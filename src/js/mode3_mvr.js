// =====================================================================
// mode3_mvr.js: 模式四 (MVR 容积式 - 罗茨/螺杆)
// 版本: v8.35 (Feature: Unit Conversion & Baseline Comparison)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, exportToExcel, formatValue, getDiffHtml } from './utils.js';

let calcButtonM4, resultsDivM4, calcFormM4, printButtonM4, exportButtonM4, chartDivM4, fluidSelectM4;
let lastMode4Data = null;
let baselineMode4 = null; // Baseline data for comparison

// --- Global Event Listeners (New in v8.35) ---
document.addEventListener('unit-change', () => {
    if (lastMode4Data) {
        resultsDivM4.innerHTML = generateMVRDatasheet(lastMode4Data, baselineMode4);
    }
});

document.addEventListener('pin-baseline', () => {
    if (lastMode4Data && document.getElementById('tab-content-4').style.display !== 'none') {
        baselineMode4 = { ...lastMode4Data };
        resultsDivM4.innerHTML = generateMVRDatasheet(lastMode4Data, baselineMode4);
    }
});

// --- Helper: MVR Datasheet Generator (v8.35) ---
function generateMVRDatasheet(d, base = null) {
    const themeColor = "text-purple-700 border-purple-600";
    const themeBg = "bg-purple-50";
    const themeBorder = "border-purple-100";

    // Helper Row with Comparison
const rowCmp = (label, valSI, baseSI, type, inverse = false, suffix = '') => {
        let formatted = formatValue(valSI, type);
        if (suffix) formatted += `<span class="text-xs text-gray-400 ml-0.5">${suffix}</span>`; // 新增

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

    let injHtml = `<span class="text-gray-400 text-xs">Disabled</span>`;
    if (d.is_desuperheat && d.m_water > 0) {
        // Injection Water Flow
        const val = d.m_water * 3600;
        const baseVal = base?.m_water ? base.m_water * 3600 : null;
        const fmt = formatValue(val, 'flow_mass');
        const diff = base ? getDiffHtml(val, baseVal, false) : '';
        injHtml = `<div class="flex flex-col items-center"><span class="text-purple-600 font-bold">${fmt}</span>${diff}</div>`;
    }

    return `
    <div class="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100 font-sans text-gray-800 max-w-4xl mx-auto transition-all duration-300">
        <div class="border-b-2 border-purple-600 pb-4 mb-6 flex flex-col md:flex-row md:justify-between md:items-end">
            <div>
                <h2 class="text-xl md:text-2xl font-bold text-purple-800 leading-tight">MVR DATASHEET</h2>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-bold">Volumetric</span>
                    <span class="text-xs text-gray-400">${d.date}</span>
                </div>
            </div>
            ${base ? '<div class="mt-2 md:mt-0 text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">Comparison Active</div>' : ''}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Evaporation</div>
                <div class="text-2xl md:text-3xl font-extrabold text-purple-800">${formatValue(d.m_flow * 3600, 'flow_mass')}</div>
                ${getDiffHtml(d.m_flow, base?.m_flow, false)}
            </div>
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Shaft Power</div>
                <div class="text-2xl md:text-3xl font-extrabold text-purple-800">${formatValue(d.power, 'power')}</div>
                ${getDiffHtml(d.power, base?.power, true)}
            </div>
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm flex flex-col justify-center items-center">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Injection Water</div>
                ${injHtml}
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-purple-600 pl-3 mb-4 uppercase tracking-wide">Process Parameters</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-6">
                    ${rowCmp("Suction Pressure", d.p_in, base?.p_in, "pressure")}
                    ${rowCmp("Saturation Temp", d.t_sat_in, base?.t_sat_in, "temp")}
                    ${rowCmp("Suction Superheat", d.sh_in, base?.sh_in, "delta_temp")}
                    ${rowCmp("Discharge Pressure", d.p_out, base?.p_out, "pressure")}
                    ${rowCmp("Sat. Temp Rise", d.dt, base?.dt, "delta_temp")}
                </div>

                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-purple-600 pl-3 mb-4 uppercase tracking-wide">Efficiency</h3>
<div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    ${rowCmp("Isentropic Eff.", d.eff_is * 100, base?.eff_is ? base.eff_is * 100 : null, null, false, '%')}
                    ${rowCmp("Volumetric Eff.", d.eff_vol * 100, base?.eff_vol ? base.eff_vol * 100 : null, null, false, '%')}
                </div>
            </div>
            
            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-purple-600 pl-3 mb-4 uppercase tracking-wide">Machine & Thermal</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div class="flex justify-between items-start py-2 border-b border-gray-100">
                        <span class="text-gray-500 text-sm font-medium mt-0.5">Operating Speed</span>
                        <span class="font-mono font-bold text-gray-800">${d.rpm} <span class="text-xs text-gray-400 ml-1">RPM</span></span>
                    </div>
                    ${rowCmp("Suction Vol Flow", d.v_flow_in * 3600, base?.v_flow_in ? base.v_flow_in * 3600 : null, "flow_vol")}
                    ${rowCmp("Discharge Temp (Dry)", d.t_out_dry, base?.t_out_dry, "temp")}
                    
                    <div class="flex justify-between items-start py-2 border-b border-gray-100">
                        <span class="text-gray-500 text-sm font-medium mt-0.5">Specific Power</span>
                        <div class="text-right">
                            <div class="font-mono font-bold text-gray-800">${(d.power / (d.m_flow*3.6)).toFixed(2)} <span class="text-xs text-gray-400 ml-1">kWh/t</span></div>
                        </div>
                    </div>

                    ${d.is_desuperheat ? `
                    <div class="mt-3 pt-2 border-t border-purple-100">
                        <div class="text-[10px] text-purple-600 font-bold uppercase mb-1">After Injection</div>
                        ${rowCmp("Final Discharge T", d.t_out_final, base?.t_out_final, "temp")}
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <div class="mt-8 pt-4 border-t border-gray-100 text-center">
            <p class="text-[10px] text-gray-400">Calculation of Compressor Efficiency Pro v8.35</p>
        </div>
    </div>
    `;
}

// --- Helper: Flow Calculation (Logic from v8.30) ---
function getFlowRate(formData, density_in) {
    const mode = formData.get('flow_mode_m4');
    let m_flow = 0, v_flow_in = 0, rpm = 0;
    
    const vol_eff = parseFloat(formData.get('vol_eff_m4') || '80') / 100.0;

    if (mode === 'rpm') {
        rpm = parseFloat(formData.get('rpm_m4'));
        const disp = parseFloat(formData.get('vol_disp_m4')) / 1e6; 
        const v_flow_th = (rpm / 60.0) * disp;
        v_flow_in = v_flow_th * vol_eff; 
        m_flow = v_flow_in * density_in;
    } else if (mode === 'mass') {
        m_flow = parseFloat(formData.get('mass_flow_m4')) / 3600.0; // kg/h -> kg/s
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        const v_flow_th = parseFloat(formData.get('vol_flow_m4')) / 3600.0;
        v_flow_in = v_flow_th * vol_eff; 
        m_flow = v_flow_in * density_in;
    }
    return { m_flow, v_flow_in, rpm };
}

// --- Core Calculation ---
async function calculateMode4(CP) {
    if (!CP) return;
    calcButtonM4.textContent = "计算中...";
    calcButtonM4.disabled = true;

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM4);
            const fluid = formData.get('fluid_m4');
            
            const p_in = parseFloat(formData.get('p_in_m4')) * 1e5;
            const sh_in = parseFloat(formData.get('SH_in_m4')) || 0;
            const t_sat_in = CP.PropsSI('T', 'P', p_in, 'Q', 1, fluid);
            const t_in = t_sat_in + sh_in;
            
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in, fluid);
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in, fluid);

            const dt = parseFloat(formData.get('delta_T_m4'));
            const p_out = CP.PropsSI('P', 'T', t_sat_in + dt, 'Q', 1, fluid);
            
            const { m_flow, v_flow_in, rpm } = getFlowRate(formData, d_in);

            const eff_is = parseFloat(formData.get('eff_isen_m4'))/100;
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_is;
            const h_out_dry = h_in + w_real;
            const t_out_dry = CP.PropsSI('T', 'P', p_out, 'H', h_out_dry, fluid);
            
            const power = w_real * m_flow / 1000.0; // kW

            // Injection Logic
            const is_desuperheat = document.getElementById('enable_desuperheat_m4').checked;
            const t_water = parseFloat(formData.get('T_water_in_m4')) || 30;
            const target_sh = parseFloat(formData.get('target_superheat_m4')) || 0;
            
            let m_water = 0;
            let h_out_final = h_out_dry;
            let t_out_final = t_out_dry;
            const t_sat_out = t_sat_in + dt;

            if (is_desuperheat) {
                const t_target_k = t_sat_out + target_sh;
                if (t_out_dry > t_target_k) {
                    const h_target = CP.PropsSI('H', 'P', p_out, 'T', t_target_k, fluid);
                    const h_water_in = CP.PropsSI('H', 'T', t_water + 273.15, 'P', p_out, 'Water');
                    const num = m_flow * (h_out_dry - h_target);
                    const den = h_target - h_water_in;
                    if (den > 0) {
                        m_water = num / den;
                        h_out_final = h_target;
                        t_out_final = t_target_k;
                    }
                }
            }
            const s_out_final = CP.PropsSI('S', 'P', p_out, 'H', h_out_final, fluid);

            lastMode4Data = {
                date: new Date().toLocaleDateString(),
                fluid, p_in: p_in/1e5, 
                t_sat_in: t_sat_in - 273.15, sh_in,
                dt, rpm, eff_is, eff_vol: parseFloat(formData.get('vol_eff_m4'))/100,
                p_out: p_out/1e5, t_sat_out: t_sat_out - 273.15, 
                t_out_dry: t_out_dry - 273.15,
                t_out_final: t_out_final - 273.15,
                power, m_flow, v_flow_in, 
                is_desuperheat, m_water, t_water
            };

            resultsDivM4.innerHTML = generateMVRDatasheet(lastMode4Data, baselineMode4);
            
            if(chartDivM4) {
                chartDivM4.classList.remove('hidden');
                const points = [
                    { name: '1', desc: 'Suc', p: p_in, t: t_in, h: h_in, s: s_in },
                    { name: '2', desc: 'Dry', p: p_out, t: t_out_dry, h: h_out_dry, s: s_in }
                ];
                if (m_water > 0) points.push({ name: '3', desc: 'Fin', p: p_out, t: t_out_final, h: h_out_final, s: s_out_final });
                drawPhDiagram(CP, fluid, { points }, 'chart-m4');
            }

        } catch (err) {
            resultsDivM4.innerHTML = `<div class="text-red-600 p-4">Error: ${err.message}</div>`;
        } finally {
            calcButtonM4.textContent = "计算 MVR";
            calcButtonM4.disabled = false;
            if(printButtonM4) printButtonM4.disabled = false;
            if(exportButtonM4) exportButtonM4.disabled = false;
        }
    }, 50);
}

export function initMode4(CP) {
    calcButtonM4 = document.getElementById('calc-button-4');
    resultsDivM4 = document.getElementById('results-4');
    calcFormM4 = document.getElementById('calc-form-4');
    printButtonM4 = document.getElementById('print-button-4');
    exportButtonM4 = document.getElementById('export-button-4');
    chartDivM4 = document.getElementById('chart-m4');
    fluidSelectM4 = document.getElementById('fluid_m4');
    
    if (calcFormM4) {
        // Note: AI Preset logic moved to ui.js, kept here as fallback if ui.js fails to load
        const aiSelect = document.getElementById('ai_eff_m4');
        if(aiSelect) {
            aiSelect.addEventListener('change', () => {
                if (aiSelect.value === 'roots') { document.getElementById('eff_isen_m4').value = 60; document.getElementById('vol_eff_m4').value = 75; }
                else if (aiSelect.value === 'screw_mvr') { document.getElementById('eff_isen_m4').value = 75; document.getElementById('vol_eff_m4').value = 85; }
            });
        }
        calcFormM4.addEventListener('submit', (e) => { e.preventDefault(); calculateMode4(CP); });
        if(fluidSelectM4) {
            fluidSelectM4.addEventListener('change', () => updateFluidInfo(fluidSelectM4, document.getElementById('fluid-info-m4'), CP));
        }
    }
    if (printButtonM4) {
        printButtonM4.onclick = () => {
            if (lastMode4Data) {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>MVR Report</title><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head><body class="p-4 bg-gray-100">${generateMVRDatasheet(lastMode4Data, baselineMode4)}</body></html>`);
                setTimeout(() => win.print(), 200);
            } else alert("Please Calculate First");
        };
    }
    if (exportButtonM4) {
        exportButtonM4.onclick = () => {
            if (lastMode4Data) exportToExcel(lastMode4Data, "MVR_Volumetric_Result");
            else alert("Please Calculate First");
        };
    }
}