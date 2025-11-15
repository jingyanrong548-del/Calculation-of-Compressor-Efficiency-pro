// =====================================================================
// mode2_predict.js: 模式一 (热泵预测) 和 模式二 (气体预测) 模块
// 版本: v7.2 (最终修复版)
// 职责: 1. 实现模式一 (原2A, 热泵) 和 模式二 (原2B, 气体) 的计算逻辑。
//        2. 使用统一的初始化函数 'initMode1_2' 并更新所有 DOM ID。
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode1ResultText = null;
let lastMode2ResultText = null;

// --- 模式一 DOM 元素 ---
let calcButtonM1, resultsDivM1, calcFormM1, printButtonM1;
let fluidSelectM1, fluidInfoDivM1;
let allInputsM1;

// --- 模式二 DOM 元素 ---
let calcButtonM2, resultsDivM2, calcFormM2, printButtonM2;
let fluidSelectM2, fluidInfoDivM2;
let allInputsM2;

// =====================================================================
// 模式一 (热泵) 专用函数
// =====================================================================

const btnText1 = "计算性能 (热泵)";
const btnTextStale1 = "重新计算 (热泵)";
const classesFresh1 = ['bg-green-600', 'hover:bg-green-700', 'text-white'];
const classesStale1 = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

function setButtonStale1() {
    if (!calcButtonM1) return;
    calcButtonM1.textContent = btnTextStale1;
    calcButtonM1.classList.remove(...classesFresh1);
    calcButtonM1.classList.add(...classesStale1);
    printButtonM1.disabled = true;
    lastMode1ResultText = null;
}

async function calculateMode1() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM1.textContent = "错误: CoolProp 未加载。";
        return;
    }

    calcButtonM1.disabled = true;
    calcButtonM1.textContent = "计算中...";
    resultsDivM1.textContent = "--- 正在计算, 请稍候... ---";

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM1);
            const fluid = formData.get('fluid_m1');
            
            const inlet_define = formData.get('inlet_define_m1');
            const outlet_define = formData.get('outlet_define_m1');

            let p_in_bar, T_in_C, p_out_bar;
            let T_evap_C, SH_K, T_cond_C, T_cond_K_calc;

            if (inlet_define === 'pt') {
                p_in_bar = parseFloat(formData.get('p_in_m1'));
                T_in_C = parseFloat(formData.get('T_in_m1'));
                const T_sat_in_K = CP.PropsSI('T', 'P', p_in_bar * 1e5, 'Q', 1, fluid);
                T_evap_C = T_sat_in_K - 273.15;
                SH_K = T_in_C - T_evap_C;
            } else { // 't_sh'
                T_evap_C = parseFloat(formData.get('T_evap_m1'));
                SH_K = parseFloat(formData.get('SH_m1'));
                const T_evap_K = T_evap_C + 273.15;
                p_in_bar = CP.PropsSI('P', 'T', T_evap_K, 'Q', 1, fluid) / 1e5;
                T_in_C = T_evap_C + SH_K;
            }

            if (outlet_define === 'p') {
                p_out_bar = parseFloat(formData.get('p_out_m1'));
                T_cond_K_calc = CP.PropsSI('T', 'P', p_out_bar * 1e5, 'Q', 1, fluid);
                T_cond_C = T_cond_K_calc - 273.15;
            } else { // 't'
                T_cond_C = parseFloat(formData.get('T_cond_m1'));
                T_cond_K_calc = T_cond_C + 273.15;
                p_out_bar = CP.PropsSI('P', 'T', T_cond_K_calc, 'Q', 1, fluid) / 1e5;
            }

            const eff_isen = parseFloat(formData.get('eff_isen_m1')) / 100.0;
            const vol_eff = parseFloat(formData.get('vol_eff_m1')) / 100.0;
            const motor_eff = parseFloat(formData.get('motor_eff_m1')) / 100.0;
            
            const flow_mode = formData.get('flow_mode_m1');
            const rpm = parseFloat(formData.get('rpm_m1'));
            const vol_disp_cm3 = parseFloat(formData.get('vol_disp_m1'));
            const mass_flow_kgs = parseFloat(formData.get('mass_flow_m1'));
            const vol_flow_m3h = parseFloat(formData.get('vol_flow_m1'));

            const SC_K = parseFloat(formData.get('SC_m1'));
            const enable_cooler_calc = formData.get('enable_cooler_calc_m1') === 'on';
            const target_temp_C = parseFloat(formData.get('target_temp_m1'));

            const p_in_Pa = p_in_bar * 1e5;
            const T_in_K = T_in_C + 273.15;
            const p_out_Pa = p_out_bar * 1e5;
            const vol_disp_m3 = vol_disp_cm3 / 1e6;
            const target_temp_K = target_temp_C + 273.15;

            const H_in = CP.PropsSI('H', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const S_in = CP.PropsSI('S', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const D_in = CP.PropsSI('D', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const v_in = 1.0 / D_in;

            const H_out_is = CP.PropsSI('H', 'P', p_out_Pa, 'S', S_in, fluid);
            const T_out_is_K = CP.PropsSI('T', 'P', p_out_Pa, 'S', S_in, fluid);
            const W_is = H_out_is - H_in;

            const W_real = W_is / eff_isen;
            const H_out_real = H_in + W_real;
            const T_out_real_K = CP.PropsSI('T', 'P', p_out_Pa, 'H', H_out_real, fluid);

            let m_flow, V_flow_in;
            if (flow_mode === 'rpm') {
                V_flow_in = (rpm / 60.0) * vol_disp_m3 * vol_eff;
                m_flow = V_flow_in * D_in;
            } else if (flow_mode === 'mass') {
                m_flow = mass_flow_kgs;
                V_flow_in = m_flow * v_in;
            } else {
                V_flow_in = vol_flow_m3h / 3600.0;
                m_flow = V_flow_in * D_in;
            }

            const Power_shaft = (W_real * m_flow) / 1000.0;
            const Power_motor = Power_shaft / motor_eff;

            const T_liq_out_K = T_cond_K_calc - SC_K;
            const H_throttle = CP.PropsSI('H', 'T', T_liq_out_K, 'P', p_out_Pa, fluid);
            const q_evap = H_in - H_throttle;
            const q_cond = H_out_real - H_throttle;
            const Q_evap_kW = q_evap * m_flow / 1000.0;
            const Q_cond_kW = q_cond * m_flow / 1000.0;
            const COP_R = q_evap / W_real;
            const COP_H = q_cond / W_real;

            let Q_cooler = 0;
            let cooler_notes = "后冷却器/冷凝器: 未启用";
            if (enable_cooler_calc) {
                cooler_notes = `系统制热能力 (Q_cond): ${Q_cond_kW.toFixed(2)} kW\n`;
                if (target_temp_K > 0) {
                     const H_target = CP.PropsSI('H', 'P', p_out_Pa, 'T', target_temp_K, fluid);
                     Q_cooler = (H_out_real - H_target) * m_flow / 1000.0;
                     cooler_notes += `  (若后冷到 ${target_temp_C}°C, 热负荷为: ${Q_cooler.toFixed(2)} kW)`;
                }
            }

            const T_out_is_C = T_out_is_K - 273.15;
            const T_out_real_C = T_out_real_K - 273.15;
            
            let resultText = `
========= 模式一 (热泵预测) 计算报告 =========
工质: ${fluid}

--- 1. 进口/出口工况 ---
蒸发温度 (T_evap): ${T_evap_C.toFixed(2)} °C
过热度 (SH):        ${SH_K.toFixed(1)} K
冷凝温度 (T_cond): ${T_cond_C.toFixed(2)} °C
过冷度 (SC):        ${SC_K.toFixed(1)} K

--- 2. 进口状态 (计算值) ---
进口压力 (P_in):    ${p_in_bar.toFixed(3)} bar
进口温度 (T_in):    ${T_in_C.toFixed(2)} °C
  - 进口比容 (v_in):  ${v_in.toFixed(5)} m³/kg
  - 进口焓 (H_in):    ${(H_in / 1000.0).toFixed(2)} kJ/kg
  - 进口熵 (S_in):    ${(S_in / 1000.0).toFixed(4)} kJ/kg.K

--- 3. 压缩过程 (计算值) ---
出口压力 (P_out):   ${p_out_bar.toFixed(3)} bar
等熵效率 (Eff_is):  ${(eff_isen * 100).toFixed(1)} %
----------------------------------------
  - 理论等熵功 (W_is):   ${(W_is / 1000.0).toFixed(2)} kJ/kg
  - 理论排气温度 (T_out_is): ${T_out_is_C.toFixed(2)} °C
  
  - 实际轴功 (W_real):   ${(W_real / 1000.0).toFixed(2)} kJ/kg
  - 实际排气温度 (T_out):  ${T_out_real_C.toFixed(2)} °C
  - 实际排气焓 (H_out):    ${(H_out_real / 1000.0).toFixed(2)} kJ/kg

--- 4. 流量与功率 ---
质量流量 (M_flow):  ${m_flow.toFixed(4)} kg/s
进口体积流量 (V_in): ${V_flow_in.toFixed(5)} m³/s (${(V_flow_in * 3600).toFixed(2)} m³/h)
(基于 容积效率: ${(vol_eff * 100).toFixed(1)}% 和 电机效率: ${(motor_eff * 100).toFixed(1)}%)
----------------------------------------
  - 压缩机轴功率 (P_shaft): ${Power_shaft.toFixed(2)} kW
  - 电机输入功率 (P_motor): ${Power_motor.toFixed(2)} kW

--- 5. 系统性能 ---
节流前焓 (H_throttle): ${(H_throttle / 1000.0).toFixed(2)} kJ/kg
----------------------------------------
单位制冷量 (q_evap): ${(q_evap / 1000.0).toFixed(2)} kJ/kg
单位制热量 (q_cond): ${(q_cond / 1000.0).toFixed(2)} kJ/kg
----------------------------------------
系统制冷能力 (Q_evap): ${Q_evap_kW.toFixed(2)} kW
系统制热能力 (Q_cond): ${Q_cond_kW.toFixed(2)} kW
COP (制冷, 轴):      ${COP_R.toFixed(3)}
COP (制热, 轴):      ${COP_H.toFixed(3)}

--- 6. 后冷却器/冷凝器 ---
${cooler_notes}
`;
            resultsDivM1.textContent = resultText;
            lastMode1ResultText = resultText;
            
            calcButtonM1.textContent = btnText1;
            calcButtonM1.classList.remove(...classesStale1);
            calcButtonM1.classList.add(...classesFresh1);
            calcButtonM1.disabled = false;
            printButtonM1.disabled = false;

        } catch (err) {
            console.error("Mode 1 (Heat Pump) calculation failed:", err);
            resultsDivM1.textContent = `计算出错 (模式一): \n${err.message}\n\n请检查输入参数。`;
            calcButtonM1.textContent = "计算失败";
            calcButtonM1.disabled = false;
            setButtonStale1();
        }
    }, 10);
}

function printReportMode1() {
    if (!lastMode1ResultText) return;
    const printHtml = `
        <html><head><title>模式一 (热泵预测) 计算报告</title>
        <style>
            body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #15803d; border-bottom: 2px solid #15803d; }
            pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 14px; white-space: pre-wrap; }
            footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
        </style>
        </head><body>
            <h1>模式一 (热泵预测) 计算报告</h1>
            <pre>${lastMode1ResultText}</pre>
            <footer><p>版本: v7.2</p><p>计算时间: ${new Date().toLocaleString()}</p></footer>
        </body></html>
    `;
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container-1';
    printContainer.innerHTML = printHtml;
    document.body.appendChild(printContainer);
    window.print();
    setTimeout(() => { if (document.body.contains(printContainer)) document.body.removeChild(printContainer); }, 500);
}

// =====================================================================
// 模式二 (气体) 专用函数
// =====================================================================

const btnText2 = "计算性能 (气体)";
const btnTextStale2 = "重新计算 (气体)";
const classesFresh2 = ['bg-cyan-600', 'hover:bg-cyan-700', 'text-white'];
const classesStale2 = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

function setButtonStale2() {
    if (!calcButtonM2) return;
    calcButtonM2.textContent = btnTextStale2;
    calcButtonM2.classList.remove(...classesFresh2);
    calcButtonM2.classList.add(...classesStale2);
    printButtonM2.disabled = true;
    lastMode2ResultText = null;
}

async function calculateMode2() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM2.textContent = "错误: CoolProp 未加载。";
        return;
    }

    calcButtonM2.disabled = true;
    calcButtonM2.textContent = "计算中...";
    resultsDivM2.textContent = "--- 正在计算, 请稍候... ---";

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM2);
            const fluid = formData.get('fluid_m2');

            const p_in_bar = parseFloat(formData.get('p_in_m2'));
            const T_in_C = parseFloat(formData.get('T_in_m2'));
            const p_out_bar = parseFloat(formData.get('p_out_m2'));
            const eff_isen = parseFloat(formData.get('eff_isen_m2')) / 100.0;
            const eff_iso = parseFloat(formData.get('eff_iso_m2')) / 100.0;
            
            const flow_mode = formData.get('flow_mode_m2');
            const rpm = parseFloat(formData.get('rpm_m2'));
            const vol_disp_cm3 = parseFloat(formData.get('vol_disp_m2'));
            const mass_flow_kgs = parseFloat(formData.get('mass_flow_m2'));
            const vol_flow_m3h = parseFloat(formData.get('vol_flow_m2'));

            const enable_cooler_calc = formData.get('enable_cooler_calc_m2') === 'on';
            const target_temp_C = parseFloat(formData.get('target_temp_m2'));

            const p_in_Pa = p_in_bar * 1e5;
            const T_in_K = T_in_C + 273.15;
            const p_out_Pa = p_out_bar * 1e5;
            const vol_disp_m3 = vol_disp_cm3 / 1e6;
            const target_temp_K = target_temp_C + 273.15;

            const H_in = CP.PropsSI('H', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const S_in = CP.PropsSI('S', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const D_in = CP.PropsSI('D', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const v_in = 1.0 / D_in;

            const H_out_is = CP.PropsSI('H', 'P', p_out_Pa, 'S', S_in, fluid);
            const T_out_is_K = CP.PropsSI('T', 'P', p_out_Pa, 'S', S_in, fluid);
            const W_is = H_out_is - H_in;
            
            const T_out_iso_K = T_in_K;
            const H_out_iso = CP.PropsSI('H', 'P', p_out_Pa, 'T', T_out_iso_K, fluid);
            const S_out_iso = CP.PropsSI('S', 'P', p_out_Pa, 'T', T_out_iso_K, fluid);
            const W_iso = (H_out_iso - H_in) - T_in_K * (S_out_iso - S_in);

            let T_out_real_K, H_out_real, W_real;
            let eff_notes = `(基于等熵效率 ${eff_isen * 100}%)`;

            if (eff_iso > 0.01) {
                W_real = W_iso / eff_iso;
                H_out_real = H_in + (W_is / eff_isen);
                T_out_real_K = CP.PropsSI('T', 'P', p_out_Pa, 'H', H_out_real, fluid);
                eff_notes = `(基于等温效率 ${eff_iso * 100}%)`;
            } else {
                W_real = W_is / eff_isen;
                H_out_real = H_in + W_real;
                T_out_real_K = CP.PropsSI('T', 'P', p_out_Pa, 'H', H_out_real, fluid);
            }

            let m_flow, V_flow_in;
            const vol_eff = 1.0; 
            
            if (flow_mode === 'rpm') {
                V_flow_in = (rpm / 60.0) * vol_disp_m3 * vol_eff;
                m_flow = V_flow_in * D_in;
            } else if (flow_mode === 'mass') {
                m_flow = mass_flow_kgs;
                V_flow_in = m_flow * v_in;
            } else {
                V_flow_in = vol_flow_m3h / 3600.0;
                m_flow = V_flow_in * D_in;
            }

            const Power_shaft = (W_real * m_flow) / 1000.0;

            let Q_cooler = 0;
            let cooler_notes = "后冷却器: 未启用";
            if (enable_cooler_calc) {
                const H_target = CP.PropsSI('H', 'P', p_out_Pa, 'T', target_temp_K, fluid);
                Q_cooler = (H_out_real - H_target) * m_flow / 1000.0;
                cooler_notes = `后冷却器热负荷 (Q_cooler): ${Q_cooler.toFixed(2)} kW`;
            }

            const T_out_is_C = T_out_is_K - 273.15;
            const T_out_real_C = T_out_real_K - 273.15;
            
            let resultText = `
========= 模式二 (气体预测) 计算报告 =========
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
            resultsDivM2.textContent = resultText;
            lastMode2ResultText = resultText;
            
            calcButtonM2.textContent = btnText2;
            calcButtonM2.classList.remove(...classesStale2);
            calcButtonM2.classList.add(...classesFresh2);
            calcButtonM2.disabled = false;
            printButtonM2.disabled = false;

        } catch (err) {
            console.error("Mode 2 (Gas) calculation failed:", err);
            resultsDivM2.textContent = `计算出错 (模式二): \n${err.message}\n\n请检查输入参数。`;
            calcButtonM2.textContent = "计算失败";
            calcButtonM2.disabled = false;
            setButtonStale2();
        }
    }, 10);
}

function printReportMode2() {
    if (!lastMode2ResultText) return;
    const printHtml = `
        <html><head><title>模式二 (气体预测) 计算报告</title>
        <style>
            body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #0891b2; border-bottom: 2px solid #0891b2; }
            pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 14px; white-space: pre-wrap; }
            footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
        </style>
        </head><body>
            <h1>模式二 (气体预测) 计算报告</h1>
            <pre>${lastMode2ResultText}</pre>
            <footer><p>版本: v7.2</p><p>计算时间: ${new Date().toLocaleString()}</p></footer>
        </body></html>
    `;
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container-2';
    printContainer.innerHTML = printHtml;
    document.body.appendChild(printContainer);
    window.print();
    setTimeout(() => { if (document.body.contains(printContainer)) document.body.removeChild(printContainer); }, 500);
}

// =====================================================================
// 初始化函数 (由 main.js 调用)
// =====================================================================

export function initMode1_2(CP) {
    CP_INSTANCE = CP;
    
    // --- 初始化 模式一 (热泵) ---
    calcButtonM1 = document.getElementById('calc-button-1');
    resultsDivM1 = document.getElementById('results-1');
    calcFormM1 = document.getElementById('calc-form-1');
    printButtonM1 = document.getElementById('print-button-1');
    fluidSelectM1 = document.getElementById('fluid_m1');
    fluidInfoDivM1 = document.getElementById('fluid-info-m1');
    
    if (calcFormM1) {
        allInputsM1 = calcFormM1.querySelectorAll('input, select');
        
        calcFormM1.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1(); });
        allInputsM1.forEach(input => {
            input.addEventListener('input', setButtonStale1);
            input.addEventListener('change', setButtonStale1);
        });
        fluidSelectM1.addEventListener('change', () => {
            updateFluidInfo(fluidSelectM1, fluidInfoDivM1, CP);
            setButtonStale1();
        });
        printButtonM1.addEventListener('click', printReportMode1);
        console.log("Mode 1 (Heat Pump) initialized.");
    }
    
    // --- 初始化 模式二 (气体) ---
    calcButtonM2 = document.getElementById('calc-button-2');
    resultsDivM2 = document.getElementById('results-2');
    calcFormM2 = document.getElementById('calc-form-2');
    printButtonM2 = document.getElementById('print-button-2');
    fluidSelectM2 = document.getElementById('fluid_m2');
    fluidInfoDivM2 = document.getElementById('fluid-info-m2');

    if (calcFormM2) {
        allInputsM2 = calcFormM2.querySelectorAll('input, select');
        
        calcFormM2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode2(); });
        allInputsM2.forEach(input => {
            input.addEventListener('input', setButtonStale2);
            input.addEventListener('change', setButtonStale2);
        });
        fluidSelectM2.addEventListener('change', () => {
            updateFluidInfo(fluidSelectM2, fluidInfoDivM2, CP);
            setButtonStale2();
        });
        printButtonM2.addEventListener('click', printReportMode2);
        console.log("Mode 2 (Gas) initialized.");
    }
}