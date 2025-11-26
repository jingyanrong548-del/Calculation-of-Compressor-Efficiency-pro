// =====================================================================
// mode2_predict.js: 模式一 (制冷/CO2) & 模式二 (气体)
// 版本: v8.24 (Feature: CO2 Dual Mode & Gas Cooling)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, exportToExcel } from './utils.js';

let CP_INSTANCE = null;
let lastMode1Data = null;
let lastMode2Data = null;

// DOM Elements
let calcButtonM1, resultsDivM1, calcFormM1, printButtonM1, exportButtonM1, chartDivM1;
let calcButtonM1_CO2, calcFormM1_CO2, btnOptP;
let calcButtonM2, resultsDivM2, calcFormM2, printButtonM2, exportButtonM2, chartDivM2;

// --- Helper: 流量计算 ---
function getFlowRate(formData, modeSuffix, density_in, overrideVolEff = null) {
    const mode = formData.get(`flow_mode_${modeSuffix}`);
    let m_flow = 0, v_flow_in = 0;

    if (mode === 'rpm') {
        const rpm = parseFloat(formData.get(`rpm_${modeSuffix}`));
        const vol_disp = parseFloat(formData.get(`vol_disp_${modeSuffix}`)) / 1e6;
        const vol_eff_val = overrideVolEff !== null ? overrideVolEff : parseFloat(formData.get(`vol_eff_${modeSuffix}`) || '100') / 100.0;
        v_flow_in = (rpm / 60.0) * vol_disp * vol_eff_val; 
        m_flow = v_flow_in * density_in;
    } else if (mode === 'mass') {
        m_flow = parseFloat(formData.get(`mass_flow_${modeSuffix}`));
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        v_flow_in = parseFloat(formData.get(`vol_flow_${modeSuffix}`)) / 3600.0;
        m_flow = v_flow_in * density_in;
    }
    return { m_flow, v_flow_in };
}

// --- Helper: Datasheet 生成器 ---
function generateDatasheetHTML(d, title) {
    try {
        const themeColor = (d.fluid && d.fluid.includes('R744')) ? "#ea580c" : (title.includes("GAS") ? "#0891b2" : "#059669");
        const isGas = title.includes("GAS");
        
        // CO2 专用字段处理
        let highSideRow = "";
        if (d.cycle_type === 'Subcritical') {
            highSideRow = `
            <tr><td style="padding:6px;">Condensing Temp</td><td style="text-align:right;">${d.t_cond.toFixed(2)} °C</td></tr>
            <tr><td style="padding:6px;">Subcooling</td><td style="text-align:right;">${d.sc.toFixed(1)} K</td></tr>
            <tr><td style="padding:6px;">Discharge Pressure</td><td style="text-align:right;">${d.p_out.toFixed(2)} bar</td></tr>`;
        } else if (d.cycle_type === 'Transcritical') {
            highSideRow = `
            <tr><td style="padding:6px;">Gas Cooler Press.</td><td style="text-align:right;">${d.p_out.toFixed(1)} bar</td></tr>
            <tr><td style="padding:6px;">Gas Cooler Exit T</td><td style="text-align:right;">${d.t_gc_out.toFixed(1)} °C</td></tr>`;
        } else {
            // 常规模式
            highSideRow = `
            <tr><td style="padding:6px;">Discharge Pressure</td><td style="text-align:right;">${d.p_out.toFixed(2)} bar</td></tr>
            <tr><td style="padding:6px;">Discharge Temp</td><td style="text-align:right;">${d.t_out.toFixed(2)} °C</td></tr>`;
        }

        let html = `
        <div style="padding:20px; font-family:'Segoe UI', sans-serif; background:#fff;">
            <div style="border-bottom:2px solid ${themeColor}; padding-bottom:10px; margin-bottom:20px;">
                <h2 style="color:${themeColor}; margin:0;">${title}</h2>
                <div style="font-size:12px; color:#666;">Fluid: ${d.fluid} | Date: ${d.date} | Type: ${d.cycle_type || 'Standard'}</div>
            </div>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:15px; background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:20px;">
                <div><strong>Shaft Power:</strong><br><span style="font-size:18px; color:${themeColor}">${d.power.toFixed(2)} kW</span></div>
                ${!isGas ? `<div><strong>Cooling Cap:</strong><br><span style="font-size:18px;">${d.q_evap.toFixed(2)} kW</span></div>` : ''}
                ${d.cop_c ? `<div><strong>COP (C):</strong><br><span style="font-size:18px;">${d.cop_c.toFixed(2)}</span></div>` : ''}
                ${d.q_cond ? `<div><strong>Heat Rejection:</strong><br><span style="font-size:18px;">${d.q_cond.toFixed(2)} kW</span></div>` : ''}
            </div>

            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr style="background:#eee; border-bottom:1px solid #ddd;">
                    <th style="text-align:left; padding:8px;">Parameter</th>
                    <th style="text-align:right; padding:8px;">Value</th>
                </tr>
                <tr><td style="padding:6px;">P_in / T_in</td><td style="text-align:right;">${d.p_in.toFixed(2)} bar / ${d.t_in.toFixed(2)} °C</td></tr>
                ${highSideRow}
                <tr><td style="padding:6px;">Mass Flow</td><td style="text-align:right;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
            </table>

            ${d.cooling_info ? `
            <div style="margin-top:15px; padding:10px; background:#fff1f2; border-left:3px solid ${isGas?'#0891b2':'#dc2626'}; font-size:12px;">
                <div style="font-weight:bold; margin-bottom:5px;">THERMAL MANAGEMENT (${d.cooling_info.type})</div>
                ${d.cooling_info.q_loss ? `<div>Heat Removed: <strong>${d.cooling_info.q_loss.toFixed(2)} kW</strong></div>` : ''}
                ${d.cooling_info.t_raw ? `<div>Adiabatic Discharge Temp: ${d.cooling_info.t_raw.toFixed(1)} °C</div>` : ''}
                ${d.cooling_info.m_inj ? `<div>Injection Flow: ${(d.cooling_info.m_inj*3600).toFixed(1)} kg/h</div>` : ''}
            </div>` : ''}
        </div>`;
        return html;
    } catch (e) {
        console.error("HTML Gen Error:", e);
        return `<div style="color:red;">Report Generation Failed: ${e.message}</div>`;
    }
}

// --- 模式 1-CO2 计算核心 (Dual Mode) ---
async function calculateMode1_CO2(CP) {
    if (!CP) return;
    calcButtonM1_CO2.disabled = true; 
    calcButtonM1_CO2.textContent = "计算中 (Processing)...";

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1_CO2);
            const fluid = "R744"; 
            
            // 1. 获取循环模式
            // 如果 radio 没被选中 (比如旧缓存)，默认为 transcritical
            const cycleTypeRadio = document.querySelector('input[name="cycle_type_m1_co2"]:checked');
            const cycleType = cycleTypeRadio ? cycleTypeRadio.value : 'transcritical';

            // Common Inputs
            const t_evap = parseFloat(fd.get('T_evap_m1_co2'));
            const sh = parseFloat(fd.get('SH_m1_co2'));
            
            // Efficiency Inputs
            const eff_peak = parseFloat(fd.get('eff_isen_peak_m1_co2'));
            const pr_des = parseFloat(fd.get('pr_design_m1_co2'));
            const clearance = parseFloat(fd.get('clearance_m1_co2'));
            const n_index = parseFloat(fd.get('poly_index_m1_co2'));
            
            // Cooling Inputs
            const coolRadio = document.querySelector('input[name="cooling_mode_m1_co2"]:checked');
            const cool_mode = coolRadio ? coolRadio.value : 'adiabatic';
            const heat_loss_pct = parseFloat(fd.get('heat_loss_ratio_m1_co2') || 0);
            const target_t_out = parseFloat(fd.get('target_t_out_m1_co2') || 120);

            // 2. Point 1: Suction
            const p_in = CP.PropsSI('P', 'T', t_evap + 273.15, 'Q', 1, fluid);
            const t_in_k = t_evap + sh + 273.15;
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);

            // 3. Determine High Side (Dual Mode Logic)
            let p_out, t_out_point3_k, h_point3;
            let report_t_cond = null, report_sc = null, report_t_gc_out = null;
            let is_transcritical_actual = false;

            if (cycleType === 'transcritical') {
                // 跨临界逻辑：直接读取压力和出口温度
                const p_high_bar = parseFloat(fd.get('p_high_m1_co2'));
                const t_gc_out = parseFloat(fd.get('T_gc_out_m1_co2'));
                
                p_out = p_high_bar * 1e5;
                t_out_point3_k = t_gc_out + 273.15;
                h_point3 = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3_k, fluid);
                
                report_t_gc_out = t_gc_out;
                
                // 检查物理状态
                const p_crit = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
                is_transcritical_actual = p_out > p_crit;

            } else {
                // 亚临界逻辑：读取冷凝温度和过冷度 -> 反算压力
                const t_cond = parseFloat(fd.get('T_cond_m1_co2'));
                const sc = parseFloat(fd.get('SC_m1_co2'));
                const t_cond_k = t_cond + 273.15;

                // 计算饱和压力
                try {
                    p_out = CP.PropsSI('P', 'T', t_cond_k, 'Q', 0, fluid);
                } catch (e) {
                    throw new Error(`Condensing Temp ${t_cond}°C is too high for Subcritical (Must be < 31.06°C)`);
                }

                // 计算出液点
                t_out_point3_k = t_cond_k - sc;
                h_point3 = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3_k, fluid);
                
                report_t_cond = t_cond;
                report_sc = sc;
                is_transcritical_actual = false;
            }

            // 4. Compression Calc
            const pr_act = p_out / p_in;
            
            // Volumetric Eff
            let eff_vol = 0.98 * (1.0 - clearance * (Math.pow(pr_act, 1.0/n_index) - 1.0));
            eff_vol = Math.max(0.1, Math.min(0.99, eff_vol));
            
            // Isentropic Eff
            const deviation = (pr_act - pr_des) / pr_des;
            let eff_isen = eff_peak * (1.0 - 0.25 * Math.pow(deviation, 2));
            eff_isen = Math.max(0.3, eff_isen);

            // Flow Rate
            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1_co2', d_in, eff_vol);

            // Discharge (Adiabatic)
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out_raw = h_in + w_real;
            const t_out_raw_k = CP.PropsSI('T', 'P', p_out, 'H', h_out_raw, fluid);
            const power_shaft = w_real * m_flow / 1000.0;

            // 5. Cooling & Injection
            let h_out_final = h_out_raw;
            let t_out_final_k = t_out_raw_k;
            let q_loss = 0, m_inj = 0, m_total_dis = m_flow;

            if (cool_mode === 'surface') {
                q_loss = power_shaft * (heat_loss_pct / 100.0);
                h_out_final = h_out_raw - (q_loss * 1000.0 / m_flow);
                t_out_final_k = CP.PropsSI('T', 'P', p_out, 'H', h_out_final, fluid);
            } else if (cool_mode === 'injection') {
                const t_target_k = target_t_out + 273.15;
                if (t_target_k < t_out_raw_k) {
                    const h_target = CP.PropsSI('H', 'P', p_out, 'T', t_target_k, fluid);
                    // Injection source assumes from Point 3 (Gas Cooler/Condenser Out)
                    const h_inj_src = h_point3;
                    const num = m_flow * (h_out_raw - h_target);
                    const den = h_target - h_inj_src;
                    if (den > 0) {
                        m_inj = num / den;
                        h_out_final = h_target;
                        t_out_final_k = t_target_k;
                        m_total_dis += m_inj;
                    }
                }
            }
            const s_out_final = CP.PropsSI('S', 'P', p_out, 'H', h_out_final, fluid);

            // 6. Performance
            const q_evap = (h_in - h_point3) * m_flow / 1000.0;
            const q_cond = (h_out_final - h_point3) * m_total_dis / 1000.0;

            // 7. Data Package
            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                cycle_type: cycleType === 'transcritical' ? 'Transcritical' : 'Subcritical',
                p_in: p_in/1e5, t_in: t_in_k - 273.15,
                p_out: p_out/1e5, t_out: t_out_final_k - 273.15,
                
                // Special Fields
                t_gc_out: report_t_gc_out,
                t_cond: report_t_cond,
                sc: report_sc,
                
                m_flow, v_flow: v_flow_in, power: power_shaft, 
                q_evap, q_cond,
                cop_c: q_evap/power_shaft, cop_h: q_cond/power_shaft,
                eff_isen, eff_vol, 
                eff_note: `AI-CO2 (${cycleType})`,
                cooling_info: { type: cool_mode, t_raw: t_out_raw_k - 273.15, q_loss, m_inj }
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, `CO2 ${cycleType.toUpperCase()} REPORT`);

            // 8. Chart
            if(chartDivM1) {
                chartDivM1.classList.remove('hidden');
                // Point 4 is Throttling from Point 3
                const h_4 = h_point3; 
                const s_4 = CP.PropsSI('S', 'P', p_in, 'H', h_4, fluid);
                const s_3 = CP.PropsSI('S', 'P', p_out, 'H', h_point3, fluid);

                const points = [
                    { name: '1', desc: 'Suction', p: p_in, t: t_in_k, h: h_in, s: s_in },
                    { name: '2', desc: 'Discharge', p: p_out, t: t_out_final_k, h: h_out_final, s: s_out_final },
                    { name: '3', desc: 'Out (GC/Cond)', p: p_out, t: t_out_point3_k, h: h_point3, s: s_3 },
                    { name: '4', desc: 'Evap In', p: p_in, t: CP.PropsSI('T','P',p_in,'H',h_4,fluid), h: h_4, s: s_4 }
                ];
                drawPhDiagram(CP, fluid, { points }, 'chart-m1');
            }

        } catch (err) {
            resultsDivM1.innerHTML = `<div class="p-4 bg-red-50 text-red-600 border border-red-200 rounded"><strong>Error:</strong> ${err.message}</div>`;
        } finally {
            calcButtonM1_CO2.disabled = false; 
            calcButtonM1_CO2.textContent = "🔥 计算 CO2 (R744) 循环";
        }
    }, 50);
}

// --- 模式 2: 气体压缩 (含热管理) ---
async function calculateMode2(CP) {
    if (!CP) return;
    calcButtonM2.disabled = true; 
    calcButtonM2.textContent = "计算中...";
    
    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM2);
            const fluid = fd.get('fluid_m2');
            const p_in = parseFloat(fd.get('p_in_m2')) * 1e5;
            const t_in = parseFloat(fd.get('T_in_m2')) + 273.15;
            const p_out = parseFloat(fd.get('p_out_m2')) * 1e5;
            let eff_isen = parseFloat(fd.get('eff_isen_m2'))/100;
            
            const coolRadio = document.querySelector('input[name="cooling_mode_m2"]:checked');
            const cooling_mode = coolRadio ? coolRadio.value : 'adiabatic';
            const target_t_out = parseFloat(fd.get('target_t_out_m2') || 100);

            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in, fluid);
            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in, fluid);

            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out_adiabatic = h_in + w_real;
            const t_out_adiabatic = CP.PropsSI('T','P', p_out, 'H', h_out_adiabatic, fluid);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm2', d_in);
            const power = w_real * m_flow / 1000;

            let t_out_final = t_out_adiabatic;
            let h_out_final = h_out_adiabatic;
            let q_loss = 0;
            let cooling_desc = "Adiabatic";

            if (cooling_mode === 'target_t') {
                const t_target_k = target_t_out + 273.15;
                if (t_target_k < t_out_adiabatic) {
                    t_out_final = t_target_k;
                    h_out_final = CP.PropsSI('H', 'P', p_out, 'T', t_target_k, fluid);
                    q_loss = m_flow * (h_out_adiabatic - h_out_final) / 1000.0; 
                    cooling_desc = "Target T_out (Cooled)";
                } else {
                    cooling_desc = "Target T > Adiabatic (Ignored)";
                }
            }

            const s_out_final = CP.PropsSI('S', 'P', p_out, 'H', h_out_final, fluid);

            lastMode2Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in-273.15, p_out: p_out/1e5, t_out: t_out_final-273.15,
                m_flow, v_flow: v_flow_in, power, pr: p_out/p_in,
                eff_isen, eff_vol: parseFloat(fd.get('vol_eff_m2'))/100, 
                eff_note: "Standard",
                cooling_info: { type: cooling_desc, t_raw: t_out_adiabatic - 273.15, q_loss }
            };

            resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT 气体压缩报告");
            
            if(chartDivM2) {
                chartDivM2.classList.remove('hidden');
                drawPhDiagram(CP, fluid, { points: [
                    { name: '1', desc: 'Suction', p: p_in, t: t_in, h: h_in, s: s_in },
                    { name: '2', desc: 'Discharge', p: p_out, t: t_out_final, h: h_out_final, s: s_out_final }
                ]}, 'chart-m2');
            }

        } catch(e) { 
            resultsDivM2.textContent = "Error: " + e.message; 
        } finally {
            calcButtonM2.disabled = false; 
            calcButtonM2.textContent = "计算气体压缩";
            printButtonM2.disabled = false;
            exportButtonM2.disabled = false;
        }
    }, 10);
}

// --- 模式 1 (常规) 计算 ---
async function calculateMode1(CP) {
    if (!CP) return;
    if(calcButtonM1) {
        calcButtonM1.disabled = true; 
        calcButtonM1.textContent = "Calculating...";
    }
    
    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1);
            const fluid = fd.get('fluid_m1');
            const t_evap = parseFloat(fd.get('T_evap_m1'));
            const sh = parseFloat(fd.get('SH_m1'));
            const t_cond = parseFloat(fd.get('T_cond_m1'));
            const sc = parseFloat(fd.get('SC_m1'));
            let eff_isen = parseFloat(fd.get('eff_isen_m1'))/100;
            
            const p_in = CP.PropsSI('P','T', t_evap+273.15, 'Q', 1, fluid);
            const p_out = CP.PropsSI('P','T', t_cond+273.15, 'Q', 1, fluid);
            const pr_actual = p_out / p_in;

            let eff_note = "Static";
            if (fd.get('enable_dynamic_eff_m1') === 'on') {
                const pr_des = parseFloat(fd.get('pr_design_m1'));
                const factor = 1 - 0.03 * Math.pow(pr_actual - pr_des, 2); 
                eff_isen = eff_isen * Math.max(0.5, factor);
                eff_note = `Dynamic (PR=${pr_actual.toFixed(2)})`;
            }

            const t_in_k = t_evap + sh + 273.15;
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in_k, fluid);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1', d_in);

            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out_k = CP.PropsSI('T','P', p_out, 'H', h_out, fluid);
            const s_out = CP.PropsSI('S','P', p_out, 'H', h_out, fluid);

            const t_liq_k = t_cond + 273.15 - sc;
            const h_liq = CP.PropsSI('H','P', p_out, 'T', t_liq_k, fluid);
            const s_liq = CP.PropsSI('S','P', p_out, 'T', t_liq_k, fluid);

            const h_4 = h_liq;

            const q_evap = (h_in - h_liq) * m_flow / 1000.0; 
            const q_cond = (h_out - h_liq) * m_flow / 1000.0; 
            const power = w_real * m_flow / 1000.0;

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in_k-273.15, p_out: p_out/1e5, t_out: t_out_k-273.15,
                t_cond, sc,
                m_flow, v_flow: v_flow_in, power, q_evap, q_cond, cop_c: q_evap/power, cop_h: q_cond/power,
                eff_isen, eff_vol: parseFloat(fd.get('vol_eff_m1'))/100, eff_note
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "STANDARD HEAT PUMP REPORT 制冷热泵报告");
            
            if(chartDivM1) {
                chartDivM1.classList.remove('hidden');
                const points = [
                    { name: '1', desc: 'Suction', p: p_in, t: t_in_k, h: h_in, s: s_in },
                    { name: '2', desc: 'Discharge', p: p_out, t: t_out_k, h: h_out, s: s_out },
                    { name: '3', desc: 'Liq Out', p: p_out, t: t_liq_k, h: h_liq, s: s_liq },
                    { name: '4', desc: 'Evap In', p: p_in, t: CP.PropsSI('T','P',p_in,'H',h_4,fluid), h: h_4, s: CP.PropsSI('S','P',p_in,'H',h_4,fluid) }
                ];
                drawPhDiagram(CP, fluid, { points }, 'chart-m1');
            }

        } catch (e) {
            resultsDivM1.innerHTML = `<div class="text-red-500 font-bold">Error: ${e.message}</div>`;
        } finally {
            if(calcButtonM1) {
                calcButtonM1.disabled = false; 
                calcButtonM1.textContent = "计算常规热泵";
            }
            if(printButtonM1) printButtonM1.disabled = false;
            if(exportButtonM1) exportButtonM1.disabled = false;
        }
    }, 10);
}

// --- 初始化入口 ---
export function initMode1_2(CP) {
    CP_INSTANCE = CP;
    
    calcButtonM1 = document.getElementById('calc-button-1');
    resultsDivM1 = document.getElementById('results-1');
    calcFormM1 = document.getElementById('calc-form-1');
    printButtonM1 = document.getElementById('print-button-1');
    exportButtonM1 = document.getElementById('export-button-1');
    chartDivM1 = document.getElementById('chart-m1');
    
    calcButtonM1_CO2 = document.getElementById('calc-button-1-co2');
    calcFormM1_CO2 = document.getElementById('calc-form-1-co2');
    btnOptP = document.getElementById('btn-opt-p-high');

    if (calcFormM1) calcFormM1.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1(CP); });
    
    if (calcFormM1_CO2) {
        calcFormM1_CO2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1_CO2(CP); });
        
        if(btnOptP) btnOptP.addEventListener('click', () => {
            const t = parseFloat(document.getElementById('T_gc_out_m1_co2').value);
            if (!isNaN(t)) {
                const p_opt = 2.75 * t - 6.5;
                document.getElementById('p_high_m1_co2').value = Math.max(75, p_opt.toFixed(1)); 
            }
        });

        // 流量切换
        const radios = document.querySelectorAll(`input[name="flow_mode_m1_co2"]`);
        radios.forEach(r => r.addEventListener('change', () => {
             const val = document.querySelector(`input[name="flow_mode_m1_co2"]:checked`).value;
             const rpmDiv = document.getElementById('flow-inputs-rpm-m1_co2');
             const massDiv = document.getElementById('flow-inputs-mass-m1_co2');
             const volDiv = document.getElementById('flow-inputs-vol-m1_co2');
             if(rpmDiv) rpmDiv.style.display = (val === 'rpm') ? 'grid' : 'none';
             if(massDiv) massDiv.style.display = (val === 'mass') ? 'block' : 'none';
             if(volDiv) volDiv.style.display = (val === 'vol') ? 'block' : 'none';
        }));
    }

    calcButtonM2 = document.getElementById('calc-button-2');
    resultsDivM2 = document.getElementById('results-2');
    calcFormM2 = document.getElementById('calc-form-2');
    printButtonM2 = document.getElementById('print-button-2');
    exportButtonM2 = document.getElementById('export-button-2');
    chartDivM2 = document.getElementById('chart-m2');
    
    if (printButtonM2) {
        printButtonM2.onclick = () => {
            if (lastMode2Data) {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Gas Report</title></head><body style="margin:0">${generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT 气体压缩报告")}</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 200);
            }
        };
    }
    if (exportButtonM2) {
        exportButtonM2.onclick = () => { if(lastMode2Data) exportToExcel(lastMode2Data, "Gas_Compressor_Result"); };
    }
    if (calcFormM2) {
        calcFormM2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode2(CP); });
        const fluidSelectM2 = document.getElementById('fluid_m2');
        if(fluidSelectM2) {
            fluidSelectM2.addEventListener('change', () => updateFluidInfo(fluidSelectM2, document.getElementById('fluid-info-m2'), CP));
        }
    }
}