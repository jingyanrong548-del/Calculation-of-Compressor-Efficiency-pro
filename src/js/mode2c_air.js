// =====================================================================
// mode2c_air.js: 模式三 (空压机) 核心逻辑
// 版本: v8.33 (Feature: Mobile Responsive Datasheet)
// =====================================================================

import { exportToExcel, drawPerformanceMap } from './utils.js';

let calcButtonM3, resultsDivM3, calcFormM3, printButtonM3, exportButtonM3, chartDivM3;
let lastMode3Data = null; // Single run data
let lastBatchData = null; // Batch run data

// --- Helper: Generate Single Point Datasheet (Mobile Optimized) ---
function generateAirDatasheet(d) {
    const themeColor = "text-cyan-700 border-cyan-600";
    
    // 辅助行生成器
    const row = (label, val, unit = "") => `
        <div class="flex justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <span class="text-gray-500 text-sm font-medium">${label}</span>
            <span class="font-mono font-bold text-gray-800 text-right">${val} <span class="text-xs text-gray-400 ml-1 font-sans">${unit}</span></span>
        </div>`;

    let coolingRow = "";
    if (d.cooling_info.m_inj > 0) coolingRow = row("Injection Water", (d.cooling_info.m_inj * 3600).toFixed(2), "kg/h");
    else if (d.q_jacket > 0) coolingRow = row("Jacket Heat Load", d.q_jacket.toFixed(2), "kW");

    let afterCoolRow = "";
    if (d.q_aftercool > 0) {
        afterCoolRow += row("Aftercooler Load", d.q_aftercool.toFixed(2), "kW");
        if (d.m_condensate > 0) afterCoolRow += row("Condensate Rate", (d.m_condensate * 3600).toFixed(1), "kg/h");
    }

    return `
    <div class="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-gray-100 font-sans text-gray-800 max-w-4xl mx-auto transition-all duration-300">
        <div class="border-b-2 border-cyan-600 pb-4 mb-6 flex flex-col md:flex-row md:justify-between md:items-end">
            <div>
                <h2 class="text-xl md:text-2xl font-bold text-cyan-800 leading-tight">AIR COMPRESSOR REPORT</h2>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <span class="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded text-xs font-bold">Oil-Free Air</span>
                    <span class="text-xs text-gray-400">${d.date}</span>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div class="p-4 bg-cyan-50 border border-cyan-100 rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Shaft Power</div>
                <div class="text-2xl md:text-3xl font-extrabold text-cyan-800">${d.power.toFixed(2)} <span class="text-sm font-normal text-gray-600">kW</span></div>
            </div>
            <div class="p-4 bg-cyan-50 border border-cyan-100 rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">Discharge Temp</div>
                <div class="text-2xl md:text-3xl font-extrabold text-cyan-800">${d.t_out.toFixed(1)} <span class="text-sm font-normal text-gray-600">°C</span></div>
            </div>
            <div class="p-4 bg-cyan-50 border border-cyan-100 rounded-lg text-center shadow-sm">
                <div class="text-xs text-gray-500 uppercase tracking-wide mb-1">FAD (Actual)</div>
                <div class="text-2xl md:text-3xl font-extrabold text-cyan-800">${(d.v_flow * 3600).toFixed(1)} <span class="text-sm font-normal text-gray-600">m³/h</span></div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-cyan-600 pl-3 mb-4 uppercase tracking-wide">Inlet Conditions</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-6">
                    ${row("Ambient Press", d.p_in.toFixed(3), "bar")}
                    ${row("Ambient Temp", d.t_in.toFixed(2), "°C")}
                    ${row("Relative Humidity", d.rh_in_display.toFixed(1), "%")}
                </div>

                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-cyan-600 pl-3 mb-4 uppercase tracking-wide">Efficiency</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    ${row("Isentropic Eff.", (d.eff_is * 100).toFixed(1), "%")}
                    ${row("Volumetric Eff.", (d.eff_vol * 100).toFixed(1), "%")}
                </div>
            </div>

            <div>
                <h3 class="text-xs font-bold text-gray-900 border-l-4 border-cyan-600 pl-3 mb-4 uppercase tracking-wide">Performance</h3>
                <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    ${row("Discharge Press", d.p_out.toFixed(3), "bar")}
                    ${row("Specific Power", d.spec_power.toFixed(2), "kW/(m³/min)")}
                    ${coolingRow}
                    ${afterCoolRow}
                </div>
            </div>
        </div>

        <div class="mt-8 pt-4 border-t border-gray-100 text-center">
            <p class="text-[10px] text-gray-400">Calculation of Compressor Efficiency Pro v8.33</p>
        </div>
    </div>`;
}

// --- Helper: Generate Batch Result Table (Mobile Optimized) ---
function generateBatchTable(batchData) {
    const rows = batchData.map(d => `
        <tr class="hover:bg-cyan-50 border-b border-gray-100 last:border-0 transition-colors">
            <td class="py-3 px-3 text-center font-mono text-gray-600">${d.rpm}</td>
            <td class="py-3 px-3 text-right font-bold text-cyan-700">${(d.v_flow*3600).toFixed(1)}</td>
            <td class="py-3 px-3 text-right font-mono text-gray-800">${d.power.toFixed(1)}</td>
            <td class="py-3 px-3 text-right font-mono text-gray-500 text-xs sm:text-sm">${d.spec_power.toFixed(2)}</td>
            <td class="py-3 px-3 text-right font-mono text-blue-600">${d.t_out.toFixed(0)}</td>
        </tr>
    `).join('');

    return `
    <div class="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wide">Batch Calculation Results</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="min-w-full text-sm whitespace-nowrap">
                <thead class="bg-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                        <th class="py-3 px-3 text-center font-medium">RPM</th>
                        <th class="py-3 px-3 text-right font-medium">Flow (m³/h)</th>
                        <th class="py-3 px-3 text-right font-medium">Pwr (kW)</th>
                        <th class="py-3 px-3 text-right font-medium">Spec.</th>
                        <th class="py-3 px-3 text-right font-medium">T_out</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>
    `;
}

// --- Core Calculation Logic (Single Point - Pure Function) ---
function calculateSinglePoint(CP, inputs) {
    // Unpack inputs
    const { 
        p_in, t_in, rh_in, p_out, eff_is, eff_vol, 
        cooling_type, stages, enable_intercool,
        rpm, vol_disp, // mode: rpm
        jacket_pct, t_target_inj, t_water_inj, // cooling
        enable_ac, t_target_ac // aftercooler
    } = inputs;

    // 1. Inlet State
    const v_da_in = CP.HAPropsSI('V', 'T', t_in, 'P', p_in, 'R', rh_in);
    const w_in = CP.HAPropsSI('W', 'T', t_in, 'P', p_in, 'R', rh_in);
    let current_h = CP.HAPropsSI('H', 'T', t_in, 'P', p_in, 'R', rh_in);
    let current_s = CP.HAPropsSI('S', 'T', t_in, 'P', p_in, 'R', rh_in);
    let current_w = w_in;

    // Flow Rate
    const v_flow_th = (rpm / 60.0) * (vol_disp / 1e6); 
    const v_flow_in = v_flow_th * eff_vol; 
    const m_da = v_flow_in / v_da_in; 

    // Compression Loop
    const pr_stage = Math.pow(p_out/p_in, 1.0/stages);
    let current_p = p_in;
    let total_work = 0;
    let final_t = 0;
    let q_jacket = 0, m_inj = 0;
    let cooling_desc = "Adiabatic";

    for (let i = 0; i < stages; i++) {
        let next_p = current_p * pr_stage;
        if (i === stages - 1) next_p = p_out;

        let h_out_isen = CP.HAPropsSI('H', 'P', next_p, 'S', current_s, 'W', current_w);
        let work_real = (h_out_isen - current_h) / eff_is;
        let h_out_real = current_h + work_real;
        let t_out_adiabatic = CP.HAPropsSI('T', 'P', next_p, 'H', h_out_real, 'W', current_w);
        
        // Cooling Logic
        if (cooling_type === 'jacket') {
            const q_rem = work_real * jacket_pct;
            h_out_real -= q_rem;
            q_jacket += q_rem * m_da / 1000.0; 
            cooling_desc = "Jacket Cooling";
            t_out_adiabatic = CP.HAPropsSI('T', 'P', next_p, 'H', h_out_real, 'W', current_w);
        } else if (cooling_type === 'injection') {
            if (t_out_adiabatic > t_target_inj) {
                const h_air_target = CP.HAPropsSI('H', 'T', t_target_inj, 'P', next_p, 'W', current_w);
                const dh_needed = h_out_real - h_air_target;
                const h_g = CP.PropsSI('H', 'T', t_target_inj, 'Q', 1, 'Water');
                const h_f = CP.PropsSI('H', 'T', t_water_inj, 'Q', 0, 'Water');
                const delta_h_water = h_g - h_f;
                const m_w = dh_needed / delta_h_water;
                m_inj += m_w * m_da; 
                current_w += m_w;
                h_out_real = h_out_real + m_w * h_f;
                t_out_adiabatic = t_target_inj;
                cooling_desc = "Water Injection";
            }
        }

        total_work += work_real;
        current_p = next_p;
        current_h = h_out_real;
        final_t = t_out_adiabatic;
        current_s = CP.HAPropsSI('S', 'P', current_p, 'H', current_h, 'W', current_w);

        if (enable_intercool && i < stages-1) {
            current_h = CP.HAPropsSI('H', 'T', t_in, 'P', current_p, 'W', current_w);
            current_s = CP.HAPropsSI('S', 'T', t_in, 'P', current_p, 'W', current_w);
        }
    }

    // Aftercooler
    let q_aftercool = 0, m_condensate = 0;
    if (enable_ac) {
        const w_sat_ac = CP.HAPropsSI('W', 'T', t_target_ac, 'P', current_p, 'R', 1.0);
        let w_final_ac = current_w;
        if (current_w > w_sat_ac) {
            m_condensate = (current_w - w_sat_ac) * m_da;
            w_final_ac = w_sat_ac;
        }
        const h_air_sat_out = CP.HAPropsSI('H', 'T', t_target_ac, 'P', current_p, 'W', w_final_ac);
        const h_liquid_water_out = CP.PropsSI('H', 'T', t_target_ac, 'Q', 0, 'Water');
        const mass_water_condensed_per_kg_da = Math.max(0, current_w - w_final_ac);
        const enthalpy_leaving_streams = h_air_sat_out + mass_water_condensed_per_kg_da * h_liquid_water_out;
        q_aftercool = (current_h - enthalpy_leaving_streams) * m_da / 1000.0;
    }

    const power_shaft = (total_work * m_da) / 1000.0; 
    const spec_power = power_shaft / (v_flow_in * 60); 

    return {
        date: new Date().toLocaleDateString(),
        p_in: p_in/1e5, t_in: t_in-273.15, rh_in_display: rh_in*100,
        p_out: p_out/1e5, t_out: final_t-273.15,
        rpm, m_da, v_flow: v_flow_in, power: power_shaft, spec_power,
        eff_is, eff_vol, stages, intercool: enable_intercool, cooling_desc,
        cooling_info: { m_inj: m_inj * m_da },
        q_jacket, q_aftercool, m_condensate
    };
}


async function calculateMode3(CP) {
    if (!CP) return;
    calcButtonM3.textContent = "计算中..."; calcButtonM3.disabled = true;

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM3);
            
            // Common Params
            const commonParams = {
                p_in: parseFloat(fd.get('p_in_m3')) * 1e5,
                t_in: parseFloat(fd.get('T_in_m3')) + 273.15,
                rh_in: parseFloat(fd.get('RH_in_m3')) / 100.0,
                p_out: parseFloat(fd.get('p_out_m3')) * 1e5,
                eff_is: parseFloat(fd.get('eff_isen_m3')) / 100.0,
                eff_vol: parseFloat(fd.get('vol_eff_m3')) / 100.0,
                cooling_type: fd.get('cooling_type_m3'),
                stages: parseInt(fd.get('stages_m3') || 1),
                enable_intercool: document.getElementById('enable_intercool_m3').checked,
                jacket_pct: parseFloat(fd.get('jacket_heat_percent_m3') || 15)/100,
                t_target_inj: parseFloat(fd.get('target_t_out_m3')) + 273.15,
                t_water_inj: parseFloat(fd.get('T_inject_water_m3')) + 273.15,
                enable_ac: fd.get('enable_cooler_calc_m3') === 'on',
                t_target_ac: parseFloat(fd.get('target_temp_m3')) + 273.15
            };

            const isBatch = document.getElementById('batch_mode_m3').checked;

            if (!isBatch) {
                // --- Single Run ---
                let rpm = 1500;
                let vol_disp = 1000;

                const mode = fd.get('flow_mode_m3');
                if (mode === 'rpm') {
                    rpm = parseFloat(fd.get('rpm_m3'));
                    vol_disp = parseFloat(fd.get('vol_disp_m3'));
                } else {
                    // RPM calc for other modes
                    const v_disp_ref = 1000; 
                    let v_flow_target = 0;
                    if(mode === 'mass') {
                        const m_target = parseFloat(fd.get('mass_flow_m3'));
                        const v_da_in = CP.HAPropsSI('V', 'T', commonParams.t_in, 'P', commonParams.p_in, 'R', commonParams.rh_in);
                        v_flow_target = m_target * v_da_in;
                    } else {
                        v_flow_target = parseFloat(fd.get('vol_flow_m3')) / 3600;
                    }
                    rpm = (v_flow_target / ((v_disp_ref/1e6) * commonParams.eff_vol)) * 60;
                    vol_disp = v_disp_ref;
                }

                lastMode3Data = calculateSinglePoint(CP, { ...commonParams, rpm, vol_disp });
                lastBatchData = null; // Clear batch data

                resultsDivM3.innerHTML = generateAirDatasheet(lastMode3Data);
                if(chartDivM3) chartDivM3.classList.add('hidden'); 
            } else {
                // --- Batch Run ---
                const rpmStart = parseFloat(fd.get('rpm_start_m3'));
                const rpmEnd = parseFloat(fd.get('rpm_end_m3'));
                const rpmStep = parseFloat(fd.get('rpm_step_m3'));
                const volDisp = parseFloat(fd.get('vol_disp_m3_batch'));
                
                const batchResults = [];
                for (let r = rpmStart; r <= rpmEnd; r += rpmStep) {
                    const res = calculateSinglePoint(CP, { ...commonParams, rpm: r, vol_disp: volDisp });
                    batchResults.push(res);
                }
                
                lastBatchData = batchResults;
                lastMode3Data = null;

                resultsDivM3.innerHTML = generateBatchTable(batchResults);
                
                if(chartDivM3) {
                    chartDivM3.classList.remove('hidden');
                    drawPerformanceMap('chart-m3', batchResults);
                }
            }

            calcButtonM3.disabled = false; calcButtonM3.textContent = "计算空压机";
            printButtonM3.disabled = false; exportButtonM3.disabled = false;

            printButtonM3.onclick = () => {
                const win = window.open('', '_blank');
                // Use standard print layout or simplified
                const content = lastBatchData ? generateBatchTable(lastBatchData) : generateAirDatasheet(lastMode3Data);
                win.document.write(`<html><head><title>Air Report</title><meta name="viewport" content="width=device-width, initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head><body class="p-4 bg-gray-100">${content}</body></html>`);
                setTimeout(() => win.print(), 200);
            };
            exportButtonM3.onclick = () => {
                if (lastBatchData) exportToExcel(lastBatchData[0], "AirComp_Batch");
                else exportToExcel(lastMode3Data, "AirComp_Calc");
            };

        } catch (err) {
            console.error(err);
            resultsDivM3.textContent = "Error: " + err.message;
            calcButtonM3.disabled = false;
        }
    }, 10);
}

export function initMode3(CP) {
    calcButtonM3 = document.getElementById('calc-button-3');
    resultsDivM3 = document.getElementById('results-3');
    calcFormM3 = document.getElementById('calc-form-3');
    printButtonM3 = document.getElementById('print-button-3');
    exportButtonM3 = document.getElementById('export-button-3');
    chartDivM3 = document.getElementById('chart-m3');
    
    if (calcFormM3) {
        calcFormM3.addEventListener('submit', (e) => { e.preventDefault(); calculateMode3(CP); });
        // UI presets are now handled centrally in ui.js, so we removed the local change listener
    }
}