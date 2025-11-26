// =====================================================================
// mode2_predict.js: 模式一 (制冷/CO2) & 模式二 (气体)
// 版本: v8.27 (Fix: Mode 1 CO2 undefined pr & Mode 1 Cycle Plot)
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

function generateDatasheetHTML(d, title) {
    try {
        const themeColor = (d.fluid && d.fluid.includes('R744')) ? "#ea580c" : (title.includes("GAS") ? "#0891b2" : "#059669");
        const isGas = title.includes("GAS");
        
        let highSideRow = "";
        if (d.cycle_type === 'Subcritical') {
            highSideRow = `<tr><td style="padding:6px;">Condensing Temp</td><td style="text-align:right;">${d.t_cond.toFixed(2)} °C</td></tr>
            <tr><td style="padding:6px;">Subcooling</td><td style="text-align:right;">${d.sc.toFixed(1)} K</td></tr>
            <tr><td style="padding:6px;">Discharge Pressure</td><td style="text-align:right;">${d.p_out.toFixed(2)} bar</td></tr>`;
        } else if (d.cycle_type === 'Transcritical') {
            highSideRow = `<tr><td style="padding:6px;">Gas Cooler Press.</td><td style="text-align:right;">${d.p_out.toFixed(1)} bar</td></tr>
            <tr><td style="padding:6px;">Gas Cooler Exit T</td><td style="text-align:right;">${d.t_gc_out.toFixed(1)} °C</td></tr>`;
        } else {
            highSideRow = `<tr><td style="padding:6px;">Discharge Pressure</td><td style="text-align:right;">${d.p_out.toFixed(2)} bar</td></tr>
            <tr><td style="padding:6px;">Discharge Temp</td><td style="text-align:right;">${d.t_out.toFixed(2)} °C</td></tr>`;
        }

        let stageInfo = "";
        if (d.stages && d.stages > 1) {
            stageInfo = `<div style="margin-top:5px; font-size:12px; color:#555;">Stages: <b>${d.stages}</b> | Intercooling: <b>${d.intercool ? "Yes" : "No"}</b></div>`;
        }

        return `
        <div style="padding:30px; font-family:'Segoe UI', sans-serif; background:#fff; color:#333;">
            <div style="border-bottom:3px solid ${themeColor}; padding-bottom:15px; margin-bottom:20px;">
                <h2 style="color:${themeColor}; margin:0;">${title}</h2>
                <div style="font-size:12px; color:#666; margin-top:5px;">Fluid: <strong>${d.fluid}</strong> | Date: <strong>${d.date}</strong></div>
                ${stageInfo}
            </div>
            
            <div style="display:flex; justify-content:space-around; background:#f9fafb; padding:20px; border-radius:8px; margin-bottom:30px; border:1px solid #eee;">
                <div style="text-align:center;"><div style="font-size:11px; color:#666;">SHAFT POWER</div><div style="font-size:24px; font-weight:800; color:${themeColor}">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div></div>
                ${!isGas ? `<div style="text-align:center;"><div style="font-size:11px; color:#666;">COOLING CAP</div><div style="font-size:24px; font-weight:800; color:${themeColor}">${d.q_evap.toFixed(2)} <span style="font-size:14px">kW</span></div></div>` : ''}
                <div style="text-align:center;"><div style="font-size:11px; color:#666;">${d.q_cond ? 'HEATING/GC LOAD' : 'PRESSURE RATIO'}</div><div style="font-size:24px; font-weight:800; color:${themeColor}">${d.q_cond ? d.q_cond.toFixed(2) + ' <span style="font-size:14px">kW</span>' : d.pr.toFixed(2)}</div></div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px;">
                <div>
                    <div style="font-weight:bold; border-left:4px solid ${themeColor}; padding-left:10px; margin-bottom:10px; background:#f9fafb;">Operating Conditions</div>
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">Suction Pressure</td><td style="text-align:right; font-weight:600;">${d.p_in.toFixed(2)} bar</td></tr>
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">Suction Temp</td><td style="text-align:right; font-weight:600;">${d.t_in.toFixed(2)} °C</td></tr>
                        ${highSideRow}
                    </table>
                </div>
                <div>
                    <div style="font-weight:bold; border-left:4px solid ${themeColor}; padding-left:10px; margin-bottom:10px; background:#f9fafb;">Performance Data</div>
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">Mass Flow</td><td style="text-align:right; font-weight:600;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">Vol Flow (In)</td><td style="text-align:right; font-weight:600;">${(d.v_flow * 3600).toFixed(1)} m³/h</td></tr>
                        ${d.cop_c ? `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">COP (Cooling)</td><td style="text-align:right; font-weight:600;">${d.cop_c.toFixed(2)}</td></tr>` : ''}
                    </table>
                </div>
            </div>

            ${d.cooling_info ? `
            <div style="margin-top:20px; padding:15px; background:#fff1f2; border-left:4px solid ${isGas?'#0891b2':'#dc2626'}; border-radius:4px; font-size:13px;">
                <div style="font-weight:bold; color:#991b1b; margin-bottom:5px;">THERMAL MANAGEMENT (${d.cooling_info.type})</div>
                ${d.cooling_info.q_loss > 0 ? `<div>Heat Removed: <strong>${d.cooling_info.q_loss.toFixed(2)} kW</strong></div>` : ''}
                ${d.cooling_info.t_raw ? `<div>Raw Discharge T: ${d.cooling_info.t_raw.toFixed(1)} °C</div>` : ''}
            </div>` : ''}
            <div style="margin-top:40px; text-align:center; font-size:11px; color:#999; border-top:1px solid #eee; padding-top:10px;">Calculation of Compressor Efficiency Pro v8.27</div>
        </div>`;
    } catch (e) {
        console.error("HTML Gen Error:", e);
        return `<div style="color:red;">Report Error: ${e.message}</div>`;
    }
}

async function calculateMode1_CO2(CP) {
    if (!CP) return;
    calcButtonM1_CO2.disabled = true; 
    calcButtonM1_CO2.textContent = "计算中...";

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1_CO2);
            const fluid = "R744"; 
            const cycleType = document.querySelector('input[name="cycle_type_m1_co2"]:checked')?.value || 'transcritical';

            const t_evap = parseFloat(fd.get('T_evap_m1_co2'));
            const sh = parseFloat(fd.get('SH_m1_co2'));
            const p_in = CP.PropsSI('P', 'T', t_evap + 273.15, 'Q', 1, fluid);
            const t_in_k = t_evap + sh + 273.15;
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);

            let p_out, t_out_point3_k, h_point3;
            let report_vals = {};

            if (cycleType === 'transcritical') {
                const p_high = parseFloat(fd.get('p_high_m1_co2')) * 1e5;
                const t_gc_out = parseFloat(fd.get('T_gc_out_m1_co2'));
                p_out = p_high;
                t_out_point3_k = t_gc_out + 273.15;
                h_point3 = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3_k, fluid);
                report_vals = { t_gc_out };
            } else {
                const t_cond = parseFloat(fd.get('T_cond_m1_co2'));
                const sc = parseFloat(fd.get('SC_m1_co2'));
                const t_cond_k = t_cond + 273.15;
                p_out = CP.PropsSI('P', 'T', t_cond_k, 'Q', 0, fluid);
                t_out_point3_k = t_cond_k - sc;
                h_point3 = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3_k, fluid);
                report_vals = { t_cond, sc };
            }

            const pr_act = p_out / p_in; // Calculate Pressure Ratio
            const eff_isen = parseFloat(fd.get('eff_isen_peak_m1_co2')); 
            const eff_vol = 0.95; 

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1_co2', d_in, eff_vol);

            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out_raw = h_in + w_real;
            const t_out_raw_k = CP.PropsSI('T', 'P', p_out, 'H', h_out_raw, fluid);
            const power = w_real * m_flow / 1000.0;
            const q_evap = (h_in - h_point3) * m_flow / 1000.0;
            
            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                cycle_type: cycleType === 'transcritical' ? 'Transcritical' : 'Subcritical',
                p_in: p_in/1e5, t_in: t_in_k - 273.15,
                p_out: p_out/1e5, t_out: t_out_raw_k - 273.15,
                pr: pr_act, // [Fix] Added this line
                ...report_vals,
                m_flow, v_flow: v_flow_in, power, q_evap,
                cop_c: q_evap/power,
                eff_isen, eff_vol, eff_note: "Standard"
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "CO2 REPORT");
            if(chartDivM1) {
                chartDivM1.classList.remove('hidden');
                // CO2 Cycle Points
                const h_4 = h_point3; 
                const s_4 = CP.PropsSI('S', 'P', p_in, 'H', h_4, fluid);
                const s_3 = CP.PropsSI('S', 'P', p_out, 'H', h_point3, fluid);
                drawPhDiagram(CP, fluid, { points: [
                    { name: '1', desc: 'Suc', p: p_in, t: t_in_k, h: h_in, s: s_in },
                    { name: '2', desc: 'Dis', p: p_out, t: t_out_raw_k, h: h_out_raw, s: CP.PropsSI('S','P',p_out,'H',h_out_raw,fluid) },
                    { name: '3', desc: 'Out', p: p_out, t: t_out_point3_k, h: h_point3, s: s_3 },
                    { name: '4', desc: 'Exp', p: p_in, t: CP.PropsSI('T','P',p_in,'H',h_4,fluid), h: h_4, s: s_4 }
                ]}, 'chart-m1');
            }

        } catch (err) {
            resultsDivM1.innerHTML = `<div class="p-4 bg-red-50 text-red-600">Error: ${err.message}</div>`;
        } finally {
            calcButtonM1_CO2.disabled = false; calcButtonM1_CO2.textContent = "🔥 计算 CO2 (R744) 循环";
            if(printButtonM1) printButtonM1.disabled = false;
            if(exportButtonM1) exportButtonM1.disabled = false;
        }
    }, 50);
}

async function calculateMode2(CP) {
    if (!CP) return;
    calcButtonM2.disabled = true; calcButtonM2.textContent = "计算中...";
    
    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM2);
            const fluid = fd.get('fluid_m2');
            const p_in = parseFloat(fd.get('p_in_m2')) * 1e5;
            const t_in = parseFloat(fd.get('T_in_m2')) + 273.15;
            const p_out = parseFloat(fd.get('p_out_m2')) * 1e5;
            const eff_isen = parseFloat(fd.get('eff_isen_m2'))/100;
            const stages = parseInt(fd.get('stages_m2') || 1);
            const enable_intercool = document.getElementById('enable_intercool_m2').checked;
            
            const coolRadio = document.querySelector('input[name="cooling_mode_m2"]:checked');
            const cooling_mode = coolRadio ? coolRadio.value : 'adiabatic';
            const target_t_out = parseFloat(fd.get('target_t_out_m2') || 100);

            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in, fluid);
            let { m_flow, v_flow_in } = getFlowRate(fd, 'm2', d_in);

            const pr_total = p_out / p_in;
            const pr_stage = Math.pow(pr_total, 1.0 / stages);
            
            let total_work = 0;
            let current_p = p_in;
            let current_t = t_in;
            
            let h_stage_start, s_stage_start, h_stage_end_real, work_stage;
            let final_h = 0, final_t = 0, final_s = 0;

            for (let i = 0; i < stages; i++) {
                let next_p = current_p * pr_stage;
                if (i === stages - 1) next_p = p_out;

                h_stage_start = CP.PropsSI('H', 'P', current_p, 'T', current_t, fluid);
                s_stage_start = CP.PropsSI('S', 'P', current_p, 'T', current_t, fluid);

                let h_end_is = CP.PropsSI('H', 'P', next_p, 'S', s_stage_start, fluid);
                work_stage = (h_end_is - h_stage_start) / eff_isen;
                h_stage_end_real = h_stage_start + work_stage;
                
                total_work += work_stage;
                current_p = next_p;

                if (i < stages - 1) {
                    if (enable_intercool) current_t = t_in;
                    else current_t = CP.PropsSI('T', 'P', current_p, 'H', h_stage_end_real, fluid);
                } else {
                    final_h = h_stage_end_real;
                    final_t = CP.PropsSI('T', 'P', current_p, 'H', h_stage_end_real, fluid);
                }
            }

            let t_out_final = final_t;
            let h_out_final = final_h;
            let q_loss = 0;
            let cooling_desc = "Adiabatic";

            if (cooling_mode === 'target_t') {
                const t_target_k = target_t_out + 273.15;
                if (t_target_k < final_t) {
                    t_out_final = t_target_k;
                    h_out_final = CP.PropsSI('H', 'P', p_out, 'T', t_target_k, fluid);
                    q_loss = m_flow * (final_h - h_out_final) / 1000.0;
                    cooling_desc = "Cooled Target T";
                }
            }
            final_s = CP.PropsSI('S', 'P', p_out, 'H', h_out_final, fluid);
            const power = total_work * m_flow / 1000.0;

            lastMode2Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in-273.15, p_out: p_out/1e5, t_out: t_out_final-273.15,
                m_flow, v_flow: v_flow_in, power, pr: pr_total,
                eff_isen, stages, intercool: enable_intercool,
                cooling_info: { type: cooling_desc, t_raw: final_t - 273.15, q_loss }
            };

            resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT");
            if(chartDivM2) {
                chartDivM2.classList.remove('hidden');
                const h_in_0 = CP.PropsSI('H', 'P', p_in, 'T', t_in, fluid);
                const s_in_0 = CP.PropsSI('S', 'P', p_in, 'T', t_in, fluid);
                drawPhDiagram(CP, fluid, { points: [
                    { name: 'In', desc: 'Suction', p: p_in, t: t_in, h: h_in_0, s: s_in_0 },
                    { name: 'Out', desc: 'Discharge', p: p_out, t: t_out_final, h: h_out_final, s: final_s }
                ]}, 'chart-m2');
            }

        } catch(e) { 
            resultsDivM2.textContent = "Error: " + e.message; 
        } finally {
            calcButtonM2.disabled = false; calcButtonM2.textContent = "计算气体压缩";
            if(printButtonM2) printButtonM2.disabled = false;
            if(exportButtonM2) exportButtonM2.disabled = false;
        }
    }, 10);
}

async function calculateMode1(CP) {
    if (!CP) return;
    calcButtonM1.disabled = true; calcButtonM1.textContent = "Calculating...";
    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1);
            const fluid = fd.get('fluid_m1');
            const t_evap = parseFloat(fd.get('T_evap_m1'));
            const sh = parseFloat(fd.get('SH_m1'));
            const t_cond = parseFloat(fd.get('T_cond_m1'));
            const sc = parseFloat(fd.get('SC_m1'));
            const eff_isen = parseFloat(fd.get('eff_isen_m1'))/100;
            const stages = parseInt(fd.get('stages_m1') || 1);
            
            const p_in = CP.PropsSI('P','T', t_evap+273.15, 'Q', 1, fluid);
            const p_out = CP.PropsSI('P','T', t_cond+273.15, 'Q', 1, fluid);
            const t_in_k = t_evap + sh + 273.15;
            
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in_k, fluid);

            const pr_total = p_out / p_in;
            const pr_stage = Math.pow(pr_total, 1.0 / stages);
            
            let current_p = p_in;
            let current_h = h_in;
            let total_work = 0;

            for(let i=0; i<stages; i++) {
                let next_p = current_p * pr_stage;
                if(i === stages-1) next_p = p_out;

                let current_s = CP.PropsSI('S', 'P', current_p, 'H', current_h, fluid);
                let h_end_is = CP.PropsSI('H', 'P', next_p, 'S', current_s, fluid);
                let work_stage = (h_end_is - current_h) / eff_isen;
                
                current_h += work_stage;
                current_p = next_p;
                total_work += work_stage;
            }

            const h_out = current_h;
            const t_out_k = CP.PropsSI('T','P', p_out, 'H', h_out, fluid);
            const s_out = CP.PropsSI('S','P', p_out, 'H', h_out, fluid);

            const t_liq_k = t_cond + 273.15 - sc;
            const h_liq = CP.PropsSI('H','P', p_out, 'T', t_liq_k, fluid);
            const s_liq = CP.PropsSI('S','P', p_out, 'T', t_liq_k, fluid);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1', d_in);
            const q_evap = (h_in - h_liq) * m_flow / 1000.0; 
            const q_cond = (h_out - h_liq) * m_flow / 1000.0; 
            const power = total_work * m_flow / 1000.0;

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in_k-273.15, p_out: p_out/1e5, t_out: t_out_k-273.15,
                t_cond, sc, m_flow, v_flow: v_flow_in, power, q_evap, q_cond, 
                cop_c: q_evap/power, cop_h: q_cond/power, stages,
                eff_isen, eff_vol: parseFloat(fd.get('vol_eff_m1'))/100, eff_note: "Standard"
            };
            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "STANDARD HEAT PUMP REPORT");
            
            if(chartDivM1) {
                chartDivM1.classList.remove('hidden');
                // Draw Full 4-Point Cycle (Fix for v8.27)
                const t_4 = CP.PropsSI('T', 'P', p_in, 'H', h_liq, fluid);
                const s_4 = CP.PropsSI('S', 'P', p_in, 'H', h_liq, fluid);

                const points = [
                    { name: '1', desc: 'Suction', p: p_in, t: t_in_k, h: h_in, s: s_in },
                    { name: '2', desc: 'Discharge', p: p_out, t: t_out_k, h: h_out, s: s_out },
                    { name: '3', desc: 'Liquid', p: p_out, t: t_liq_k, h: h_liq, s: s_liq },
                    { name: '4', desc: 'Evap In', p: p_in, t: t_4, h: h_liq, s: s_4 }
                ];
                drawPhDiagram(CP, fluid, { points }, 'chart-m1');
            }
        } catch (e) { resultsDivM1.innerHTML = `<div class="text-red-500">Error: ${e.message}</div>`; }
        finally {
            calcButtonM1.disabled = false; calcButtonM1.textContent = "计算常规热泵";
            if(printButtonM1) printButtonM1.disabled = false;
            if(exportButtonM1) exportButtonM1.disabled = false;
        }
    }, 10);
}

export function initMode1_2(CP) {
    CP_INSTANCE = CP;
    printButtonM1 = document.getElementById('print-button-1');
    exportButtonM1 = document.getElementById('export-button-1');
    printButtonM2 = document.getElementById('print-button-2');
    exportButtonM2 = document.getElementById('export-button-2');
    
    calcButtonM1 = document.getElementById('calc-button-1');
    calcButtonM1_CO2 = document.getElementById('calc-button-1-co2');
    calcButtonM2 = document.getElementById('calc-button-2');
    
    resultsDivM1 = document.getElementById('results-1');
    resultsDivM2 = document.getElementById('results-2');
    chartDivM1 = document.getElementById('chart-m1');
    chartDivM2 = document.getElementById('chart-m2');
    
    calcFormM1 = document.getElementById('calc-form-1');
    calcFormM1_CO2 = document.getElementById('calc-form-1-co2');
    calcFormM2 = document.getElementById('calc-form-2');
    btnOptP = document.getElementById('btn-opt-p-high');

    // AI Logic for Mode 2
    const aiSelectM2 = document.getElementById('ai_eff_m2');
    if (aiSelectM2) {
        aiSelectM2.addEventListener('change', () => {
            const val = aiSelectM2.value;
            const effIsen = document.getElementById('eff_isen_m2');
            const effVol = document.getElementById('vol_eff_m2');
            if (val === 'piston') { effIsen.value = 75; effVol.value = 85; }
            else if (val === 'screw') { effIsen.value = 78; effVol.value = 90; }
            else if (val === 'turbo') { effIsen.value = 82; effVol.value = 95; }
        });
    }

    if (printButtonM1) printButtonM1.onclick = () => {
        if (lastMode1Data) {
            const win = window.open('', '_blank');
            win.document.write(`<html><head><title>Report</title></head><body style="margin:0">${generateDatasheetHTML(lastMode1Data, lastMode1Data.fluid.includes('R744') ? "CO2 REPORT" : "HEAT PUMP REPORT")}</body></html>`);
            win.document.close();
            setTimeout(() => win.print(), 200);
        } else alert("Please Calculate First");
    };
    if (exportButtonM1) exportButtonM1.onclick = () => { if (lastMode1Data) exportToExcel(lastMode1Data, "Mode1_Result"); };

    if (printButtonM2) printButtonM2.onclick = () => {
        if (lastMode2Data) {
            const win = window.open('', '_blank');
            win.document.write(`<html><head><title>Gas Report</title></head><body style="margin:0">${generateDatasheetHTML(lastMode2Data, "GAS REPORT")}</body></html>`);
            win.document.close();
            setTimeout(() => win.print(), 200);
        } else alert("Please Calculate First");
    };
    if (exportButtonM2) exportButtonM2.onclick = () => { if (lastMode2Data) exportToExcel(lastMode2Data, "Mode2_Gas_Result"); };

    if (calcFormM1) calcFormM1.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1(CP); });
    if (calcFormM1_CO2) {
        calcFormM1_CO2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1_CO2(CP); });
        if(btnOptP) btnOptP.addEventListener('click', () => {
            const t = parseFloat(document.getElementById('T_gc_out_m1_co2').value);
            if(t) document.getElementById('p_high_m1_co2').value = (2.75 * t - 6.5).toFixed(1);
        });
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
    if (calcFormM2) {
        calcFormM2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode2(CP); });
        const fluidSelectM2 = document.getElementById('fluid_m2');
        if(fluidSelectM2) fluidSelectM2.addEventListener('change', () => updateFluidInfo(fluidSelectM2, document.getElementById('fluid-info-m2'), CP));
    }
}