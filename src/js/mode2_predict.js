// =====================================================================
// mode2_predict.js: 模式一 (制冷/CO2) & 模式二 (气体)
// 版本: v8.51 (Fix: View Curve Button Interaction)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, drawOptimizationCurve, exportToExcel, formatValue, getDiffHtml, generatePrintPage } from './utils.js';

let CP_INSTANCE = null;

// State for Mode 1
let lastMode1Data = null;
let baselineMode1 = null;

// State for Mode 2
let lastMode2Data = null;
let baselineMode2 = null;

// DOM Elements
let calcButtonM1, resultsDivM1, calcFormM1, printButtonM1, exportButtonM1, chartDivM1;
let calcButtonM1_CO2, calcFormM1_CO2, btnOptP;
let calcButtonM2, resultsDivM2, calcFormM2, printButtonM2, exportButtonM2, chartDivM2;

// --- Helper: Robust Fluid State Calculation (SH=0 Guardkeeper) ---
function getFluidState(CP, fluid, p, t_sat, sh) {
    if (Math.abs(sh) < 0.001) {
        return {
            h: CP.PropsSI('H', 'P', p, 'Q', 1, fluid),
            s: CP.PropsSI('S', 'P', p, 'Q', 1, fluid),
            d: CP.PropsSI('D', 'P', p, 'Q', 1, fluid),
            t: t_sat,
            z: CP.PropsSI('Z', 'P', p, 'Q', 1, fluid),
            k: CP.PropsSI('isentropic_expansion_coefficient', 'P', p, 'Q', 1, fluid),
            a: CP.PropsSI('A', 'P', p, 'Q', 1, fluid)
        };
    } else {
        const t_val = t_sat + sh;
        return {
            h: CP.PropsSI('H', 'P', p, 'T', t_val, fluid),
            s: CP.PropsSI('S', 'P', p, 'T', t_val, fluid),
            d: CP.PropsSI('D', 'P', p, 'T', t_val, fluid),
            t: t_val,
            z: CP.PropsSI('Z', 'P', p, 'T', t_val, fluid),
            k: CP.PropsSI('isentropic_expansion_coefficient', 'P', p, 'T', t_val, fluid),
            a: CP.PropsSI('A', 'P', p, 'T', t_val, fluid)
        };
    }
}

// --- Helper: IHX Calculation ---
function calculateIHX(CP, fluid, p_low, h_1a, t_1a, p_high, h_3a, t_3a, effectiveness) {
    if (effectiveness <= 0) return null;

    try {
        const h_1b_max = CP.PropsSI('H', 'P', p_low, 'T', t_3a, fluid);
        const dh_max_cold_side = h_1b_max - h_1a;

        const h_3b_min = CP.PropsSI('H', 'P', p_high, 'T', t_1a, fluid);
        const dh_max_hot_side = h_3a - h_3b_min;

        const dh_max = Math.min(Math.max(0, dh_max_cold_side), Math.max(0, dh_max_hot_side));
        const dh_actual = dh_max * effectiveness;

        const h_1b = h_1a + dh_actual;
        const h_3b = h_3a - dh_actual;

        const t_1b = CP.PropsSI('T', 'P', p_low, 'H', h_1b, fluid);
        const t_3b = CP.PropsSI('T', 'P', p_high, 'H', h_3b, fluid);
        const s_1b = CP.PropsSI('S', 'P', p_low, 'H', h_1b, fluid);

        return {
            enabled: true,
            eff: effectiveness,
            h_1b, t_1b, s_1b,
            h_3b, t_3b,
            dh: dh_actual,
            q_ihx: 0,
            t_1b_display: t_1b - 273.15,
            t_3b_display: t_3b - 273.15
        };
    } catch (e) {
        console.warn("IHX Calc Failed:", e);
        return null;
    }
}

// --- Global Event Listeners ---
document.addEventListener('unit-change', () => {
    if (lastMode1Data) {
        const title = lastMode1Data.fluid.includes('R744') ? "CO2 REPORT" : "STANDARD HEAT PUMP REPORT";
        resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, title, baselineMode1);
    }
    if (lastMode2Data) {
        resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT", baselineMode2);
    }
});

document.addEventListener('pin-baseline', () => {
    if (lastMode1Data && document.getElementById('tab-content-1').style.display !== 'none') {
        baselineMode1 = { ...lastMode1Data };
        const title = lastMode1Data.fluid.includes('R744') ? "CO2 REPORT" : "STANDARD HEAT PUMP REPORT";
        resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, title, baselineMode1);
    }
    if (lastMode2Data && document.getElementById('tab-content-2').style.display !== 'none') {
        baselineMode2 = { ...lastMode2Data };
        resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT", baselineMode2);
    }
});

// --- Helper: Flow Calculation ---
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

// --- Helper: CO2 Opt Algo ---
function runCO2OptimizationSweep(CP, params) {
    const { h_in, s_in, t_gc_out, eff_isen, clearance, n_index, rpm, vol_disp, density_in, p_in } = params;
    const fluid = 'R744';
    const t_gc_out_k = t_gc_out + 273.15;
    const results = [];
    const p_start = 74e5, p_end = 140e5, step = 1e5;
    let bestCOP = -1, bestP = 0;

    if (isNaN(eff_isen) || isNaN(vol_disp)) return { data: [], bestP: 0, bestCOP: 0 };

    for (let p_curr = p_start; p_curr <= p_end; p_curr += step) {
        try {
            const h_out_is = CP.PropsSI('H', 'P', p_curr, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const pr = p_curr / p_in;
            let eff_vol = 0.98 * (1.0 - clearance * (Math.pow(pr, 1.0 / n_index) - 1.0));
            eff_vol = Math.max(0.1, Math.min(0.99, eff_vol));
            const v_flow_th = (rpm / 60.0) * (vol_disp / 1e6);
            const m_flow_calc = v_flow_th * eff_vol * density_in;
            const h_gc_out = CP.PropsSI('H', 'T', t_gc_out_k, 'P', p_curr, fluid);
            const q_evap = m_flow_calc * (h_in - h_gc_out) / 1000.0;
            const power = w_real * m_flow_calc / 1000.0;
            const cop = q_evap / power;
            results.push({ p: p_curr / 1e5, cop: cop });
            if (cop > bestCOP) { bestCOP = cop; bestP = p_curr / 1e5; }
        } catch (e) { }
    }
    return { data: results, bestP, bestCOP };
}

// --- Helper: Datasheet Generator ---
function generateDatasheetHTML(d, title, base = null) {
    try {
        const themeColor = (d.fluid && d.fluid.includes('R744')) ? "text-orange-600 border-orange-600" : (title.includes("GAS") ? "text-cyan-700 border-cyan-700" : "text-emerald-700 border-emerald-700");
        const themeBg = (d.fluid && d.fluid.includes('R744')) ? "bg-orange-50" : "bg-gray-50";
        const themeBorder = (d.fluid && d.fluid.includes('R744')) ? "border-orange-200" : "border-gray-200";
        const isGas = title.includes("GAS");
        const isCO2Trans = d.fluid === 'R744' && d.cycle_type === 'Transcritical';

        const rowCmp = (label, valSI, baseSI, type, inverse = false, suffix = '') => {
            let formatted = formatValue(valSI, type);
            if (suffix) formatted += `<span class="text-xs text-gray-400 ml-0.5">${suffix}</span>`;
            const diff = base ? getDiffHtml(valSI, baseSI, inverse) : '';
            return `
            <div class="flex justify-between items-start py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <span class="text-gray-500 text-sm font-medium mt-0.5">${label}</span>
                <div class="text-right">
                    <div class="font-mono font-bold text-gray-800">${formatted}</div>
                    ${diff}
                </div>
            </div>`;
        };

        let highSideContent = "";
        if (d.cycle_type === 'Subcritical') {
            highSideContent = rowCmp("Condensing Temp", d.t_cond, base?.t_cond, "temp") +
                rowCmp("Cond SC (Static)", d.static_sc, base?.static_sc, "delta_temp") +
                rowCmp("Discharge Press", d.p_out, base?.p_out, "pressure");
        } else if (d.cycle_type === 'Transcritical') {
            highSideContent = rowCmp("Gas Cooler Press", d.p_out, base?.p_out, "pressure") +
                rowCmp("Gas Cooler Exit", d.t_gc_out, base?.t_gc_out, "temp");
        } else {
            highSideContent = rowCmp("Discharge Press", d.p_out, base?.p_out, "pressure") +
                rowCmp("Pressure Ratio", d.pr, base?.pr, null);
        }

        let ihxBlock = "";
        if (d.ihx && d.ihx.enabled) {
            ihxBlock = `
            <div class="bg-indigo-50 rounded-lg p-3 border border-indigo-100 mb-6">
                <div class="text-xs font-bold text-indigo-700 uppercase mb-2 flex justify-between items-center">
                    <span>Internal Heat Exchanger</span>
                    <span class="bg-indigo-200 px-1.5 py-0.5 rounded text-[10px]">Eff: ${(d.ihx.eff * 100).toFixed(0)}%</span>
                </div>
                ${rowCmp("IHX Load", d.ihx.q_ihx, base?.ihx?.q_ihx, "power")}
                
                <div class="my-2 border-t border-indigo-200"></div>
                
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <div class="text-[10px] text-indigo-500 uppercase mb-1">Suction Side</div>
                        ${rowCmp("Comp Suction T", d.ihx.t_1b_display, base?.ihx?.t_1b_display, "temp")}
                        ${rowCmp("Total Suction SH", d.total_sh, base?.total_sh, "delta_temp")}
                    </div>
                    <div>
                        <div class="text-[10px] text-indigo-500 uppercase mb-1">Liquid Side</div>
                        ${rowCmp("Valve Inlet T", d.ihx.t_3b_display, base?.ihx?.t_3b_display, "temp")}
                        ${d.total_sc !== null ? rowCmp("Total Subcool", d.total_sc, base?.total_sc, "delta_temp") : ''}
                    </div>
                </div>
            </div>`;
        }

        let optInfo = "";
        if (isCO2Trans && d.opt_p_val) {
            const diff = Math.abs(d.p_out - d.opt_p_val);
            const colorClass = diff > 2.0 ? "text-red-600" : "text-green-600";
            const msg = diff > 2.0 ? "Optimized P available" : "Operating at Optimal";
            optInfo = `
            <div class="mt-6 p-4 bg-orange-50 border border-dashed border-orange-300 rounded-lg">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-orange-700 uppercase tracking-wider">💡 AI Optimization</span>
                    <span class="text-xs font-bold ${colorClass}">${msg}</span>
                </div>
                <div class="flex justify-between text-sm mb-4">
                    <span class="text-gray-600">Suggested Pressure:</span>
                    <span class="font-bold text-gray-900">${formatValue(d.opt_p_val, 'pressure')}</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button id="btn-show-opt-curve" class="py-2 px-3 bg-orange-600 text-white text-xs font-bold rounded shadow hover:bg-orange-700">📈 View Curve</button>
                    <button id="btn-show-ph-chart" class="hidden py-2 px-3 bg-white text-gray-600 border border-gray-300 text-xs font-bold rounded shadow hover:bg-gray-50">↩ Back to P-h</button>
                </div>
            </div>`;
        }

        let copBlock = "";
        if (!isGas) {
            copBlock = `
            <div class="grid grid-cols-2 gap-2 mb-4">
                <div class="p-3 bg-blue-50 rounded border border-blue-100 text-center">
                    <div class="text-[10px] text-blue-600 font-bold uppercase">COP (Cooling)</div>
                    <div class="text-xl font-bold text-blue-800">${d.cop_c ? d.cop_c.toFixed(2) : '-'}</div>
                    ${getDiffHtml(d.cop_c, base?.cop_c, false)}
                </div>
                <div class="p-3 bg-red-50 rounded border border-red-100 text-center">
                    <div class="text-[10px] text-red-600 font-bold uppercase">COP (Heating)</div>
                    <div class="text-xl font-bold text-red-800">${d.cop_h ? d.cop_h.toFixed(2) : '-'}</div>
                    ${getDiffHtml(d.cop_h, base?.cop_h, false)}
                </div>
            </div>`;
        }

        let extraParams = '';
        if (d.vcc) extraParams += rowCmp("VCC (Vol. Cap)", d.vcc, base?.vcc, 'vcc');
        if (d.heat_rejection_ratio) extraParams += rowCmp("Heat Rejection Ratio", d.heat_rejection_ratio, base?.heat_rejection_ratio, null);
        if (d.flash_gas) extraParams += rowCmp("Flash Gas Quality", d.flash_gas * 100, base?.flash_gas ? base.flash_gas * 100 : null, null, false, '%');

        const realGasBlock = `
        <div class="mt-6 pt-4 border-t border-dashed border-gray-300">
            <div class="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Real Gas Properties</div>
            <div class="grid grid-cols-1 gap-y-1">
                ${rowCmp("Compressibility Z (In)", d.z_in, base?.z_in, null)} 
                ${rowCmp("Isentropic Exp k (In)", d.gamma_in, base?.gamma_in, null)}
                ${rowCmp("Sound Speed (In)", d.sound_speed_in, base?.sound_speed_in, 'speed')}
                ${rowCmp("Density (In)", d.d_in, base?.d_in, 'density')}
                ${d.z_out ? rowCmp("Compressibility Z (Out)", d.z_out, base?.z_out, null) : ''}
            </div>
        </div>`;

        return `
        <div class="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100 font-sans text-gray-800 max-w-4xl mx-auto transition-all duration-300">
            <div class="border-b-2 ${themeColor} pb-4 mb-6 flex flex-col md:flex-row md:justify-between md:items-end">
                <div>
                    <h2 class="text-xl md:text-2xl font-bold ${themeColor.split(' ')[0]} leading-tight">${title}</h2>
                    <div class="mt-2 flex flex-wrap items-center gap-2">
                        <span class="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-700">${d.fluid}</span>
                        <span class="text-xs text-gray-400">${d.date}</span>
                        ${d.ihx && d.ihx.enabled ? '<span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">IHX Active</span>' : ''}
                    </div>
                </div>
                ${base ? '<div class="mt-2 md:mt-0 text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">Comparison Active</div>' : ''}
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                    <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Shaft Power</div>
                    <div class="text-2xl md:text-3xl font-extrabold ${themeColor.split(' ')[0]}">${formatValue(d.power, 'power')}</div>
                    ${getDiffHtml(d.power, base?.power, true)}
                </div>
                <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                    <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Discharge Temp</div>
                    <div class="text-2xl md:text-3xl font-extrabold ${themeColor.split(' ')[0]}">${formatValue(d.t_out, 'temp')}</div>
                    <div class="text-[10px] text-gray-400 mt-1">Superheat: ${d.sh_out ? d.sh_out.toFixed(1) : 0} K</div>
                </div>
                <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                    <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Mass Flow</div>
                    <div class="text-2xl md:text-3xl font-extrabold ${themeColor.split(' ')[0]}">${formatValue(d.m_flow * 3600, 'flow_mass')}</div>
                    ${getDiffHtml(d.m_flow, base?.m_flow, false)}
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 class="text-xs font-bold text-gray-900 border-l-4 ${themeColor.split(' ')[0]} pl-3 mb-4 uppercase tracking-wide">Operating Conditions</h3>
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        ${rowCmp("Suction Press", d.p_in, base?.p_in, "pressure")}
                        ${rowCmp("Evap Temp (Sat)", d.t_sat_evap, base?.t_sat_evap, "temp")}
                        ${rowCmp("Evap SH (Static)", d.static_sh, base?.static_sh, "delta_temp")}
                        ${highSideContent}
                    </div>
                    ${copBlock}
                    ${ihxBlock}
                    ${optInfo}
                </div>

                <div>
                    <h3 class="text-xs font-bold text-gray-900 border-l-4 ${themeColor.split(' ')[0]} pl-3 mb-4 uppercase tracking-wide">Performance</h3>
                    <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        ${rowCmp("Vol Flow (Act)", d.v_flow * 3600, base?.v_flow ? base.v_flow * 3600 : null, "flow_vol")}
                        ${d.q_evap ? rowCmp("Cooling Capacity", d.q_evap, base?.q_evap, "power") : ''}
                        ${d.q_cond ? rowCmp("Heating Capacity", d.q_cond, base?.q_cond, "power") : ''}
                        ${extraParams}
                    </div>
                    ${realGasBlock}
                </div>
            </div>

<div class="mt-8 pt-4 border-t border-gray-100 text-center">
                <div class="flex flex-col items-center justify-center space-y-1">
                    <p class="text-xs font-bold text-gray-600">
                        <span class="opacity-75">Created by:</span> 荆炎荣 (Jing Yanrong)
                    </p>
                    <p class="text-[10px] text-gray-400 max-w-lg leading-tight">
                        免责声明：本计算结果基于理论模型，仅供方案参考，不作为最终设备选型依据。<br>
                        Disclaimer: Simulation results are for reference only. Please verify with official manufacturer data.
                    </p>
                    <p class="text-[10px] text-gray-300 mt-1 font-mono">Calculation of Compressor Efficiency Pro v8.52</p>
                </div>
            </div>
        </div>`; // 结束 return 字符串
    } catch (e) {
        return `<div class="p-4 bg-red-50 text-red-600 rounded border border-red-200 text-center">Error: ${e.message}</div>`;
    }
}

// --- Calculation: Mode 1 (CO2) ---
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

            const state1a = getFluidState(CP, fluid, p_in, t_evap + 273.15, sh);

            let p_out, t_out_point3a_k, h_point3a;
            let report_vals = {};
            let t_gc_out = null, t_cond = null, sc = null, total_sc = null;

            const getVal = (name, def) => { const el = document.querySelector(`[name="${name}"]`); return el ? (parseFloat(el.value) || def) : def; };
            const eff_isen_peak = getVal('eff_isen_peak_m1_co2', 0.7);
            const clearance = getVal('clearance_m1_co2', 0.05);
            const n_index = getVal('poly_index_m1_co2', 1.3);
            const rpm = getVal('rpm_m1_co2', 4500);
            const vol_disp = getVal('vol_disp_m1_co2', 15);

            let optimizationResults = null;

            if (cycleType === 'transcritical') {
                const p_high = parseFloat(fd.get('p_high_m1_co2')) * 1e5;
                if (!p_high || p_high < 30e5) throw new Error("High Side Pressure too low.");

                t_gc_out = parseFloat(fd.get('T_gc_out_m1_co2'));
                p_out = p_high;
                t_out_point3a_k = t_gc_out + 273.15;
                h_point3a = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3a_k, fluid);
                report_vals = { t_gc_out };

                optimizationResults = runCO2OptimizationSweep(CP, {
                    h_in: state1a.h, s_in: state1a.s, t_gc_out, eff_isen: eff_isen_peak,
                    clearance, n_index,
                    rpm, vol_disp, density_in: state1a.d, p_in
                });

            } else {
                t_cond = parseFloat(fd.get('T_cond_m1_co2'));
                sc = parseFloat(fd.get('SC_m1_co2'));
                const t_cond_k = t_cond + 273.15;
                try {
                    p_out = CP.PropsSI('P', 'T', t_cond_k, 'Q', 0, fluid);
                } catch (e) { throw new Error(`Condensing Temp ${t_cond}°C too high for Subcritical`); }
                t_out_point3a_k = t_cond_k - sc;
                h_point3a = CP.PropsSI('H', 'P', p_out, 'T', t_out_point3a_k, fluid);
                report_vals = { t_cond, static_sc: sc };
                total_sc = sc;
            }

            const pr = p_out / p_in;

            // Efficiency
            const eff_model = document.querySelector('input[name="eff_model_m1_co2"]:checked')?.value || 'fixed';
            let eff_isen = 0.7, eff_vol = 0.85;

            if (eff_model === 'fixed') {
                eff_isen = parseFloat(fd.get('eff_isen_m1_co2')) / 100.0;
                eff_vol = parseFloat(fd.get('vol_eff_m1_co2')) / 100.0;
            } else {
                eff_isen = eff_isen_peak;
                eff_vol = 0.98 * (1.0 - clearance * (Math.pow(pr, 1.0 / n_index) - 1.0));
                eff_vol = Math.max(0.1, Math.min(0.99, eff_vol));
            }

            // IHX
            let compInlet = { h: state1a.h, s: state1a.s, t: state1a.t };
            let valveInlet = { h: h_point3a, t: t_out_point3a_k };
            const ihxEl = document.getElementById('enable_ihx_m1_co2');
            const enable_ihx = ihxEl ? ihxEl.checked : false;
            let ihxResult = null;
            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1_co2', state1a.d, eff_vol);

            if (enable_ihx) {
                const ihxVal = document.querySelector('input[name="ihx_eff_m1_co2"]');
                const ihx_eff = ihxVal ? (parseFloat(ihxVal.value) / 100.0) : 0.6;
                ihxResult = calculateIHX(CP, fluid, p_in, state1a.h, state1a.t, p_out, h_point3a, t_out_point3a_k, ihx_eff);

                if (ihxResult && ihxResult.enabled) {
                    compInlet.h = ihxResult.h_1b; compInlet.t = ihxResult.t_1b; compInlet.s = ihxResult.s_1b;
                    valveInlet.h = ihxResult.h_3b; valveInlet.t = ihxResult.t_3b;
                    const d_1b = CP.PropsSI('D', 'P', p_in, 'H', compInlet.h, fluid);
                    const flowRes = getFlowRate(fd, 'm1_co2', d_1b, eff_vol);
                    m_flow = flowRes.m_flow; v_flow_in = flowRes.v_flow_in;
                    ihxResult.q_ihx = ihxResult.dh * m_flow / 1000.0;

                    if (cycleType === 'subcritical') {
                        const t_sat_cond = CP.PropsSI('T', 'P', p_out, 'Q', 0, fluid);
                        total_sc = t_sat_cond - valveInlet.t;
                    }
                }
            }

            // Compression
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', compInlet.s, fluid);
            const w_real = (h_out_is - compInlet.h) / eff_isen;
            const h_out = compInlet.h + w_real;
            const t_out_k = CP.PropsSI('T', 'P', p_out, 'H', h_out, fluid);

            const power = w_real * m_flow / 1000.0;
            const q_evap = (state1a.h - valveInlet.h) * m_flow / 1000.0;
            const q_cond = (h_out - h_point3a) * m_flow / 1000.0;
            const flash_gas = CP.PropsSI('Q', 'P', p_in, 'H', valveInlet.h, fluid);
            const vcc = (state1a.h - valveInlet.h) * state1a.d; // 原始计算 (J/m³)

            const t_sat_out_k = cycleType === 'subcritical' ? CP.PropsSI('T', 'P', p_out, 'Q', 1, fluid) : 0;
            const sh_out = cycleType === 'subcritical' ? (t_out_k - t_sat_out_k) : 0;

            const z_out = CP.PropsSI('Z', 'P', p_out, 'H', h_out, fluid);
            const gamma_out = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_out, 'H', h_out, fluid);

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                cycle_type: cycleType === 'transcritical' ? 'Transcritical' : 'Subcritical',
                p_in: p_in / 1e5, t_in: state1a.t - 273.15,
                p_out: p_out / 1e5, t_out: t_out_k - 273.15, sh_out,
                pr: pr, ...report_vals,
                t_sat_evap: t_evap,
                static_sh: sh,
                total_sh: compInlet.t - (t_evap + 273.15),
                total_sc: total_sc,
                z_in: state1a.z, gamma_in: state1a.k, d_in: state1a.d, sound_speed_in: state1a.a,
                z_out, gamma_out,
                m_flow, v_flow: v_flow_in, power,
                q_evap, q_cond,
                cop_c: q_evap / power, cop_h: q_cond / power,
                heat_rejection_ratio: q_cond / q_evap,
                vcc: vcc / 1000.0, // <--- 【修复】: 除以 1000 转换为 kJ/m³
                flash_gas,
                eff_isen, eff_vol: eff_vol, eff_note: `AI-CO2 (${cycleType})`,
                ihx: ihxResult,
                opt_curve_data: optimizationResults ? optimizationResults.data : null,
                opt_p_val: optimizationResults ? optimizationResults.bestP : null
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "CO2 REPORT", baselineMode1);

            if (optimizationResults && optimizationResults.bestP > 0) {
                const btnOpt = document.getElementById('btn-show-opt-curve');
                const btnPh = document.getElementById('btn-show-ph-chart');
                if (btnOpt && btnPh) {
                    btnOpt.onclick = () => {
                        console.log("Opt Curve Clicked"); // Debug
                        drawOptimizationCurve('chart-m1', optimizationResults.data, p_out / 1e5);
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

            if (chartDivM1) { chartDivM1.classList.remove('hidden'); drawPh(); }

            function drawPh() {
                const h_4 = h_point3a;
                let points = [];
                if (ihxResult && ihxResult.enabled) {
                    points = [
                        { name: '1a', desc: 'EvapOut', p: p_in, t: state1a.t, h: state1a.h, s: state1a.s },
                        { name: '1b', desc: 'CmpIn', p: p_in, t: compInlet.t, h: compInlet.h, s: compInlet.s },
                        { name: '2', desc: 'Dis', p: p_out, t: t_out_k, h: h_out, s: CP.PropsSI('S', 'P', p_out, 'H', h_out, fluid) },
                        { name: '3a', desc: 'GCOut', p: p_out, t: t_out_point3a_k, h: h_point3a, s: CP.PropsSI('S', 'P', p_out, 'H', h_point3a, fluid) },
                        { name: '3b', desc: 'VlvIn', p: p_out, t: valveInlet.t, h: valveInlet.h, s: CP.PropsSI('S', 'P', p_out, 'H', valveInlet.h, fluid) },
                        { name: '4', desc: 'Exp', p: p_in, t: CP.PropsSI('T', 'P', p_in, 'H', valveInlet.h, fluid), h: valveInlet.h, s: CP.PropsSI('S', 'P', p_in, 'H', valveInlet.h, fluid) }
                    ];
                } else {
                    points = [
                        { name: '1', desc: 'Suc', p: p_in, t: state1a.t, h: state1a.h, s: state1a.s },
                        { name: '2', desc: 'Dis', p: p_out, t: t_out_k, h: h_out, s: CP.PropsSI('S', 'P', p_out, 'H', h_out, fluid) },
                        { name: '3', desc: 'Out', p: p_out, t: t_out_point3a_k, h: h_point3a, s: CP.PropsSI('S', 'P', p_out, 'H', h_point3a, fluid) },
                        { name: '4', desc: 'Exp', p: p_in, t: CP.PropsSI('T', 'P', p_in, 'H', h_point3a, fluid), h: h_point3a, s: CP.PropsSI('S', 'P', p_in, 'H', h_point3a, fluid) }
                    ];
                }
                drawPhDiagram(CP, fluid, { points }, 'chart-m1');
            }

            if (chartDivM1) { chartDivM1.classList.remove('hidden'); drawPh(); }

            // 【新增修复】: 解锁打印和导出按钮
            if (printButtonM1) printButtonM1.disabled = false;
            if (exportButtonM1) exportButtonM1.disabled = false;

        } catch (e) {
            resultsDivM1.innerHTML = `<div class="p-4 text-red-600">Error: ${e.message}</div>`;
        }
        finally {
            calcButtonM1_CO2.disabled = false;
            calcButtonM1_CO2.textContent = "🔥 计算 CO2 (R744) 循环";
        }
    }, 50);
}

// --- Calculation: Mode 1 (Standard) ---
async function calculateMode1(CP) {
    if (!CP) return;
    calcButtonM1.disabled = true; calcButtonM1.textContent = "Calculating...";
    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1);
            let fluid = fd.get('fluid_m1') || document.getElementById('fluid_m1')?.value || 'R134a';

            const t_evap = parseFloat(fd.get('T_evap_m1'));
            const sh = parseFloat(fd.get('SH_m1'));
            const p_in = CP.PropsSI('P', 'T', t_evap + 273.15, 'Q', 1, fluid);
            const vol_eff = parseFloat(fd.get('vol_eff_m1')) / 100;

            // [FIX] Naming state1a
            const state1a = getFluidState(CP, fluid, p_in, t_evap + 273.15, sh);

            const t_cond = parseFloat(fd.get('T_cond_m1'));
            const sc = parseFloat(fd.get('SC_m1'));
            const eff_isen = parseFloat(fd.get('eff_isen_m1')) / 100;
            const p_out = CP.PropsSI('P', 'T', t_cond + 273.15, 'Q', 1, fluid);

            const t_liq_k = t_cond + 273.15 - sc;
            const h_point3a = CP.PropsSI('H', 'P', p_out, 'T', t_liq_k, fluid);

            // IHX Calculation
            let compInlet = { h: state1a.h, s: state1a.s, t: state1a.t };
            let valveInlet = { h: h_point3a, t: t_liq_k };
            // [FIX] Safe DOM access for PWA cache
            const ihxEl = document.getElementById('enable_ihx_m1');
            const enable_ihx = ihxEl ? ihxEl.checked : false;
            let ihxResult = null;
            let total_sc = sc;

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1', state1a.d, vol_eff);

            if (enable_ihx) {
                const ihxVal = document.querySelector('input[name="ihx_eff_m1"]');
                const ihx_eff = ihxVal ? (parseFloat(ihxVal.value) / 100.0) : 0.6;
                ihxResult = calculateIHX(CP, fluid, p_in, state1a.h, state1a.t, p_out, h_point3a, t_liq_k, ihx_eff);

                if (ihxResult && ihxResult.enabled) {
                    compInlet.h = ihxResult.h_1b; compInlet.t = ihxResult.t_1b; compInlet.s = ihxResult.s_1b;
                    valveInlet.h = ihxResult.h_3b; valveInlet.t = ihxResult.t_3b;
                    const d_1b = CP.PropsSI('D', 'P', p_in, 'H', compInlet.h, fluid);
                    const flowRes = getFlowRate(fd, 'm1', d_1b, vol_eff);
                    m_flow = flowRes.m_flow; v_flow_in = flowRes.v_flow_in;
                    ihxResult.q_ihx = ihxResult.dh * m_flow / 1000.0;

                    const t_sat_cond = CP.PropsSI('T', 'P', p_out, 'Q', 0, fluid);
                    total_sc = t_sat_cond - valveInlet.t;
                }
            }

            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', compInlet.s, fluid);
            const w_real = (h_out_is - compInlet.h) / eff_isen;
            const h_out = compInlet.h + w_real;
            const t_out_k = CP.PropsSI('T', 'P', p_out, 'H', h_out, fluid);

            const q_evap = (state1a.h - valveInlet.h) * m_flow / 1000.0;
            const q_cond = (h_out - h_point3a) * m_flow / 1000.0;
            const power = w_real * m_flow / 1000.0;

            const t_sat_out_k = CP.PropsSI('T', 'P', p_out, 'Q', 1, fluid);
            const sh_out = t_out_k - t_sat_out_k;

            const vcc = (state1a.h - valveInlet.h) * state1a.d; // 原始计算 (J/m³)
            const flash_gas = CP.PropsSI('Q', 'P', p_in, 'H', valveInlet.h, fluid);

            const z_out = CP.PropsSI('Z', 'P', p_out, 'H', h_out, fluid);
            const gamma_out = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_out, 'H', h_out, fluid);

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in / 1e5, t_in: state1a.t - 273.15, p_out: p_out / 1e5, t_out: t_out_k - 273.15,
                sh_out,
                t_cond,
                static_sc: sc,
                total_sc: total_sc,
                t_sat_evap: t_evap,
                static_sh: sh,
                total_sh: compInlet.t - (t_evap + 273.15),
                m_flow, v_flow: v_flow_in, power, q_evap, q_cond,
                cop_c: q_evap / power, cop_h: q_cond / power,
                heat_rejection_ratio: q_cond / q_evap,
                vcc: vcc / 1000.0, // <--- 【修复】: 除以 1000 转换为 kJ/m³
                flash_gas,
                eff_isen, eff_vol: vol_eff, eff_note: "Standard",
                z_in: state1a.z, gamma_in: state1a.k, d_in: state1a.d, sound_speed_in: state1a.a,
                z_out, gamma_out, pr: p_out / p_in,
                ihx: ihxResult
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "STANDARD HEAT PUMP REPORT", baselineMode1);

            let points = [];
            if (ihxResult && ihxResult.enabled) {
                points = [
                    { name: '1a', desc: 'EvapOut', p: p_in, t: state1a.t, h: state1a.h, s: state1a.s },
                    { name: '1b', desc: 'CmpIn', p: p_in, t: compInlet.t, h: compInlet.h, s: compInlet.s },
                    { name: '2', desc: 'Dis', p: p_out, t: t_out_k, h: h_out, s: CP.PropsSI('S', 'P', p_out, 'H', h_out, fluid) },
                    { name: '3a', desc: 'Liq', p: p_out, t: t_liq_k, h: h_point3a, s: CP.PropsSI('S', 'P', p_out, 'H', h_point3a, fluid) },
                    { name: '3b', desc: 'VlvIn', p: p_out, t: valveInlet.t, h: valveInlet.h, s: CP.PropsSI('S', 'P', p_out, 'H', valveInlet.h, fluid) },
                    { name: '4', desc: 'Exp', p: p_in, t: CP.PropsSI('T', 'P', p_in, 'H', valveInlet.h, fluid), h: valveInlet.h, s: CP.PropsSI('S', 'P', p_in, 'H', valveInlet.h, fluid) }
                ];
            } else {
                points = [
                    { name: '1', desc: 'Suc', p: p_in, t: state1a.t, h: state1a.h, s: state1a.s },
                    { name: '2', desc: 'Dis', p: p_out, t: t_out_k, h: h_out, s: CP.PropsSI('S', 'P', p_out, 'H', h_out, fluid) },
                    { name: '3', desc: 'Liq', p: p_out, t: t_liq_k, h: h_point3a, s: CP.PropsSI('S', 'P', p_out, 'H', h_point3a, fluid) },
                    { name: '4', desc: 'Exp', p: p_in, t: CP.PropsSI('T', 'P', p_in, 'H', h_point3a, fluid), h: h_point3a, s: CP.PropsSI('S', 'P', p_in, 'H', h_point3a, fluid) }
                ];
            }
            if (chartDivM1) { chartDivM1.classList.remove('hidden'); drawPhDiagram(CP, fluid, { points }, 'chart-m1'); }

            // 【新增修复】: 解锁打印和导出按钮
            if (printButtonM1) printButtonM1.disabled = false;
            if (exportButtonM1) exportButtonM1.disabled = false;

        } catch (e) {
            resultsDivM1.innerHTML = `<div class="text-red-500">Error: ${e.message}</div>`;
        }
        finally {
            calcButtonM1.disabled = false;
            calcButtonM1.textContent = "计算常规热泵";
        }
    }, 10);
}

// --- Calculation: Mode 2 (Gas) ---
async function calculateMode2(CP) {
    if (!CP) return;
    calcButtonM2.disabled = true; calcButtonM2.textContent = "Calculating...";
    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM2);
            let fluid = fd.get('fluid_m2');
            if (!fluid) {
                const el = document.getElementById('fluid_m2');
                fluid = el ? el.value : 'Air';
            }
            if (!fluid) fluid = 'Air';

            const p_in = parseFloat(fd.get('p_in_m2')) * 1e5;
            const t_in = parseFloat(fd.get('T_in_m2')) + 273.15;
            const p_out = parseFloat(fd.get('p_out_m2')) * 1e5;
            const eff_isen = parseFloat(fd.get('eff_isen_m2')) / 100;
            const vol_eff = parseFloat(fd.get('vol_eff_m2')) / 100;

            const z_in = CP.PropsSI('Z', 'P', p_in, 'T', t_in, fluid);
            const gamma_in = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_in, 'T', t_in, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in, fluid);
            const a_in = CP.PropsSI('A', 'P', p_in, 'T', t_in, fluid);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm2', d_in, vol_eff);
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in, fluid);
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out_adiabatic = h_in + w_real;
            const t_out_adiabatic = CP.PropsSI('T', 'P', p_out, 'H', h_out_adiabatic, fluid);
            const power = w_real * m_flow / 1000.0;

            const z_out = CP.PropsSI('Z', 'P', p_out, 'T', t_out_adiabatic, fluid);
            const gamma_out = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_out, 'T', t_out_adiabatic, fluid);

            const coolRadio = document.querySelector('input[name="cooling_mode_m2"]:checked');
            const cooling_mode = coolRadio ? coolRadio.value : 'adiabatic';
            let t_out_final = t_out_adiabatic;
            let q_loss = 0;
            if (cooling_mode === 'target_t') {
                const t_target = parseFloat(fd.get('target_t_out_m2')) + 273.15;
                if (t_target < t_out_adiabatic) {
                    t_out_final = t_target;
                    const h_cooled = CP.PropsSI('H', 'P', p_out, 'T', t_target, fluid);
                    q_loss = m_flow * (h_out_adiabatic - h_cooled) / 1000.0;
                }
            }
            lastMode2Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in / 1e5, t_in: t_in - 273.15, p_out: p_out / 1e5, t_out: t_out_final - 273.15, sh_out: 0,
                z_in, gamma_in, d_in, sound_speed_in: a_in, z_out, gamma_out,
                m_flow, v_flow: v_flow_in, power, pr: p_out / p_in,
                eff_isen, eff_vol: vol_eff,
                eff_note: "Standard",
                cooling_info: { type: cooling_mode, t_raw: t_out_adiabatic - 273.15, q_loss }
            };

            resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT", baselineMode2);
            if (chartDivM2) {
                chartDivM2.classList.remove('hidden');
                drawPhDiagram(CP, fluid, {
                    points: [
                        { name: '1', desc: 'Suc', p: p_in, t: t_in, h: h_in, s: s_in },
                        { name: '2', desc: 'Dis', p: p_out, t: t_out_final, h: CP.PropsSI('H', 'P', p_out, 'T', t_out_final, fluid), s: CP.PropsSI('S', 'P', p_out, 'T', t_out_final, fluid) }
                    ]
                }, 'chart-m2');
            }

        } catch (e) { resultsDivM2.textContent = "Error: " + e.message; }
        finally {
            calcButtonM2.disabled = false; calcButtonM2.textContent = "计算气体压缩";
            if (printButtonM2) printButtonM2.disabled = false;
            if (exportButtonM2) exportButtonM2.disabled = false;
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

    const fluidSelectM1 = document.getElementById('fluid_m1');
    if (fluidSelectM1) {
        fluidSelectM1.addEventListener('change', () => updateFluidInfo(fluidSelectM1, document.getElementById('fluid-info-m1'), CP));
    }

    if (printButtonM1) printButtonM1.onclick = () => {
        if (lastMode1Data) {
            // 使用新的打印生成器，传入 HTML 内容和图表 ID ('chart-m1')
            const title = lastMode1Data.fluid.includes('R744') ? "CO2 REPORT" : "HEAT PUMP REPORT";
            const content = generateDatasheetHTML(lastMode1Data, title, baselineMode1);
            generatePrintPage(content, 'chart-m1');
        } else alert("Please Calculate First");
    };
    if (exportButtonM1) exportButtonM1.onclick = () => { if (lastMode1Data) exportToExcel(lastMode1Data, "Mode1_Result"); };

    if (printButtonM2) printButtonM2.onclick = () => {
        if (lastMode2Data) {
            // 使用新的打印生成器，传入 HTML 内容和图表 ID ('chart-m2')
            const content = generateDatasheetHTML(lastMode2Data, "GAS REPORT", baselineMode2);
            generatePrintPage(content, 'chart-m2');
        } else alert("Please Calculate First");
    };
    if (exportButtonM2) exportButtonM2.onclick = () => { if (lastMode2Data) exportToExcel(lastMode2Data, "Mode2_Gas_Result"); };

    if (calcFormM1) calcFormM1.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1(CP); });

    if (calcFormM1_CO2) {
        calcFormM1_CO2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1_CO2(CP); });

        if (btnOptP) btnOptP.addEventListener('click', () => {
            if (!CP_INSTANCE) return;
            const btn = btnOptP;
            btn.textContent = "⏳...";
            setTimeout(() => {
                try {
                    const fd = new FormData(calcFormM1_CO2);
                    const t_evap = parseFloat(fd.get('T_evap_m1_co2'));
                    const sh = parseFloat(fd.get('SH_m1_co2'));
                    const t_gc_out = parseFloat(fd.get('T_gc_out_m1_co2'));
                    const p_in = CP.PropsSI('P', 'T', t_evap + 273.15, 'Q', 1, 'R744');
                    // [FIX] SH Guard
                    const stateIn = getFluidState(CP, 'R744', p_in, t_evap + 273.15, sh);

                    // DOM Helper
                    const getVal = (id, def) => { const el = document.getElementById(id); return el ? (parseFloat(el.value) || def) : def; };

                    const res = runCO2OptimizationSweep(CP, {
                        h_in: stateIn.h, s_in: stateIn.s, t_gc_out,
                        eff_isen: getVal('eff_isen_peak_m1_co2', 0.7),
                        clearance: getVal('clearance_m1_co2', 0.05),
                        n_index: getVal('poly_index_m1_co2', 1.3),
                        rpm: getVal('rpm_m1_co2', 4500),
                        vol_disp: getVal('vol_disp_m1_co2', 15),
                        density_in: stateIn.d, p_in
                    });

                    if (res && res.bestP > 30) document.getElementById('p_high_m1_co2').value = res.bestP.toFixed(1);
                } catch (e) {
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
            if (rpmDiv) rpmDiv.style.display = (val === 'rpm') ? 'grid' : 'none';
            if (massDiv) massDiv.style.display = (val === 'mass') ? 'block' : 'none';
            if (volDiv) volDiv.style.display = (val === 'vol') ? 'block' : 'none';
        }));
    }

    if (calcFormM2) {
        calcFormM2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode2(CP); });
        const fluidSelectM2 = document.getElementById('fluid_m2');
        if (fluidSelectM2) fluidSelectM2.addEventListener('change', () => updateFluidInfo(fluidSelectM2, document.getElementById('fluid-info-m2'), CP));
    }
}