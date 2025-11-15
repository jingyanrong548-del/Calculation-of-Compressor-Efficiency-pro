// =====================================================================
// mode3_mvr.js: 模式四 (MVR 容积式计算) 模块
// 版本: v7.2 (最终修复版)
// 职责: 1. 作为独立的模式四运行。
//        2. 更新所有 DOM ID 和初始化函数名以匹配 v7.0 结构。
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode4ResultText = null;

// --- DOM 元素引用 ---
let calcButtonM4, resultsDivM4, calcFormM4, printButtonM4;
let fluidSelectM4, fluidInfoDivM4;
let allInputsM4;

// --- 按钮状态常量 ---
const btnText4 = "计算喷水量 (MVR 容积式)";
const btnTextStale4 = "重新计算 (MVR 容积式)";
const classesFresh4 = ['bg-purple-600', 'hover:bg-purple-700', 'text-white'];
const classesStale4 = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

/**
 * 设置按钮为“脏”状态 (Stale)
 */
function setButtonStale4() {
    if (!calcButtonM4) return;
    calcButtonM4.textContent = btnTextStale4;
    calcButtonM4.classList.remove(...classesFresh4);
    calcButtonM4.classList.add(...classesStale4);
    printButtonM4.disabled = true;
    lastMode4ResultText = null;
}

/**
 * 模式四：计算
 */
async function calculateMode4() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM4.textContent = "错误: CoolProp 未加载。";
        return;
    }

    calcButtonM4.disabled = true;
    calcButtonM4.textContent = "计算中...";
    resultsDivM4.textContent = "--- 正在计算, 请稍候... ---";

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM4);
            
            const fluid = formData.get('fluid_m4');
            const state_define = formData.get('state_define_m4');
            const delta_T_sat = parseFloat(formData.get('delta_T_m4'));
            
            const flow_mode = formData.get('flow_mode_m4');
            const rpm = parseFloat(formData.get('rpm_m4'));
            const vol_disp_cm3 = parseFloat(formData.get('vol_disp_m4'));
            const vol_eff = parseFloat(formData.get('vol_eff_m4')) / 100.0;
            const mass_flow_kgs = parseFloat(formData.get('mass_flow_m4'));
            const vol_flow_m3h = parseFloat(formData.get('vol_flow_m4'));
            
            const eff_isen = parseFloat(formData.get('eff_isen_m4')) / 100.0;
            const T_water_in_C = parseFloat(formData.get('T_water_in_m4'));

            const T_water_in_K = T_water_in_C + 273.15;
            const vol_disp_m3 = vol_disp_cm3 / 1e6;

            let p_in_Pa, T_in_K, H_in, S_in, D_in, T_sat_in_K;
            let p_in_bar, T_in_C, q_in; 

            if (state_define === 'pt') {
                p_in_bar = parseFloat(formData.get('p_in_m4'));
                T_in_C = parseFloat(formData.get('T_in_m4'));
                p_in_Pa = p_in_bar * 1e5;
                T_in_K = T_in_C + 273.15;
                T_sat_in_K = CP.PropsSI('T', 'P', p_in_Pa, 'Q', 1, fluid);

                H_in = CP.PropsSI('H', 'P', p_in_Pa, 'T', T_in_K, fluid);
                S_in = CP.PropsSI('S', 'P', p_in_Pa, 'T', T_in_K, fluid);
                D_in = CP.PropsSI('D', 'P', p_in_Pa, 'T', T_in_K, fluid);

            } else { // state_define === 'pq'
                p_in_bar = parseFloat(formData.get('p_in_pq_m4'));
                q_in = parseFloat(formData.get('q_in_m4'));
                p_in_Pa = p_in_bar * 1e5;
                
                H_in = CP.PropsSI('H', 'P', p_in_Pa, 'Q', q_in, fluid);
                S_in = CP.PropsSI('S', 'P', p_in_Pa, 'Q', q_in, fluid);
                D_in = CP.PropsSI('D', 'P', p_in_Pa, 'Q', q_in, fluid);
                
                T_sat_in_K = CP.PropsSI('T', 'P', p_in_Pa, 'Q', 1, fluid);
                T_in_K = CP.PropsSI('T', 'P', p_in_Pa, 'Q', q_in, fluid);
                T_in_C = T_in_K - 273.15; 
            }
            
            const T_sat_out_K = T_sat_in_K + delta_T_sat;
            const p_out_Pa = CP.PropsSI('P', 'T', T_sat_out_K, 'Q', 1, fluid);

            const H_out_is = CP.PropsSI('H', 'P', p_out_Pa, 'S', S_in, fluid);
            const W_is = H_out_is - H_in;

            const W_real_dry = W_is / eff_isen;
            const H_out_dry = H_in + W_real_dry;

            let m_flow_in, V_flow_in_s;
            let flow_notes = "";

            if (flow_mode === 'rpm') {
                const V_flow_theo_s = (rpm / 60.0) * vol_disp_m3;
                V_flow_in_s = V_flow_theo_s * vol_eff;
                m_flow_in = V_flow_in_s * D_in;
                flow_notes = `(基于 RPM: ${rpm}, 排量: ${vol_disp_cm3} cm³, 容效: ${(vol_eff * 100.0).toFixed(1)}%)`;
            } else if (flow_mode === 'mass') {
                m_flow_in = mass_flow_kgs;
                V_flow_in_s = m_flow_in / D_in;
                flow_notes = `(基于质量流量: ${m_flow_in.toFixed(4)} kg/s)`;
            } else { // flow_mode === 'vol'
                V_flow_in_s = vol_flow_m3h / 3600.0;
                m_flow_in = V_flow_in_s * D_in;
                flow_notes = `(基于体积流量: ${vol_flow_m3h.toFixed(2)} m³/h)`;
            }

            const H_out_target = CP.PropsSI('H', 'P', p_out_Pa, 'Q', 1, fluid);
            const h_water_in = CP.PropsSI('H', 'T', T_water_in_K, 'P', p_out_Pa, 'Water');

            const m_water = m_flow_in * (H_out_target - H_out_dry) / (h_water_in - H_out_target);
            
            let m_water_kgh, m_water_ratio, Power_shaft, W_real_wet;
            let spray_notes = "";

            if (m_water > 0) {
                m_water_kgh = m_water * 3600.0;
                m_water_ratio = m_water / m_flow_in;
                const m_flow_out = m_flow_in + m_water;
                W_real_wet = (H_out_target * m_flow_out - H_in * m_flow_in - h_water_in * m_water) / m_flow_in;
                Power_shaft = W_real_wet * m_flow_in / 1000.0;
                spray_notes = `为达到出口饱和状态，需要喷水: ${(m_water_kgh).toFixed(3)} kg/h`;
            } else {
                m_water = 0;
                m_water_kgh = 0;
                m_water_ratio = 0;
                W_real_wet = W_real_dry;
                Power_shaft = W_real_dry * m_flow_in / 1000.0;
                const T_out_dry_K = CP.PropsSI('T', 'P', p_out_Pa, 'H', H_out_dry, fluid); 
                spray_notes = `计算结果为过热蒸汽 (${(T_out_dry_K-273.15).toFixed(2)} °C)，无需喷水。`;
            }
            
            const T_sat_in_C = T_sat_in_K - 273.15;
            const T_sat_out_C = T_sat_out_K - 273.15;

            let resultText = `
========= 模式四 (MVR 容积式) 计算报告 =========
工质: ${fluid}
流量模式: ${flow_mode}

--- 1. 进口状态 (P, T) ---
进口压力 (P_in):    ${p_in_bar.toFixed(3)} bar
进口温度 (T_in):    ${T_in_C.toFixed(2)} °C
(进口饱和温度 (T_sat_in): ${T_sat_in_C.toFixed(2)} °C)
  - 进口焓 (H_in):  ${(H_in / 1000.0).toFixed(2)} kJ/kg
  - 进口熵 (S_in):  ${(S_in / 1000.0).toFixed(4)} kJ/kg.K
  - 进口密度 (D_in):  ${D_in.toFixed(4)} kg/m³

--- 2. 出口状态 (目标) ---
出口饱和温升 (ΔT_sat): ${delta_T_sat.toFixed(2)} K
出口饱和温度 (T_sat_out): ${T_sat_out_C.toFixed(2)} °C
出口压力 (P_out):       ${(p_out_Pa / 1e5).toFixed(3)} bar
  - 出口饱和焓 (H_out_sat): ${(H_out_target / 1000.0).toFixed(2)} kJ/kg

--- 3. 压缩过程 (干) ---
等熵效率 (Eff_is):  ${(eff_isen * 100.0).toFixed(1)} %
  - 理论等熵功 (W_is):   ${(W_is / 1000.0).toFixed(2)} kJ/kg
  - 实际干功 (W_dry):    ${(W_real_dry / 1000.0).toFixed(2)} kJ/kg
  - 干出口焓 (H_dry_out): ${(H_out_dry / 1000.0).toFixed(2)} kJ/kg

--- 4. 流量 ${flow_notes} ---
  - 进口蒸汽流量 (M_in): ${m_flow_in.toFixed(4)} kg/s (${(m_flow_in * 3600).toFixed(2)} kg/h)
  - 进口体积流量 (V_in): ${V_flow_in_s.toFixed(5)} m³/s (${(V_flow_in_s * 3600).toFixed(2)} m³/h)

--- 5. 喷水与功率 (湿) ---
喷入水温 (T_water): ${T_water_in_C.toFixed(2)} °C
(喷水焓 (h_water): ${(h_water_in / 1000.0).toFixed(2)} kJ/kg)
----------------------------------------
${spray_notes}
  - 实际总轴功 (W_wet):  ${(W_real_wet / 1000.0).toFixed(2)} kJ/kg_in
  - 压缩机轴功率 (P_shaft): ${Power_shaft.toFixed(2)} kW
`;
            resultsDivM4.textContent = resultText;
            lastMode4ResultText = resultText;
            
            calcButtonM4.textContent = btnText4;
            calcButtonM4.classList.remove(...classesStale4);
            calcButtonM4.classList.add(...classesFresh4);
            calcButtonM4.disabled = false;
            printButtonM4.disabled = false;

        } catch (err) {
            console.error("Mode 4 calculation failed:", err);
            resultsDivM4.textContent = `计算出错: \n${err.message}\n\n请检查输入参数是否在工质的有效范围内。`;
            calcButtonM4.textContent = "计算失败";
            calcButtonM4.disabled = false;
            setButtonStale4();
        }
    }, 10);
}

/**
 * 打印模式四报告
 */
function printReportMode4() {
    if (!lastMode4ResultText) {
        alert("没有可供打印的计算结果 (M4)。");
        return;
    }
    const printHtml = `
        <html><head><title>模式四 (MVR 容积式) 计算报告</title>
        <style>
            body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #7e22ce; border-bottom: 2px solid #7e22ce; }
            pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 14px; white-space: pre-wrap; }
            footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
        </style>
        </head><body>
            <h1>模式四 (MVR 容积式) 计算报告</h1>
            <pre>${lastMode4ResultText}</pre>
            <footer><p>版本: v7.2</p><p>计算时间: ${new Date().toLocaleString()}</p></footer>
        </body></html>
    `;
    
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container-4';
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
 * 模式四：初始化函数
 * @param {object} CP - CoolProp 实例
 */
export function initMode4(CP) {
    CP_INSTANCE = CP;
    
    calcButtonM4 = document.getElementById('calc-button-4');
    resultsDivM4 = document.getElementById('results-4');
    calcFormM4 = document.getElementById('calc-form-4');
    printButtonM4 = document.getElementById('print-button-4');
    fluidSelectM4 = document.getElementById('fluid_m4');
    fluidInfoDivM4 = document.getElementById('fluid-info-m4');

    if (!calcFormM4) {
        console.error("Mode 4 Form (calc-form-4) not found! Cannot initialize.");
        return;
    }
    allInputsM4 = calcFormM4.querySelectorAll('input, select');

    calcFormM4.addEventListener('submit', (event) => {
        event.preventDefault();
        calculateMode4();
    });

    allInputsM4.forEach(input => {
        input.addEventListener('input', setButtonStale4);
        input.addEventListener('change', setButtonStale4);
    });

    fluidSelectM4.addEventListener('change', () => {
        updateFluidInfo(fluidSelectM4, fluidInfoDivM4, CP);
        setButtonStale4();
    });

    printButtonM4.addEventListener('click', printReportMode4);

    console.log("Mode 4 (MVR Volumetric) initialized.");
}