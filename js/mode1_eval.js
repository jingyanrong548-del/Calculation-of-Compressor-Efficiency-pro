// =====================================================================
// mode1_eval.js: 模式一 (性能评估) 模块
// 版本: v4.3 (RPM 逻辑修复)
// 职责: 1. 初始化模式一的 UI 事件
//        2. 执行模式一 (评估) 的计算
//        3. 处理打印和数据传输
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode1Results = null;
let lastMode1ResultText = null;

// --- DOM 元素引用 ---
let calcButtonM1, resultsDivM1, calcFormM1, transferButton, printButtonM1;
let fluidSelectM1, fluidInfoDivM1;
let allInputsM1;

// --- 按钮状态常量 ---
const btnText = "计算效率 (模式一)";
const btnTextStale = "重新计算 (模式一)";
const classesFresh = ['bg-blue-600', 'hover:bg-blue-700', 'text-white'];
const classesStale = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

/**
 * 设置按钮为“脏”状态 (Stale)
 */
function setButtonStale() {
    calcButtonM1.textContent = btnTextStale;
    calcButtonM1.classList.remove(...classesFresh);
    calcButtonM1.classList.add(...classesStale);
    transferButton.disabled = true;
    printButtonM1.disabled = true;
    lastMode1Results = null;
    lastMode1ResultText = null;
}

/**
 * 设置按钮为“新”状态 (Fresh)
 */
function setButtonFresh() {
    calcButtonM1.textContent = btnText;
    calcButtonM1.classList.remove(...classesStale);
    calcButtonM1.classList.add(...classesFresh);
}


/**
 * 模式一：主计算函数
 */
function calculateMode1() {
    try {
        // --- A. 获取所有输入值 ---
        const fluid = fluidSelectM1.value;
        const flow_mode = document.querySelector('input[name="flow_mode"]:checked').value;
        const power_mode = document.querySelector('input[name="power_mode"]:checked').value;
        const capacity_mode = document.querySelector('input[name="capacity_mode"]:checked').value;
        
        // v4.3 修复: 仅在 'rpm' 模式下读取 rpm
        let rpm_val = NaN;
        if (flow_mode === 'rpm') {
             rpm_val = parseFloat(document.getElementById('rpm').value);
        }

        const Q_input_kW = parseFloat(document.getElementById('capacity').value);
        const Win_box_kW = parseFloat(document.getElementById('power').value);
        const motor_eff_val = parseFloat(document.getElementById('motor_eff').value);
        const Te_C = parseFloat(document.getElementById('temp_evap').value);
        const Tc_C = parseFloat(document.getElementById('temp_cond').value);
        const dT_sh_K = parseFloat(document.getElementById('superheat').value);
        const dT_sc_K = parseFloat(document.getElementById('subcooling').value);
        
        // v4.3 修复: 更新 NaN 检查
        if (isNaN(Q_input_kW) || isNaN(Win_box_kW) || isNaN(Te_C) || isNaN(Tc_C) || isNaN(dT_sh_K) || isNaN(dT_sc_K)) {
            throw new Error("输入包含无效数字，请检查所有字段。");
        }
        if (flow_mode === 'rpm' && isNaN(rpm_val)) {
             throw new Error("在'按转速'模式下，必须提供有效的转速。");
        }
        if (power_mode === 'input' && isNaN(motor_eff_val)) {
             throw new Error("在'输入功率'模式下，必须提供有效的电机效率。");
        }

        // --- B. 单位转换 ---
        const Te_K = Te_C + 273.15;
        const Tc_K = Tc_C + 273.15;
        const Q_input_W = Q_input_kW * 1000;
        const Win_box_W = Win_box_kW * 1000;

        // --- C. 功率和容量计算 ---
        let W_shaft_W;
        let Win_input_W;
        if (power_mode === 'shaft') {
            W_shaft_W = Win_box_W;
            Win_input_W = NaN;
        } else {
            Win_input_W = Win_box_W;
            W_shaft_W = Win_input_W * motor_eff_val;
        }
        let Qe_W;
        let Qh_W;
        if (capacity_mode === 'refrigeration') {
            Qe_W = Q_input_W;
            Qh_W = Qe_W + W_shaft_W;
        } else {
            Qh_W = Q_input_W;
            Qe_W = Qh_W - W_shaft_W;
        }
        if (Qe_W <= 0) {
            throw new Error(`计算的制冷量 (Qe = Qh - W_shaft) 小于等于零 (${(Qe_W/1000).toFixed(2)} kW)。请检查输入。`);
        }

        // --- D. 理论体积流量 (m³/s) ---
        let V_th_m3_s;
        let V_rev_cm3_val = NaN, V_th_m3_h_val = NaN;
        if (flow_mode === 'rpm') {
            V_rev_cm3_val = parseFloat(document.getElementById('displacement').value);
            if (isNaN(V_rev_cm3_val)) throw new Error("请检查每转排量输入。");
            if (rpm_val <= 0) throw new Error("转速必须大于 0。");
            V_th_m3_s = (V_rev_cm3_val / 1e6) * (rpm_val / 60);
            V_th_m3_h_val = V_th_m3_s * 3600;
        } else {
            // 'vol' 模式
            V_th_m3_h_val = parseFloat(document.getElementById('flow_m3h').value);
            if (isNaN(V_th_m3_h_val)) throw new Error("请检查体积流量输入。");
            V_th_m3_s = V_th_m3_h_val / 3600;
            // v4.3 修复: rpm_val 和 V_rev_cm3_val 此时为 NaN, 跳过无效计算
        }
        if (V_th_m3_s <= 0) throw new Error("理论排量必须大于零。");

        // --- E. 计算稳定状态点 (1, 3, 4) ---
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

        // --- F. 计算稳定的性能参数 (质量流, 容积效率) ---
        const h_evap_J_kg = h1_J_kg - h4_J_kg;
        if (h_evap_J_kg <= 0) throw new Error("计算出错：制冷焓差小于等于零。");
        const m_dot_kg_s = Qe_W / h_evap_J_kg;
        const V_actual_m3_s = m_dot_kg_s * v1_m3_kg;
        const eta_v = (V_actual_m3_s / V_th_m3_s);

        // --- G. 计算两种效率 ---
        let Ws_W, h2s_J_kg, T2s_K, T2s_C;
        let eta_s_shaft = NaN;
        let eta_s_total = NaN;
        let isentropic_error_msg = null;
        try {
            h2s_J_kg = CP_INSTANCE.PropsSI('H', 'P', Pc_Pa, 'S', s1_J_kgK, fluid);
            T2s_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'S', s1_J_kgK, fluid);
            T2s_C = T2s_K - 273.15;
            
            const h_isen_J_kg = h2s_J_kg - h1_J_kg;
            if (h_isen_J_kg <= 0) throw new Error("理论等熵焓升小于等于零, 工况错误。");
            Ws_W = m_dot_kg_s * h_isen_J_kg;
            if (W_shaft_W <= 0) throw new Error("计算出的轴功率必须大于零。");
            eta_s_shaft = Ws_W / W_shaft_W;
            if (power_mode === 'input') {
                if (Win_input_W <= 0) throw new Error("输入功率必须大于零。");
                eta_s_total = Ws_W / Win_input_W;
            }
        } catch (isen_error) {
            console.error("Isentropic calculation failed (Mode 1):", isen_error);
            isentropic_error_msg = `计算失败 (${isen_error.message})`;
            Ws_W = NaN; h2s_J_kg = NaN; T2s_K = NaN; T2s_C = NaN;
            eta_s_shaft = NaN; eta_s_total = NaN;
        }

        // --- G.2 计算实际排气温度 T2a ---
        let T2a_K = NaN, T2a_C = NaN, h2a_J_kg = NaN;
        let actual_temp_error_msg = null;
        try {
            if (m_dot_kg_s <= 0) throw new Error("质量流量为零，无法计算。");
            h2a_J_kg = (W_shaft_W / m_dot_kg_s) + h1_J_kg;
            T2a_K = CP_INSTANCE.PropsSI('T', 'P', Pc_Pa, 'H', h2a_J_kg, fluid);
            T2a_C = T2a_K - 273.15;
        } catch (actual_temp_error) {
            console.error("Actual temp calculation failed (Mode 1):", actual_temp_error);
            actual_temp_error_msg = `计算失败 (${actual_temp_error.message})`;
            T2a_K = NaN; T2a_C = NaN; h2a_J_kg = NaN;
        }

        // --- H. 格式化输出 ---
        const powerInputLabel = (power_mode === 'shaft') ? `轴功率 (Win)` : `输入功率 (Win)`;
        const capacityInputLabel = (capacity_mode === 'refrigeration') ? `制冷量 (Qe)` : `制热量 (Qh)`;

        let output = `
--- 计算概览 (工质: ${fluid}) ---
蒸发压力 (Pe): ${(Pe_Pa / 1e5).toFixed(3)} bar
冷凝压力 (Pc): ${(Pc_Pa / 1e5).toFixed(3)} bar
压缩比 (PR):   ${(Pc_Pa / Pe_Pa).toFixed(2)}

--- 关键状态点 ---
状态 1 (入口):
  T1 = ${T1_K.toFixed(2)} K (${(T1_K - 273.15).toFixed(2)} °C)
  h1 = ${(h1_J_kg / 1000).toFixed(2)} kJ/kg
  s1 = ${(s1_J_kgK / 1000).toFixed(4)} kJ/kg·K
  v1 = ${v1_m3_kg.toFixed(5)} m³/kg
状态 3 (阀前):
  T3 = ${T3_K.toFixed(2)} K (${(T3_K - 273.15).toFixed(2)} °C)
  h3 = ${(h3_J_kg / 1000).toFixed(2)} kJ/kg
状态 2s (等熵出口):
  T2s = ${isNaN(T2s_C) ? `N/A (${isentropic_error_msg})` : `${T2s_C.toFixed(2)} °C`}
  h2s = ${isNaN(h2s_J_kg) ? `N/A (${isentropic_error_msg})` : `${(h2s_J_kg / 1000).toFixed(2)} kJ/kg`}
状态 2a (实际出口):
  T2a = ${isNaN(T2a_C) ? `N/A (${actual_temp_error_msg})` : `${T2a_C.toFixed(2)} °C`}
  h2a = ${isNaN(h2a_J_kg) ? `N/A (${actual_temp_error_msg})` : `${(h2a_J_kg / 1000).toFixed(2)} kJ/kg`}

--- 功率与容量 (基于能量平衡) ---
输入 ${capacityInputLabel}: ${Q_input_kW.toFixed(3)} kW
输入 ${powerInputLabel}: ${Win_box_kW.toFixed(3)} kW
${(power_mode === 'input') ? `电机效率:       ${(motor_eff_val * 100).toFixed(1)} %` : ''}
${(power_mode === 'input') ? `计算轴功率:     ${(W_shaft_W / 1000).toFixed(3)} kW` : ''}

计算 ${capacity_mode === 'refrigeration' ? '制热量 (Qh)' : '制冷量 (Qe)'}: ${capacity_mode === 'refrigeration' ? (Qh_W / 1000).toFixed(3) : (Qe_W / 1000).toFixed(3)} kW

--- 流量与等熵功率 ---
制冷焓差:     ${(h_evap_J_kg / 1000).toFixed(2)} kJ/kg
质量流量 (m_dot): ${m_dot_kg_s.toFixed(5)} kg/s
等熵功率 (Ws):   ${isNaN(Ws_W) ? 'N/A' : `${(Ws_W / 1000).toFixed(3)} kW`}
`;
        // v4.3 修复: 调整输出
        let flow_output = '';
        if (flow_mode === 'rpm') {
            flow_output = `
--- 体积流量 (转速: ${rpm_val.toFixed(0)} RPM) ---
输入排量:     ${V_rev_cm3_val.toFixed(1)} cm³/rev
计算流量:     ${V_th_m3_h_val.toFixed(2)} m³/h
`;
        } else {
            flow_output = `
--- 体积流量 ---
输入流量:     ${V_th_m3_h_val.toFixed(2)} m³/h
`;
        }
        
        output += flow_output; // 添加条件块

        output += `
理论体积流量 (V_th): ${V_th_m3_s.toFixed(6)} m³/s
实际体积流量 (V_act): ${V_actual_m3_s.toFixed(6)} m³/s

========================================
           最终效率计算 (备注)
========================================
等熵效率 (η_s):       ${isNaN(eta_s_shaft) ? 'N/A' : `${(eta_s_shaft * 100).toFixed(2)} %`}\n`;
        output += `  (备注: 理论等熵功率 / 实际轴功率)\n`;

        if (power_mode === 'input') {
            output += `总等熵效率 (η_total):   ${isNaN(eta_s_total) ? 'N/A' : `${(eta_s_total * 100).toFixed(2)} %`}\n`;
            output += `  (备注: 理论等熵功率 / 电机输入功率)\n`;
        }
        
        output += `容积效率 (η_v):         ${(eta_v * 100).toFixed(2)} %`;
        output += `\n  (备注: 实际吸气体积流量 / 理论输气量)`;

        resultsDivM1.textContent = output;
        lastMode1ResultText = output; // 存储纯文本

        // 缓存结果并启用转换按钮
        lastMode1Results = {
            fluid,
            rpm_val, // 可能为 NaN
            flow_mode,
            V_rev_cm3_val, // 可能为 NaN
            V_th_m3_h_val,
            Te_C,
            Tc_C,
            dT_sh_K,
            dT_sc_K,
            power_mode,
            motor_eff_val,
            eta_v: isNaN(eta_v) ? null : eta_v,
            eta_s_shaft: isNaN(eta_s_shaft) ? null : eta_s_shaft,
            eta_s_total: isNaN(eta_s_total) ? null : eta_s_total
        };
        transferButton.disabled = false;
        printButtonM1.disabled = false;

        setButtonFresh();

    } catch (error) {
        resultsDivM1.textContent = `计算出错: ${error.message}\n\n请检查输入参数是否在工质的有效范围内。`;
        console.error(error);
        
        lastMode1Results = null;
        lastMode1ResultText = null;
        transferButton.disabled = true;
        printButtonM1.disabled = true;
    }
}

/**
 * 准备模式一的打印报告
 */
function printReportMode1() {
    if (!lastMode1ResultText) {
        alert("没有可打印的结果。");
        return;
    }

    // 1. 收集所有输入
    const flow_mode_val = document.querySelector('input[name="flow_mode"]:checked').value;
    
    const inputs = {
        "报告类型": "模式一: 性能评估",
        "制冷剂": fluidSelectM1.value,
        "理论输气量模式": flow_mode_val === 'rpm' ? '按转速与排量' : '按体积流量',
        "压缩机转速 (RPM)": flow_mode_val === 'rpm' ? document.getElementById('rpm').value : 'N/A',
        "每转排量 (cm³/rev)": flow_mode_val === 'rpm' ? document.getElementById('displacement').value : 'N/A',
        "理论体积流量 (m³/h)": flow_mode_val === 'vol' ? document.getElementById('flow_m3h').value : 'N/A',
        "容量模式": document.querySelector('input[name="capacity_mode"]:checked').value === 'heating' ? '制热量 (冷凝器)' : '制冷量',
        "输入容量 (kW)": document.getElementById('capacity').value,
        "功率模式": document.querySelector('input[name="power_mode"]:checked').value === 'input' ? '输入功率 (电机)' : '轴功率',
        "输入功率 (kW)": document.getElementById('power').value,
        "电机效率": document.querySelector('input[name="power_mode"]:checked').value === 'input' ? document.getElementById('motor_eff').value : 'N/A',
        "蒸发温度 (°C)": document.getElementById('temp_evap').value,
        "冷凝温度 (°C)": document.getElementById('temp_cond').value,
        "有效过热度 (K)": document.getElementById('superheat').value,
        "过冷度 (K)": document.getElementById('subcooling').value,
    };

    // 2. 生成打印HTML
    let printHtml = `
        <h1>压缩机性能计算报告</h1>
        <p>计算时间: ${new Date().toLocaleString('zh-CN')}</p>
        <h2>1. 输入参数 (模式一)</h2>
        <table class="print-table">
            ${Object.entries(inputs).map(([key, value]) => `
                <tr>
                    <th>${key}</th>
                    <td>${value}</td>
                </tr>
            `).join('')}
        </table>
        <h2>2. 计算结果 (模式一)</h2>
        <pre class="print-results">${lastMode1ResultText}</pre>
        <h3>--- 报告结束 (编者: 荆炎荣) ---</h3>
    `;
    
    // 3. 执行打印 (调用全局打印函数)
    callPrint(printHtml);
}

/**
 * 转换数据到模式二
 */
function transferToMode2() {
    if (!lastMode1Results) {
        alert("没有可代入的数据。请先在模式一中成功计算。");
        return;
    }
    
    const data = lastMode1Results;

    // 1. 代入通用工况
    document.getElementById('fluid_m2').value = data.fluid;
    document.getElementById('temp_evap_m2').value = data.Te_C;
    document.getElementById('temp_cond_m2').value = data.Tc_C;
    document.getElementById('superheat_m2').value = data.dT_sh_K;
    document.getElementById('subcooling_m2').value = data.dT_sc_K;
    
    // 2. 代入流量模式 (v4.3 修复)
    const flowModeRpmM2 = document.getElementById('flow_mode_rpm_m2');
    const flowModeVolM2 = document.getElementById('flow_mode_vol_m2');
    if (data.flow_mode === 'rpm') {
        flowModeRpmM2.checked = true;
        document.getElementById('rpm_m2').value = data.rpm_val; // rpm_val 是有效的
        document.getElementById('displacement_m2').value = data.V_rev_cm3_val;
        flowModeRpmM2.dispatchEvent(new Event('change')); // 触发 UI 切换
    } else {
        // 'vol' 模式
        flowModeVolM2.checked = true;
        document.getElementById('flow_m3h_m2').value = data.V_th_m3_h_val;
        // rpm_val 和 V_rev_cm3_val 为 NaN, 不需要设置
        flowModeVolM2.dispatchEvent(new Event('change')); // 触发 UI 切换
    }

    // 3. 代入核心效率 (智能判断)
    const etaVInputM2 = document.getElementById('eta_v_m2');
    if (data.eta_v === null) {
        alert("警告: 模式一未能算出有效的容积效率 (η_v)。");
        etaVInputM2.value = 0.85; // 填入默认值
    } else {
        etaVInputM2.value = data.eta_v.toFixed(3);
    }
    
    const effModeInputM2 = document.getElementById('eff_mode_input_m2');
    const effModeShaftM2 = document.getElementById('eff_mode_shaft_m2');
    const etaSInputM2 = document.getElementById('eta_s_m2');

    if (data.power_mode === 'input' && data.eta_s_total !== null) {
        effModeInputM2.checked = true;
        etaSInputM2.value = data.eta_s_total.toFixed(3);
        document.getElementById('motor_eff_m2').value = data.motor_eff_val;
        effModeInputM2.dispatchEvent(new Event('change'));
        
    } else if (data.power_mode === 'shaft' && data.eta_s_shaft !== null) {
        effModeShaftM2.checked = true;
        etaSInputM2.value = data.eta_s_shaft.toFixed(3);
        effModeShaftM2.dispatchEvent(new Event('change'));

    } else if (data.eta_s_shaft !== null) {
        effModeShaftM2.checked = true;
        etaSInputM2.value = data.eta_s_shaft.toFixed(3);
        effModeShaftM2.dispatchEvent(new Event('change'));
        
    } else {
        alert("警告: 模式一未能算出有效的等熵效率 (η_s)。将使用默认值。");
        effModeShaftM2.checked = true;
        etaSInputM2.value = 0.7; // 填入默认值
        effModeShaftM2.dispatchEvent(new Event('change'));
    }

    // 4. 更新制冷剂信息
    updateFluidInfo(document.getElementById('fluid_m2'), document.getElementById('fluid-info-m2'), CP_INSTANCE);
    
    // 5. 自动切换视图
    const mode2Radio = document.getElementById('mode-2-radio');
    mode2Radio.checked = true;
    mode2Radio.dispatchEvent(new Event('change'));
    
    // 6. 提示用户
    document.getElementById('results-mode-2').textContent = "--- 数据已从模式一代入 --- \n--- 请点击下方按钮计算性能 ---";
    // 触发模式二的“脏检查”
    document.getElementById('calc-button-mode-2').dispatchEvent(new Event('stale'));
}


/**
 * 打印报告的核心函数 (全局)
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
 * 模式一：初始化函数
 * @param {object} CP - CoolProp 实例
 */
export function initMode1(CP) {
    CP_INSTANCE = CP; // 将 CP 实例存储在模块作用域
    
    // 获取 DOM 元素
    calcButtonM1 = document.getElementById('calc-button-mode-1');
    resultsDivM1 = document.getElementById('results-mode-1');
    calcFormM1 = document.getElementById('calc-form-mode-1');
    transferButton = document.getElementById('transfer-to-mode-2');
    printButtonM1 = document.getElementById('print-button-mode-1');
    fluidSelectM1 = document.getElementById('fluid');
    fluidInfoDivM1 = document.getElementById('fluid-info');
    allInputsM1 = calcFormM1.querySelectorAll('input, select');

    // 绑定计算事件
    calcFormM1.addEventListener('submit', (event) => {
        event.preventDefault();
        calculateMode1();
    });

    // 绑定“脏”状态检查
    allInputsM1.forEach(input => {
        input.addEventListener('input', setButtonStale);
        input.addEventListener('change', setButtonStale);
    });

    // 绑定流体信息更新
    fluidSelectM1.addEventListener('change', () => {
        updateFluidInfo(fluidSelectM1, fluidInfoDivM1, CP_INSTANCE);
    });

    // 绑定打印按钮
    printButtonM1.addEventListener('click', printReportMode1);
    
    // 绑定转换按钮
    transferButton.addEventListener('click', transferToMode2);

    console.log("模式一 (评估) 已初始化。");
}