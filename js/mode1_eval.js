// =====================================================================
// mode1_eval.js: 模式一 (性能评估) 模块
// 版本: v6.0 (M1, M2A 热泵模式升级)
// 职责: 1. (v6.0) 增加 (T_evap, SH) 和 (T_cond) 输入模式
//        2. (v6.0) 增加 (SC) 输入, 并计算系统制冷/制热能力和 COP
//        3. (v6.0) 升级 'transfer' 功能以匹配 M2A v6.0
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

// --- 模块内部变量 ---
let CP_INSTANCE = null;
let lastMode1Results = null; // 存储结构化数据
let lastMode1ResultText = null; // 存储报告文本

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
    if (!calcButtonM1) return;
    calcButtonM1.textContent = btnTextStale;
    calcButtonM1.classList.remove(...classesFresh);
    calcButtonM1.classList.add(...classesStale);
    transferButton.disabled = true;
    printButtonM1.disabled = true;
    lastMode1Results = null;
    lastMode1ResultText = null;
}

/**
 * (v6.0 修复版) 模式一：计算
 */
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
            // (v5.1 修复) 使用 FormData 获取所有值
            const formData = new FormData(calcFormM1);

            const fluid = formData.get('fluid');
            
            // ================== v6.0 预处理 ==================
            const inlet_define = formData.get('inlet_define_m1');
            const outlet_define = formData.get('outlet_define_m1');
            
            let p_in_bar, T_in_C, p_out_bar, T_out_C;
            let T_evap_C, SH_K, T_cond_C; // 用于存储和传输

            // 1.a 确定进口 P, T
            if (inlet_define === 'pt') {
                p_in_bar = parseFloat(formData.get('p_in'));
                T_in_C = parseFloat(formData.get('T_in'));
                // 反算 T_evap 和 SH 用于数据存储
                const p_in_Pa_temp = p_in_bar * 1e5;
                const T_sat_in_K = CP.PropsSI('T', 'P', p_in_Pa_temp, 'Q', 1, fluid);
                T_evap_C = T_sat_in_K - 273.15;
                SH_K = T_in_C - T_evap_C;
            } else { // 't_sh'
                T_evap_C = parseFloat(formData.get('T_evap_m1'));
                SH_K = parseFloat(formData.get('SH_m1'));
                
                const T_evap_K = T_evap_C + 273.15;
                const p_in_Pa_temp = CP.PropsSI('P', 'T', T_evap_K, 'Q', 1, fluid);
                p_in_bar = p_in_Pa_temp / 1e5;
                T_in_C = T_evap_C + SH_K;
            }

            // 1.b 确定出口 P, T
            if (outlet_define === 'pt') {
                p_out_bar = parseFloat(formData.get('p_out'));
                T_out_C = parseFloat(formData.get('T_out'));
                // 反算 T_cond 用于数据存储
                const p_out_Pa_temp = p_out_bar * 1e5;
                const T_sat_out_K = CP.PropsSI('T', 'P', p_out_Pa_temp, 'Q', 1, fluid);
                T_cond_C = T_sat_out_K - 273.15;
            } else { // 't_t'
                T_cond_C = parseFloat(formData.get('T_cond_m1'));
                T_out_C = parseFloat(formData.get('T_out_m1_alt'));
                
                const T_cond_K = T_cond_C + 273.15;
                const p_out_Pa_temp = CP.PropsSI('P', 'T', T_cond_K, 'Q', 1, fluid);
                p_out_bar = p_out_Pa_temp / 1e5;
            }
            
            // 1.c 获取流量和功率
            const flow_mode = formData.get('flow_mode_m1'); 
            const rpm = parseFloat(formData.get('rpm'));
            const vol_disp_cm3 = parseFloat(formData.get('vol_disp'));
            const mass_flow_kgs = parseFloat(formData.get('mass_flow'));
            const vol_flow_m3h = parseFloat(formData.get('vol_flow'));

            let power_shaft_kW = parseFloat(formData.get('power'));
            const motor_power_kW = parseFloat(formData.get('motor_power'));
            const motor_eff = parseFloat(formData.get('motor_eff')) / 100.0;
            
            // 1.d 获取系统参数 (v6.0 新增)
            const SC_K = parseFloat(formData.get('SC_m1'));

            // 检查功率输入
            if (power_shaft_kW <= 0) {
                power_shaft_kW = motor_power_kW * motor_eff;
            }
            // ================== v6.0 预处理结束 ==================

            // 单位换算
            const p_in_Pa = p_in_bar * 1e5;
            const T_in_K = T_in_C + 273.15;
            const p_out_Pa = p_out_bar * 1e5;
            const T_out_K = T_out_C + 273.15;
            const vol_disp_m3 = vol_disp_cm3 / 1e6;

            // 2. 进口状态
            const H_in = CP.PropsSI('H', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const S_in = CP.PropsSI('S', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const D_in = CP.PropsSI('D', 'P', p_in_Pa, 'T', T_in_K, fluid);
            const v_in = 1.0 / D_in; // 进口比容 m³/kg

            // 3. 出口状态
            const H_out = CP.PropsSI('H', 'P', p_out_Pa, 'T', T_out_K, fluid);

            // 4. 理论等熵压缩
            const H_out_is = CP.PropsSI('H', 'P', p_out_Pa, 'S', S_in, fluid);
            const T_out_is_K = CP.PropsSI('T', 'P', p_out_Pa, 'S', S_in, fluid);
            const W_is = H_out_is - H_in; // 理论等熵功 (J/kg)

            // 5. 实际压缩
            const W_real = H_out - H_in; // 实际焓升 (J/kg)

            // 6. 计算效率
            const eff_isen = W_is / W_real; // 等熵效率
            
            // 7. 计算流量
            let m_flow, V_flow_in, vol_eff = 0;
            if (flow_mode === 'rpm') {
                m_flow = (power_shaft_kW * 1000.0) / W_real; // 质量流量 (kg/s)
                V_flow_in = m_flow * v_in; // 进口体积流量 (m³/s)
                const V_flow_theo = (rpm / 60.0) * vol_disp_m3;
                vol_eff = V_flow_in / V_flow_theo; // 容积效率
            } else if (flow_mode === 'mass') {
                m_flow = mass_flow_kgs;
                V_flow_in = m_flow * v_in;
                // RPM 模式下的容积效率不适用
            } else { // flow_mode === 'vol'
                V_flow_in = vol_flow_m3h / 3600.0;
                m_flow = V_flow_in / v_in;
                // RPM 模式下的容积效率不适用
            }
            
            // 8. 基于流量反算功率
            const Power_shaft_calc = (W_real * m_flow) / 1000.0; // kW
            const Power_motor_calc = Power_shaft_calc / motor_eff; // kW
            
            // ================== v6.0 新增: 系统性能计算 ==================
            const T_cond_K_calc = CP.PropsSI('T', 'P', p_out_Pa, 'Q', 1, fluid);
            const T_liq_out_K = T_cond_K_calc - SC_K;
            
            // 节流前焓
            const H_throttle = CP.PropsSI('H', 'T', T_liq_out_K, 'P', p_out_Pa, fluid);
            
            // 单位性能
            const q_evap = H_in - H_throttle; // 单位制冷量 (J/kg)
            const q_cond = H_out - H_throttle; // 单位制热量 (J/kg)
            
            // 系统总性能
            const Q_evap_kW = q_evap * m_flow / 1000.0; // 制冷能力 (kW)
            const Q_cond_kW = q_cond * m_flow / 1000.0; // 制热能力 (kW)
            
            // COP
            const COP_R = q_evap / W_real; // 制冷 COP (基于轴功)
            const COP_H = q_cond / W_real; // 制热 COP (基于轴功)
            // ================== v6.0 新增结束 ==================

            // 9. 存储结果 (v6.0 扩展)
            lastMode1Results = {
                fluid,
                p_in_bar, T_in_C, p_out_bar, T_out_C,
                T_evap_C, SH_K, T_cond_C, SC_K, // (v6.0)
                eff_isen, vol_eff, motor_eff,
                rpm, vol_disp_cm3,
                m_flow, V_flow_in,
                Power_shaft_calc,
                inlet_define, outlet_define // (v6.0)
            };

            // 10. 格式化输出
            const T_out_is_C = T_out_is_K - 273.15;
            
            // (v4.7 修复)
            const p_in_str = p_in_bar.toFixed(3).padEnd(9);
            const T_in_str = T_in_C.toFixed(2).padEnd(9);
            const H_in_str = (H_in / 1000.0).toFixed(2).padEnd(11);
            const S_in_str = (S_in / 1000.0).toFixed(4);
            
            const p_out_str = p_out_bar.toFixed(3).padEnd(9);
            const T_out_str = T_out_C.toFixed(2).padEnd(9);
            const H_out_str = (H_out / 1000.0).toFixed(2).padEnd(11);
            
            const T_is_str = T_out_is_C.toFixed(2).padEnd(9);
            const H_is_str = (H_out_is / 1000.0).toFixed(2).padEnd(11);

            let resultText = `
========= 模式一 (性能评估) 计算报告 =========
工质: ${fluid}
流量模式: ${flow_mode}
功率基准: ${power_shaft_kW.toFixed(2)} kW (轴功率)

--- 1. 状态点 ---
          P (bar)   T (°C)   H (kJ/kg)   S (kJ/kg.K)
进口 (in): ${p_in_str} ${T_in_str} ${H_in_str} ${S_in_str}
出口 (out): ${p_out_str} ${T_out_str} ${H_out_str}
等熵出口 (is): ${p_out_str} ${T_is_str} ${H_is_str} ${S_in_str}

--- 2. 功与效率 ---
理论等熵功 (W_is):   ${(W_is / 1000.0).toFixed(2)} kJ/kg
实际比功 (W_real):   ${(W_real / 1000.0).toFixed(2)} kJ/kg
----------------------------------------
等熵效率 (Eff_is):   ${(eff_isen * 100.0).toFixed(2)} %
`;
            if (flow_mode === 'rpm') {
                resultText += `容积效率 (Eff_vol):   ${(vol_eff * 100.0).toFixed(2)} % (基于 ${rpm} RPM)\n`;
            }
            
            resultText += `
--- 3. 流量与功率 (反算) ---
(基于 ${flow_mode} 模式输入)
质量流量 (M_flow):  ${m_flow.toFixed(4)} kg/s
进口体积流量 (V_in): ${V_flow_in.toFixed(5)} m³/s (${(V_flow_in * 3600).toFixed(2)} m³/h)
----------------------------------------
反算轴功率 (P_shaft): ${Power_shaft_calc.toFixed(2)} kW
反算电机功率 (P_motor): ${Power_motor_calc.toFixed(2)} kW
`;
            
            // ================== v6.0 新增: 系统性能报告 ==================
            resultText += `
--- 4. 系统性能 (v6.0) ---
(基于 过冷度 SC = ${SC_K.toFixed(1)} K)
节流前焓 (H_throttle): ${(H_throttle / 1000.0).toFixed(2)} kJ/kg
----------------------------------------
单位制冷量 (q_evap): ${(q_evap / 1000.0).toFixed(2)} kJ/kg
单位制热量 (q_cond): ${(q_cond / 1000.0).toFixed(2)} kJ/kg
----------------------------------------
系统制冷能力 (Q_evap): ${Q_evap_kW.toFixed(2)} kW
系统制热能力 (Q_cond): ${Q_cond_kW.toFixed(2)} kW
COP (制冷, 轴):      ${COP_R.toFixed(3)}
COP (制热, 轴):      ${COP_H.toFixed(3)}
`;
            // ================== v6.0 新增结束 ==================
            
            if (Math.abs(Power_shaft_calc - power_shaft_kW) > 0.1 && flow_mode !== 'rpm') {
                resultText += `
*** 警告:
反算的轴功率 (${Power_shaft_calc.toFixed(2)} kW) 与
您输入的功率 (${power_shaft_kW.toFixed(2)} kW) 不匹配。
请检查流量和功率输入是否一致。
`;
            }

            // 11. 显示结果
            resultsDivM1.textContent = resultText;
            lastMode1ResultText = resultText;
            
            // 12. 更新按钮状态
            calcButtonM1.textContent = btnText;
            calcButtonM1.classList.remove(...classesStale);
            calcButtonM1.classList.add(...classesFresh);
            calcButtonM1.disabled = false;
            transferButton.disabled = false;
            printButtonM1.disabled = false;

        } catch (err) {
            console.error("Mode 1 calculation failed:", err);
            resultsDivM1.textContent = `计算出错: \n${err.message}\n\n请检查输入参数是否在工质的有效范围内。`;
            calcButtonM1.textContent = "计算失败";
            calcButtonM1.disabled = false;
            setButtonStale();
        }
    }, 10); // 10ms 延迟确保 UI 更新
}

/**
 * 打印模式一报告
 */
function printReportMode1() {
    if (!lastMode1ResultText) {
        alert("没有可供打印的计算结果。");
        return;
    }
    
    const printHtml = `
        <html>
        <head>
            <title>无油压缩机性能计算器 - 模式一报告</title>
            <style>
                body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; padding: 20px; }
                h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 5px; }
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
            <h1>无油压缩机性能计算器 - 模式一报告</h1>
            <pre>${lastMode1ResultText}</pre>
            <footer>
                <p>版本: v6.0</p>
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

    // (v5.1 修复) 确保 calcFormM1 存在
    if (!calcFormM1) {
        console.error("Mode 1 Form (calc-form-mode-1) not found! Cannot initialize.");
        return;
    }
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
        updateFluidInfo(fluidSelectM1, fluidInfoDivM1, CP);
        setButtonStale(); // 更改流体也需要重新计算
    });

    // 绑定打印事件
    printButtonM1.addEventListener('click', printReportMode1);

    // ================== v6.0 升级: 传输功能 ==================
    transferButton.addEventListener('click', () => {
        if (!lastMode1Results) {
            alert("没有可传输的数据。请先计算。");
            return;
        }
        
        const r = lastMode1Results;

        // 目标：模式 2A
        document.getElementById('fluid_m2').value = r.fluid;
        
        // 填充所有字段 (v6.0)
        document.getElementById('p_in_m2').value = r.p_in_bar.toFixed(3);
        document.getElementById('T_in_m2').value = r.T_in_C.toFixed(2);
        document.getElementById('T_evap_m2a').value = r.T_evap_C.toFixed(2);
        document.getElementById('SH_m2a').value = r.SH_K.toFixed(2);
        
        document.getElementById('p_out_m2').value = r.p_out_bar.toFixed(3);
        document.getElementById('T_cond_m2a').value = r.T_cond_C.toFixed(2);
        
        document.getElementById('SC_m2a').value = r.SC_K.toFixed(1);

        document.getElementById('eff_isen_m2').value = (r.eff_isen * 100.0).toFixed(2);
        document.getElementById('vol_eff_m2').value = (r.vol_eff * 100.0).toFixed(2);
        document.getElementById('motor_eff_m2').value = (r.motor_eff * 100.0).toFixed(2);
        
        document.getElementById('rpm_m2').value = r.rpm;
        document.getElementById('vol_disp_m2').value = r.vol_disp_cm3;
        document.getElementById('mass_flow_m2').value = r.m_flow.toFixed(4);
        document.getElementById('vol_flow_m2').value = (r.V_flow_in * 3600.0).toFixed(2);
        
        // (v6.0) 激活对应的单选按钮
        if (r.inlet_define === 't_sh') {
            document.getElementById('inlet_define_t_sh_m2a').click();
        } else {
            document.getElementById('inlet_define_pt_m2a').click();
        }
        
        if (r.outlet_define === 't_t') { // M1 的 't_t' 对应 M2A 的 't'
            document.getElementById('outlet_define_t_m2a').click();
        } else {
            document.getElementById('outlet_define_p_m2a').click();
        }
        
        // 触发 M2 的流体信息更新
        document.getElementById('fluid_m2').dispatchEvent(new Event('change'));
        
        // 触发 M2 的"脏"状态 (v4.2)
        const staleEvent = new Event('stale');
        document.getElementById('calc-button-mode-2').dispatchEvent(staleEvent);
        document.getElementById('calc-button-mode-2b').dispatchEvent(staleEvent);

        // 切换到 M2 选项卡
        document.getElementById('tab-btn-m2').click();
        // 切换到 2A 子选项卡
        document.getElementById('tab-btn-mode-2a').click();
    });

    console.log("Mode 1 (Evaluation) initialized.");
}