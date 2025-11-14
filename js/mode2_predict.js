// =====================================================================
// mode2_predict.js: 模式二 (性能预测) 模块
// 版本: v4.4 (M2B 增加等温效率) - (v5.1 修复版)
// 职责: 1. 初始化 2A (热泵) 和 2B (气体) 的 UI 事件
//        2. (v5.1 修复) 确保计算函数只使用 v4.6 index.html 中存在的 ID
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
    if (!calcButtonM2A) return;
    calcButtonM2A.textContent = btnTextStale2A;
    calcButtonM2A.classList.remove(...classesFresh2A);
    calcButtonM2A.classList.add(...classesStale2A);
    printButtonM2A.disabled = true;
    lastMode2AResultText = null;
}

/**
 * (v5.1 修复版) 模式 2A (热泵) 计算
 */
async function calculateMode2A() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM2A.textContent = "错误: CoolProp 未加载。";
        return;
    }

    calcButtonM2A.disabled = true;
    calcButtonM2A.textContent = "计算中...";
    resultsDivM2A.textContent = "--- 正在计算, 请稍候... ---";

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM2A);
            const fluid = formData.get('fluid_m2');
            
            // (v5.1 修复) 严格使用 index.html v4.6 中的 ID
            const p_in_bar = parseFloat(formData.get('p_in_m2'));
            const T_in_C = parseFloat(formData.get('T_in_m2'));
            const p_out_bar = parseFloat(formData.get('p_out_m2'));
            const eff_isen = parseFloat(formData.get('eff_isen_m2')) / 100.0;
            const vol_eff = parseFloat(formData.get('vol_eff_m2')) / 100.0;
            const motor_eff = parseFloat(formData.get('motor_eff_m2')) / 100.0;
            
            const flow_mode = formData.get('flow_mode_m2');
            const rpm = parseFloat(formData.get('rpm_m2'));
            const vol_disp_cm3 = parseFloat(formData.get('vol_disp_m2'));
            const mass_flow_kgs = parseFloat(formData.get('mass_flow_m2'));
            const vol_flow_m3h = parseFloat(formData.get('vol_flow_m2'));

            const enable_cooler_calc = formData.get('enable_cooler_calc_m2') === 'on';
            const target_temp_C = parseFloat(formData.get('target_temp_m2'));

            // 单位换算
            const p_in_Pa = p_in_bar * 1e5;
            const T_in_K = T_in_C + 273.15;
            const p_out_Pa = p_out_bar * 1e5;
            const vol_disp_m3 = vol_disp_cm3 / 1e6;
            const target_temp_K = target_temp_C + 273.15;

            // 1. 进口状态
            const H_in = CP.PropsSI('H', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const S_in = CP.PropsSI('S', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const D_in = CP.PropsSI('D', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const v_in = 1.0 / D_in; // 进口比容 m³/kg

            // 2. 理论等熵压缩
            const H_out_is = CP.PropsSI('H', 'P', p_out_Pa, 'S', S_in, fluid);
            const T_out_is_K = CP.PropsSI('T', 'P', p_out_Pa, 'S', S_in, fluid);
            const W_is = H_out_is - H_in; // 理论等熵功 (J/kg)

            // 3. 实际压缩
            const W_real = W_is / eff_isen; // 实际轴功 (J/kg)
            const H_out_real = H_in + W_real;
            const T_out_real_K = CP.PropsSI('T', 'P', p_out_Pa, 'H', H_out_real, fluid);

            // 4. 计算流量
            let m_flow, V_flow_in;
            if (flow_mode === 'rpm') {
                V_flow_in = (rpm / 60.0) * vol_disp_m3 * vol_eff; // 进口体积流量 (m³/s)
                m_flow = V_flow_in * D_in; // 质量流量 (kg/s)
            } else if (flow_mode === 'mass') {
                m_flow = mass_flow_kgs; // 质量流量 (kg/s)
                V_flow_in = m_flow * v_in; // 进口体积流量 (m³/s)
            } else { // flow_mode === 'vol'
                V_flow_in = vol_flow_m3h / 3600.0; // 进口体积流量 (m³/s)
                m_flow = V_flow_in * D_in; // 质量流量 (kg/s)
            }

            // 5. 计算功率
            const Power_shaft = (W_real * m_flow) / 1000.0; // 轴功率 (kW)
            const Power_motor = Power_shaft / motor_eff; // 电机功率 (kW)

            // 6. 后冷却器/冷凝器
            let Q_cooler = 0;
            let T_cond_K = 0, P_cond_Pa = 0;
            let cooler_notes = "后冷却器/冷凝器: 未启用";
            
            if (enable_cooler_calc) {
                // 检查出口是否在过热区
                const T_sat_out_K = CP.PropsSI('T', 'P', p_out_Pa, 'Q', 1, fluid);
                
                if (T_out_real_K > T_sat_out_K) {
                    // 状态1: 压缩机出口 (过热)
                    // H_out_real, p_out_Pa

                    // 状态2: 饱和蒸汽点
                    const H_sat_vap = CP.PropsSI('H', 'P', p_out_Pa, 'Q', 1, fluid);
                    const Q_de_superheat = (H_out_real - H_sat_vap) * m_flow; // 显热 (J/s 或 W)
                    
                    // 状态3: 目标温度 (假定在两相区或饱和液)
                    // 检查目标温度是否低于出口饱和温度
                    if (target_temp_K <= T_sat_out_K) {
                        const H_target = CP.PropsSI('H', 'P', p_out_Pa, 'T', target_temp_K, fluid);
                        Q_cooler = (H_out_real - H_target) * m_flow / 1000.0; // 总热负荷 (kW)
                        cooler_notes = `冷凝器热负荷 (Q_cond): ${Q_cooler.toFixed(2)} kW (显热 + 潜热)`;
                    } else {
                        // 目标温度高于饱和温度，只是过热器
                        const H_target = CP.PropsSI('H', 'P', p_out_Pa, 'T', target_temp_K, fluid);
                        Q_cooler = (H_out_real - H_target) * m_flow / 1000.0; // 仅显热 (kW)
                        cooler_notes = `后冷却器热负荷 (Q_cooler): ${Q_cooler.toFixed(2)} kW (仅显热)`;
                    }
                } else {
                    // 压缩机出口已在两相区 (湿压缩)
                    const H_target = CP.PropsSI('H', 'P', p_out_Pa, 'T', target_temp_K, fluid);
                    Q_cooler = (H_out_real - H_target) * m_flow / 1000.0; // (kW)
                    cooler_notes = `冷凝器热负荷 (Q_cond): ${Q_cooler.toFixed(2)} kW`;
                }
            }

            // 7. 格式化输出
            const T_out_is_C = T_out_is_K - 273.15;
            const T_out_real_C = T_out_real_K - 273.15;
            
            let resultText = `
========= 模式 2A (热泵) 计算报告 =========
工质: ${fluid}

--- 1. 进口状态 ---
进口压力 (P_in):    ${p_in_bar.toFixed(3)} bar
进口温度 (T_in):    ${T_in_C.toFixed(2)} °C
  - 进口比容 (v_in):  ${v_in.toFixed(5)} m³/kg
  - 进口焓 (H_in):    ${(H_in / 1000.0).toFixed(2)} kJ/kg
  - 进口熵 (S_in):    ${(S_in / 1000.0).toFixed(4)} kJ/kg.K

--- 2. 压缩过程 ---
出口压力 (P_out):   ${p_out_bar.toFixed(3)} bar
等熵效率 (Eff_is):  ${(eff_isen * 100).toFixed(1)} %
容积效率 (Eff_vol): ${(vol_eff * 100).toFixed(1)} % (用于RPM模式)
电机效率 (Eff_mot): ${(motor_eff * 100).toFixed(1)} %
----------------------------------------
  - 理论等熵功 (W_is):   ${(W_is / 1000.0).toFixed(2)} kJ/kg
  - 理论排气温度 (T_out_is): ${T_out_is_C.toFixed(2)} °C
  
  - 实际轴功 (W_real):   ${(W_real / 1000.0).toFixed(2)} kJ/kg
  - 实际排气温度 (T_out):  ${T_out_real_C.toFixed(2)} °C
  - 实际排气焓 (H_out):    ${(H_out_real / 1000.0).toFixed(2)} kJ/kg

--- 3. 流量与功率 ---
质量流量 (M_flow):  ${m_flow.toFixed(4)} kg/s
进口体积流量 (V_in): ${V_flow_in.toFixed(5)} m³/s (${(V_flow_in * 3600).toFixed(2)} m³/h)
----------------------------------------
  - 压缩机轴功率 (P_shaft): ${Power_shaft.toFixed(2)} kW
  - 电机输入功率 (P_motor): ${Power_motor.toFixed(2)} kW

--- 4. 后冷却器/冷凝器 ---
${cooler_notes}
`;
            resultsDivM2A.textContent = resultText;
            lastMode2AResultText = resultText;
            
            calcButtonM2A.textContent = btnText2A;
            calcButtonM2A.classList.remove(...classesStale2A);
            calcButtonM2A.classList.add(...classesFresh2A);
            calcButtonM2A.disabled = false;
            printButtonM2A.disabled = false;

        } catch (err) {
            console.error("Mode 2A calculation failed:", err);
            resultsDivM2A.textContent = `计算出错 (2A): \n${err.message}\n\n请检查输入参数是否在工质的有效范围内。`;
            calcButtonM2A.textContent = "计算失败";
            calcButtonM2A.disabled = false;
            setButtonStale2A();
        }
    }, 10);
}

function printReportMode2A() {
    if (!lastMode2AResultText) {
        alert("没有可供打印的计算结果 (2A)。");
        return;
    }
    // (使用 mode1_eval.js 中的打印样式)
    const printHtml = `
        <html><head><title>模式 2A (热泵) 计算报告</title>
        <style>
            body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #15803d; border-bottom: 2px solid #15803d; }
            pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 14px; white-space: pre-wrap; }
            footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
        </style>
        </head><body>
            <h1>模式 2A (热泵) 计算报告</h1>
            <pre>${lastMode2AResultText}</pre>
            <footer><p>版本: v4.4</p><p>计算时间: ${new Date().toLocaleString()}</p></footer>
        </body></html>
    `;
    
    const printContainer = document.createElement('div');
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


// =====================================================================
// 模式 2B (气体) 专用函数
// =====================================================================

// --- 按钮状态 (2B) ---
const btnText2B = "计算性能 (模式 2B)";
const btnTextStale2B = "重新计算 (模式 2B)";
const classesFresh2B = ['bg-cyan-600', 'hover:bg-cyan-700', 'text-white'];
const classesStale2B = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

function setButtonStale2B() {
    if (!calcButtonM2B) return;
    calcButtonM2B.textContent = btnTextStale2B;
    calcButtonM2B.classList.remove(...classesFresh2B);
    calcButtonM2B.classList.add(...classesStale2B);
    printButtonM2B.disabled = true;
    lastMode2BResultText = null;
}

/**
 * (v4.4) 模式 2B (气体) 计算
 */
async function calculateMode2B() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM2B.textContent = "错误: CoolProp 未加载。";
        return;
    }

    calcButtonM2B.disabled = true;
    calcButtonM2B.textContent = "计算中...";
    resultsDivM2B.textContent = "--- 正在计算, 请稍候... ---";

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM2B);
            const fluid = formData.get('fluid_m2b');

            // (v5.1 修复) 严格使用 v4.6 HTML ID
            const p_in_bar = parseFloat(formData.get('p_in_m2b'));
            const T_in_C = parseFloat(formData.get('T_in_m2b'));
            const p_out_bar = parseFloat(formData.get('p_out_m2b'));
            const eff_isen = parseFloat(formData.get('eff_isen_m2b')) / 100.0;
            const eff_iso = parseFloat(formData.get('eff_iso_m2b')) / 100.0;
            
            const flow_mode = formData.get('flow_mode_m2b');
            const rpm = parseFloat(formData.get('rpm_m2b'));
            const vol_disp_cm3 = parseFloat(formData.get('vol_disp_m2b'));
            const mass_flow_kgs = parseFloat(formData.get('mass_flow_m2b'));
            const vol_flow_m3h = parseFloat(formData.get('vol_flow_m2b'));

            const enable_cooler_calc = formData.get('enable_cooler_calc_m2b') === 'on';
            const target_temp_C = parseFloat(formData.get('target_temp_m2b'));

            // 单位换算
            const p_in_Pa = p_in_bar * 1e5;
            const T_in_K = T_in_C + 273.15;
            const p_out_Pa = p_out_bar * 1e5;
            const vol_disp_m3 = vol_disp_cm3 / 1e6;
            const target_temp_K = target_temp_C + 273.15;

            // 1. 进口状态
            const H_in = CP.PropsSI('H', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const S_in = CP.PropsSI('S', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const D_in = CP.PropsSI('D', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const v_in = 1.0 / D_in; // 进口比容 m³/kg

            // 2. 理论压缩 (等熵 & 等温)
            const H_out_is = CP.PropsSI('H', 'P', p_out_Pa, 'S', S_in, fluid);
            const T_out_is_K = CP.PropsSI('T', 'P', p_out_Pa, 'S', S_in, fluid);
            const W_is = H_out_is - H_in; // 理论等熵功 (J/kg)
            
            const T_out_iso_K = T_in_K; // 等温过程温度不变
            const H_out_iso = CP.PropsSI('H', 'P', p_out_Pa, 'T', T_out_iso_K, fluid);
            const S_out_iso = CP.PropsSI('S', 'P', p_out_Pa, 'T', T_out_iso_K, fluid);
            // 理论等温功 W = ΔH - TΔS
            const W_iso = (H_out_iso - H_in) - T_in_K * (S_out_iso - S_in); // (J/kg)

            // 3. 实际压缩
            let T_out_real_K, H_out_real, W_real;
            let eff_notes = `(基于等熵效率 ${eff_isen * 100}%)`;

            // (v4.4) 检查是否使用等温效率
            if (eff_iso > 0.01) {
                // 使用等温效率
                W_real = W_iso / eff_iso; // 实际轴功 (J/kg)
                // 假设冷却良好，但非理想，排温 T_out = T_in + (1 - eff_iso) * (T_is - T_in) (简化估算)
                // 更准确：能量平衡 W_real = (H_out - H_in) - Q_cool
                // 暂时无法仅从等温效率反推排温，先按等熵效率计算排温
                H_out_real = H_in + (W_is / eff_isen);
                T_out_real_K = CP.PropsSI('T', 'P', p_out_Pa, 'H', H_out_real, fluid);
                eff_notes = `(基于等温效率 ${eff_iso * 100}%)`;
            } else {
                // 使用等熵效率
                W_real = W_is / eff_isen; // 实际轴功 (J/kg)
                H_out_real = H_in + W_real;
                T_out_real_K = CP.PropsSI('T', 'P', p_out_Pa, 'H', H_out_real, fluid);
            }

            // 4. 计算流量
            let m_flow, V_flow_in;
            // (v4.3 修复) 假设容积效率为 100%, 因为气体压缩机通常用 FAD
            const vol_eff = 1.0; 
            
            if (flow_mode === 'rpm') {
                V_flow_in = (rpm / 60.0) * vol_disp_m3 * vol_eff; // 进口体积流量 (m³/s)
                m_flow = V_flow_in * D_in; // 质量流量 (kg/s)
            } else if (flow_mode === 'mass') {
                m_flow = mass_flow_kgs; // 质量流量 (kg/s)
                V_flow_in = m_flow * v_in; // 进口体积流量 (m³/s)
            } else { // flow_mode === 'vol'
                V_flow_in = vol_flow_m3h / 3600.0; // 进口体积流量 (m³/s)
                m_flow = V_flow_in * D_in; // 质量流量 (kg/s)
            }

            // 5. 计算功率
            const Power_shaft = (W_real * m_flow) / 1000.0; // 轴功率 (kW)

            // 6. 后冷却器
            let Q_cooler = 0;
            let cooler_notes = "后冷却器: 未启用";
            
            if (enable_cooler_calc) {
                const H_target = CP.PropsSI('H', 'P', p_out_Pa, 'T', target_temp_K, fluid);
                Q_cooler = (H_out_real - H_target) * m_flow / 1000.0; // (kW)
                cooler_notes = `后冷却器热负荷 (Q_cooler): ${Q_cooler.toFixed(2)} kW`;
            }

            // 7. 格式化输出
            const T_out_is_C = T_out_is_K - 273.15;
            const T_out_real_C = T_out_real_K - 273.15;
            
            let resultText = `
========= 模式 2B (气体) 计算报告 =========
工质: ${fluid}
效率基准: ${eff_notes}

--- 1. 进口状态 ---
进口压力 (P_in):    ${p_in_bar.toFixed(3)} bar
进口温度 (T_in):    ${T_in_C.toFixed(2)} °C
  - 进口比容 (v_in):  ${v_in.toFixed(5)} m³/kg
  - 进口焓 (H_in):    ${(H_in / 1000.0).toFixed(2)} kJ/kg
  - 进口熵 (S_in):    ${(S_in / 1000.0).toFixed(4)} kJ/kg.K

--- 2. 压缩过程 ---
出口压力 (P_out):   ${p_out_bar.toFixed(3)} bar
----------------------------------------
  - 理论等熵功 (W_is):   ${(W_is / 1000.0).toFixed(2)} kJ/kg
  - 理论等温功 (W_iso):  ${(W_iso / 1000.0).toFixed(2)} kJ/kg
  - 理论排气温度 (T_is): ${T_out_is_C.toFixed(2)} °C
  
  - 实际轴功 (W_real):   ${(W_real / 1000.0).toFixed(2)} kJ/kg
  - 实际排气温度 (T_out):  ${T_out_real_C.toFixed(2)} °C
  - 实际排气焓 (H_out):    ${(H_out_real / 1000.0).toFixed(2)} kJ/kg

--- 3. 流量与功率 ---
质量流量 (M_flow):  ${m_flow.toFixed(4)} kg/s
进口体积流量 (V_in): ${V_flow_in.toFixed(5)} m³/s (${(V_flow_in * 3600).toFixed(2)} m³/h)
----------------------------------------
  - 压缩机轴功率 (P_shaft): ${Power_shaft.toFixed(2)} kW

--- 4. 后冷却器 ---
${cooler_notes}
`;
            resultsDivM2B.textContent = resultText;
            lastMode2BResultText = resultText;
            
            calcButtonM2B.textContent = btnText2B;
            calcButtonM2B.classList.remove(...classesStale2B);
            calcButtonM2B.classList.add(...classesFresh2B);
            calcButtonM2B.disabled = false;
            printButtonM2B.disabled = false;

        } catch (err) {
            console.error("Mode 2B calculation failed:", err);
            resultsDivM2B.textContent = `计算出错 (2B): \n${err.message}\n\n请检查输入参数是否在工质的有效范围内。`;
            calcButtonM2B.textContent = "计算失败";
            calcButtonM2B.disabled = false;
            setButtonStale2B();
        }
    }, 10);
}

function printReportMode2B() {
    if (!lastMode2BResultText) {
        alert("没有可供打印的计算结果 (2B)。");
        return;
    }
    const printHtml = `
        <html><head><title>模式 2B (气体) 计算报告</title>
        <style>
            body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #0891b2; border-bottom: 2px solid #0891b2; }
            pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 14px; white-space: pre-wrap; }
            footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
        </style>
        </head><body>
            <h1>模式 2B (气体) 计算报告</h1>
            <pre>${lastMode2BResultText}</pre>
            <footer><p>版本: v4.4</p><p>计算时间: ${new Date().toLocaleString()}</p></footer>
        </body></html>
    `;
    
    const printContainer = document.createElement('div');
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


// =====================================================================
// 初始化函数 (由 main.js 调用)
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
    targetTempM2A = document.getElementById('target_temp_m2'); // (v5.1 修复) ID 引用, 即使计算中未使用
    
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
        calcButtonM2A.addEventListener('stale', setButtonStale2A);

        // 绑定流体信息更新 (2A)
        fluidSelectM2A.addEventListener('change', () => {
            updateFluidInfo(fluidSelectM2A, fluidInfoDivM2A, CP);
            setButtonStale2A();
        });
        
        // 绑定打印事件
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
    targetTempM2B = document.getElementById('target_temp_m2b'); // (v5.1 修复) ID 引用

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
            updateFluidInfo(fluidSelectM2B, fluidInfoDivM2B, CP);
            setButtonStale2B();
        });
        
        // 绑定打印事件
        printButtonM2B.addEventListener('click', printReportMode2B);
    }

    console.log("Mode 2 (A & B) initialized.");
}