// =====================================================================
// mode2_predict.js: 模式二 (性能预测) 模块
// 版本: v4.4 (M2B 增加等温效率)
// 职责: 1. 初始化 2A (热泵) 和 2B (气体) 的 UI 事件
//        2. 执行 2A 和 2B 的计算
//        3. 处理打印
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode2AResultText = null;
let lastMode2BResultText = null;

// --- 2A DOM 元素 ---
let calcButtonM2A, resultsDivM2A, calcFormM2A, printButtonM2A;
let fluidSelectM2A, fluidInfoDivM2A;
let allInputsM2A;
let enableCoolerCalcM2A, targetTempM2A;

// --- 2B DOM 元素 ---
let calcButtonM2B, resultsDivM2B, calcFormM2B, printButtonM2B;
let fluidSelectM2B, fluidInfoDivM2B;
let allInputsM2B;
let enableCoolerCalcM2B, targetTempM2B;

// =====================================================================
// 模式 2A (热泵) 专用函数
// =====================================================================

// --- 按钮状态 (2A) ---
const btnText2A = "计算性能 (模式 2A)";
const btnTextStale2A = "重新计算 (模式 2A)";
const classesFresh2A = ['bg-green-600', 'hover:bg-green-700', 'text-white'];
const classesStale2A = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

function setButtonStale2A() {
    if (calcButtonM2A.textContent !== btnTextStale2A) {
        calcButtonM2A.textContent = btnTextStale2A;
        calcButtonM2A.classList.remove(...classesFresh2A);
        calcButtonM2A.classList.add(...classesStale2A);
        printButtonM2A.disabled = true;
        lastMode2AResultText = null;
    }
}

function setButtonFresh2A() {
    calcButtonM2A.textContent = btnText2A;
    calcButtonM2A.classList.remove(...classesStale2A);
    calcButtonM2A.classList.add(...classesFresh2A);
}

/**
 * 模式 2A (热泵) 主计算函数
 */
function calculateMode2A() {
    try {
        // --- A. 获取所有输入值 ---
        const fluid = fluidSelectM2A.value;
        
        // 工况
        const Te_C = parseFloat(document.getElementById('temp_evap_m2').value);
        const Tc_C = parseFloat(document.getElementById('temp_cond_m2').value);
        const superheat_K = parseFloat(document.getElementById('superheat_m2').value);
        const subcooling_K = parseFloat(document.getElementById('subcooling_m2').value);
        
        // 压缩机
        const flow_mode = document.querySelector('input[name="flow_mode_m2"]:checked').value;
        const eta_v = parseFloat(document.getElementById('eta_v_m2').value);
        
        // 效率
        const eff_mode = document.querySelector('input[name="eff_mode_m2"]:checked').value; // 'shaft' 或 'input'
        const eta_s_input = parseFloat(document.getElementById('eta_s_m2').value); // η_s 或 η_total
        const motor_eff = parseFloat(document.getElementById('motor_eff_m2').value);
        
        // 校验 (基础)
        if (isNaN(Te_C) || isNaN(Tc_C) || isNaN(superheat_K) || isNaN(subcooling_K)) {
            throw new Error("热力学工况参数包含无效数字。");
        }
        if (isNaN(eta_v) || isNaN(eta_s_input) || eta_v <= 0 || eta_s_input <= 0) {
            throw new Error("效率参数必须是大于零的数字。");
        }
        if (eff_mode === 'input' && (isNaN(motor_eff) || motor_eff <= 0)) {
            throw new Error("当基于输入功率计算时，电机效率必须是大于零的数字。");
        }
        
        // --- B. 计算理论输气量 (V_th_m3_s) ---
        let V_th_m3_s;
        let flow_input_source = "";
        
        if (flow_mode === 'rpm') {
            const rpm = parseFloat(document.getElementById('rpm_m2').value);
            const displacement_cm3 = parseFloat(document.getElementById('displacement_m2').value);
            if (isNaN(rpm) || isNaN(displacement_cm3) || rpm <= 0 || displacement_cm3 <= 0) {
                throw new Error("转速或排量必须是大于零的数字。");
            }
            // (v4.3 修复) V_th = RPM * (cm³/1e6) / 60
            V_th_m3_s = rpm * (displacement_cm3 / 1e6) / 60.0;
            flow_input_source = `(RPM: ${rpm}, Disp: ${displacement_cm3} cm³)`;
        } else { // 'vol'
            const flow_m3h = parseFloat(document.getElementById('flow_m3h_m2').value);
            if (isNaN(flow_m3h) || flow_m3h <= 0) {
                throw new Error("理论体积流量必须是大于零的数字。");
            }
            V_th_m3_s = flow_m3h / 3600.0;
            flow_input_source = `(Flow: ${flow_m3h} m³/h)`;
        }

        // --- C. 计算热力学状态点 ---
        
        // 状态点 (饱和)
        const T_evap_K = Te_C + 273.15;
        const T_cond_K = Tc_C + 273.15;
        const Pe_Pa = CP_INSTANCE.PropsSI('P', 'T', T_evap_K, 'Q', 1, fluid);
        const Pc_Pa = CP_INSTANCE.PropsSI('P', 'T', T_cond_K, 'Q', 1, fluid);

        if (Pc_Pa <= Pe_Pa) {
            throw new Error("冷凝压力必须高于蒸发压力。");
        }

        // 状态 1 (吸气口)
        const T_1_K = T_evap_K + superheat_K;
        const h_1 = CP_INSTANCE.PropsSI('H', 'T', T_1_K, 'P', Pe_Pa, fluid);
        const s_1 = CP_INSTANCE.PropsSI('S', 'T', T_1_K, 'P', Pe_Pa, fluid);
        const rho_1 = CP_INSTANCE.PropsSI('D', 'T', T_1_K, 'P', Pe_Pa, fluid); // 吸气密度

        // 状态 2s (等熵出口)
        const h_2s = CP_INSTANCE.PropsSI('H', 'P', Pc_Pa, 'S', s_1, fluid);
        const T_2s_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'S', s_1, fluid);
        
        // 状态 3 (节流阀前)
        const T_3_K = T_cond_K - subcooling_K;
        const h_3 = CP_INSTANCE.PropsSI('H', 'T', T_3_K, 'P', Pc_Pa, fluid);
        
        // 状态 4 (蒸发器入口)
        const h_4 = h_3;

        // --- D. 计算流量 (m_dot_act) ---
        const V_act_m3_s = V_th_m3_s * eta_v;
        const m_dot_act = V_act_m3_s * rho_1;

        // --- E. 计算功率 (W_shaft_W, W_input_W) ---
        const Ws_W = m_dot_act * (h_2s - h_1); // 理论等熵功率
        
        let W_shaft_W, W_input_W;
        let eta_s_shaft, eta_s_total;
        let eff_mode_desc = "";

        if (eff_mode === 'shaft') {
            eta_s_shaft = eta_s_input; // 输入的是 η_s (轴)
            W_shaft_W = Ws_W / eta_s_shaft;
            
            // 如果轴功率模式下电机效率无效 (v4.2 修正: 即使轴功率模式, 也读取电机效率用于计算)
            if (isNaN(motor_eff) || motor_eff <= 0) {
                 throw new Error("电机效率必须是大于零的数字。");
            }
            W_input_W = W_shaft_W / motor_eff;
            eta_s_total = Ws_W / W_input_W; // 反算 η_total
            
            eff_mode_desc = `效率基准: 轴功率 (η_s = ${eta_s_shaft.toFixed(4)})`;

        } else { // 'input'
            eta_s_total = eta_s_input; // 输入的是 η_total (总)
            W_input_W = Ws_W / eta_s_total;
            
            if (isNaN(motor_eff) || motor_eff <= 0) {
                 throw new Error("当基于输入功率计算时，电机效率必须是大于零的数字。");
            }
            W_shaft_W = W_input_W * motor_eff;
            eta_s_shaft = Ws_W / W_shaft_W; // 反算 η_s
            
            eff_mode_desc = `效率基准: 输入功率 (η_total = ${eta_s_total.toFixed(4)})`;
        }

        // --- F. 计算实际出口 (State 2a) 和容量 ---
        const h_2a = h_1 + (W_shaft_W / m_dot_act);
        const T_2a_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'H', h_2a, fluid);
        
        const Q_evap_W = m_dot_act * (h_1 - h_4); // 制冷量
        const Q_cond_W = m_dot_act * (h_2a - h_3); // 制热量 (冷凝器)
        // const Q_discharge_W = m_dot_act * (h_2a - h_1) + Q_evap_W; // 这个算法不严谨
        const Q_discharge_W = W_shaft_W + Q_evap_W; // 能量平衡法: 制热量 = 轴功 + 制冷量
        
        // --- G. 计算 COP ---
        const COP_R = Q_evap_W / W_input_W;
        const COP_H = Q_discharge_W / W_input_W; // (使用总制热量 Q_discharge_W)

        // --- H. 可选: 计算后冷却器 ---
        let cooler_output = "";
        if (enableCoolerCalcM2A.checked) {
            const target_temp_C = parseFloat(targetTempM2A.value);
            if (isNaN(target_temp_C)) {
                cooler_output = "\n--- 后冷却器 (Desuperheater) ---\n错误: 目标冷却后温度无效。";
            } else {
                const target_temp_K = target_temp_C + 273.15;
                if (target_temp_K >= T_2a_K) {
                    cooler_output = `\n--- 后冷却器 (Desuperheater) ---\n错误: 目标温度 (${target_temp_C.toFixed(2)} °C) 必须低于实际排气温度 (${(T_2a_K - 273.15).toFixed(2)} °C)。`;
                } else {
                    const h_cooler_out = CP_INSTANCE.PropsSI('H', 'T', target_temp_K, 'P', Pc_Pa, fluid);
                    const Q_cooler_W = m_dot_act * (h_2a - h_cooler_out);
                    
                    // 冷却后, 进入冷凝器的热量
                    const Q_cond_remaining_W = m_dot_act * (h_cooler_out - h_3); 
                    
                    cooler_output = `\n--- 后冷却器 (Desuperheater) ---
后冷器负荷 (Q_cooler):   ${(Q_cooler_W / 1000).toFixed(3)} kW
  (备注: T_2a ${(T_2a_K - 273.15).toFixed(2)} °C -> T_target ${target_temp_C.toFixed(2)} °C)
剩余冷凝负荷 (Q_cond): ${(Q_cond_remaining_W / 1000).toFixed(3)} kW
总排热负荷 (Q_total):    ${((Q_cooler_W + Q_cond_remaining_W) / 1000).toFixed(3)} kW
  (备注: Q_total 应等于 Q_discharge)`;
                }
            }
        }

        // --- I. 格式化输出 ---
        let output = `
--- 压缩机规格 ---
工质: ${fluid}
理论输气量 (V_th): ${V_th_m3_s.toFixed(6)} m³/s (${(V_th_m3_s * 3600).toFixed(3)} m³/h)
  (来源: ${flow_input_source})
实际吸气量 (V_act): ${V_act_m3_s.toFixed(6)} m³/s (V_th * η_v)
实际质量流量 (m_dot): ${m_dot_act.toFixed(5)} kg/s

--- 热力学状态点 ---
蒸发 (Evap):   Te = ${Te_C.toFixed(2)} °C, Pe = ${(Pe_Pa / 1e5).toFixed(3)} bar
冷凝 (Cond):   Tc = ${Tc_C.toFixed(2)} °C, Pc = ${(Pc_Pa / 1e5).toFixed(3)} bar
1. 吸气 (Inlet):   T1 = ${(T_1_K - 273.15).toFixed(2)} °C (过热 ${superheat_K} K), h1 = ${(h_1 / 1000).toFixed(2)} kJ/kg, s1 = ${(s_1 / 1000).toFixed(4)} kJ/kg·K
2s. 等熵出口: T2s = ${(T_2s_K - 273.15).toFixed(2)} °C, h2s = ${(h_2s / 1000).toFixed(2)} kJ/kg
2a. 实际出口: T2a = ${(T_2a_K - 273.15).toFixed(2)} °C, h2a = ${(h_2a / 1000).toFixed(2)} kJ/kg
3. 节流阀前: T3 = ${(T_3_K - 273.15).toFixed(2)} °C (过冷 ${subcooling_K} K), h3 = ${(h_3 / 1000).toFixed(2)} kJ/kg
4. 节流阀后: h4 = h3 = ${(h_4 / 1000).toFixed(2)} kJ/kg

--- 功率 (Power) ---
理论等熵功率 (Ws):   ${(Ws_W / 1000).toFixed(3)} kW (m_dot * (h2s - h1))
实际轴功率 (W_shaft): ${(W_shaft_W / 1000).toFixed(3)} kW
电机输入功率 (W_input): ${(W_input_W / 1000).toFixed(3)} kW

--- 效率 (Efficiency) ---
${eff_mode_desc}
(反算) 等熵效率 (η_s, 轴): ${eta_s_shaft.toFixed(4)}  (Ws / W_shaft)
(反算) 总等熵效率 (η_total): ${eta_s_total.toFixed(4)}  (Ws / W_input)
容积效率 (η_v): ${eta_v.toFixed(4)}
电机效率 (η_motor): ${eff_mode === 'shaft' ? motor_eff.toFixed(4) + ' (输入值)' : (motor_eff.toFixed(4))}

========================================
           性能预测结果
========================================
制冷量 (Q_evap):     ${(Q_evap_W / 1000).toFixed(3)} kW
总制热量 (Q_discharge): ${(Q_discharge_W / 1000).toFixed(3)} kW
  (备注: Q_discharge = W_shaft + Q_evap)
冷凝器热量 (Q_cond):   ${(Q_cond_W / 1000).toFixed(3)} kW
  (备注: Q_cond = m_dot * (h2a - h3))

--- 性能系数 (COP) ---
COP (制冷, COP_R):   ${COP_R.toFixed(3)} (Q_evap / W_input)
COP (制热, COP_H):   ${COP_H.toFixed(3)} (Q_discharge / W_input)
${cooler_output}
`;

        resultsDivM2A.textContent = output;
        lastMode2AResultText = output;
        setButtonFresh2A();
        printButtonM2A.disabled = false;

    } catch (error) {
        resultsDivM2A.textContent = `计算出错 (2A): ${error.message}\n\n请检查输入参数是否在工质的有效范围内。`;
        console.error("Mode 2A Error:", error);
        lastMode2AResultText = null;
        printButtonM2A.disabled = true;
    }
}

/**
 * 模式 2A (热泵) 打印报告
 */
function printReportMode2A() {
    if (!lastMode2AResultText) {
        alert("没有可打印的结果 (2A)。");
        return;
    }

    const inputs = {
        "报告类型": `模式 2A: 性能预测 (制冷热泵)`,
        "工质": document.getElementById('fluid_m2').value,
        "理论输气量模式": document.querySelector('input[name="flow_mode_m2"]:checked').value === 'rpm' ? '按转速与排量' : '按体积流量',
        "转速 (RPM)": document.getElementById('rpm_m2').value,
        "排量 (cm³/rev)": document.getElementById('displacement_m2').value,
        "理论体积流量 (m³/h)": document.getElementById('flow_m3h_m2').value,
        "蒸发温度 (°C)": document.getElementById('temp_evap_m2').value,
        "冷凝温度 (°C)": document.getElementById('temp_cond_m2').value,
        "有效过热度 (K)": document.getElementById('superheat_m2').value,
        "过冷度 (K)": document.getElementById('subcooling_m2').value,
        "效率基准": document.querySelector('input[name="eff_mode_m2"]:checked').value === 'shaft' ? '基于轴功率 (η_s)' : '基于输入功率 (η_total)',
        "等熵/总效率 (η_s / η_total)": document.getElementById('eta_s_m2').value,
        "容积效率 (η_v)": document.getElementById('eta_v_m2').value,
        "电机效率": document.getElementById('motor_eff_m2').value,
        "计算后冷却器": document.getElementById('enable_cooler_calc_m2').checked ? '是' : '否',
        "目标冷却后温度 (°C)": document.getElementById('target_temp_m2').value,
    };
    
    callPrint(inputs, lastMode2AResultText, "模式 2A");
}


// =====================================================================
// 模式 2B (气体压缩) 专用函数
// =====================================================================

// --- 按钮状态 (2B) ---
const btnText2B = "计算性能 (模式 2B)";
const btnTextStale2B = "重新计算 (模式 2B)";
const classesFresh2B = ['bg-indigo-600', 'hover:bg-indigo-700', 'text-white'];
const classesStale2B = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

function setButtonStale2B() {
    if (calcButtonM2B.textContent !== btnTextStale2B) {
        calcButtonM2B.textContent = btnTextStale2B;
        calcButtonM2B.classList.remove(...classesFresh2B);
        calcButtonM2B.classList.add(...classesStale2B);
        printButtonM2B.disabled = true;
        lastMode2BResultText = null;
    }
}

function setButtonFresh2B() {
    calcButtonM2B.textContent = btnText2B;
    calcButtonM2B.classList.remove(...classesStale2B);
    calcButtonM2B.classList.add(...classesFresh2B);
}

/**
 * 模式 2B (气体压缩) 主计算函数
 */
function calculateMode2B() {
    try {
        // --- A. 获取所有输入值 ---
        const fluid = fluidSelectM2B.value;
        
        // 工况
        const Pe_bar = parseFloat(document.getElementById('press_in_m2b').value);
        const Te_C = parseFloat(document.getElementById('temp_in_m2b').value);
        const Pc_bar = parseFloat(document.getElementById('press_out_m2b').value);
        
        // 压缩机
        const flow_mode = document.querySelector('input[name="flow_mode_m2b"]:checked').value;
        const eta_v = parseFloat(document.getElementById('eta_v_m2b').value);
        
        // 效率
        const eff_mode = document.querySelector('input[name="eff_mode_m2b"]:checked').value; // 'shaft' 或 'input'
        const eta_s_input = parseFloat(document.getElementById('eta_s_m2b').value); // η_s 或 η_total
        const motor_eff = parseFloat(document.getElementById('motor_eff_m2b').value);
        
        // 校验 (基础)
        if (isNaN(Pe_bar) || isNaN(Pc_bar) || isNaN(Te_C) || Pe_bar <= 0 || Pc_bar <= 0) {
            throw new Error("压力或温度参数包含无效数字。");
        }
        if (Pc_bar <= Pe_bar) {
            throw new Error("排气压力必须高于吸气压力。");
        }
        if (isNaN(eta_v) || isNaN(eta_s_input) || eta_v <= 0 || eta_s_input <= 0) {
            throw new Error("效率参数必须是大于零的数字。");
        }
        if (eff_mode === 'input' && (isNaN(motor_eff) || motor_eff <= 0)) {
            throw new Error("当基于输入功率计算时，电机效率必须是大于零的数字。");
        }

        // --- B. 计算理论输气量 (V_th_m3_s) ---
        let V_th_m3_s;
        let flow_input_source = "";
        
        if (flow_mode === 'rpm') {
            const rpm = parseFloat(document.getElementById('rpm_m2b').value);
            const displacement_cm3 = parseFloat(document.getElementById('displacement_m2b').value);
            if (isNaN(rpm) || isNaN(displacement_cm3) || rpm <= 0 || displacement_cm3 <= 0) {
                throw new Error("转速或排量必须是大于零的数字。");
            }
            // (v4.3 修复) V_th = RPM * (cm³/1e6) / 60
            V_th_m3_s = rpm * (displacement_cm3 / 1e6) / 60.0;
            flow_input_source = `(RPM: ${rpm}, Disp: ${displacement_cm3} cm³)`;
        } else { // 'vol'
            const flow_m3h = parseFloat(document.getElementById('flow_m3h_m2b').value);
            if (isNaN(flow_m3h) || flow_m3h <= 0) {
                throw new Error("理论体积流量必须是大于零的数字。");
            }
            V_th_m3_s = flow_m3h / 3600.0;
            flow_input_source = `(Flow: ${flow_m3h} m³/h)`;
        }

        // --- C. 计算热力学状态点 ---
        const Pe_Pa = Pe_bar * 1e5;
        const Pc_Pa = Pc_bar * 1e5;
        const T_1_K = Te_C + 273.15;

        // 状态 1 (吸气口)
        const h_1 = CP_INSTANCE.PropsSI('H', 'T', T_1_K, 'P', Pe_Pa, fluid);
        const s_1 = CP_INSTANCE.PropsSI('S', 'T', T_1_K, 'P', Pe_Pa, fluid);
        const rho_1 = CP_INSTANCE.PropsSI('D', 'T', T_1_K, 'P', Pe_Pa, fluid); // 吸气密度

        // 状态 2s (等熵出口)
        const h_2s = CP_INSTANCE.PropsSI('H', 'P', Pc_Pa, 'S', s_1, fluid);
        const T_2s_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'S', s_1, fluid);
        
        // --- D. 计算流量 (m_dot_act) ---
        const V_act_m3_s = V_th_m3_s * eta_v;
        const m_dot_act = V_act_m3_s * rho_1;

        // --- E. 计算功率 (W_shaft_W, W_input_W) ---
        const Ws_W = m_dot_act * (h_2s - h_1); // 理论等熵功率
        
        let W_shaft_W, W_input_W;
        let eta_s_shaft, eta_s_total;
        let eff_mode_desc = "";

        if (eff_mode === 'shaft') {
            eta_s_shaft = eta_s_input; // 输入的是 η_s (轴)
            W_shaft_W = Ws_W / eta_s_shaft;
            
            if (isNaN(motor_eff) || motor_eff <= 0) {
                 throw new Error("电机效率必须是大于零的数字。");
            }
            W_input_W = W_shaft_W / motor_eff;
            eta_s_total = Ws_W / W_input_W; // 反算 η_total
            
            eff_mode_desc = `效率基准: 轴功率 (η_s = ${eta_s_shaft.toFixed(4)})`;

        } else { // 'input'
            eta_s_total = eta_s_input; // 输入的是 η_total (总)
            W_input_W = Ws_W / eta_s_total;
            
            if (isNaN(motor_eff) || motor_eff <= 0) {
                 throw new Error("当基于输入功率计算时，电机效率必须是大于零的数字。");
            }
            W_shaft_W = W_input_W * motor_eff;
            eta_s_shaft = Ws_W / W_shaft_W; // 反算 η_s
            
            eff_mode_desc = `效率基准: 输入功率 (η_total = ${eta_s_total.toFixed(4)})`;
        }

        // --- F. 计算实际出口 (State 2a) 和排热量 ---
        const h_2a = h_1 + (W_shaft_W / m_dot_act);
        const T_2a_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'H', h_2a, fluid);
        
        const Q_discharge_W = m_dot_act * (h_2a - h_1); // 压缩总排热
        
        // --- (v4.4) G. 计算等温功率和效率 ---
        let W_iso_W, eta_iso_shaft, eta_iso_total;
        try {
            // R_specific = R_universal / MolarMass
            const R_gas = CP_INSTANCE.PropsSI('GAS_CONSTANT', '', 0, '', 0, fluid) / CP_INSTANCE.PropsSI('MOLAR_MASS', '', 0, '', 0, fluid);
            
            // W_iso = m_dot * R_specific * T1 * ln(P2/P1)
            W_iso_W = m_dot_act * R_gas * T_1_K * Math.log(Pc_Pa / Pe_Pa);
            
            eta_iso_shaft = W_iso_W / W_shaft_W;
            eta_iso_total = W_iso_W / W_input_W;

        } catch (isoErr) {
            // R_gas 或 Molar Mass 可能失败 (例如某些工质没有定义)
            console.warn("Isothermal calculation failed: ", isoErr);
            W_iso_W = NaN;
            eta_iso_shaft = NaN;
            eta_iso_total = NaN;
        }


        // --- H. 可选: 计算后冷却器 ---
        let cooler_output = "";
        if (enableCoolerCalcM2B.checked) {
            const target_temp_C = parseFloat(targetTempM2B.value);
            if (isNaN(target_temp_C)) {
                cooler_output = "\n--- 后冷却器 (Aftercooler) ---\n错误: 目标冷却后温度无效。";
            } else {
                const target_temp_K = target_temp_C + 273.15;
                if (target_temp_K >= T_2a_K) {
                    cooler_output = `\n--- 后冷却器 (Aftercooler) ---\n错误: 目标温度 (${target_temp_C.toFixed(2)} °C) 必须低于实际排气温度 (${(T_2a_K - 273.15).toFixed(2)} °C)。`;
                } else {
                    const h_cooler_out = CP_INSTANCE.PropsSI('H', 'T', target_temp_K, 'P', Pc_Pa, fluid);
                    const Q_cooler_W = m_dot_act * (h_2a - h_cooler_out);
                    
                    cooler_output = `\n--- 后冷却器 (Aftercooler) ---
后冷器负荷 (Q_cooler):   ${(Q_cooler_W / 1000).toFixed(3)} kW
  (备注: T_2a ${(T_2a_K - 273.15).toFixed(2)} °C -> T_target ${target_temp_C.toFixed(2)} °C)`;
                }
            }
        }

        // --- I. 格式化输出 (v4.4 修改) ---
        let output = `
--- 压缩机规格 ---
工质: ${fluid}
理论输气量 (V_th): ${V_th_m3_s.toFixed(6)} m³/s (${(V_th_m3_s * 3600).toFixed(3)} m³/h)
  (来源: ${flow_input_source})
实际吸气量 (V_act): ${V_act_m3_s.toFixed(6)} m³/s (V_th * η_v)
实际质量流量 (m_dot): ${m_dot_act.toFixed(5)} kg/s

--- 热力学状态点 ---
1. 吸气 (Inlet):   T1 = ${Te_C.toFixed(2)} °C, P1 = ${Pe_bar.toFixed(3)} bar
2s. 等熵出口: T2s = ${(T_2s_K - 273.15).toFixed(2)} °C, P2 = ${Pc_bar.toFixed(3)} bar
2a. 实际出口: T2a = ${(T_2a_K - 273.15).toFixed(2)} °C, P2 = ${Pc_bar.toFixed(3)} bar
(h1: ${(h_1 / 1000).toFixed(2)} kJ/kg, h2s: ${(h_2s / 1000).toFixed(2)} kJ/kg, h2a: ${(h_2a / 1000).toFixed(2)} kJ/kg)

--- 功率 (Power) ---
理论等熵功率 (Ws):   ${(Ws_W / 1000).toFixed(3)} kW
理论等温功率 (W_iso): ${isNaN(W_iso_W) ? 'N/A' : (W_iso_W / 1000).toFixed(3)} kW
实际轴功率 (W_shaft): ${(W_shaft_W / 1000).toFixed(3)} kW
电机输入功率 (W_input): ${(W_input_W / 1000).toFixed(3)} kW

--- 效率 (Efficiency) ---
${eff_mode_desc}
(反算) 等熵效率 (η_s, 轴): ${eta_s_shaft.toFixed(4)}  (Ws / W_shaft)
(反算) 总等熵效率 (η_total): ${eta_s_total.toFixed(4)}  (Ws / W_input)
容积效率 (η_v): ${eta_v.toFixed(4)}
电机效率 (η_motor): ${eff_mode === 'shaft' ? motor_eff.toFixed(4) + ' (输入值)' : (motor_eff.toFixed(4))}
---
等温效率 (η_iso, 轴): ${isNaN(eta_iso_shaft) ? 'N/A' : (eta_iso_shaft).toFixed(4)}  (W_iso / W_shaft)
等温效率 (η_iso, 总): ${isNaN(eta_iso_total) ? 'N/A' : (eta_iso_total).toFixed(4)}  (W_iso / W_input)

========================================
           性能预测结果
========================================
总排热量 (Q_discharge): ${(Q_discharge_W / 1000).toFixed(3)} kW
  (备注: Q_discharge = m_dot * (h2a - h1))
${cooler_output}
`;

        resultsDivM2B.textContent = output;
        lastMode2BResultText = output;
        setButtonFresh2B();
        printButtonM2B.disabled = false;

    } catch (error) {
        resultsDivM2B.textContent = `计算出错 (2B): ${error.message}\n\n请检查输入参数是否在工质的有效范围内。`;
        console.error("Mode 2B Error:", error);
        lastMode2BResultText = null;
        printButtonM2B.disabled = true;
    }
}

/**
 * 模式 2B (气体压缩) 打印报告
 */
function printReportMode2B() {
    if (!lastMode2BResultText) {
        alert("没有可打印的结果 (2B)。");
        return;
    }
    
    const inputs = {
        "报告类型": `模式 2B: 性能预测 (气体压缩)`,
        "工质": document.getElementById('fluid_m2b').value,
        "理论输气量模式": document.querySelector('input[name="flow_mode_m2b"]:checked').value === 'rpm' ? '按转速与排量' : '按体积流量',
        "转速 (RPM)": document.getElementById('rpm_m2b').value,
        "排量 (cm³/rev)": document.getElementById('displacement_m2b').value,
        "理论体积流量 (m³/h)": document.getElementById('flow_m3h_m2b').value,
        "吸气压力 (bar)": document.getElementById('press_in_m2b').value,
        "吸气温度 (°C)": document.getElementById('temp_in_m2b').value,
        "排气压力 (bar)": document.getElementById('press_out_m2b').value,
        "效率基准": document.querySelector('input[name="eff_mode_m2b"]:checked').value === 'shaft' ? '基于轴功率 (η_s)' : '基于输入功率 (η_total)',
        "等熵/总效率 (η_s / η_total)": document.getElementById('eta_s_m2b').value,
        "容积效率 (η_v)": document.getElementById('eta_v_m2b').value,
        "电机效率": document.getElementById('motor_eff_m2b').value,
        "计算后冷却器": document.getElementById('enable_cooler_calc_m2b').checked ? '是' : '否',
        "目标冷却后温度 (°C)": document.getElementById('target_temp_m2b').value,
    };
    
    callPrint(inputs, lastMode2BResultText, "模式 2B");
}

// =====================================================================
// 通用函数 (打印)
// =====================================================================

/**
 * 打印报告的核心函数
 * @param {object} inputs - 输入参数的对象
 * @param {string} resultText - 结果 <pre> 文本
 * @param {string} modeTitle - 模式标题 (e.g., "模式 2A")
 */
function callPrint(inputs, resultText, modeTitle) {
    let printContainer = document.getElementById('print-container');
    if (printContainer) {
        printContainer.remove();
    }
    printContainer = document.createElement('div');
    printContainer.id = 'print-container';

    let printHtml = `
        <h1>压缩机性能计算报告</h1>
        <p>计算时间: ${new Date().toLocaleString('zh-CN')}</p>
        <h2>1. 输入参数 (${modeTitle})</h2>
        <table class="print-table">
            ${Object.entries(inputs).map(([key, value]) => `
                <tr>
                    <th>${key}</th>
                    <td>${value}</td>
                </tr>
            `).join('')}
        </table>
        <h2>2. 计算结果 (${modeTitle})</h2>
        <pre class="print-results">${resultText}</pre>
        <h3>--- 报告结束 (编者: 荆炎荣) ---</h3>
    `;

    printContainer.innerHTML = printHtml;
    document.body.appendChild(printContainer);
    window.print();
    setTimeout(() => {
        if (document.body.contains(printContainer)) {
            document.body.removeChild(printContainer);
        }
    }, 500);
}


// =====================================================================
// 模块初始化 (由 main.js 调用)
// =====================================================================

/**
 * (v4.2) 模式二：初始化函数
 * @param {object} CP - CoolProp 实例
 */
export function initMode2(CP) {
    CP_INSTANCE = CP; // 将 CP 实例存储在模块作用域
    
    // --- 初始化 2A (热泵) ---
    calcButtonM2A = document.getElementById('calc-button-mode-2');
    resultsDivM2A = document.getElementById('results-mode-2');
    calcFormM2A = document.getElementById('calc-form-mode-2');
    printButtonM2A = document.getElementById('print-button-mode-2');
    fluidSelectM2A = document.getElementById('fluid_m2');
    fluidInfoDivM2A = document.getElementById('fluid-info-m2');
    enableCoolerCalcM2A = document.getElementById('enable_cooler_calc_m2');
    targetTempM2A = document.getElementById('target_temp_m2');

    if (calcFormM2A) {
        allInputsM2A = calcFormM2A.querySelectorAll('input, select');
        
        // 绑定计算事件 (2A)
        calcFormM2A.addEventListener('submit', (event) => {
            event.preventDefault();
            calculateMode2A();
        });

        // 绑定“脏”状态检查 (2A)
        allInputsM2A.forEach(input => {
            input.addEventListener('input', setButtonStale2A);
            input.addEventListener('change', setButtonStale2A);
        });
        // (v4.3 修复) 确保 M1 传输后, M2A 按钮变脏
        calcButtonM2A.addEventListener('stale', setButtonStale2A);


        // 绑定流体信息更新 (2A)
        fluidSelectM2A.addEventListener('change', () => {
            updateFluidInfo(fluidSelectM2A, fluidInfoDivM2A, CP_INSTANCE);
        });

        // 绑定打印按钮 (2A)
        printButtonM2A.addEventListener('click', printReportMode2A);
    }
    
    
    // --- 初始化 2B (气体压缩) ---
    calcButtonM2B = document.getElementById('calc-button-mode-2b');
    resultsDivM2B = document.getElementById('results-mode-2b');
    calcFormM2B = document.getElementById('calc-form-mode-2b');
    printButtonM2B = document.getElementById('print-button-mode-2b');
    fluidSelectM2B = document.getElementById('fluid_m2b');
    fluidInfoDivM2B = document.getElementById('fluid-info-m2b');
    enableCoolerCalcM2B = document.getElementById('enable_cooler_calc_m2b');
    targetTempM2B = document.getElementById('target_temp_m2b');

    if (calcFormM2B) {
        allInputsM2B = calcFormM2B.querySelectorAll('input, select');
        
        // 绑定计算事件 (2B)
        calcFormM2B.addEventListener('submit', (event) => {
            event.preventDefault();
            calculateMode2B();
        });

        // 绑定“脏”状态检查 (2B)
        allInputsM2B.forEach(input => {
            input.addEventListener('input', setButtonStale2B);
            input.addEventListener('change', setButtonStale2B);
        });
        calcButtonM2B.addEventListener('stale', setButtonStale2B);

        // 绑定流体信息更新 (2B)
        fluidSelectM2B.addEventListener('change', () => {
            updateFluidInfo(fluidSelectM2B, fluidInfoDivM2B, CP_INSTANCE);
        });

        // 绑定打印按钮 (2B)
        printButtonM2B.addEventListener('click', printReportMode2B);
    }
    
    console.log("模式二 (v4.4 预测: 2A & 2B) 已初始化。");
}