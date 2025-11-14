// =====================================================================
// mode2c_air.js: 模式 2C (空压机) 模块
// 版本: v5.1 (HAPropsSI 7-arg 修复)
// 职责: 1. 初始化模式 2C (空压机) 的 UI 事件
//        2. (v5.1 修复) 确保所有 HAPropsSI 调用都是 7 个参数
//        3. 处理绝热、夹套冷却、喷水冷却三种模式
//        4. 计算显热/潜热负荷及后冷器析出水量
// =====================================================================

// (这个模块暂时不需要 updateFluidInfo, 因为工质固定为湿空气)
// import { updateFluidInfo } from './coolprop_loader.js';

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode2CResultText = null;

// --- 2C DOM 元素 ---
let calcButtonM2C, resultsDivM2C, calcFormM2C, printButtonM2C;
let allInputsM2C;
let radioCoolingNone, radioCoolingJacket, radioCoolingInjection;
let jacketInputsDiv, injectionInputsDiv;
let enableCoolerCalcM2C, coolerInputsDivM2C; // (基于 v4.2 UI 结构的假设)

// --- 按钮状态 (2C) ---
const btnText2C = "计算性能 (模式 2C)";
const btnTextStale2C = "重新计算 (模式 2C)";
const classesFresh2C = ['bg-cyan-600', 'hover:bg-cyan-700', 'text-white']; // (v5.1 颜色修正)
const classesStale2C = ['bg-yellow-500', 'hover:bg-yellow-600', 'text-black'];

/**
 * 设置按钮为“脏”状态 (Stale) (2C)
 */
function setButtonStale2C() {
    if (!calcButtonM2C) return;
    calcButtonM2C.textContent = btnTextStale2C;
    calcButtonM2C.classList.remove(...classesFresh2C);
    calcButtonM2C.classList.add(...classesStale2C);
    printButtonM2C.disabled = true;
    lastMode2CResultText = null;
}

/**
 * 切换冷却模式特定输入框的显示
 */
function toggleCoolingInputs() {
    if (radioCoolingJacket.checked) {
        jacketInputsDiv.style.display = 'block';
    } else {
        jacketInputsDiv.style.display = 'none';
    }

    if (radioCoolingInjection.checked) {
        injectionInputsDiv.style.display = 'block';
    } else {
        injectionInputsDiv.style.display = 'none';
    }
}

/**
 * (v5.1) 模式 2C 核心计算函数
 */
async function calculateMode2C() {
    const CP = CP_INSTANCE;
    if (!CP) {
        resultsDivM2C.textContent = "错误: CoolProp 未加载。";
        return;
    }

    // 1. 设置按钮为加载中
    calcButtonM2C.disabled = true;
    calcButtonM2C.textContent = "计算中...";
    resultsDivM2C.textContent = "--- 正在计算, 请稍候... ---";

    // 异步执行，防止 UI 阻塞
    setTimeout(() => {
        try {
            // 2. 获取表单数据
            const formData = new FormData(calcFormM2C);
            
            // 进口参数 (需求 2.1)
            const p_in_bar = parseFloat(formData.get('p_in_m2c'));
            const T_in_C = parseFloat(formData.get('T_in_m2c'));
            const RH_in_percent = parseFloat(formData.get('RH_in_m2c'));
            
            // 压缩过程
            const p_out_bar = parseFloat(formData.get('p_out_m2c'));
            const eff_isen = parseFloat(formData.get('eff_isen_m2c')) / 100.0;
            
            // 流量 (AI 补充)
            const V_flow_in_m3h = parseFloat(formData.get('V_flow_in_m2c'));
            
            // 冷却方式 (需求 2.4)
            const cooling_type = formData.get('cooling_type_m2c');
            const jacket_heat_kW = parseFloat(formData.get('jacket_heat_m2c')) || 0;
            const T_water_in_C = parseFloat(formData.get('T_water_in_m2c')) || 0;

            // 后冷却器 (需求 2.3)
            const enable_cooler_calc = formData.get('enable_cooler_calc_m2c') === 'on';
            const target_temp_C = parseFloat(formData.get('target_temp_m2c'));
            
            // 3. 单位换算
            const p_in_Pa = p_in_bar * 1e5;
            const T_in_K = T_in_C + 273.15;
            const p_out_Pa = p_out_bar * 1e5;
            const RH_in_fraction = RH_in_percent / 100.0;
            const V_flow_in_m3s = V_flow_in_m3h / 3600.0;
            const T_water_in_K = T_water_in_C + 273.15;
            const target_temp_K = target_temp_C + 273.15;

            // 4. 计算进口状态 (湿空气)
            // HAPropsSI(Output, Input1, Value1, Input2, Value2, Input3, Value3)
            const H_in_kj_kg = CP.HAPropsSI('H', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction) / 1000.0;
            const S_in_kj_kgK = CP.HAPropsSI('S', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction) / 1000.0;
            const W_in_kg_kg = CP.HAPropsSI('W', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction);
            const V_in_m3_kg = CP.HAPropsSI('V', 'T', T_in_K, 'P', p_in_Pa, 'R', RH_in_fraction);
            
            // 5. 计算干空气质量流量
            const m_da_kgs = V_flow_in_m3s / V_in_m3_kg; // kg_da/s

            // 6. 计算理论压缩 (等熵)
            // 假设等熵过程含湿量不变 (W_in)
            const H_out_isen_kj_kg = CP.HAPropsSI('H', 'P', p_out_Pa, 'S', S_in_kj_kgK * 1000, 'W', W_in_kg_kg) / 1000.0;
            const T_out_isen_K = CP.HAPropsSI('T', 'P', p_out_Pa, 'S', S_in_kj_kgK * 1000, 'W', W_in_kg_kg);
            const W_isen_kj_kg = H_out_isen_kj_kg - H_in_kj_kg; // 比理论功 (kJ/kg_da)

            // 7. 计算实际压缩
            const W_real_kj_kg = W_isen_kj_kg / eff_isen; // 比实际功 (kJ/kg_da)
            const Power_kW = W_real_kj_kg * m_da_kgs; // 轴功率 (kW)

            // 8. 根据冷却方式计算排气状态
            let H_out_real_kj_kg, T_out_real_K, W_out_real_kg_kg;
            let m_water_inject_kg_kg = 0;
            let cooling_notes = "";

            if (cooling_type === 'cooling_none') {
                // 模式 8.1: 绝热压缩
                H_out_real_kj_kg = H_in_kj_kg + W_real_kj_kg;
                W_out_real_kg_kg = W_in_kg_kg; // 含湿量不变
                T_out_real_K = CP.HAPropsSI('T', 'P', p_out_Pa, 'H', H_out_real_kj_kg * 1000, 'W', W_out_real_kg_kg);
                cooling_notes = "计算模式: 绝热压缩 (无冷却)";
            
            } else if (cooling_type === 'cooling_jacket') {
                // 模式 8.2: 夹套冷却 (需求 2.4)
                const Q_cooling_kj_kg = jacket_heat_kW / m_da_kgs; // 比冷却量 (kJ/kg_da)
                H_out_real_kj_kg = H_in_kj_kg + W_real_kj_kg - Q_cooling_kj_kg;
                W_out_real_kg_kg = W_in_kg_kg; // 含湿量不变
                T_out_real_K = CP.HAPropsSI('T', 'P', p_out_Pa, 'H', H_out_real_kj_kg * 1000, 'W', W_out_real_kg_kg);
                cooling_notes = `计算模式: 夹套冷却 (移热 ${jacket_heat_kW.toFixed(2)} kW)`;
            
            } else if (cooling_type === 'cooling_injection') {
                // 模式 8.3: 喷水冷却 (需求 2.4)
                
                // 喷入水的焓 (kJ/kg_w)
                const h_water_in_kj_kg = CP.PropsSI('H', 'T', T_water_in_K, 'P', p_out_Pa, 'Water') / 1000.0;

                // 求解目标: 找到唯一的 T_out，使其满足能量和质量平衡
                const errorFunction = (T_out_guess_K) => {
                    // 1. 假设 T_out 时的饱和状态
                    const H_out_sat_kj_kg = CP.HAPropsSI('H', 'T', T_out_guess_K, 'P', p_out_Pa, 'R', 1.0) / 1000.0;
                    const W_out_sat_kg_kg = CP.HAPropsSI('W', 'T', T_out_guess_K, 'P', p_out_Pa, 'R', 1.0);
                    
                    // 2. 根据质量平衡计算所需喷水量
                    const m_water_needed_kg_kg = W_out_sat_kg_kg - W_in_kg_kg;
                    
                    // 3. 根据能量平衡计算 H_out
                    const H_out_calc_kj_kg = H_in_kj_kg + W_real_kj_kg + m_water_needed_kg_kg * h_water_in_kj_kg;
                    
                    // 4. 返回误差
                    return H_out_calc_kj_kg - H_out_sat_kj_kg;
                };

                // 求解: 使用二分法求解器
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

            // 9. 计算热负荷 (需求 2.2)
            
            // ================== v5.1 修复开始 ==================
            // (Hha 必须有 7 个参数。使用 W_in_kg_kg)
            const H_da_in_kj_kg = CP.HAPropsSI('Hha', 'T', T_in_K, 'P', p_in_Pa, 'W', W_in_kg_kg) / 1000.0;
            // (Hha 必须有 7 个参数。使用 W_out_real_kg_kg)
            const H_da_out_kj_kg = CP.HAPropsSI('Hha', 'T', T_out_real_K, 'P', p_out_Pa, 'W', W_out_real_kg_kg) / 1000.0;
            // ================== v5.1 修复结束 ==================

            const Q_total_kj_kg = H_out_real_kj_kg - H_in_kj_kg; // 压缩机总热负荷 (kJ/kg_da)
            const Q_sensible_kj_kg = H_da_out_kj_kg - H_da_in_kj_kg; // 显热 (kJ/kg_da)
            const Q_latent_kj_kg = Q_total_kj_kg - Q_sensible_kj_kg; // 潜热 (kJ/kg_da)

            // 10. 计算后冷却器 (需求 2.3)
            let Q_cooler_kW = 0;
            let m_condensed_kgh = 0;
            let cooler_notes = "后冷却器: 未启用";

            if (enable_cooler_calc) {
                // 冷却器进口状态 (即压缩机出口)
                const H_in_cooler_kj_kg = H_out_real_kj_kg;
                const W_in_cooler_kg_kg = W_out_real_kg_kg;

                // 冷却器出口状态 (假设冷却到目标温度且饱和 RH=1.0)
                const H_out_cooler_kj_kg = CP.HAPropsSI('H', 'T', target_temp_K, 'P', p_out_Pa, 'R', 1.0) / 1000.0;
                const W_out_cooler_kg_kg = CP.HAPropsSI('W', 'T', target_temp_K, 'P', p_out_Pa, 'R', 1.0);

                // 析出水量
                const m_condensed_kg_kg = W_in_cooler_kg_kg - W_out_cooler_kg_kg;
                m_condensed_kgh = m_condensed_kg_kg * m_da_kgs * 3600.0; // (kg_w/h)

                // 析出冷凝水的焓 (kJ/kg_w)
                const h_f_condensed_kj_kg = CP.PropsSI('H', 'T', target_temp_K, 'Q', 0, 'Water') / 1000.0;

                // 冷却器热负荷 (能量平衡)
                const Q_cooler_kj_kg = (H_in_cooler_kj_kg - H_out_cooler_kj_kg) - (m_condensed_kg_kg * h_f_condensed_kj_kg);
                Q_cooler_kW = Q_cooler_kj_kg * m_da_kgs; // (kW)
                
                cooler_notes = `后冷却器: 启用 (目标 ${target_temp_C}°C)`;
            }

            // 11. 格式化输出
            const T_out_real_C = T_out_real_K - 273.15;
            const T_out_isen_C = T_out_isen_K - 273.15;
            const m_water_inject_kgh = m_water_inject_kg_kg * m_da_kgs * 3600.0;

            let resultText = `
========= 模式 2C (空压机) 计算报告 =========
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
等熵效率 (Eff_is):  ${(eff_isen * 100).toFixed(1)} %
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

            // 12. 显示结果
            resultsDivM2C.textContent = resultText;
            lastMode2CResultText = resultText;
            
            // 13. 更新按钮状态
            calcButtonM2C.textContent = btnText2C;
            calcButtonM2C.classList.remove(...classesStale2C);
            calcButtonM2C.classList.add(...classesFresh2C);
            calcButtonM2C.disabled = false;
            printButtonM2C.disabled = false;

        } catch (err) {
            // 错误处理
            console.error("Mode 2C calculation failed:", err);
            resultsDivM2C.textContent = `计算失败: \n${err.message}\n\n${err.stack}`;
            calcButtonM2C.textContent = "计算失败";
            calcButtonM2C.disabled = false;
            setButtonStale2C();
        }
    }, 10); // 10ms 延迟确保 UI 更新
}

/**
 * 打印模式 2C 报告
 */
function printReportMode2C() {
    if (!lastMode2CResultText) {
        alert("没有可供打印的计算结果。");
        return;
    }
    
    // (与 mode1, mode2 等共享的打印样式)
    const printHtml = `
        <html>
        <head>
            <title>无油压缩机性能计算器 - 模式 2C 报告</title>
            <style>
                body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
                h1 { color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 5px; }
                pre { 
                    background-color: #f7fafc; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 8px; 
                    padding: 15px; 
                    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
                    font-size: 14px;
                    white-space: pre-wrap; 
                    word-wrap: break-word; 
                }
                footer { margin-top: 20px; font-size: 12px; color: #718096; text-align: center; }
            </style>
        </head>
        <body>
            <h1>无油压缩机性能计算器 - 模式 2C 报告</h1>
            <pre>${lastMode2CResultText}</pre>
            <footer>
                <p>版本: v5.1 (模式 2C)</p>
                <p>计算时间: ${new Date().toLocaleString()}</p>
            </footer>
        </body>
        </html>
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


// =========================================================
// 辅助函数: 二分法求解器
// =========================================================
/**
 * bisection(f, a, b, tol=1e-5, maxIter=100)
 * 查找 f(x) = 0 在 [a, b] 上的根
 */
function bisection(f, a, b, tol = 1e-5, maxIter = 100) {
    let fa = f(a);
    let fb = f(b);

    if (fa * fb >= 0) {
        return { success: false, message: `求解失败：f(a) 和 f(b) 必须异号 (f(a)=${fa.toFixed(2)}, f(b)=${fb.toFixed(2)})。检查 T_low 和 T_high 范围。` };
    }

    let c, fc;
    for (let i = 0; i < maxIter; i++) {
        c = (a + b) / 2;
        fc = f(c);

        if (Math.abs(fc) < tol || (b - a) / 2 < tol) {
            return { success: true, root: c, iterations: i };
        }

        if (fc * fa < 0) {
            b = c;
        } else {
            a = c;
            fa = fc;
        }
    }
    return { success: false, message: `迭代 ${maxIter} 次后未收敛。` };
}


/**
 * (v5.0) 模式 2C：初始化函数
 * @param {object} CP - CoolProp 实例
 */
export function initMode2C(CP) {
    CP_INSTANCE = CP; // 将 CP 实例存储在模块作用域
    
    // --- 获取 DOM 元素 (ID 必须在 index.html 中定义) ---
    calcButtonM2C = document.getElementById('calc-button-mode-2c');
    resultsDivM2C = document.getElementById('results-mode-2c');
    calcFormM2C = document.getElementById('calc-form-mode-2c');
    printButtonM2C = document.getElementById('print-button-mode-2c');
    
    // 冷却模式
    radioCoolingNone = document.getElementById('cooling_none_m2c');
    radioCoolingJacket = document.getElementById('cooling_jacket_m2c');
    radioCoolingInjection = document.getElementById('cooling_injection_m2c');
    jacketInputsDiv = document.getElementById('jacket-inputs-m2c');
    injectionInputsDiv = document.getElementById('injection-inputs-m2c');
    
    // 后冷却器
    enableCoolerCalcM2C = document.getElementById('enable_cooler_calc_m2c');
    coolerInputsDivM2C = document.getElementById('cooler-inputs-m2c'); // 假设 ID

    if (!calcFormM2C) {
        console.warn("Mode 2C (Air Compressor) elements not found. Skipping init.");
        return;
    }

    allInputsM2C = calcFormM2C.querySelectorAll('input, select');
    
    // 绑定计算事件 (2C)
    calcFormM2C.addEventListener('submit', (event) => {
        event.preventDefault();
        calculateMode2C();
    });

    // 绑定“脏”状态检查 (2C)
    allInputsM2C.forEach(input => {
        input.addEventListener('input', setButtonStale2C);
        input.addEventListener('change', setButtonStale2C);
    });
    // (v4.4 风格: 确保 select 也能触发)
    calcFormM2C.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', setButtonStale2C);
    });

    // 绑定打印事件
    printButtonM2C.addEventListener('click', printReportMode2C);

    // 绑定冷却模式切换事件
    const coolingRadios = [radioCoolingNone, radioCoolingJacket, radioCoolingInjection];
    coolingRadios.forEach(radio => {
        if(radio) {
            radio.addEventListener('change', toggleCoolingInputs);
        }
    });
    // 初始调用一次以设置正确显示
    if (jacketInputsDiv && injectionInputsDiv) {
        toggleCoolingInputs();
    }

    // 绑定后冷却器 Toggle (复用 ui.js 的逻辑，但这里也实现以便模块独立)
    if (enableCoolerCalcM2C && coolerInputsDivM2C) {
        const toggleCooler = () => {
            coolerInputsDivM2C.style.display = enableCoolerCalcM2C.checked ? 'block' : 'none';
        };
        enableCoolerCalcM2C.addEventListener('change', toggleCooler);
        // 初始调用
        toggleCooler();
    }

    console.log("Mode 2C (Air Compressor) initialized.");
}