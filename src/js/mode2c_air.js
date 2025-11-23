// =====================================================================
// mode2c_air.js: 模式三 (空压机) 模块
// 版本: v7.2 (引入动态效率模型)
// 职责: 1. 作为独立的模式三运行。
//        2. 新增效率选型下拉菜单的事件处理逻辑。
//        3. 新增基于压比的动态效率模型计算逻辑。
// =====================================================================

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode3ResultText = null;

// --- 模式三 DOM 元素 ---
let calcButtonM3, resultsDivM3, calcFormM3, printButtonM3;
let allInputsM3;
let radioCoolingNone, radioCoolingJacket, radioCoolingInjection;
let jacketInputsDiv, injectionInputsDiv;
let enableCoolerCalcM3, coolerInputsDivM3;
let jacketHeatInput, injectionTempInput;

// --- 按钮状态 (模式三) ---
const btnText3 = "计算性能 (空压机)";
const btnTextStale3 = "重新计算 (空压机)";
const classesFresh3 = ['bg-cyan-600', 'hover:bg-cyan-700', 'text-white'];
const classesStale3 = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

/**
 * 设置按钮为“脏”状态 (Stale) (模式三)
 */
function setButtonStale3() {
    if (!calcButtonM3) return;
    calcButtonM3.textContent = btnTextStale3;
    calcButtonM3.classList.remove(...classesFresh3);
    calcButtonM3.classList.add(...classesStale3);
    printButtonM3.disabled = true;
    lastMode3ResultText = null;
}

/**
 * 切换冷却模式特定输入框的显示和禁用状态
 */
function toggleCoolingInputs() {
    if (radioCoolingJacket.checked) {
        jacketInputsDiv.style.display = 'block';
        jacketHeatInput.disabled = false;
        jacketHeatInput.required = true;
    } else {
        jacketInputsDiv.style.display = 'none';
        jacketHeatInput.disabled = true;
        jacketHeatInput.required = false;
    }

    if (radioCoolingInjection.checked) {
        injectionInputsDiv.style.display = 'block';
        injectionTempInput.disabled = false;
        injectionTempInput.required = true;
    } else {
        injectionInputsDiv.style.display = 'none';
        injectionTempInput.disabled = true;
        injectionTempInput.required = false;
    }
}

/**
 * 模式三 核心计算函数
 */
async function calculateMode3() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM3.textContent = "错误: CoolProp 未加载。";
        return;
    }

    // 1. 设置按钮为加载中
    calcButtonM3.disabled = true;
    calcButtonM3.textContent = "计算中...";
    resultsDivM3.textContent = "--- 正在计算, 请稍候... ---";

    // 异步执行，防止 UI 阻塞
    setTimeout(() => {
        try {
            // 2. 获取表单数据
            const formData = new FormData(calcFormM3);
            
            // 进口参数
            const p_in_bar = parseFloat(formData.get('p_in_m3'));
            const T_in_C = parseFloat(formData.get('T_in_m3'));
            const RH_in_percent = parseFloat(formData.get('RH_in_m3'));
            
            // 压缩过程
            const p_out_bar = parseFloat(formData.get('p_out_m3'));
            
            // [修改] 动态效率模型计算
            let eff_isen_final = parseFloat(formData.get('eff_isen_m3')) / 100.0;
            let dynamicModelNotes = "效率模型: 静态 (手动输入)";

            const isDynamic = formData.get('enable_dynamic_eff_m3') === 'on';
            if (isDynamic) {
                const pr_design = parseFloat(formData.get('pr_design_m3'));
                const pr_actual = p_out_bar / p_in_bar;
                const SENSITIVITY_A = 0.03;
                const isen_correction_factor = 1 - SENSITIVITY_A * Math.pow(pr_actual - pr_design, 2);
                const eff_isen_base = parseFloat(formData.get('eff_isen_m3')) / 100.0;
                eff_isen_final = Math.max(0, eff_isen_base * isen_correction_factor);
                dynamicModelNotes = `效率模型: 动态 (设计压比=${pr_design.toFixed(2)})`;
            }

            // 流量
            const V_flow_in_m3h = parseFloat(formData.get('V_flow_in_m3'));
            
            // 冷却方式
            const cooling_type = formData.get('cooling_type_m3');
            const jacket_heat_kW = parseFloat(formData.get('jacket_heat_m3')) || 0;
            const T_water_in_C = parseFloat(formData.get('T_water_in_m3')) || 0;

            // 后冷却器
            const enable_cooler_calc = formData.get('enable_cooler_calc_m3') === 'on';
            const target_temp_C = parseFloat(formData.get('target_temp_m3'));
            
            // 3. 单位换算
            const p_in_Pa = p_in_bar * 1e5;
            const T_in_K = T_in_C + 273.15;
            const p_out_Pa = p_out_bar * 1e5;
            const RH_in_fraction = RH_in_percent / 100.0;
            const V_flow_in_m3s = V_flow_in_m3h / 3600.0;
            const T_water_in_K = T_water_in_C + 273.15;
            const target_temp_K = target_temp_C + 273.15;

            // 4. 计算进口状态 (湿空气)
            const H_in_kj_kg = CP.HAPropsSI('H', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction) / 1000.0;
            const S_in_kj_kgK = CP.HAPropsSI('S', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction) / 1000.0;
            const W_in_kg_kg = CP.HAPropsSI('W', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction);
            const V_in_m3_kg = CP.HAPropsSI('V', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction);
            
            // 5. 计算干空气质量流量
            const m_da_kgs = V_flow_in_m3s / V_in_m3_kg; // kg_da/s

            // 6. 计算理论压缩 (等熵)
            const H_out_isen_kj_kg = CP.HAPropsSI('H', 'P', p_out_Pa, 'S', S_in_kj_kgK * 1000, 'W', W_in_kg_kg) / 1000.0;
            const T_out_isen_K = CP.HAPropsSI('T', 'P', p_out_Pa, 'S', S_in_kj_kgK * 1000, 'W', W_in_kg_kg);
            const W_isen_kj_kg = H_out_isen_kj_kg - H_in_kj_kg; // 比理论功 (kJ/kg_da)

            // 7. 计算实际压缩
            const W_real_kj_kg = W_isen_kj_kg / eff_isen_final; // 比实际功 (kJ/kg_da)
            const Power_kW = W_real_kj_kg * m_da_kgs; // 轴功率 (kW)

            // 8. 根据冷却方式计算排气状态
            let H_out_real_kj_kg, T_out_real_K, W_out_real_kg_kg;
            let m_water_inject_kg_kg = 0;
            let cooling_notes = "";

            if (cooling_type === 'cooling_none') {
                H_out_real_kj_kg = H_in_kj_kg + W_real_kj_kg;
                W_out_real_kg_kg = W_in_kg_kg;
                T_out_real_K = CP.HAPropsSI('T', 'P', p_out_Pa, 'H', H_out_real_kj_kg * 1000, 'W', W_out_real_kg_kg);
                cooling_notes = "计算模式: 绝热压缩 (无冷却)";
            
            } else if (cooling_type === 'cooling_jacket') {
                const Q_cooling_kj_kg = jacket_heat_kW / m_da_kgs;
                H_out_real_kj_kg = H_in_kj_kg + W_real_kj_kg - Q_cooling_kj_kg;
                W_out_real_kg_kg = W_in_kg_kg;
                T_out_real_K = CP.HAPropsSI('T', 'P', p_out_Pa, 'H', H_out_real_kj_kg * 1000, 'W', W_out_real_kg_kg);
                cooling_notes = `计算模式: 夹套冷却 (移热 ${jacket_heat_kW.toFixed(2)} kW)`;
            
            } else if (cooling_type === 'cooling_injection') {
                const h_water_in_kj_kg = CP.PropsSI('H', 'T', T_water_in_K, 'P', p_out_Pa, 'Water') / 1000.0;
                const errorFunction = (T_out_guess_K) => {
                    const H_out_sat_kj_kg = CP.HAPropsSI('H', 'T', T_out_guess_K, 'P', p_out_Pa, 'R', 1.0) / 1000.0;
                    const W_out_sat_kg_kg = CP.HAPropsSI('W', 'T', T_out_guess_K, 'P', p_out_Pa, 'R', 1.0);
                    let m_water_needed_kg_kg = W_out_sat_kg_kg - W_in_kg_kg;
                    if (m_water_needed_kg_kg < 0) {
                        m_water_needed_kg_kg = 0;
                    }
                    const H_out_calc_kj_kg = H_in_kj_kg + W_real_kj_kg + m_water_needed_kg_kg * h_water_in_kj_kg;
                    return H_out_calc_kj_kg - H_out_sat_kj_kg;
                };

                const T_low = T_water_in_K + 0.01;
                const T_high = CP.HAPropsSI('T', 'P', p_out_Pa, 'H', (H_in_kj_kg + W_real_kj_kg) * 1000, 'W', W_in_kg_kg);
                const solveResult = bisection(errorFunction, T_low, T_high);
                
                if (!solveResult.success) {
                    throw new Error(`喷水冷却迭代计算失败: ${solveResult.message}`);
                }
                
                T_out_real_K = solveResult.root;
                H_out_real_kj_kg = CP.HAPropsSI('H', 'T', T_out_real_K, 'P', p_out_Pa, 'R', 1.0) / 1000.0;
                W_out_real_kg_kg = CP.HAPropsSI('W', 'T', T_out_real_K, 'P', p_out_Pa, 'R', 1.0);
                m_water_inject_kg_kg = W_out_real_kg_kg - W_in_kg_kg;
                cooling_notes = `计算模式: 喷水冷却 (喷水 ${T_water_in_C}°C)`;
            }

            const H_da_in_kj_kg = CP.HAPropsSI('Hha', 'T', T_in_K, 'P', p_in_Pa, 'W', W_in_kg_kg) / 1000.0;
            const H_da_out_kj_kg = CP.HAPropsSI('Hha', 'T', T_out_real_K, 'P', p_out_Pa, 'W', W_out_real_kg_kg) / 1000.0;
            const Q_total_kj_kg = H_out_real_kj_kg - H_in_kj_kg;
            const Q_sensible_kj_kg = H_da_out_kj_kg - H_da_in_kj_kg;
            const Q_latent_kj_kg = Q_total_kj_kg - Q_sensible_kj_kg;

            let Q_cooler_kW = 0, m_condensed_kgh = 0;
            let cooler_notes = "后冷却器: 未启用";

            if (enable_cooler_calc) {
                const H_in_cooler_kj_kg = H_out_real_kj_kg;
                const W_in_cooler_kg_kg = W_out_real_kg_kg;
                const H_out_cooler_kj_kg = CP.HAPropsSI('H', 'T', target_temp_K, 'P', p_out_Pa, 'R', 1.0) / 1000.0;
                const W_out_cooler_kg_kg = CP.HAPropsSI('W', 'T', target_temp_K, 'P', p_out_Pa, 'R', 1.0);
                const m_condensed_kg_kg = W_in_cooler_kg_kg - W_out_cooler_kg_kg;
                m_condensed_kgh = m_condensed_kg_kg * m_da_kgs * 3600.0;
                const h_f_condensed_kj_kg = CP.PropsSI('H', 'T', target_temp_K, 'Q', 0, 'Water') / 1000.0;
                const Q_cooler_kj_kg = (H_in_cooler_kj_kg - H_out_cooler_kj_kg) - (m_condensed_kg_kg * h_f_condensed_kj_kg);
                Q_cooler_kW = Q_cooler_kj_kg * m_da_kgs;
                cooler_notes = `后冷却器: 启用 (目标 ${target_temp_C}°C)`;
            }

            const T_out_real_C = T_out_real_K - 273.15;
            const T_out_isen_C = T_out_isen_K - 273.15;
            const m_water_inject_kgh = m_water_inject_kg_kg * m_da_kgs * 3600.0;

            let resultText = `
========= 模式三 (空压机) 计算报告 =========
${dynamicModelNotes}
${cooling_notes}
${cooler_notes}

--- 1. 进口状态 (P_in, T_in, RH) ---
进口压力 (P_in):    ${p_in_bar.toFixed(3)} bar
进口温度 (T_in):    ${T_in_C.toFixed(2)} °C
进口相对湿度 (RH):  ${RH_in_percent.toFixed(1)} %
进口体积流量 (V_in): ${V_flow_in_m3h.toFixed(2)} m³/h
----------------------------------------
  - 进口比容 (v_in):  ${V_in_m3_kg.toFixed(4)} m³/kg_da
  - 进口含湿量 (W_in): ${W_in_kg_kg.toFixed(6)} kg_w/kg_da
  - 进口湿焓 (H_in):  ${H_in_kj_kg.toFixed(2)} kJ/kg_da
  - 干空气质量流量:   ${m_da_kgs.toFixed(4)} kg_da/s (${(m_da_kgs * 3600).toFixed(2)} kg_da/h)

--- 2. 压缩过程 (P_out, Eff) ---
出口压力 (P_out):   ${p_out_bar.toFixed(3)} bar
等熵效率 (Eff_is):  ${(eff_isen_final * 100).toFixed(1)} %
----------------------------------------
  - 理论排气温度 (T_out_is): ${T_out_isen_C.toFixed(2)} °C
  - 理论比功 (W_is):       ${W_isen_kj_kg.toFixed(2)} kJ/kg_da
  - 实际比功 (W_real):     ${W_real_kj_kg.toFixed(2)} kJ/kg_da
  - 压缩机轴功率 (Power):  ${Power_kW.toFixed(2)} kW

--- 3. 压缩机出口状态 (实际) ---
实际排气温度 (T_out): ${T_out_real_C.toFixed(2)} °C
实际排气含湿量 (W_out): ${W_out_real_kg_kg.toFixed(6)} kg_w/kg_da
实际排气湿焓 (H_out): ${H_out_real_kj_kg.toFixed(2)} kJ/kg_da
`;
            if (cooling_type === 'cooling_injection') {
                resultText += `
--- 4. 喷水冷却 (专用) ---
所需喷水量 (m_w):   ${m_water_inject_kg_kg.toFixed(6)} kg_w/kg_da
所需喷水流量 (M_w): ${m_water_inject_kgh.toFixed(3)} kg/h
`;
            } else {
                resultText += `\n--- 4. 喷水冷却 (专用) ---\n  - 未启用 - \n`;
            }
            resultText += `
--- 5. 压缩机热负荷 (基于干空气) ---
总热负荷 (Q_total):   ${(Q_total_kj_kg * m_da_kgs).toFixed(2)} kW (${Q_total_kj_kg.toFixed(2)} kJ/kg_da)
显热负荷 (Q_sensible): ${(Q_sensible_kj_kg * m_da_kgs).toFixed(2)} kW (${Q_sensible_kj_kg.toFixed(2)} kJ/kg_da)
潜热负荷 (Q_latent):   ${(Q_latent_kj_kg * m_da_kgs).toFixed(2)} kW (${Q_latent_kj_kg.toFixed(2)} kJ/kg_da)

--- 6. 后冷却器 (计算) ---
后冷器热负荷 (Q_cooler): ${Q_cooler_kW.toFixed(2)} kW
析出水量 (M_condensed):  ${m_condensed_kgh.toFixed(3)} kg/h
`;
            resultsDivM3.textContent = resultText;
            lastMode3ResultText = resultText;
            
            calcButtonM3.textContent = btnText3;
            calcButtonM3.classList.remove(...classesStale3);
            calcButtonM3.classList.add(...classesFresh3);
            calcButtonM3.disabled = false;
            printButtonM3.disabled = false;

        } catch (err) {
            console.error("Mode 3 (Air Compressor) calculation failed:", err);
            resultsDivM3.textContent = `计算失败: \n${err.message}\n\n${err.stack}`;
            calcButtonM3.textContent = "计算失败";
            calcButtonM3.disabled = false;
            setButtonStale3();
        }
    }, 10);
}

function printReportMode3() {
    if (!lastMode3ResultText) {
        alert("没有可供打印的计算结果。");
        return;
    }
    const printHtml = `
        <html><head><title>无油压缩机性能计算器 - 模式三 (空压机) 报告</title>
        <style>
            body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 5px; }
            pre { background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
            footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
        </style>
        </head><body>
            <h1>无油压缩机性能计算器 - 模式三 (空压机) 报告</h1>
            <pre>${lastMode3ResultText}</pre>
            <footer><p>版本: v7.4</p><p>计算时间: ${new Date().toLocaleString()}</p></footer>
        </body></html>
    `;
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container-3';
    printContainer.innerHTML = printHtml;
    document.body.appendChild(printContainer);
    window.print();
    setTimeout(() => { document.body.removeChild(printContainer); }, 500);
}

function bisection(f, a, b, tol = 1e-5, maxIter = 100) {
    if (isNaN(a) || isNaN(b)) {
        return { success: false, message: `求解失败：边界无效 (T_low=${a}, T_high=${b})。` };
    }
    let fa = f(a), fb = f(b);
    if (fa * fb >= 0) {
        return { success: false, message: `求解失败：f(a) 和 f(b) 必须异号 (f(a)=${fa.toFixed(2)}, f(b)=${fb.toFixed(2)})。` };
    }
    let c, fc;
    for (let i = 0; i < maxIter; i++) {
        c = (a + b) / 2;
        fc = f(c);
        if (Math.abs(fc) < tol || (b - a) / 2 < tol) {
            return { success: true, root: c, iterations: i };
        }
        if (fc * fa < 0) { b = c; } else { a = c; fa = fc; }
    }
    return { success: false, message: `迭代 ${maxIter} 次后未收敛。` };
}

/**
 * 模式三：初始化函数 (原 initMode2C)
 * @param {object} CP - CoolProp 实例
 */
export function initMode3(CP) {
    CP_INSTANCE = CP;
    
    calcButtonM3 = document.getElementById('calc-button-3');
    resultsDivM3 = document.getElementById('results-3');
    calcFormM3 = document.getElementById('calc-form-3');
    printButtonM3 = document.getElementById('print-button-3');
    
    radioCoolingNone = document.getElementById('cooling_none_m3');
    radioCoolingJacket = document.getElementById('cooling_jacket_m3');
    radioCoolingInjection = document.getElementById('cooling_injection_m3');
    jacketInputsDiv = document.getElementById('jacket-inputs-m3');
    injectionInputsDiv = document.getElementById('injection-inputs-m3');
    
    jacketHeatInput = document.getElementById('jacket_heat_m3');
    injectionTempInput = document.getElementById('T_water_in_m3');
    
    enableCoolerCalcM3 = document.getElementById('enable_cooler_calc_m3');
    coolerInputsDivM3 = document.getElementById('cooler-inputs-m3'); 
    const coolerTempInput = document.getElementById('target_temp_m3');

    if (!calcFormM3) {
        console.warn("Mode 3 (Air Compressor) elements not found. Skipping init.");
        return;
    }

    allInputsM3 = calcFormM3.querySelectorAll('input, select');
    
    calcFormM3.addEventListener('submit', (event) => {
        event.preventDefault();
        calculateMode3();
    });

    allInputsM3.forEach(input => {
        input.addEventListener('input', setButtonStale3);
        input.addEventListener('change', setButtonStale3);
    });

    printButtonM3.addEventListener('click', printReportMode3);

    const effSelectorM3 = document.getElementById('eff_selector_m3');
    const effIsenInputM3 = document.getElementById('eff_isen_m3');
    effSelectorM3.addEventListener('change', () => {
        const selectedValue = effSelectorM3.value;
        if (selectedValue) {
            effIsenInputM3.value = selectedValue;
            effIsenInputM3.dispatchEvent(new Event('input'));
        }
    });
    
    // [新增] 模式三动态效率模型UI逻辑
    const dynamicEffCheckboxM3 = document.getElementById('enable_dynamic_eff_m3');
    const dynamicEffInputsM3 = document.getElementById('dynamic-eff-inputs-m3');
    const effIsenLabelM3 = document.querySelector('label[for="eff_isen_m3"]');
    dynamicEffCheckboxM3.addEventListener('change', () => {
        const isChecked = dynamicEffCheckboxM3.checked;
        dynamicEffInputsM3.style.display = isChecked ? 'block' : 'none';
        effIsenLabelM3.textContent = isChecked ? '基础等熵效率 (Eff_is)' : '等熵效率 (Eff_is)';
        setButtonStale3();
    });


    const coolingRadios = [radioCoolingNone, radioCoolingJacket, radioCoolingInjection];
    coolingRadios.forEach(radio => {
        if(radio) {
            radio.addEventListener('change', toggleCoolingInputs);
        }
    });
    if (jacketInputsDiv && injectionInputsDiv && jacketHeatInput && injectionTempInput) {
        toggleCoolingInputs();
    }

    if (enableCoolerCalcM3 && coolerInputsDivM3) {
        const toggleCooler = () => {
            const isChecked = enableCoolerCalcM3.checked;
            coolerInputsDivM3.style.display = isChecked ? 'block' : 'none';
            if (coolerTempInput) {
                coolerTempInput.disabled = !isChecked;
                coolerTempInput.required = isChecked;
            }
        };
        enableCoolerCalcM3.addEventListener('change', toggleCooler);
        toggleCooler();
    }

    console.log("Mode 3 (Air Compressor) initialized.");
}