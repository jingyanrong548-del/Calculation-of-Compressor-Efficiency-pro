// =====================================================================
// mode3_mvr.js: 模式三 (MVR 喷水计算) 模块
// 版本: v3.0
// 职责: 1. 初始化模式三的 UI 事件
//        2. 执行模式三 (MVR) 的计算
//        3. 处理打印
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
    calcButtonM3.textContent = btnTextStale;
    calcButtonM3.classList.remove(...classesFresh);
    calcButtonM3.classList.add(...classesStale);
    printButtonM3.disabled = true;
    lastMode3ResultText = null;
}

/**
 * 设置按钮为“新”状态 (Fresh)
 */
function setButtonFresh() {
    calcButtonM3.textContent = btnText;
    calcButtonM3.classList.remove(...classesStale);
    calcButtonM3.classList.add(...classesFresh);
}


/**
 * 模式三：主计算函数 (MVR 喷水)
 */
function calculateMode3() {
    try {
        // --- A. 获取所有输入值 ---
        const fluid = fluidSelectM3.value; // 必须是 'Water'
        const rpm_val = parseFloat(document.getElementById('rpm_m3').value);
        const displacement_m3 = parseFloat(document.getElementById('displacement_m3').value);
        const eta_s_m3 = parseFloat(document.getElementById('eta_s_m3').value);
        const eta_v_m3 = parseFloat(document.getElementById('eta_v_m3').value);
        const Te_C = parseFloat(document.getElementById('temp_evap_m3').value);
        const Tc_C = parseFloat(document.getElementById('temp_cond_m3').value);
        const T_water_in_m3 = parseFloat(document.getElementById('temp_water_in_m3').value);
        const target_state_m3 = document.getElementById('target_state_m3').value;

        if (isNaN(rpm_val) || isNaN(displacement_m3) || isNaN(eta_s_m3) || isNaN(eta_v_m3) || isNaN(Te_C) || isNaN(Tc_C) || isNaN(T_water_in_m3)) {
            throw new Error("输入包含无效数字，请检查所有字段。");
        }
        if (rpm_val <= 0 || displacement_m3 <= 0 || eta_s_m3 <= 0 || eta_v_m3 <= 0) {
            throw new Error("转速、排量和效率必须大于零。");
        }
        if (Tc_C <= Te_C) {
            throw new Error("出口温度必须高于入口温度。");
        }
        
        // --- B. 单位转换与常数 ---
        const Te_K = Te_C + 273.15;
        const Tc_K = Tc_C + 273.15;
        const T_water_in_K = T_water_in_m3 + 273.15;

        // --- C. (Step 1) 计算入口状态 (1) ---
        // 假设入口总是饱和蒸汽
        const Pe_Pa = CP_INSTANCE.PropsSI('P', 'T', Te_K, 'Q', 1, fluid);
        const h_1 = CP_INSTANCE.PropsSI('H', 'P', Pe_Pa, 'Q', 1, fluid);
        const s_1 = CP_INSTANCE.PropsSI('S', 'P', Pe_Pa, 'Q', 1, fluid);
        const rho_1 = CP_INSTANCE.PropsSI('D', 'P', Pe_Pa, 'Q', 1, fluid);
        
        // --- D. (Step 2) 计算喷水入口状态 (water_in) ---
        // 假设喷水总是饱和液体 (Q=0)
        const h_water_in = CP_INSTANCE.PropsSI('H', 'T', T_water_in_K, 'Q', 0, fluid);

        // --- E. (Step 3) 计算目标出口状态 (2) ---
        const Pc_Pa = CP_INSTANCE.PropsSI('P', 'T', Tc_K, 'Q', 1, fluid);
        const target_Q = (target_state_m3 === 'SaturatedVapor') ? 1 : 0;
        const h_2_target = CP_INSTANCE.PropsSI('H', 'P', Pc_Pa, 'Q', target_Q, fluid);
        const T_2_target = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'Q', target_Q, fluid) - 273.15;

        // --- F. (Step 4) 计算干蒸汽流量 (m_dot_gas) ---
        const V_th_m3_s = (displacement_m3 / 1e6) * (rpm_val / 60);
        const V_act_m3_s = V_th_m3_s * eta_v_m3;
        const m_dot_gas = V_act_m3_s * rho_1;

        // --- G. (Step 5) 计算理论轴功率 (W_shaft_W) ---
        // G.1: 找到干式压缩的等熵出口 (2s)
        const h_2s = CP_INSTANCE.PropsSI('H', 'P', Pc_Pa, 'S', s_1, fluid);
        const T_2s = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'S', s_1, fluid) - 273.15;
        
        // G.2: 计算干式等熵功率 (Ws) 和实际轴功率 (W_shaft)
        const Ws_W = m_dot_gas * (h_2s - h_1);
        const W_shaft_W = Ws_W / eta_s_m3;

        // --- H. (Step 6) 求解喷水量 (m_dot_water) ---
        // 基于能量平衡方程:
        // W_shaft_W + m_dot_gas*h_1 + m_dot_water*h_water_in = m_dot_gas*h_2_target + m_dot_water*h_2_target
        // W_shaft_W = m_dot_gas*(h_2_target - h_1) + m_dot_water*(h_2_target - h_water_in)
        // m_dot_water = ( W_shaft_W - m_dot_gas*(h_2_target - h_1) ) / (h_2_target - h_water_in)

        const energy_excess_W = W_shaft_W - (m_dot_gas * (h_2_target - h_1));
        const energy_per_kg_water = h_2_target - h_water_in;

        if (energy_per_kg_water <= 0) {
            throw new Error("计算错误：每kg喷水吸收的能量小于等于零。");
        }
        if (energy_excess_W < 0) {
            // 这意味着压缩机效率太低，轴功W_shaft甚至不足以将干蒸汽加热到目标状态
            throw new Error(`计算错误：轴功率不足。 W_shaft (${(W_shaft_W/1000).toFixed(2)} kW) 小于将干蒸汽加热到目标状态所需的理论功率 (${(m_dot_gas * (h_2_target - h_1)/1000).toFixed(2)} kW)。不需要喷水，反而需要加热！请检查效率输入。`);
        }
        
        const m_dot_water = energy_excess_W / energy_per_kg_water;

        // --- I. 格式化输出 ---
        let output = `
--- 计算概览 (工质: ${fluid}, MVR 模式) ---
入口压力 (Pe): ${(Pe_Pa / 1e5).toFixed(3)} bar (${Te_C.toFixed(2)} °C 饱和)
出口压力 (Pc): ${(Pc_Pa / 1e5).toFixed(3)} bar (${Tc_C.toFixed(2)} °C 饱和)
压缩比 (PR):   ${(Pc_Pa / Pe_Pa).toFixed(2)}

--- 关键状态点 (焓值) ---
状态 1 (入口饱和蒸汽):
  h1 = ${(h_1 / 1000).toFixed(2)} kJ/kg
状态 2s (干式等熵出口):
  T2s = ${T_2s.toFixed(2)} °C
  h2s = ${(h_2s / 1000).toFixed(2)} kJ/kg
喷水 (入口液态水):
  T_water_in = ${T_water_in_m3.toFixed(2)} °C
  h_water_in = ${(h_water_in / 1000).toFixed(2)} kJ/kg
目标 2 (出口 ${target_state_m3}):
  T2_target = ${T_2_target.toFixed(2)} °C
  h2_target = ${(h_2_target / 1000).toFixed(2)} kJ/kg

--- 压缩机性能 ---
理论排量 (V_th): ${V_th_m3_s.toFixed(5)} m³/s (${(V_th_m3_s * 3600).toFixed(2)} m³/h)
实际吸气 (V_act): ${V_act_m3_s.toFixed(5)} m³/s (${(V_act_m3_s * 3600).toFixed(2)} m³/h)
干蒸汽质量流 (m_dot_gas): ${m_dot_gas.toFixed(5)} kg/s

--- 功率平衡 ---
干式等熵功率 (Ws): ${(Ws_W / 1000).toFixed(3)} kW
实际轴功率 (W_shaft): ${(W_shaft_W / 1000).toFixed(3)} kW (基于 η_s = ${eta_s_m3.toFixed(3)})
蒸汽焓升所需功率:     ${(m_dot_gas * (h_2_target - h_1) / 1000).toFixed(3)} kW
需喷水带走的热量:     ${(energy_excess_W / 1000).toFixed(3)} kW
  (备注: W_shaft - 蒸汽焓升所需功率)
每kg水可吸收热量:   ${(energy_per_kg_water / 1000).toFixed(2)} kJ/kg
  (备注: h2_target - h_water_in)

========================================
           MVR 喷水计算结果
========================================
所需喷水量 (m_dot_water): ${m_dot_water.toFixed(5)} kg/s
  (约等于: ${(m_dot_water * 3600).toFixed(3)} kg/h)

--- 最终出口状态 ---
总出口质量流 (m_dot_total): ${(m_dot_gas + m_dot_water).toFixed(5)} kg/s
出口蒸汽干度 (Q_out):       ${(m_dot_gas / (m_dot_gas + m_dot_water)).toFixed(4)}
  (备注: 仅当目标为饱和蒸汽时，此干度有意义)
`;

        resultsDivM3.textContent = output;
        lastMode3ResultText = output; // 存储纯文本

        setButtonFresh();
        printButtonM3.disabled = false;

    } catch (error) {
        resultsDivM3.textContent = `计算出错: ${error.message}\n\n请检查输入参数是否在工质的有效范围内。`;
        console.error(error);
        lastMode3ResultText = null;
        printButtonM3.disabled = true;
    }
}

/**
 * 准备模式三的打印报告
 */
function printReportMode3() {
    if (!lastMode3ResultText) {
        alert("没有可打印的结果。");
        return;
    }
    
    const inputs = {
        "报告类型": "模式三: MVR 喷水计算",
        "工质": fluidSelectM3.value,
        "压缩机转速 (RPM)": document.getElementById('rpm_m3').value,
        "每转排量 (cm³/rev)": document.getElementById('displacement_m3').value,
        "等熵效率 (η_s)": document.getElementById('eta_s_m3').value,
        "容积效率 (η_v)": document.getElementById('eta_v_m3').value,
        "入口饱和温度 (°C)": document.getElementById('temp_evap_m3').value,
        "出口饱和温度 (°C)": document.getElementById('temp_cond_m3').value,
        "喷水温度 (°C)": document.getElementById('temp_water_in_m3').value,
        "目标出口状态": document.getElementById('target_state_m3').options[document.getElementById('target_state_m3').selectedIndex].text,
    };

    let printHtml = `
        <h1>压缩机性能计算报告</h1>
        <p>计算时间: ${new Date().toLocaleString('zh-CN')}</p>
        <h2>1. 输入参数 (模式三)</h2>
        <table class="print-table">
            ${Object.entries(inputs).map(([key, value]) => `
                <tr>
                    <th>${key}</th>
                    <td>${value}</td>
                </tr>
            `).join('')}
        </table>
        <h2>2. 计算结果 (模式三)</h2>
        <pre class="print-results">${lastMode3ResultText}</pre>
        <h3>--- 报告结束 (编者: 荆炎荣) ---</h3>
    `;

    callPrint(printHtml);
}

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
 * 模式三：初始化函数
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

    // 绑定流体信息更新 (虽然被禁用, 但在未来启用时有用)
    fluidSelectM3.addEventListener('change', () => {
        updateFluidInfo(fluidSelectM3, fluidInfoDivM3, CP_INSTANCE);
    });

    // 绑定打印按钮
    printButtonM3.addEventListener('click', printReportMode3);
    
    console.log("模式三 (MVR) 已初始化。");
}