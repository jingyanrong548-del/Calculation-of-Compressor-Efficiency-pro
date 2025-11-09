// =====================================================================
// mode2_predict.js: 模式二 (性能预测) 模块
// 版本: v4.3 (RPM 逻辑修复)
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
    calcButtonM2A.textContent = btnTextStale2A;
    calcButtonM2A.classList.remove(...classesFresh2A);
    calcButtonM2A.classList.add(...classesStale2A);
    printButtonM2A.disabled = true;
    lastMode2AResultText = null;
}

function setButtonFresh2A() {
    calcButtonM2A.textContent = btnText2A;
    calcButtonM2A.classList.remove(...classesStale2A);
    calcButtonM2A.classList.add(...classesFresh2A);
}

/**
 * 模式 2A (热泵)：主计算函数
 */
function calculateMode2A() {
    try {
        // --- A. 获取所有输入值 (2A) ---
        const fluid = fluidSelectM2A.value;
        const flow_mode = document.querySelector('input[name="flow_mode_m2"]:checked').value;
        const eff_mode = document.querySelector('input[name="eff_mode_m2"]:checked').value;
        
        // v4.3 修复: 仅在 'rpm' 模式下读取 rpm
        let rpm_val = NaN;
        if (flow_mode === 'rpm') {
             rpm_val = parseFloat(document.getElementById('rpm_m2').value);
        }
        
        const eta_s_input = parseFloat(document.getElementById('eta_s_m2').value);
        const eta_v_input = parseFloat(document.getElementById('eta_v_m2').value);
        const motor_eff_val = parseFloat(document.getElementById('motor_eff_m2').value);
        const Te_C = parseFloat(document.getElementById('temp_evap_m2').value);
        const Tc_C = parseFloat(document.getElementById('temp_cond_m2').value);
        const dT_sh_K = parseFloat(document.getElementById('superheat_m2').value);
        const dT_sc_K = parseFloat(document.getElementById('subcooling_m2').value);
        
        // v4.3 修复: 更新 NaN 检查
        if (isNaN(eta_s_input) || isNaN(eta_v_input) || isNaN(Te_C) || isNaN(Tc_C) || isNaN(dT_sh_K) || isNaN(dT_sc_K)) {
            throw new Error("输入包含无效数字，请检查所有字段。");
        }
        if (flow_mode === 'rpm' && isNaN(rpm_val)) {
             throw new Error("在'按转速'模式下，必须提供有效的转速。");
        }
        if (eff_mode === 'input' && isNaN(motor_eff_val)) {
            throw new Error("在'基于输入功率'模式下，必须提供有效的电机效率。");
        }

        // --- B. 单位转换 ---
        const Te_K = Te_C + 273.15;
        const Tc_K = Tc_C + 273.15;

        // --- C. 理论体积流量 (m³/s) ---
        let V_th_m3_s;
        let V_rev_cm3_val = NaN, V_th_m3_h_val = NaN;
        if (flow_mode === 'rpm') {
            V_rev_cm3_val = parseFloat(document.getElementById('displacement_m2').value);
            if (isNaN(V_rev_cm3_val)) throw new Error("请检查每转排量输入。");
            if (rpm_val <= 0) throw new Error("转速必须大于 0。");
            V_th_m3_s = (V_rev_cm3_val / 1e6) * (rpm_val / 60);
            V_th_m3_h_val = V_th_m3_s * 3600;
        } else {
            // 'vol' 模式
            V_th_m3_h_val = parseFloat(document.getElementById('flow_m3h_m2').value);
            if (isNaN(V_th_m3_h_val)) throw new Error("请检查体积流量输入。");
            V_th_m3_s = V_th_m3_h_val / 3600;
            // v4.3 修复: rpm_val 和 V_rev_cm3_val 此时为 NaN, 跳过无效计算
        }
        if (V_th_m3_s <= 0) throw new Error("理论排量必须大于零。");

        // --- D. 计算状态点 (1, 3, 4) ---
        const Pe_Pa = CP_INSTANCE.PropsSI('P', 'T', Te_K, 'Q', 1, fluid);
        const T1_K = Te_K + dT_sh_K;
        const h1_J_kg = CP_INSTANCE.PropsSI('H', 'T', T1_K, 'P', Pe_Pa, fluid);
        const s1_J_kgK = CP_INSTANCE.PropsSI('S', 'T', T1_K, 'P', Pe_Pa, fluid);
        const rho1_kg_m3 = CP_INSTANCE.PropsSI('D', 'T', T1_K, 'P', Pe_Pa, fluid);
        const v1_m3_kg = 1 / rho1_kg_m3;
        const Pc_Pa = CP_INSTANCE.PropsSI('P', 'T', Tc_K, 'Q', 0, fluid);
        const T3_K = Tc_K - dT_sc_K;
        const h3_J_kg = CP_INSTANCE.PropsSI('H', 'T', T3_K, 'P', Pc_Pa, fluid);
        const h4_J_kg = h3_J_kg;

        // --- E. 计算理论比焓 (和 T2s) ---
        const h_evap_J_kg = h1_J_kg - h4_J_kg;
        if (h_evap_J_kg <= 0) throw new Error("计算出错：制冷焓差小于等于零。");
        let h_isen_J_kg, h2s_J_kg, T2s_K, T2s_C;
        let isentropic_error_msg = null;
        try {
            h2s_J_kg = CP_INSTANCE.PropsSI('H', 'P', Pc_Pa, 'S', s1_J_kgK, fluid);
            T2s_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'S', s1_J_kgK, fluid);
            T2s_C = T2s_K - 273.15;
            h_isen_J_kg = h2s_J_kg - h1_J_kg;
            if (h_isen_J_kg <= 0) throw new Error("理论等熵焓升小于等于零, 工况错误。");
        } catch (isen_error) {
            console.error("Isentropic calculation failed (Mode 2A):", isen_error);
            isentropic_error_msg = `计算失败 (${isen_error.message})`;
            T2s_K = NaN; T2s_C = NaN;
            throw new Error(`等熵点计算失败: ${isentropic_error_msg}`);
        }

        // --- F. 应用效率 (核心逻辑) ---
        const V_actual_m3_s = V_th_m3_s * eta_v_input;
        const m_dot_kg_s = V_actual_m3_s / v1_m3_kg;
        const Ws_W = m_dot_kg_s * h_isen_J_kg;

        // --- G. 计算实际功率 ---
        let W_shaft_W, Win_input_W = NaN;
        let eta_s_shaft = NaN, eta_s_total = NaN;
        if (eff_mode === 'input') {
            eta_s_total = eta_s_input;
            Win_input_W = Ws_W / eta_s_total;
            W_shaft_W = Win_input_W * motor_eff_val;
            eta_s_shaft = (W_shaft_W > 0) ? Ws_W / W_shaft_W : NaN;
        } else {
            eta_s_shaft = eta_s_input;
            W_shaft_W = Ws_W / eta_s_shaft;
            eta_s_total = NaN;
        }

        // --- H. 计算实际容量 ---
        const Qe_W = m_dot_kg_s * h_evap_J_kg;
        const Qh_W = Qe_W + W_shaft_W;

        // --- H.2 计算实际排气温度 T2a ---
        let T2a_K = NaN, T2a_C = NaN, h2a_J_kg = NaN;
        let actual_temp_error_msg = null;
        try {
            if (m_dot_kg_s <= 0) throw new Error("质量流量为零，无法计算。");
            h2a_J_kg = (W_shaft_W / m_dot_kg_s) + h1_J_kg;
            T2a_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'H', h2a_J_kg, fluid);
            T2a_C = T2a_K - 273.15;
        } catch (actual_temp_error) {
            console.error("Actual temp calculation failed (Mode 2A):", actual_temp_error);
            actual_temp_error_msg = `计算失败 (${actual_temp_error.message})`;
            T2a_K = NaN; T2a_C = NaN; h2a_J_kg = NaN;
        }

        // --- I. 计算 COP ---
        const COP_R = (W_shaft_W > 0) ? Qe_W / W_shaft_W : NaN;
        const COP_H = (W_shaft_W > 0) ? Qh_W / W_shaft_W : NaN;
        const EER_R = isNaN(Win_input_W) ? NaN : ((Win_input_W > 0) ? (Qe_W / Win_input_W) : NaN);
        const EER_H = isNaN(Win_input_W) ? NaN : ((Win_input_W > 0) ? (Qh_W / Win_input_W) : NaN);

        // --- J. 格式化输出 ---
        let output = `
--- 计算概览 (工质: ${fluid}) ---
蒸发压力 (Pe): ${(Pe_Pa / 1e5).toFixed(3)} bar
冷凝压力 (Pc): ${(Pc_Pa / 1e5).toFixed(3)} bar
压缩比 (PR):   ${(Pc_Pa / Pe_Pa).toFixed(2)}

--- 关键状态点 ---
状态 1 (入口):
  T1 = ${T1_K.toFixed(2)} K (${(T1_K - 273.15).toFixed(2)} °C)
  v1 = ${v1_m3_kg.toFixed(5)} m³/kg
  h1 = ${(h1_J_kg / 1000).toFixed(2)} kJ/kg
状态 3 (阀前):
  h3 = ${(h3_J_kg / 1000).toFixed(2)} kJ/kg
状态 2s (等熵出口):
  T2s = ${isNaN(T2s_C) ? 'N/A' : `${T2s_C.toFixed(2)} °C`}
  h2s = ${(h2s_J_kg / 1000).toFixed(2)} kJ/kg
状态 2a (实际出口):
  T2a = ${isNaN(T2a_C) ? `N/A (${actual_temp_error_msg})` : `${T2a_C.toFixed(2)} °C`}
  h2a = ${isNaN(h2a_J_kg) ? `N/A (${actual_temp_error_msg})` : `${(h2a_J_kg / 1000).toFixed(2)} kJ/kg`}

--- 理论流量与比焓 ---
制冷焓差:     ${(h_evap_J_kg / 1000).toFixed(2)} kJ/kg
等熵焓升:     ${(h_isen_J_kg / 1000).toFixed(2)} kJ/kg
`;
        
        // v4.3 修复: 调整输出
        let flow_output = '';
        if (flow_mode === 'rpm') {
            flow_output = `
输入排量:     ${V_rev_cm3_val.toFixed(1)} cm³/rev ( @ ${rpm_val.toFixed(0)} RPM )
理论流量(V_th): ${V_th_m3_h_val.toFixed(2)} m³/h
`;
        } else {
            flow_output = `
输入流量(V_th): ${V_th_m3_h_val.toFixed(2)} m³/h
`;
        }
        output += flow_output; // 添加条件块

output += `
--- 输入效率 ---
容积效率 (η_v):         ${(eta_v_input * 100).toFixed(2)} %
${(eff_mode === 'shaft') ? `等熵效率 (η_s):       ${(eta_s_shaft * 100).toFixed(2)} %` : `总等熵效率 (η_total):   ${(eta_s_total * 100).toFixed(2)} %`}
${(eff_mode === 'input') ? `电机效率:             ${(motor_eff_val * 100).toFixed(1)} %` : ''}
${(eff_mode === 'input') ? `(计算的 η_s):         ${isNaN(eta_s_shaft) ? 'N/A' : (eta_s_shaft * 100).toFixed(2)} %` : ''}

--- 实际流量 ---
实际体积流量 (V_act): ${(V_actual_m3_s * 3600).toFixed(2)} m³/h
实际质量流量 (m_dot): ${m_dot_kg_s.toFixed(5)} kg/s
理论等熵功率 (Ws):   ${(Ws_W / 1000).toFixed(3)} kW

========================================
           最终性能计算 (备注)
========================================
制冷量 (Qe):     ${(Qe_W / 1000).toFixed(2)} kW
制热量 (Qh):     ${(Qh_W / 1000).toFixed(2)} kW
轴功率 (W_shaft): ${(W_shaft_W / 1000).toFixed(2)} kW
${isNaN(Win_input_W) ? '' : `输入功率 (W_in):  ${(Win_input_W / 1000).toFixed(2)} kW`}

COP (制冷):      ${isNaN(COP_R) ? 'N/A' : COP_R.toFixed(3)}
  (备注: Qe / W_shaft)
COP (制热):      ${isNaN(COP_H) ? 'N/A' : COP_H.toFixed(3)}
  (备注: Qh / W_shaft)
${isNaN(EER_R) ? '' : `总 COP (制冷):   ${isNaN(EER_R) ? 'N/A' : EER_R.toFixed(3)}
  (备注: Qe / W_in)`}
${isNaN(EER_H) ? '' : `总 COP (制热):   ${isNaN(EER_H) ? 'N/A' : EER_H.toFixed(3)}
  (备注: Qh / W_in)`}
`;

        // --- K. 后冷却器计算 ---
        let coolerOutput = "";
        const enableCooler = enableCoolerCalcM2A.checked;
        
        if (enableCooler) {
            try {
                const T_target_C = parseFloat(targetTempM2A.value);
                if (isNaN(T_target_C)) {
                    throw new Error("无效的目标冷却温度。");
                }
                if (isNaN(T2a_C)) {
                    throw new Error("无法计算后冷却器，因为 T2a (实际排气温度) 计算失败。");
                }
                if (T_target_C >= T2a_C) {
                    throw new Error(`目标温度 (${T_target_C}°C) 必须低于实际排气温度 T2a (${T2a_C.toFixed(2)}°C)。`);
                }
                if (T_target_C <= Tc_C) {
                     coolerOutput += `\n(注意: 目标温度 ${T_target_C}°C 低于或等于冷凝温度 ${Tc_C}°C，已进入冷凝区)\n`;
                }

                const T_target_K = T_target_C + 273.15;
                const h_target_J_kg = CP_INSTANCE.PropsSI('H', 'T', T_target_K, 'P', Pc_Pa, fluid);
                const Q_cooler_W = m_dot_kg_s * (h2a_J_kg - h_target_J_kg);
                const Q_cooler_kW = Q_cooler_W / 1000;

                coolerOutput += `
========================================
           后冷却器负荷 (Q_cooler)
========================================
原始实际排气 (T2a):  ${T2a_C.toFixed(2)} °C (h2a: ${(h2a_J_kg/1000).toFixed(2)} kJ/kg)
目标冷却后温度 (T2c):  ${T_target_C.toFixed(2)} °C (h2c: ${(h_target_J_kg/1000).toFixed(2)} kJ/kg)

计算后冷却器负荷:  ${Q_cooler_kW.toFixed(3)} kW
  (备注: m_dot * (h2a - h2c))
`;
            } catch (coolerError) {
                coolerOutput = `
========================================
           后冷却器负荷 (Q_cooler)
========================================
计算失败: ${coolerError.message}
`;
            }
        }
        
        // --- L. 组合最终输出 ---
        resultsDivM2A.textContent = output + coolerOutput;
        lastMode2AResultText = output + coolerOutput; // 存储纯文本

        setButtonFresh2A();
        printButtonM2A.disabled = false;

    } catch (error) {
        resultsDivM2A.textContent = `计算出错 (2A): ${error.message}\n\n请检查输入参数是否在工质的有效范围内。`;
        console.error(error);
        lastMode2AResultText = null;
        printButtonM2A.disabled = true;
    }
}

/**
 * 准备模式 2A 的打印报告
 */
function printReportMode2A() {
    if (!lastMode2AResultText) {
        alert("没有可打印的结果。");
        return;
    }
    
    const flow_mode_val = document.querySelector('input[name="flow_mode_m2"]:checked').value;
    
    const inputs = {
        "报告类型": "模式 2A: 性能预测 (制冷热泵)",
        "制冷剂": fluidSelectM2A.value,
        "理论输气量模式": flow_mode_val === 'rpm' ? '按转速与排量' : '按体积流量',
        "压缩机转速 (RPM)": flow_mode_val === 'rpm' ? document.getElementById('rpm_m2').value : 'N/A',
        "每转排量 (cm³/rev)": flow_mode_val === 'rpm' ? document.getElementById('displacement_m2').value : 'N/A',
        "理论体积流量 (m³/h)": flow_mode_val === 'vol' ? document.getElementById('flow_m3h_m2').value : 'N/A',
        "蒸发温度 (°C)": document.getElementById('temp_evap_m2').value,
        "冷凝温度 (°C)": document.getElementById('temp_cond_m2').value,
        "有效过热度 (K)": document.getElementById('superheat_m2').value,
        "过冷度 (K)": document.getElementById('subcooling_m2').value,
        "效率基准": document.querySelector('input[name="eff_mode_m2"]:checked').value === 'input' ? '基于输入功率 (η_total)' : '基于轴功率 (η_s)',
        "输入等熵效率": document.getElementById('eta_s_m2').value,
        "容积效率 (η_v)": document.getElementById('eta_v_m2').value,
        "电机效率": document.querySelector('input[name="eff_mode_m2"]:checked').value === 'input' ? document.getElementById('motor_eff_m2').value : 'N/A',
        "后冷却器计算": enableCoolerCalcM2A.checked ? '是' : '否',
        "目标冷却后温度 (°C)": enableCoolerCalcM2A.checked ? targetTempM2A.value : 'N/A',
    };

    let printHtml = `
        <h1>压缩机性能计算报告</h1>
        <p>计算时间: ${new Date().toLocaleString('zh-CN')}</p>
        <h2>1. 输入参数 (模式 2A: 制冷热泵)</h2>
        <table class="print-table">
            ${Object.entries(inputs).map(([key, value]) => `
                <tr>
                    <th>${key}</th>
                    <td>${value}</td>
                </tr>
            `).join('')}
        </table>
        <h2>2. 计算结果 (模式 2A)</h2>
        <pre class="print-results">${lastMode2AResultText}</pre>
        <h3>--- 报告结束 (编者: 荆炎荣) ---</h3>
    `;

    callPrint(printHtml);
}


// =====================================================================
// 模式 2B (气体压缩) 专用函数 (v4.2 新增)
// =====================================================================

// --- 按钮状态 (2B) ---
const btnText2B = "计算性能 (模式 2B)";
const btnTextStale2B = "重新计算 (模式 2B)";
const classesFresh2B = ['bg-indigo-600', 'hover:bg-indigo-700', 'text-white'];
const classesStale2B = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

function setButtonStale2B() {
    if (calcButtonM2B) {
        calcButtonM2B.textContent = btnTextStale2B;
        calcButtonM2B.classList.remove(...classesFresh2B);
        calcButtonM2B.classList.add(...classesStale2B);
        printButtonM2B.disabled = true;
        lastMode2BResultText = null;
    }
}

function setButtonFresh2B() {
    if (calcButtonM2B) {
        calcButtonM2B.textContent = btnText2B;
        calcButtonM2B.classList.remove(...classesStale2B);
        calcButtonM2B.classList.add(...classesFresh2B);
    }
}

/**
 * 模式 2B (气体压缩)：主计算函数
 */
function calculateMode2B() {
    try {
        // --- A. 获取所有输入值 (2B) ---
        const fluid = fluidSelectM2B.value;
        const flow_mode = document.querySelector('input[name="flow_mode_m2b"]:checked').value;
        const eff_mode = document.querySelector('input[name="eff_mode_m2b"]:checked').value;
        
        // v4.3 修复: 仅在 'rpm' 模式下读取 rpm
        let rpm_val = NaN;
        if (flow_mode === 'rpm') {
             rpm_val = parseFloat(document.getElementById('rpm_m2b').value);
        }
        
        const eta_s_input = parseFloat(document.getElementById('eta_s_m2b').value);
        const eta_v_input = parseFloat(document.getElementById('eta_v_m2b').value);
        const motor_eff_val = parseFloat(document.getElementById('motor_eff_m2b').value);
        
        // 核心工况变化
        const P_in_bar = parseFloat(document.getElementById('press_in_m2b').value);
        const T_in_C = parseFloat(document.getElementById('temp_in_m2b').value);
        const P_out_bar = parseFloat(document.getElementById('press_out_m2b').value);

        // v4.3 修复: 更新 NaN 检查
        if (isNaN(eta_s_input) || isNaN(eta_v_input) || isNaN(P_in_bar) || isNaN(T_in_C) || isNaN(P_out_bar)) {
            throw new Error("输入包含无效数字，请检查所有字段。");
        }
        if (flow_mode === 'rpm' && isNaN(rpm_val)) {
             throw new Error("在'按转速'模式下，必须提供有效的转速。");
        }
        if (eff_mode === 'input' && isNaN(motor_eff_val)) {
            throw new Error("在'基于输入功率'模式下，必须提供有效的电机效率。");
        }
        if (P_in_bar <= 0 || P_out_bar <= 0 || P_out_bar <= P_in_bar) {
            throw new Error("压力设置无效。必须 P_out > P_in > 0。");
        }

        // --- B. 单位转换 ---
        const T_in_K = T_in_C + 273.15;
        const P_in_Pa = P_in_bar * 1e5;
        const P_out_Pa = P_out_bar * 1e5;

        // --- C. 理论体积流量 (m³/s) ---
        let V_th_m3_s;
        let V_rev_cm3_val = NaN, V_th_m3_h_val = NaN;
        if (flow_mode === 'rpm') {
            V_rev_cm3_val = parseFloat(document.getElementById('displacement_m2b').value);
            if (isNaN(V_rev_cm3_val)) throw new Error("请检查每转排量输入。");
            if (rpm_val <= 0) throw new Error("转速必须大于 0。");
            V_th_m3_s = (V_rev_cm3_val / 1e6) * (rpm_val / 60);
            V_th_m3_h_val = V_th_m3_s * 3600;
        } else {
            // 'vol' 模式
            V_th_m3_h_val = parseFloat(document.getElementById('flow_m3h_m2b').value);
            if (isNaN(V_th_m3_h_val)) throw new Error("请检查体积流量输入。");
            V_th_m3_s = V_th_m3_h_val / 3600;
            // v4.3 修复: rpm_val 和 V_rev_cm3_val 此时为 NaN
        }
        if (V_th_m3_s <= 0) throw new Error("理论排量必须大于零。");

        // --- D. 计算状态点 1 (入口) ---
        const h1_J_kg = CP_INSTANCE.PropsSI('H', 'T', T_in_K, 'P', P_in_Pa, fluid);
        const s1_J_kgK = CP_INSTANCE.PropsSI('S', 'T', T_in_K, 'P', P_in_Pa, fluid);
        const rho1_kg_m3 = CP_INSTANCE.PropsSI('D', 'T', T_in_K, 'P', P_in_Pa, fluid);
        const v1_m3_kg = 1 / rho1_kg_m3;

        // --- E. 计算状态点 2s (等熵出口) ---
        let h_isen_J_kg, h2s_J_kg, T2s_K, T2s_C;
        let isentropic_error_msg = null;
        try {
            h2s_J_kg = CP_INSTANCE.PropsSI('H', 'P', P_out_Pa, 'S', s1_J_kgK, fluid);
            T2s_K = CP_INSTANCE.PropsSI('T', 'P', P_out_Pa, 'S', s1_J_kgK, fluid);
            T2s_C = T2s_K - 273.15;
            h_isen_J_kg = h2s_J_kg - h1_J_kg;
            if (h_isen_J_kg <= 0) throw new Error("理论等熵焓升小于等于零, 工况错误。");
        } catch (isen_error) {
            console.error("Isentropic calculation failed (Mode 2B):", isen_error);
            isentropic_error_msg = `计算失败 (${isen_error.message})`;
            T2s_K = NaN; T2s_C = NaN;
            throw new Error(`等熵点计算失败: ${isentropic_error_msg}`);
        }

        // --- F. 应用效率 (核心逻辑) ---
        const V_actual_m3_s = V_th_m3_s * eta_v_input;
        const m_dot_kg_s = V_actual_m3_s / v1_m3_kg;
        const Ws_W = m_dot_kg_s * h_isen_J_kg; // 理论等熵功率

        // --- G. 计算实际功率 ---
        let W_shaft_W, Win_input_W = NaN;
        let eta_s_shaft = NaN, eta_s_total = NaN;
        if (eff_mode === 'input') {
            eta_s_total = eta_s_input;
            Win_input_W = Ws_W / eta_s_total;
            W_shaft_W = Win_input_W * motor_eff_val;
            eta_s_shaft = (W_shaft_W > 0) ? Ws_W / W_shaft_W : NaN;
        } else {
            eta_s_shaft = eta_s_input;
            W_shaft_W = Ws_W / eta_s_shaft;
            eta_s_total = NaN;
        }

        // --- H. 计算实际排气温度 T2a ---
        let T2a_K = NaN, T2a_C = NaN, h2a_J_kg = NaN;
        let actual_temp_error_msg = null;
        try {
            if (m_dot_kg_s <= 0) throw new Error("质量流量为零，无法计算。");
            h2a_J_kg = (W_shaft_W / m_dot_kg_s) + h1_J_kg;
            T2a_K = CP_INSTANCE.PropsSI('T', 'P', P_out_Pa, 'H', h2a_J_kg, fluid);
            T2a_C = T2a_K - 273.15;
        } catch (actual_temp_error) {
            console.error("Actual temp calculation failed (Mode 2B):", actual_temp_error);
            actual_temp_error_msg = `计算失败 (${actual_temp_error.message})`;
            T2a_K = NaN; T2a_C = NaN; h2a_J_kg = NaN;
        }

        // --- I. 计算比功 ---
        const spec_power_kJ_kg = (m_dot_kg_s > 0) ? (W_shaft_W / m_dot_kg_s / 1000) : NaN;


        // --- J. 格式化输出 ---
        let output = `
--- 计算概览 (工质: ${fluid}) ---
吸气压力 (P_in):  ${P_in_bar.toFixed(3)} bar
排气压力 (P_out): ${P_out_bar.toFixed(3)} bar
压缩比 (PR):    ${(P_out_bar / P_in_bar).toFixed(2)}

--- 关键状态点 ---
状态 1 (入口):
  T1 = ${T_in_K.toFixed(2)} K (${T_in_C.toFixed(2)} °C)
  v1 = ${v1_m3_kg.toFixed(5)} m³/kg
  h1 = ${(h1_J_kg / 1000).toFixed(2)} kJ/kg
状态 2s (等熵出口):
  T2s = ${isNaN(T2s_C) ? `N/A (${isentropic_error_msg})` : `${T2s_C.toFixed(2)} °C`}
  h2s = ${isNaN(h2s_J_kg) ? `N/A (${isentropic_error_msg})` : `${(h2s_J_kg / 1000).toFixed(2)} kJ/kg`}
状态 2a (实际出口):
  T2a = ${isNaN(T2a_C) ? `N/A (${actual_temp_error_msg})` : `${T2a_C.toFixed(2)} °C`}
  h2a = ${isNaN(h2a_J_kg) ? `N/A (${actual_temp_error_msg})` : `${(h2a_J_kg / 1000).toFixed(2)} kJ/kg`}

--- 理论流量与比焓 ---
等熵焓升:     ${(h_isen_J_kg / 1000).toFixed(2)} kJ/kg
`;
        
        // v4.3 修复: 调整输出
        let flow_output = '';
        if (flow_mode === 'rpm') {
            flow_output = `
输入排量:     ${V_rev_cm3_val.toFixed(1)} cm³/rev ( @ ${rpm_val.toFixed(0)} RPM )
理论流量(V_th): ${V_th_m3_h_val.toFixed(2)} m³/h
`;
        } else {
            flow_output = `
输入流量(V_th): ${V_th_m3_h_val.toFixed(2)} m³/h
`;
        }
        output += flow_output; // 添加条件块
        
output += `
--- 输入效率 ---
容积效率 (η_v):         ${(eta_v_input * 100).toFixed(2)} %
${(eff_mode === 'shaft') ? `等熵效率 (η_s):       ${(eta_s_shaft * 100).toFixed(2)} %` : `总等熵效率 (η_total):   ${(eta_s_total * 100).toFixed(2)} %`}
${(eff_mode === 'input') ? `电机效率:             ${(motor_eff_val * 100).toFixed(1)} %` : ''}
${(eff_mode === 'input') ? `(计算的 η_s):         ${isNaN(eta_s_shaft) ? 'N/A' : (eta_s_shaft * 100).toFixed(2)} %` : ''}

--- 实际流量 ---
实际体积流量 (V_act): ${(V_actual_m3_s * 3600).toFixed(2)} m³/h
实际质量流量 (m_dot): ${m_dot_kg_s.toFixed(5)} kg/s
理论等熵功率 (Ws):   ${(Ws_W / 1000).toFixed(3)} kW

========================================
           最终性能计算 (备注)
========================================
轴功率 (W_shaft): ${(W_shaft_W / 1000).toFixed(2)} kW
${isNaN(Win_input_W) ? '' : `输入功率 (W_in):  ${(Win_input_W / 1000).toFixed(2)} kW`}

比功 (轴功/质量流): ${isNaN(spec_power_kJ_kg) ? 'N/A' : spec_power_kJ_kg.toFixed(2)} kJ/kg
`;

        // --- K. 后冷却器计算 ---
        let coolerOutput = "";
        const enableCooler = enableCoolerCalcM2B.checked;
        
        if (enableCooler) {
            try {
                const T_target_C = parseFloat(targetTempM2B.value);
                if (isNaN(T_target_C)) {
                    throw new Error("无效的目标冷却温度。");
                }
                if (isNaN(T2a_C)) {
                    throw new Error("无法计算后冷却器，因为 T2a (实际排气温度) 计算失败。");
                }
                if (T_target_C >= T2a_C) {
                    throw new Error(`目标温度 (${T_target_C}°C) 必须低于实际排气温度 T2a (${T2a_C.toFixed(2)}°C)。`);
                }
                
                // 检查目标温度是否低于入口温度
                if (T_target_C < T_in_C) {
                    coolerOutput += `\n(注意: 目标温度 ${T_target_C}°C 低于入口温度 ${T_in_C}°C)\n`;
                }

                const T_target_K = T_target_C + 273.15;
                const h_target_J_kg = CP_INSTANCE.PropsSI('H', 'T', T_target_K, 'P', P_out_Pa, fluid);
                const Q_cooler_W = m_dot_kg_s * (h2a_J_kg - h_target_J_kg);
                const Q_cooler_kW = Q_cooler_W / 1000;

                coolerOutput += `
========================================
           后冷却器负荷 (Q_cooler)
========================================
原始实际排气 (T2a):  ${T2a_C.toFixed(2)} °C (h2a: ${(h2a_J_kg/1000).toFixed(2)} kJ/kg)
目标冷却后温度 (T2c):  ${T_target_C.toFixed(2)} °C (h2c: ${(h_target_J_kg/1000).toFixed(2)} kJ/kg)

计算后冷却器负荷:  ${Q_cooler_kW.toFixed(3)} kW
  (备注: m_dot * (h2a - h2c))
`;
            } catch (coolerError) {
                coolerOutput = `
========================================
           后冷却器负荷 (Q_cooler)
========================================
计算失败: ${coolerError.message}
`;
            }
        }
        
        // --- L. 组合最终输出 ---
        resultsDivM2B.textContent = output + coolerOutput;
        lastMode2BResultText = output + coolerOutput; // 存储纯文本

        setButtonFresh2B();
        printButtonM2B.disabled = false;

    } catch (error) {
        resultsDivM2B.textContent = `计算出错 (2B): ${error.message}\n\n请检查输入参数是否在工质的有效范围内。`;
        console.error(error);
        lastMode2BResultText = null;
        printButtonM2B.disabled = true;
    }
}


/**
 * 准备模式 2B 的打印报告
 */
function printReportMode2B() {
    if (!lastMode2BResultText) {
        alert("没有可打印的结果。");
        return;
    }
    
    const flow_mode_val = document.querySelector('input[name="flow_mode_m2b"]:checked').value;
    
    const inputs = {
        "报告类型": "模式 2B: 性能预测 (气体压缩)",
        "工质": fluidSelectM2B.value,
        "理论输气量模式": flow_mode_val === 'rpm' ? '按转速与排量' : '按体积流量',
        "压缩机转速 (RPM)": flow_mode_val === 'rpm' ? document.getElementById('rpm_m2b').value : 'N/A',
        "每转排量 (cm³/rev)": flow_mode_val === 'rpm' ? document.getElementById('displacement_m2b').value : 'N/A',
        "理论体积流量 (m³/h)": flow_mode_val === 'vol' ? document.getElementById('flow_m3h_m2b').value : 'N/A',
        
        "吸气压力 (bar)": document.getElementById('press_in_m2b').value,
        "吸气温度 (°C)": document.getElementById('temp_in_m2b').value,
        "排气压力 (bar)": document.getElementById('press_out_m2b').value,
        
        "效率基准": document.querySelector('input[name="eff_mode_m2b"]:checked').value === 'input' ? '基于输入功率 (η_total)' : '基于轴功率 (η_s)',
        "输入等熵效率": document.getElementById('eta_s_m2b').value,
        "容积效率 (η_v)": document.getElementById('eta_v_m2b').value,
        "电机效率": document.querySelector('input[name="eff_mode_m2b"]:checked').value === 'input' ? document.getElementById('motor_eff_m2b').value : 'N/A',
        "后冷却器计算": enableCoolerCalcM2B.checked ? '是' : '否',
        "目标冷却后温度 (°C)": enableCoolerCalcM2B.checked ? targetTempM2B.value : 'N/A',
    };

    let printHtml = `
        <h1>压缩机性能计算报告</h1>
        <p>计算时间: ${new Date().toLocaleString('zh-CN')}</p>
        <h2>1. 输入参数 (模式 2B: 气体压缩)</h2>
        <table class="print-table">
            ${Object.entries(inputs).map(([key, value]) => `
                <tr>
                    <th>${key}</th>
                    <td>${value}</td>
                </tr>
            `).join('')}
        </table>
        <h2>2. 计算结果 (模式 2B)</h2>
        <pre class="print-results">${lastMode2BResultText}</pre>
        <h3>--- 报告结束 (编者: 荆炎荣) ---</h3>
    `;

    callPrint(printHtml);
}


// =====================================================================
// 通用函数
// =====================================================================

/**
 * 打印报告的核心函数 (模块内)
 * @param {string} printHtml - 要打印的 HTML 内容
 */
function callPrint(printHtml) {
    let printContainer = document.getElementById('print-container');
    if (printContainer) {
        printContainer.remove();
    }
    printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.innerHTML = printHtml;
    document.body.appendChild(printContainer);
    window.print();
    setTimeout(() => {
        if (document.body.contains(printContainer)) {
            document.body.removeChild(printContainer);
        }
    }, 500);
}


/**
 * 模式二：主初始化函数 (v4.3)
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
    allInputsM2A = calcFormM2A.querySelectorAll('input, select');
    enableCoolerCalcM2A = document.getElementById('enable_cooler_calc_m2');
    targetTempM2A = document.getElementById('target_temp_m2');

    if (calcFormM2A) {
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
    
    console.log("模式二 (2A & 2B) 已初始化。");
}