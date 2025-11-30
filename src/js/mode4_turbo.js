// =====================================================================
// mode4_turbo.js: 模式五 (MVR 透平式 - 离心机)
// 版本: v8.45 (Stable: SH=0 Fix, SEC, Suffix UI)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, exportToExcel, formatValue, getDiffHtml } from './utils.js';

let calcButtonM5, resultsDivM5, calcFormM5, printButtonM5, exportButtonM5, chartDivM5, fluidSelectM5;
let lastMode5Data = null;
let baselineMode5 = null;

// --- Helper: Robust Fluid State (SH=0 Guard) ---
function getFluidState(CP, fluid, p, t_sat, sh) {
    if (Math.abs(sh) < 0.001) {
        // Force Saturated Vapor (Q=1)
        return {
            h: CP.PropsSI('H', 'P', p, 'Q', 1, fluid),
            s: CP.PropsSI('S', 'P', p, 'Q', 1, fluid),
            d: CP.PropsSI('D', 'P', p, 'Q', 1, fluid),
            t: t_sat,
            z: CP.PropsSI('Z', 'P', p, 'Q', 1, fluid),
            a: CP.PropsSI('A', 'P', p, 'Q', 1, fluid) // Speed of Sound
        };
    } else {
        const t_val = t_sat + sh;
        return {
            h: CP.PropsSI('H', 'P', p, 'T', t_val, fluid),
            s: CP.PropsSI('S', 'P', p, 'T', t_val, fluid),
            d: CP.PropsSI('D', 'P', p, 'T', t_val, fluid),
            t: t_val,
            z: CP.PropsSI('Z', 'P', p, 'T', t_val, fluid),
            a: CP.PropsSI('A', 'P', p, 'T', t_val, fluid)
        };
    }
}

// --- Global Event Listeners ---
document.addEventListener('unit-change', () => {
    if (lastMode5Data) {
        resultsDivM5.innerHTML = generateTurboDatasheet(lastMode5Data, baselineMode5);
    }
});

document.addEventListener('pin-baseline', () => {
    if (lastMode5Data && document.getElementById('tab-content-5').style.display !== 'none') {
        baselineMode5 = { ...lastMode5Data };
        resultsDivM5.innerHTML = generateTurboDatasheet(lastMode5Data, baselineMode5);
    }
});

// --- Helper: MVR Turbo Datasheet Generator ---
function generateTurboDatasheet(d, base = null) {
    const themeColor = "text-teal-700 border-teal-600";
    const themeBg = "bg-teal-50";
    const themeBorder = "border-teal-100";

    // [FIX] Updated rowCmp to support 'suffix'
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

    let injHtml = `<span class="text-gray-400 text-xs">Disabled</span>`;
    if (d.is_desuperheat && d.m_water > 0) {
        const val = d.m_water * 3600;
        const fmt = formatValue(val, 'flow_mass');
        injHtml = `<div class="flex flex-col items-center"><span class="text-teal-600 font-bold">${fmt}</span></div>`;
    }

    return `
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 font-sans text-gray-800 max-w-4xl mx-auto transition-all duration-300">
        <div class="border-b-2 border-teal-600 pb-4 mb-6 flex flex-col md:flex-row md:justify-between md:items-end">
            <div>
                <h2 class="text-2xl font-bold text-teal-800 leading-tight">MVR TURBO REPORT</h2>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span class="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-bold">Centrifugal</span>
                    <span class="text-xs text-gray-400">${d.date}</span>
                </div>
            </div>
            ${base ? '<div class="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">Comparison Active</div>' : ''}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Evaporation</div>
                <div class="text-2xl md:text-3xl font-extrabold text-teal-800">${formatValue(d.m_flow * 3600, 'flow_mass')}</div>
                ${getDiffHtml(d.m_flow, base?.m_flow, false)}
            </div>
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Impeller Power</div>
                <div class="text-2xl md:text-3xl font-extrabold text-teal-800">${formatValue(d.power, 'power')}</div>
                ${getDiffHtml(d.power, base?.power, true)}
            </div>
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm flex flex-col justify-center items-center">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Injection</div>
                ${injHtml}
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-teal-600 pl-3 mb-4 uppercase tracking-wide">Suction & Efficiency</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-6">
                    ${rowCmp("Suction Press", d.p_in, base?.p_in, "pressure")}
                    ${rowCmp("Sat. Temp", d.t_sat_in, base?.t_sat_in, "temp")}
                    ${rowCmp("Superheat", d.sh_in, base?.sh_in, "delta_temp")}
                    ${rowCmp("Vol Flow (Act)", d.v_flow_in * 3600, base?.v_flow_in ? base.v_flow_in * 3600 : null, "flow_vol")}
                </div>

                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    ${rowCmp("Polytropic Eff.", d.eff_poly * 100, base?.eff_poly ? base.eff_poly * 100 : null, null, false, '%')}
                    ${rowCmp("COP", d.cop, base?.cop, null)}
                </div>
                
                <div class="mt-6 pt-4 border-t border-dashed border-gray-300">
                    <div class="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Gas Properties</div>
                    <div class="grid grid-cols-1 gap-y-1">
                        ${rowCmp("Compressibility Z", d.z_in, base?.z_in, null)}
                        ${rowCmp("Sound Speed", d.sound_speed_in, base?.sound_speed_in, 'speed')}
                    </div>
                </div>
            </div>

            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-teal-600 pl-3 mb-4 uppercase tracking-wide">Economy & Thermal</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    ${rowCmp("Specific Energy (SEC)", d.sec, base?.sec, "sec", true)}
                    ${rowCmp("Latent Heat (In)", d.latent_heat, base?.latent_heat, "enthalpy")}
                    ${rowCmp("Temp Lift (Sat)", d.dt, base?.dt, "delta_temp")}
                    
                    <div class="my-2 border-t border-gray-200"></div>

                    ${rowCmp("Discharge Press", d.p_out, base?.p_out, "pressure")}
                    ${rowCmp("Dry Discharge T", d.t_out_dry, base?.t_out_dry, "temp")}
                    
                    ${d.is_desuperheat ? `
                        <div class="mt-3 pt-2 border-t border-teal-100">
                            <div class="text-[10px] text-teal-600 font-bold uppercase mb-1">After Injection</div>
                            ${rowCmp("Final Discharge T", d.t_out_final, base?.t_out_final, "temp")}
                            ${rowCmp("Injection Water T", d.t_water, base?.t_water, "temp")}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>

        <div class="mt-8 pt-4 border-t border-gray-100 text-center">
            <p class="text-[10px] text-gray-400">Calculation of Compressor Efficiency Pro v8.45</p>
        </div>
    </div>`;
}

// --- Helper: Flow Calculation ---
function getFlowRate(formData, density_in) {
    const mode = formData.get('flow_mode_m5');
    let m_flow = 0;
    let v_flow_in = 0;

    if (mode === 'mass') {
        m_flow = parseFloat(formData.get('mass_flow_m5')) / 3600.0;
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        v_flow_in = parseFloat(formData.get('vol_flow_m5')) / 3600.0;
        m_flow = v_flow_in * density_in;
    }
    return { m_flow, v_flow_in };
}

// --- Core Calculation Logic ---
async function calculateMode5(CP) {
    if (!CP) return;
    calcButtonM5.textContent = "计算中...";
    calcButtonM5.disabled = true;

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM5);
            const fluid = formData.get('fluid_m5');

            const p_in_bar = parseFloat(formData.get('p_in_m5')) || 1.013;
            const sh_in = parseFloat(formData.get('SH_in_m5')) || 0;
            const dt = parseFloat(formData.get('delta_T_m5')) || 8;
            const eff_poly = (parseFloat(formData.get('eff_poly_m5')) || 80) / 100.0;
            const stages = parseInt(formData.get('stages_m5') || 1);

            const is_desuperheat = document.getElementById('enable_desuperheat_m5').checked;
            const t_water = parseFloat(formData.get('T_water_in_m5')) || 30;
            const target_sh = parseFloat(formData.get('target_superheat_m5')) || 0;

            const p_in = p_in_bar * 1e5;

            // 1. Determine Temp & Props (SH=0 Guard)
            const t_sat_in = CP.PropsSI('T', 'P', p_in, 'Q', 1, fluid);

            // [FIX] Use Guardkeeper
            const stateIn = getFluidState(CP, fluid, p_in, t_sat_in, sh_in);

            const t_sat_out = t_sat_in + dt;
            const p_out = CP.PropsSI('P', 'T', t_sat_out, 'Q', 1, fluid);

            const { m_flow, v_flow_in } = getFlowRate(formData, stateIn.d);

            const pr_total = p_out / p_in;
            const pr_stage = Math.pow(pr_total, 1.0 / stages);

            let current_p = p_in;
            let current_h = stateIn.h;
            let current_s = stateIn.s;
            let total_work = 0;

            for (let i = 0; i < stages; i++) {
                let next_p = current_p * pr_stage;
                if (i === stages - 1) next_p = p_out;

                let h_out_is = CP.PropsSI('H', 'P', next_p, 'S', current_s, fluid);
                let dh_is = h_out_is - current_h;
                let dh_real = dh_is / eff_poly; // Approx polytropic using Isentropic Delta / PolyEff

                current_h = current_h + dh_real;
                total_work += dh_real;

                current_p = next_p;
                current_s = CP.PropsSI('S', 'P', current_p, 'H', current_h, fluid);
            }

            const h_out_dry = current_h;
            const t_out_dry = CP.PropsSI('T', 'P', p_out, 'H', h_out_dry, fluid);

            const power = total_work * m_flow / 1000.0;

            // Latent & SEC
            const h_gas = CP.PropsSI('H', 'P', p_in, 'Q', 1, fluid);
            const h_liq = CP.PropsSI('H', 'P', p_in, 'Q', 0, fluid);
            const latent = h_gas - h_liq; // 这里保持 J/kg 用于 COP 计算
            const cop = power > 0 ? (m_flow * latent / 1000.0) / power : 0;

            const tons_per_hour = m_flow * 3.6;
            const sec = (tons_per_hour > 0) ? (power / tons_per_hour) : 0;

            let m_water = 0;
            let h_out_final = h_out_dry;
            let t_out_final = t_out_dry;

            if (is_desuperheat) {
                const t_target_k = t_sat_out + target_sh;
                if (t_out_dry > t_target_k) {
                    // [FIX] SH=0 Target Guard
                    let h_target;
                    if (Math.abs(target_sh) < 0.001) h_target = CP.PropsSI('H', 'P', p_out, 'Q', 1, fluid);
                    else h_target = CP.PropsSI('H', 'P', p_out, 'T', t_target_k, fluid);

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

            const points = [
                { name: 'In', desc: 'Suc', p: p_in, t: stateIn.t, h: stateIn.h, s: stateIn.s },
                { name: 'Dry', desc: 'Dry', p: p_out, t: t_out_dry, h: h_out_dry, s: current_s }
            ];
            if (m_water > 0) points.push({ name: 'Fin', desc: 'Cooled', p: p_out, t: t_out_final, h: h_out_final, s: s_out_final });

           lastMode5Data = {
                date: new Date().toLocaleDateString(),
                fluid, p_in: p_in/1e5, 
                t_sat_in: t_sat_in - 273.15,
                sh_in,
                m_flow, v_flow_in, dt, eff_poly,
                p_out: p_out/1e5, power, cop,
                t_out_dry: t_out_dry - 273.15,
                t_out_final: t_out_final - 273.15,
                dt_sat: dt, stages,
                is_desuperheat, m_water, t_water,
                sec, 
                latent_heat: latent / 1000.0, // <--- 修复: 除以 1000 转换为 kJ/kg
                z_in: stateIn.z, sound_speed_in: stateIn.a
            };

            resultsDivM5.innerHTML = generateTurboDatasheet(lastMode5Data, baselineMode5);

            if (chartDivM5) {
                chartDivM5.classList.remove('hidden');
                drawPhDiagram(CP, fluid, { points }, 'chart-m5');
            }

        } catch (err) {
            console.error(err);
            resultsDivM5.innerHTML = `<div class="p-4 text-red-600">Error: ${err.message}</div>`;
        } finally {
            calcButtonM5.textContent = "计算透平 MVR";
            calcButtonM5.disabled = false;
            if (printButtonM5) printButtonM5.disabled = false;
            if (exportButtonM5) exportButtonM5.disabled = false;
        }
    }, 50);
}

export function initMode5(CP) {
    calcButtonM5 = document.getElementById('calc-button-5');
    resultsDivM5 = document.getElementById('results-5');
    calcFormM5 = document.getElementById('calc-form-5');
    printButtonM5 = document.getElementById('print-button-5');
    exportButtonM5 = document.getElementById('export-button-5');
    chartDivM5 = document.getElementById('chart-m5');
    fluidSelectM5 = document.getElementById('fluid_m5');

    if (calcFormM5) {
        const select = document.getElementById('ai_eff_m5');
        if (select) {
            select.addEventListener('change', () => {
                const val = select.value;
                if (val === 'fan') document.getElementById('eff_poly_m5').value = 75;
                if (val === 'centrifugal') document.getElementById('eff_poly_m5').value = 80;
                if (val === 'multi_stage') document.getElementById('eff_poly_m5').value = 84;
            });
        }
        calcFormM5.addEventListener('submit', (e) => { e.preventDefault(); calculateMode5(CP); });
        if (fluidSelectM5) {
            fluidSelectM5.addEventListener('change', () => updateFluidInfo(fluidSelectM5, document.getElementById('fluid-info-m5'), CP));
        }
    }

    if (printButtonM5) {
        printButtonM5.onclick = () => {
            if (lastMode5Data) {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>MVR Turbo Report</title><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head><body class="p-4 bg-gray-100">${generateTurboDatasheet(lastMode5Data, baselineMode5)}</body></html>`);
                setTimeout(() => win.print(), 200);
            } else alert("Please Calculate First");
        };
    }
    if (exportButtonM5) {
        exportButtonM5.onclick = () => {
            if (lastMode5Data) exportToExcel(lastMode5Data, "MVR_Turbo_Result");
            else alert("Please Calculate First");
        };
    }
}