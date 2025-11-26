// =====================================================================
// mode4_turbo.js: 模式五 (MVR 透平式 - 离心机)
// 版本: v8.33 (Feature: Mobile Responsive Datasheet & Real Gas Props)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, exportToExcel } from './utils.js';

let calcButtonM5, resultsDivM5, calcFormM5, printButtonM5, exportButtonM5, chartDivM5, fluidSelectM5;
let lastMode5Data = null;

// --- Helper: MVR Turbo Datasheet (Mobile Optimized) ---
function generateTurboDatasheet(d) {
    const themeColor = "text-teal-700 border-teal-600";
    const themeBg = "bg-teal-50";
    const themeBorder = "border-teal-100";

    // 辅助行生成器
    const row = (label, val, unit = "") => `
        <div class="flex justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm font-medium">${label}</span>
            <span class="font-mono font-bold text-gray-800 text-right">${val} <span class="text-xs text-gray-400 ml-1 font-sans">${unit}</span></span>
        </div>`;

    let injHtml = d.is_desuperheat && d.m_water > 0 
        ? `<span class="text-teal-600 font-bold">${(d.m_water * 3600).toFixed(1)} <span class="text-xs font-normal text-gray-500">kg/h</span></span>` 
        : `<span class="text-gray-400 text-xs">Disabled</span>`;

    let stageInfo = d.stages > 1 ? `<span class="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200">Stages: ${d.stages}</span>` : "";

    // Real Gas Properties Block
    const realGasBlock = `
    <div class="mt-6 pt-4 border-t border-dashed border-gray-300">
        <div class="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Real Gas Props (Suction)</div>
        <div class="grid grid-cols-1 gap-y-1">
            ${row("Compressibility Z", d.z_in ? d.z_in.toFixed(4) : '-')}
            ${row("Sound Speed", d.sound_speed_in ? d.sound_speed_in.toFixed(1) : '-', 'm/s')}
            ${row("Isentropic Exp (k)", d.gamma_in ? d.gamma_in.toFixed(3) : '-')}
            ${row("Density", (d.m_flow/d.v_flow_in).toFixed(2), 'kg/m³')}
        </div>
    </div>`;

    return `
    <div class="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100 font-sans text-gray-800 max-w-4xl mx-auto transition-all duration-300">
        <div class="border-b-2 border-teal-600 pb-4 mb-6 flex flex-col md:flex-row md:justify-between md:items-end">
            <div>
                <h2 class="text-xl md:text-2xl font-bold text-teal-800 leading-tight">MVR TURBO REPORT</h2>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span class="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-bold">Centrifugal</span>
                    <span class="text-xs text-gray-400">${d.date}</span>
                    ${stageInfo}
                </div>
            </div>
            <div class="mt-2 md:mt-0 text-right">
                <span class="text-xs font-bold text-gray-500 mr-2">Fluid:</span>
                <span class="text-sm font-bold text-gray-800">${d.fluid}</span>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Evaporation</div>
                <div class="text-2xl md:text-3xl font-extrabold text-teal-800">${(d.m_flow * 3600).toFixed(1)} <span class="text-sm font-normal text-gray-600">kg/h</span></div>
            </div>
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Impeller Pwr</div>
                <div class="text-2xl md:text-3xl font-extrabold text-teal-800">${d.power.toFixed(2)} <span class="text-sm font-normal text-gray-600">kW</span></div>
            </div>
            <div class="p-4 ${themeBg} border ${themeBorder} rounded-lg text-center shadow-sm flex flex-col justify-center items-center">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Injection</div>
                <div class="text-lg font-bold">${injHtml}</div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-teal-600 pl-3 mb-4 uppercase tracking-wide">Suction Conditions</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-6">
                    ${row("Suction Press", d.p_in.toFixed(3), "bar")}
                    ${row("Sat. Temp", d.t_sat_in.toFixed(1), "°C")}
                    ${row("Superheat", d.sh_in.toFixed(1), "K")}
                    ${row("Vol Flow", (d.v_flow_in * 3600).toFixed(1), "m³/h")}
                </div>

                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-teal-600 pl-3 mb-4 uppercase tracking-wide">Efficiency</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    ${row("Polytropic Eff.", (d.eff_poly * 100).toFixed(1), "%")}
                    ${row("COP", d.cop.toFixed(2))}
                </div>
                ${realGasBlock}
            </div>

            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-teal-600 pl-3 mb-4 uppercase tracking-wide">Discharge & Thermal</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    ${row("Temp Lift (Sat)", d.dt.toFixed(1), "K")}
                    ${row("Discharge Press", d.p_out.toFixed(3), "bar")}
                    ${row("Dry Discharge T", d.t_out_dry.toFixed(1), "°C")}
                    ${d.is_desuperheat ? `
                        <div class="mt-3 pt-2 border-t border-teal-100">
                            <div class="text-[10px] text-teal-600 font-bold uppercase mb-1">After Injection</div>
                            ${row("Final Discharge T", d.t_out_final.toFixed(1), "°C")}
                            ${row("Injection Temp", d.t_water.toFixed(1), "°C")}
                        </div>
                    ` : row("Desuperheating", "Disabled")}
                </div>
            </div>
        </div>

        <div class="mt-8 pt-4 border-t border-gray-100 text-center">
            <p class="text-[10px] text-gray-400">Calculation of Compressor Efficiency Pro v8.33</p>
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

// --- Setup AI Preset ---
function setupAiEff() {
    // Note: Basic logic kept here, but main presets logic moved to ui.js in v8.33
    // This is kept for fallback or specific local logic if needed
    const select = document.getElementById('ai_eff_m5');
    if (!select) return;
    select.addEventListener('change', () => {
        const val = select.value;
        if (val === 'fan') document.getElementById('eff_poly_m5').value = 75;
        if (val === 'centrifugal') document.getElementById('eff_poly_m5').value = 80;
        if (val === 'multi_stage') document.getElementById('eff_poly_m5').value = 84;
    });
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
            
            // 1. Determine Temp & Props
            const t_sat_in = CP.PropsSI('T', 'P', p_in, 'Q', 1, fluid);
            const t_in_k = t_sat_in + sh_in; 

            // [New] Real Gas Properties Calculation
            const z_in = CP.PropsSI('Z', 'P', p_in, 'T', t_in_k, fluid);
            const sound_speed_in = CP.PropsSI('A', 'P', p_in, 'T', t_in_k, fluid);
            const gamma_in = CP.PropsSI('isentropic_expansion_coefficient', 'P', p_in, 'T', t_in_k, fluid);

            const t_sat_out = t_sat_in + dt;
            const p_out = CP.PropsSI('P', 'T', t_sat_out, 'Q', 1, fluid);

            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            
            const { m_flow, v_flow_in } = getFlowRate(formData, d_in);

            const pr_total = p_out / p_in;
            const pr_stage = Math.pow(pr_total, 1.0 / stages);
            
            let current_p = p_in;
            let current_h = h_in;
            let current_s = s_in;
            let total_work = 0;

            for(let i=0; i < stages; i++) {
                let next_p = current_p * pr_stage;
                if(i === stages - 1) next_p = p_out;

                let h_out_is = CP.PropsSI('H', 'P', next_p, 'S', current_s, fluid);
                let dh_is = h_out_is - current_h;
                let dh_real = dh_is / eff_poly;
                
                current_h = current_h + dh_real;
                total_work += dh_real;
                
                current_p = next_p;
                current_s = CP.PropsSI('S', 'P', current_p, 'H', current_h, fluid);
            }

            const h_out_dry = current_h;
            const t_out_dry = CP.PropsSI('T', 'P', p_out, 'H', h_out_dry, fluid);
            const s_out_dry = current_s;
            
            const power = total_work * m_flow / 1000.0;
            
            const h_gas_sat = CP.PropsSI('H', 'P', p_in, 'Q', 1, fluid);
            const h_liq_sat = CP.PropsSI('H', 'P', p_in, 'Q', 0, fluid);
            const latent_heat = h_gas_sat - h_liq_sat; 
            const q_latent = m_flow * latent_heat / 1000.0; 
            const cop = power > 0 ? q_latent / power : 0;

            let m_water = 0;
            let h_out_final = h_out_dry;
            let t_out_final = t_out_dry;

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

            const points = [
                { name: 'In', desc: 'Suc', p: p_in, t: t_in_k, h: h_in, s: s_in },
                { name: 'Dry', desc: 'Dry', p: p_out, t: t_out_dry, h: h_out_dry, s: s_out_dry }
            ];
            if(m_water > 0) points.push({ name: 'Fin', desc: 'Cooled', p: p_out, t: t_out_final, h: h_out_final, s: s_out_final });

            lastMode5Data = {
                date: new Date().toLocaleDateString(),
                fluid, p_in: p_in_bar, 
                t_sat_in: t_sat_in - 273.15,
                sh_in,
                t_in: t_in_k - 273.15, 
                m_flow, v_flow_in, dt, eff_poly,
                p_out: p_out/1e5, power, cop,
                t_out_dry: t_out_dry - 273.15,
                t_out_final: t_out_final - 273.15,
                dt_sat: dt, stages,
                is_desuperheat, m_water, t_water,
                // Real Gas Props
                z_in, sound_speed_in, gamma_in
            };

            resultsDivM5.innerHTML = generateTurboDatasheet(lastMode5Data);
            
            if(chartDivM5) {
                chartDivM5.classList.remove('hidden');
                drawPhDiagram(CP, fluid, { points }, 'chart-m5');
            }

        } catch (err) {
            console.error(err);
            resultsDivM5.innerHTML = `<div class="p-4 text-red-600">Error: ${err.message}</div>`;
        } finally {
            calcButtonM5.textContent = "计算透平 MVR";
            calcButtonM5.disabled = false;
            if(printButtonM5) printButtonM5.disabled = false;
            if(exportButtonM5) exportButtonM5.disabled = false;
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
        // Local listener is kept as fallback, though ui.js handles presets now.
        setupAiEff(); 
        calcFormM5.addEventListener('submit', (e) => { e.preventDefault(); calculateMode5(CP); });
        if(fluidSelectM5) {
            fluidSelectM5.addEventListener('change', () => updateFluidInfo(fluidSelectM5, document.getElementById('fluid-info-m5'), CP));
        }
    }

    if (printButtonM5) {
        printButtonM5.onclick = () => {
            if (lastMode5Data) {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>MVR Turbo Report</title><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head><body class="p-4 bg-gray-100">${generateTurboDatasheet(lastMode5Data)}</body></html>`);
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