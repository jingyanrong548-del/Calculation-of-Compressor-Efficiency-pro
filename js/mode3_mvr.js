// =====================================================================
// mode3_mvr.js: 模式三 (MVR 容积式计算) 模块
// 版本: v4.6 (修复版)
// 职责: 1. (v5.1 修复) 确保所有 'formData.get' 匹配 v4.6 HTML name 属性
//        2. (v5.1 修复) 移除对不存在的 'flow_mode_m3' 的查找
//        3. 执行基于 'rpm'/'vol' 输入的 MVR 能量平衡计算
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode3ResultText = null;

// --- DOM 元素引用 ---
let calcButtonM3, resultsDivM3, calcFormM3, printButtonM3;
let fluidSelectM3, fluidInfoDivM3;
let allInputsM3;

// --- 按钮状态常量 ---
const btnText = "计算喷水量 (模式三)";
const btnTextStale = "重新计算 (模式三)";
const classesFresh = ['bg-purple-600', 'hover:bg-purple-700', 'text-white'];
const classesStale = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

/**
 * 设置按钮为“脏”状态 (Stale)
 */
function setButtonStale() {
    if (!calcButtonM3) return;
    calcButtonM3.textContent = btnTextStale;
    calcButtonM3.classList.remove(...classesFresh);
    calcButtonM3.classList.add(...classesStale);
    printButtonM3.disabled = true;
    lastMode3ResultText = null;
}

/**
 * (v4.6 修复版) 模式三：计算
 */
async function calculateMode3() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM3.textContent = "错误: CoolProp 未加载。";
        return;
    }

    calcButtonM3.disabled = true;
    calcButtonM3.textContent = "计算中...";
    resultsDivM3.textContent = "--- 正在计算, 请稍候... ---";

    setTimeout(() => {
        try {
            // (v5.1 修复) 使用 FormData 获取所有值
            const formData = new FormData(calcFormM3);
            
            const fluid = formData.get('fluid_m3');
            const state_define = formData.get('state_define_m3');
            const delta_T_sat = parseFloat(formData.get('delta_T_m3'));
            
            const rpm = parseFloat(formData.get('rpm_m3'));
            const vol_disp_cm3 = parseFloat(formData.get('vol_disp_m3'));
            const vol_eff = parseFloat(formData.get('vol_eff_m3')) / 100.0;
            const eff_isen = parseFloat(formData.get('eff_isen_m3')) / 100.0;
            const T_water_in_C = parseFloat(formData.get('T_water_in_m3'));

            // 单位换算
            const T_water_in_K = T_water_in_C + 273.15;
            const vol_disp_m3 = vol_disp_cm3 / 1e6;

            // 1. 确定进口状态
            let p_in_Pa, T_in_K, H_in, S_in, D_in, T_sat_in_K;
            if (state_define === 'PT') {
                const p_in_bar = parseFloat(formData.get('p_in_m3'));
                const T_in_C = parseFloat(formData.get('T_in_m3'));
                p_in_Pa = p_in_bar * 1e5;
                T_in_K = T_in_C + 273.15;
                T_sat_in_K = CP.PropsSI('T', 'P', p_in_Pa, 'Q', 1, fluid);
            } else { // state_define === 'PQ'
                const p_in_bar = parseFloat(formData.get('p_in_pq_m3'));
                const q_in = parseFloat(formData.get('q_in_m3'));
                p_in_Pa = p_in_bar * 1e5;
                T_sat_in_K = CP.PropsSI('T', 'P', p_in_Pa, 'Q', 1, fluid);
                T_in_K = CP.PropsSI('T', 'P', p_in_Pa, 'Q', q_in, fluid);
            }
            
            H_in = CP.PropsSI('H', 'P', p_in_Pa, 'T', T_in_K, fluid);
            S_in = CP.PropsSI('S', 'P', p_in_Pa, 'T', T_in_K, fluid);
            D_in = CP.PropsSI('D', 'P', p_in_Pa, 'T', T_in_K, fluid);
            
            // 2. 确定出口状态
            const T_sat_out_K = T_sat_in_K + delta_T_sat;
            const p_out_Pa = CP.PropsSI('P', 'T', T_sat_out_K, 'Q', 1, fluid);

            // 3. 理论等熵压缩
            const H_out_is = CP.PropsSI('H', 'P', p_out_Pa, 'S', S_in, fluid);
            const W_is = H_out_is - H_in; // 理论功 (J/kg)

            // 4. 实际压缩 (干)
            const W_real_dry = W_is / eff_isen; // 实际干功 (J/kg)
            const H_out_dry = H_in + W_real_dry; // 干压缩出口焓

            // 5. 流量计算 (v5.1 修复: 模式三固定使用 RPM)
            const V_flow_theo_s = (rpm / 60.0) * vol_disp_m3;
            const V_flow_in_s = V_flow_theo_s * vol_eff; // 实际进口体积流量 (m³/s)
            const m_flow_in = V_flow_in_s * D_in; // 进口蒸汽质量流量 (kg/s)

            // 6. 能量平衡计算 (带喷水)
            // 目标：T_out = T_sat_out_K (出口为饱和蒸汽)
            const H_out_target = CP.PropsSI('H', 'P', p_out_Pa, 'Q', 1, fluid);
            const h_water_in = CP.PropsSI('H', 'T', T_water_in_K, 'P', p_out_Pa, 'Water');

            // Energy_in = Energy_out
            // H_in * m_in + W_real_dry * m_in + H_water * m_water = H_out_target * (m_in + m_water)
            // m_water * (h_water_in - H_out_target) = m_in * (H_out_target - H_in - W_real_dry)
            // m_water * (h_water_in - H_out_target) = m_in * (H_out_target - H_out_dry)
            
            const m_water = m_flow_in * (H_out_target - H_out_dry) / (h_water_in - H_out_target);
            
            let m_water_kgh, m_water_ratio, Power_shaft, W_real_wet;
            let spray_notes = "";

            if (m_water > 0) {
                m_water_kgh = m_water * 3600.0;
                m_water_ratio = m_water / m_flow_in;
                const m_flow_out = m_flow_in + m_water;
                // 总轴功 W_real_wet = ( H_out_target * m_flow_out - H_in * m_flow_in - h_water_in * m_water ) / m_flow_in (J/kg_in)
                W_real_wet = (H_out_target * m_flow_out - H_in * m_flow_in - h_water_in * m_water) / m_flow_in;
                Power_shaft = W_real_wet * m_flow_in / 1000.0; // kW
                spray_notes = `为达到出口饱和状态，需要喷水: ${(m_water_kgh).toFixed(3)} kg/h`;
            } else {
                // 压缩后已是过冷，无需喷水
                m_water = 0;
                m_water_kgh = 0;
                m_water_ratio = 0;
                W_real_wet = W_real_dry;
                Power_shaft = W_real_dry * m_flow_in / 1000.0; // kW
                spray_notes = "计算结果为过热蒸汽，无需喷水。";
            }
            
            // 7. 格式化输出
            const T_in_C = T_in_K - 273.15;
            const T_sat_in_C = T_sat_in_K - 273.15;
            const T_sat_out_C = T_sat_out_K - 273.15;

            let resultText = `
========= 模式三 (MVR 容积式) 计算报告 =========
工质: ${fluid}

--- 1. 进口状态 (P, T) ---
进口压力 (P_in):    ${(p_in_Pa / 1e5).toFixed(3)} bar
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

--- 4. 流量 (基于容积) ---
转速 (RPM):         ${rpm} r/min
排量 (V_disp):      ${vol_disp_cm3} cm³
容积效率 (Eff_vol): ${(vol_eff * 100.0).toFixed(1)} %
----------------------------------------
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
            resultsDivM3.textContent = resultText;
            lastMode3ResultText = resultText;
            
            calcButtonM3.textContent = btnText;
            calcButtonM3.classList.remove(...classesStale);
            calcButtonM3.classList.add(...classesFresh);
            calcButtonM3.disabled = false;
            printButtonM3.disabled = false;

        } catch (err) {
            console.error("Mode 3 calculation failed:", err);
            resultsDivM3.textContent = `计算出错: \n${err.message}\n\n请检查输入参数是否在工质的有效范围内。`;
            calcButtonM3.textContent = "计算失败";
            calcButtonM3.disabled = false;
            setButtonStale();
        }
    }, 10);
}

/**
 * 打印模式三报告
 */
function printReportMode3() {
    if (!lastMode3ResultText) {
        alert("没有可供打印的计算结果 (M3)。");
        return;
    }
    const printHtml = `
        <html><head><title>模式三 (MVR 容积式) 计算报告</title>
        <style>
            body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #7e22ce; border-bottom: 2px solid #7e22ce; }
            pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 14px; white-space: pre-wrap; }
            footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
        </style>
        </head><body>
            <h1>模式三 (MVR 容积式) 计算报告</h1>
            <pre>${lastMode3ResultText}</pre>
            <footer><p>版本: v4.6</p><p>计算时间: ${new Date().toLocaleString()}</p></footer>
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


/**
 * (v4.0) 模式三：初始化函数
 * @param {object} CP - CoolProp 实例
 */
export function initMode3(CP) {
    CP_INSTANCE = CP; // 将 CP 实例存储在模块作用域
    
    // 获取 DOM 元素
    calcButtonM3 = document.getElementById('calc-button-mode-3');
    resultsDivM3 = document.getElementById('results-mode-3');
    calcFormM3 = document.getElementById('calc-form-mode-3');
    printButtonM3 = document.getElementById('print-button-mode-3');
    fluidSelectM3 = document.getElementById('fluid_m3');
    fluidInfoDivM3 = document.getElementById('fluid-info-m3');

    // (v5.1 修复) 健壮性检查
    if (!calcFormM3) {
        console.error("Mode 3 Form (calc-form-mode-3) not found! Cannot initialize.");
        return;
    }
    allInputsM3 = calcFormM3.querySelectorAll('input, select');

    // 绑定计算事件
    calcFormM3.addEventListener('submit', (event) => {
        event.preventDefault();
        calculateMode3();
    });

    // 绑定“脏”状态检查
    allInputsM3.forEach(input => {
        input.addEventListener('input', setButtonStale);
        input.addEventListener('change', setButtonStale);
    });

    // 绑定流体信息更新
    fluidSelectM3.addEventListener('change', () => {
        updateFluidInfo(fluidSelectM3, fluidInfoDivM3, CP);
        setButtonStale();
    });

    // 绑定打印事件
    printButtonM3.addEventListener('click', printReportMode3);

    console.log("Mode 3 (MVR Volumetric) initialized.");
}