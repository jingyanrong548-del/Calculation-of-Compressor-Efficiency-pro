// =====================================================================
// mode2_predict.js: 模式一 (制冷/CO2) & 模式二 (气体)
// 版本: v8.32 (Feature: Real Gas Properties Z/A/k + CO2 Opt)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, drawOptimizationCurve, exportToExcel } from './utils.js';

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

    const vol_eff_val = overrideVolEff !== null 
        ? overrideVolEff 
        : parseFloat(formData.get(`vol_eff_${modeSuffix}`) || '100') / 100.0;

    if (mode === 'rpm') {
        const rpm = parseFloat(formData.get(`rpm_${modeSuffix}`));
        const vol_disp = parseFloat(formData.get(`vol_disp_${modeSuffix}`)) / 1e6; 
        const v_flow_th = (rpm / 60.0) * vol_disp;
        v_flow_in = v_flow_th * vol_eff_val; 
        m_flow = v_flow_in * density_in;
    } else if (mode === 'mass') {
        m_flow = parseFloat(formData.get(`mass_flow_${modeSuffix}`));
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        const v_flow_th = parseFloat(formData.get(`vol_flow_${modeSuffix}`)) / 3600.0;
        v_flow_in = v_flow_th * vol_eff_val;
        m_flow = v_flow_in * density_in;
    }
    return { m_flow, v_flow_in };
}

// --- Helper: CO2 跨临界寻优算法 (From Option A) ---
function runCO2OptimizationSweep(CP, params) {
    const { 
        h_in, s_in, t_gc_out, eff_isen,
        clearance, n_index,
        rpm, vol_disp, density_in, p_in
    } = params;

    const fluid = 'R744';
    const t_gc_out_k = t_gc_out + 273.15;
    const results = [];
    
    const p_start = 74e5;
    const p_end = 140e5;
    const step = 1e5;

    let bestCOP = -1;
    let bestP = 0;

    for (let p_curr = p_start; p_curr <= p_end; p_curr += step) {
        try {
            const h_out_is = CP.PropsSI('H', 'P', p_curr, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            
            const pr = p_curr / p_in;
            let eff_vol = 0.98 * (1.0 - clearance * (Math.pow(pr, 1.0/n_index) - 1.0));
            eff_vol = Math.max(0.1, Math.min(0.99, eff_vol));

            const v_flow_th = (rpm / 60.0) * (vol_disp / 1e6);
            const m_flow_calc = v_flow_th * eff_vol * density_in;

            const h_gc_out = CP.PropsSI('H', 'T', t_gc_out_k, 'P', p_curr, fluid);
            const q_evap = m_flow_calc * (h_in - h_gc_out) / 1000.0; 
            const power = w_real * m_flow_calc / 1000.0; 

            const cop = q_evap / power;

            results.push({ p: p_curr / 1e5, cop: cop });

            if (cop > bestCOP) {
                bestCOP = cop;
                bestP = p_curr / 1e5;
            }
        } catch (e) { }
    }

    return { data: results, bestP, bestCOP };
}

// --- Helper: Datasheet 生成器 ---
function generateDatasheetHTML(d, title) {
    try {
        const themeColor = (d.fluid && d.fluid.includes('R744')) ? "#ea580c" : (title.includes("GAS") ? "#0891b2" : "#059669");
        const isGas = title.includes("GAS");
        const isCO2Trans = d.fluid === 'R744' && d.cycle_type === 'Transcritical';
        
        let highSideRow = "";
        if (d.cycle_type === 'Subcritical') {
            highSideRow = `<tr><td style="padding:6px;">Condensing Temp</td><td style="text-align:right;">${d.t_cond.toFixed(2)} °C</td></tr>
            <tr><td style="padding:6px;">Subcooling</td><td style="text-align:right;">${d.sc.toFixed(1)} K</td></tr>
            <tr><td style="padding:6px;">Discharge Pressure</td><td style="text-align:right;">${d.p_out.toFixed(2)} bar</td></tr>`;
        } else if (d.cycle_type === 'Transcritical') {
            highSideRow = `<tr><td style="padding:6px;">Gas Cooler Press.</td><td style="text-align:right; font-weight:bold;">${d.p_out.toFixed(1)} bar</td></tr>
            <tr><td style="padding:6px;">Gas Cooler Exit T</td><td style="text-align:right;">${d.t_gc_out.toFixed(1)} °C</td></tr>`;
        } else {
            highSideRow = `<tr><td style="padding:6px;">Discharge Pressure</td><td style="text-align:right;">${d.p_out.toFixed(2)} bar</td></tr>
            <tr><td style="padding:6px;">Discharge Temp</td><td style="text-align:right;">${d.t_out.toFixed(2)} °C</td></tr>`;
        }

        let optInfo = "";
        if (isCO2Trans && d.opt_p_val) {
            const diff = Math.abs(d.p_out - d.opt_p_val);
            const color = diff > 2.0 ? "#dc2626" : "#16a34a"; 
            const msg = diff > 2.0 ? "Optimized P available" : "Operating at Optimal";
            
            optInfo = `
            <div style="margin-top:15px; padding:10px; background:#fff7ed; border:1px dashed #f97316; border-radius:4px;">
                <div style="font-size:12px; font-weight:bold; color:#ea580c; margin-bottom:5px;">💡 AI Optimization Suggestion</div>
                <div style="display:flex; justify-content:space-between; font-size:13px;">
                    <span>Optimal P: <b>${d.opt_p_val.toFixed(1)} bar</b></span>
                    <span style="color:${color}; font-weight:600;">${msg}</span>
                </div>
                <button id="btn-show-opt-curve" style="margin-top:8px; width:100%; padding:6px; background:#ea580c; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">📈 View Optimization Curve</button>
                <button id="btn-show-ph-chart" style="margin-top:4px; width:100%; padding:6px; background:#fff; color:#666; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:12px; display:none;">↩ Back to P-h Diagram</button>
            </div>`;
        }

        let stageInfo = "";
        if (d.stages && d.stages > 1) {
            stageInfo = `<div style="margin-top:5px; font-size:12px; color:#555;">Stages: <b>${d.stages}</b> | Intercooling: <b>${d.intercool ? "Yes" : "No"}</b></div>`;
        }

        // [New in v8.32] Real Gas Properties Table Block
        const realGasBlock = `
        <div style="margin-top:20px; border-top:1px dashed #ddd; padding-top:10px;">
            <div style="font-size:11px; font-weight:bold; color:#666; margin-bottom:5px; text-transform:uppercase;">Real Gas Properties (Suction)</div>
            <table style="width:100%; font-size:12px; color:#444;">
                <tr>
                    <td>Compressibility Z:</td><td style="text-align:right; font-family:monospace;">${d.z_in ? d.z_in.toFixed(4) : '-'}</td>
                    <td style="padding-left:15px;">Sound Speed:</td><td style="text-align:right; font-family:monospace;">${d.sound_speed_in ? d.sound_speed_in.toFixed(1) + ' m/s' : '-'}</td>
                </tr>
                <tr>
                    <td>Isentropic Exp. (k):</td><td style="text-align:right; font-family:monospace;">${d.gamma_in ? d.gamma_in.toFixed(3) : '-'}</td>
                    <td style="padding-left:15px;">Density:</td><td style="text-align:right; font-family:monospace;">${(d.m_flow/d.v_flow).toFixed(2)} kg/m³</td>
                </tr>
            </table>
        </div>`;

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
                    ${optInfo}
                </div>
                <div>
                    <div style="font-weight:bold; border-left:4px solid ${themeColor}; padding-left:10px; margin-bottom:10px; background:#f9fafb;">Performance Data</div>
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">Mass Flow</td><td style="text-align:right; font-weight:600;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
                        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">Vol Flow (Actual)</td><td style="text-align:right; font-weight:600;">${(d.v_flow * 3600).toFixed(1)} m³/h</td></tr>
                        ${d.cop_c ? `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0; color:#555;">COP (Cooling)</td><td style="text-align:right; font-weight:600;">${d.cop_c.toFixed(2)}</td></tr>` : ''}
                    </table>
                    ${realGasBlock}
                </div>
            </div>

            ${d.cooling_info ? `
            <div style="margin-top:20px; padding:15px; background:#fff1f2; border-left:4px solid ${isGas?'#0891b2':'#dc2626'}; border-radius:4px; font-size:13px;">
                <div style="font-weight:bold; color:#991b1b; margin-bottom:5px;">THERMAL MANAGEMENT (${d.cooling_info.type})</div>
                ${d.cooling_info.q_loss > 0 ? `<div>Heat Removed: <strong>${d.cooling_info.q_loss.toFixed(2)} kW</strong></div>` : ''}
                ${d.cooling_info.t_raw ? `<div>Raw Discharge T: ${d.cooling_info.t_raw.toFixed(1)} °C</div>` : ''}
            </div>` : ''}
            <div style="margin-top:40px; text-align:center; font-size:11px; color:#999; border-top:1px solid #eee; padding-top:10px;">Calculation of Compressor Efficiency Pro v8.32</div>
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

            // [New] Real Gas Properties
            const z_in = CP.PropsSI('Z', 'P', p_in, 'T', t_in_k, fluid);
            const sound_speed_in = CP.PropsSI('A', 'P', p_in, 'T', t_in_k, fluid);
            const gamma_in = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_in, 'T', t_in_k, fluid);

            let p_out, t_out_point3_k, h_point3;
            let report_vals = {};
            let optimizationResults = null;

            const eff_isen = parseFloat(fd.get('eff_isen_peak_m1_co2')); 
            const pr_des = parseFloat(fd.get('pr_design_m1_co2'));
            const clearance = parseFloat(fd.get('clearance_m1_co2'));
            const n_index = parseFloat(fd.get('poly_index_m1_co2'));
            const rpm = parseFloat(fd.get('rpm_m1_co2'));
            const vol_disp = parseFloat(fd.get('vol_disp_m1_co2'));

            if (cycleType === 'transcritical') {
                const p_high = parseFloat(fd.get('p_high_m1_co2')) * 1e5;
                const t_gc_out = parseFloat(fd.get('T_gc_out_m1_co2'));
                p_out = p_high;
                t_out_point3_k = t_gc_out + 273.15;
                h_point3 = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3_k, fluid);
                report_vals = { t_gc_out };

                // Optimization Scan
                optimizationResults = runCO2OptimizationSweep(CP, {
                    h_in, s_in, t_gc_out, eff_isen,
                    clearance, n_index,
                    rpm, vol_disp, density_in: d_in, p_in
                });

            } else {
                const t_cond = parseFloat(fd.get('T_cond_m1_co2'));
                const sc = parseFloat(fd.get('SC_m1_co2'));
                const t_cond_k = t_cond + 273.15;
                try {
                    p_out = CP.PropsSI('P', 'T', t_cond_k, 'Q', 0, fluid);
                } catch (e) { throw new Error(`Condensing Temp ${t_cond}°C too high for Subcritical`); }
                t_out_point3_k = t_cond_k - sc;
                h_point3 = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3_k, fluid);
                report_vals = { t_cond, sc };
            }

            const pr_act = p_out / p_in;
            let eff_vol = 0.98 * (1.0 - clearance * (Math.pow(pr_act, 1.0/n_index) - 1.0));
            eff_vol = Math.max(0.1, Math.min(0.99, eff_vol));
            
            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1_co2', d_in, eff_vol);

            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out_raw = h_in + w_real;
            const t_out_raw_k = CP.PropsSI('T', 'P', p_out, 'H', h_out_raw, fluid);
            const power_shaft = w_real * m_flow / 1000.0;

            const coolRadio = document.querySelector('input[name="cooling_mode_m1_co2"]:checked');
            const cool_mode = coolRadio ? coolRadio.value : 'adiabatic';
            let h_out_final = h_out_raw;
            let t_out_final_k = t_out_raw_k;
            let q_loss = 0, m_inj = 0; 

            const q_evap = (h_in - h_point3) * m_flow / 1000.0;
            const q_cond = (h_out_final - h_point3) * m_flow / 1000.0;

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                cycle_type: cycleType === 'transcritical' ? 'Transcritical' : 'Subcritical',
                p_in: p_in/1e5, t_in: t_in_k - 273.15,
                p_out: p_out/1e5, t_out: t_out_final_k - 273.15,
                pr: pr_act,
                ...report_vals,
                // [New] Store Real Gas Properties
                z_in, sound_speed_in, gamma_in,
                m_flow, v_flow: v_flow_in, power: power_shaft, q_evap, q_cond,
                cop_c: q_evap/power_shaft, cop_h: q_cond/power_shaft,
                eff_isen, eff_vol, eff_note: `AI-CO2 (${cycleType})`,
                cooling_info: { type: cool_mode, t_raw: t_out_raw_k - 273.15, q_loss, m_inj },
                opt_curve_data: optimizationResults ? optimizationResults.data : null,
                opt_p_val: optimizationResults ? optimizationResults.bestP : null,
                opt_cop_val: optimizationResults ? optimizationResults.bestCOP : null
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "CO2 REPORT");

            if (optimizationResults) {
                const btnOpt = document.getElementById('btn-show-opt-curve');
                const btnPh = document.getElementById('btn-show-ph-chart');
                if(btnOpt && btnPh) {
                    btnOpt.onclick = () => {
                        drawOptimizationCurve('chart-m1', optimizationResults.data, p_out/1e5);
                        btnOpt.style.display = 'none';
                        btnPh.style.display = 'block';
                    };
                    btnPh.onclick = () => {
                        drawPh();
                        btnPh.style.display = 'none';
                        btnOpt.style.display = 'block';
                    };
                }
            }

            if(chartDivM1) {
                chartDivM1.classList.remove('hidden');
                drawPh();
            }

            function drawPh() {
                const h_4 = h_point3; 
                const s_4 = CP.PropsSI('S', 'P', p_in, 'H', h_4, fluid);
                const s_3 = CP.PropsSI('S', 'P', p_out, 'H', h_point3, fluid);
                const tbl = document.querySelector('.state-table-container');
                if(tbl) tbl.style.display = 'block';
                
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
            const vol_eff = parseFloat(fd.get('vol_eff_m2'))/100;
            
            // [New] Real Gas Properties
            const z_in = CP.PropsSI('Z', 'P', p_in, 'T', t_in, fluid);
            const sound_speed_in = CP.PropsSI('A', 'P', p_in, 'T', t_in, fluid);
            const gamma_in = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_in, 'T', t_in, fluid);

            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in, fluid);
            
            let { m_flow, v_flow_in } = getFlowRate(fd, 'm2', d_in, vol_eff);
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in, fluid);
            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out_adiabatic = h_in + w_real;
            const t_out_adiabatic = CP.PropsSI('T','P', p_out, 'H', h_out_adiabatic, fluid);
            const power = w_real * m_flow / 1000.0;
            const coolRadio = document.querySelector('input[name="cooling_mode_m2"]:checked');
            const cooling_mode = coolRadio ? coolRadio.value : 'adiabatic';
            let t_out_final = t_out_adiabatic;
            let q_loss = 0;
            if (cooling_mode === 'target_t') {
                const t_target = parseFloat(fd.get('target_t_out_m2')) + 273.15;
                if(t_target < t_out_adiabatic) {
                    t_out_final = t_target;
                    const h_cooled = CP.PropsSI('H', 'P', p_out, 'T', t_target, fluid);
                    q_loss = m_flow * (h_out_adiabatic - h_cooled) / 1000.0;
                }
            }
            lastMode2Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in-273.15, p_out: p_out/1e5, t_out: t_out_final-273.15,
                // [New]
                z_in, sound_speed_in, gamma_in,
                m_flow, v_flow: v_flow_in, power, pr: p_out/p_in,
                eff_isen, eff_vol: vol_eff, eff_note: "Standard",
                cooling_info: { type: cooling_mode, t_raw: t_out_adiabatic - 273.15, q_loss }
            };
            resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT");
            if(chartDivM2) {
                chartDivM2.classList.remove('hidden');
                drawPhDiagram(CP, fluid, { points: [
                    { name: '1', desc: 'Suc', p: p_in, t: t_in, h: h_in, s: s_in },
                    { name: '2', desc: 'Dis', p: p_out, t: t_out_final, h: CP.PropsSI('H','P',p_out,'T',t_out_final,fluid), s: CP.PropsSI('S','P',p_out,'T',t_out_final,fluid) }
                ]}, 'chart-m2');
            }
        } catch(e) { resultsDivM2.textContent = "Error: " + e.message; } 
        finally {
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
            const p_in = CP.PropsSI('P','T', t_evap+273.15, 'Q', 1, fluid);
            const vol_eff = parseFloat(fd.get('vol_eff_m1'))/100;
            const t_in_k = t_evap + parseFloat(fd.get('SH_m1')) + 273.15;
            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in_k, fluid);
            
            // [New] Real Gas Properties
            const z_in = CP.PropsSI('Z', 'P', p_in, 'T', t_in_k, fluid);
            const sound_speed_in = CP.PropsSI('A', 'P', p_in, 'T', t_in_k, fluid);
            const gamma_in = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_in, 'T', t_in_k, fluid);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1', d_in, vol_eff);
            const t_cond = parseFloat(fd.get('T_cond_m1'));
            const sc = parseFloat(fd.get('SC_m1'));
            const eff_isen = parseFloat(fd.get('eff_isen_m1'))/100;
            const p_out = CP.PropsSI('P','T', t_cond+273.15, 'Q', 1, fluid);
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in_k, fluid);
            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out_k = CP.PropsSI('T','P', p_out, 'H', h_out, fluid);
            const t_liq_k = t_cond + 273.15 - sc;
            const h_liq = CP.PropsSI('H','P', p_out, 'T', t_liq_k, fluid);
            const q_evap = (h_in - h_liq) * m_flow / 1000.0; 
            const q_cond = (h_out - h_liq) * m_flow / 1000.0; 
            const power = w_real * m_flow / 1000.0;
            
            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in_k-273.15, p_out: p_out/1e5, t_out: t_out_k-273.15,
                t_cond, sc, m_flow, v_flow: v_flow_in, power, q_evap, q_cond, 
                // [New]
                z_in, sound_speed_in, gamma_in,
                cop_c: q_evap/power, cop_h: q_cond/power,
                eff_isen, eff_vol: vol_eff, eff_note: "Standard"
            };
            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "STANDARD HEAT PUMP REPORT");
            if(chartDivM1) {
                chartDivM1.classList.remove('hidden');
                const t_4 = CP.PropsSI('T', 'P', p_in, 'H', h_liq, fluid);
                drawPhDiagram(CP, fluid, { points: [
                    { name: '1', desc: 'Suc', p: p_in, t: t_in_k, h: h_in, s: s_in },
                    { name: '2', desc: 'Dis', p: p_out, t: t_out_k, h: h_out, s: CP.PropsSI('S','P',p_out,'H',h_out,fluid) },
                    { name: '3', desc: 'Liq', p: p_out, t: t_liq_k, h: h_liq, s: CP.PropsSI('S','P',p_out,'H',h_liq,fluid) },
                    { name: '4', desc: 'Exp', p: p_in, t: t_4, h: h_liq, s: CP.PropsSI('S','P',p_in,'H',h_liq,fluid) }
                ]}, 'chart-m1');
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
            if(!CP_INSTANCE) return;
            const btn = btnOptP;
            btn.textContent = "⏳...";
            setTimeout(() => {
                try {
                    const fd = new FormData(calcFormM1_CO2);
                    const t_evap = parseFloat(fd.get('T_evap_m1_co2'));
                    const sh = parseFloat(fd.get('SH_m1_co2'));
                    const t_gc_out = parseFloat(fd.get('T_gc_out_m1_co2'));
                    const p_in = CP.PropsSI('P', 'T', t_evap + 273.15, 'Q', 1, 'R744');
                    const t_in_k = t_evap + sh + 273.15;
                    const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, 'R744');
                    const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, 'R744');
                    const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, 'R744');

                    const res = runCO2OptimizationSweep(CP, {
                        h_in, s_in, t_gc_out,
                        eff_isen: parseFloat(fd.get('eff_isen_peak_m1_co2')),
                        clearance: parseFloat(fd.get('clearance_m1_co2')),
                        n_index: parseFloat(fd.get('poly_index_m1_co2')),
                        rpm: parseFloat(fd.get('rpm_m1_co2')),
                        vol_disp: parseFloat(fd.get('vol_disp_m1_co2')),
                        density_in: d_in, p_in
                    });
                    
                    document.getElementById('p_high_m1_co2').value = res.bestP.toFixed(1);
                } catch(e) {
                    console.error("Quick opt failed", e);
                    const t = parseFloat(document.getElementById('T_gc_out_m1_co2').value);
                    if (!isNaN(t)) document.getElementById('p_high_m1_co2').value = (2.75 * t - 6.5).toFixed(1);
                } finally {
                    btn.textContent = "⚡ 推荐 P_opt";
                }
            }, 10);
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