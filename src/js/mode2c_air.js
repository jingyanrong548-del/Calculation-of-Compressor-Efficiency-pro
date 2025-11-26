// =====================================================================
// mode2c_air.js: 模式三 (空压机) 核心逻辑
// 版本: v8.32 (Feature: Batch Calculation & Performance Map)
// =====================================================================

import { exportToExcel, drawPerformanceMap } from './utils.js';

let calcButtonM3, resultsDivM3, calcFormM3, printButtonM3, exportButtonM3, chartDivM3;
let lastMode3Data = null; // Single run data
let lastBatchData = null; // Batch run data

// --- Helper: Generate Single Point Datasheet ---
function generateAirDatasheet(d) {
    const themeColor = "#0891b2"; 
    const bgColor = "#ecfeff";
    const borderColor = "#cffafe";

    let stageInfo = d.stages > 1 ? `<div style="margin-top:5px; font-size:12px; color:#555;">Stages: <b>${d.stages}</b> | Intercooling: <b>${d.intercool ? "Yes" : "No"}</b></div>` : "";

    let coolingRow = ``;
    if (d.cooling_info.m_inj > 0) {
        coolingRow = `<tr style="background-color:#f0fdfa; color:#0d9488;"><td style="padding:8px 0; font-weight:bold;">Injection Water</td><td style="text-align:right; font-weight:800;">${(d.cooling_info.m_inj * 3600).toFixed(2)} kg/h</td></tr>`;
    } else if (d.q_jacket > 0) {
        coolingRow = `<tr><td style="padding:8px 0;">Jacket Heat Load</td><td style="text-align:right;">${d.q_jacket.toFixed(2)} kW</td></tr>`;
    }

    let afterCoolRow = "";
    if (d.q_aftercool > 0) {
        afterCoolRow = `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px 0; color:#0369a1;">Aftercooler Load</td>
            <td style="text-align: right; font-weight:600; color:#0369a1;">${d.q_aftercool.toFixed(2)} kW</td>
        </tr>`;
        
        if (d.m_condensate > 0) {
            afterCoolRow += `
            <tr style="background-color:#e0f2fe;">
                <td style="padding: 8px 0; font-weight:bold; color:#0c4a6e;">Condensate Rate</td>
                <td style="text-align: right; font-weight: 800; color:#0c4a6e;">${(d.m_condensate * 3600).toFixed(1)} kg/h</td>
            </tr>`;
        } else {
            afterCoolRow += `
            <tr>
                <td style="padding: 8px 0; font-size:11px; color:#666;">Condensate</td>
                <td style="text-align: right; font-size:11px; color:#666;">None</td>
            </tr>`;
        }
    }

    return `
    <div style="padding: 30px; font-family: 'Segoe UI', sans-serif; background: #fff; color: #333;">
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor};">AIR COMPRESSOR DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Oil-Free Simulation (Humid Air)</div>
                ${stageInfo}
            </div>
            <div style="text-align: right; font-size: 12px; color: #666;">Date: <strong>${d.date}</strong></div>
        </div>
        
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px;">
            <div style="text-align: center;"><div style="font-size:11px; color:#666;">SHAFT POWER</div><div style="font-size:24px; font-weight:800; color:${themeColor}">${d.power.toFixed(2)} kW</div></div>
            <div style="text-align: center;"><div style="font-size:11px; color:#666;">DISCHARGE TEMP</div><div style="font-size:24px; font-weight:800; color:${themeColor}">${d.t_out.toFixed(1)} °C</div></div>
            <div style="text-align: center;"><div style="font-size:11px; color:#666;">FAD (Actual)</div><div style="font-size:24px; font-weight:800; color:${themeColor}">${(d.v_flow * 3600).toFixed(1)} m³/h</div></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                <div style="font-weight:bold; border-left:4px solid ${themeColor}; padding-left:10px; background:#ecfeff;">Inlet Conditions</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr><td style="padding:8px 0; color:#555;">Ambient Pressure</td><td style="text-align:right; font-weight:600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr><td style="padding:8px 0; color:#555;">Ambient Temp</td><td style="text-align:right; font-weight:600;">${d.t_in.toFixed(2)} °C</td></tr>
                    <tr><td style="padding:8px 0; color:#555;">Relative Humidity</td><td style="text-align:right; font-weight:600;">${(d.rh_in_display).toFixed(1)} %</td></tr>
                </table>
                <div style="font-weight:bold; border-left:4px solid ${themeColor}; padding-left:10px; background:#ecfeff; margin-top:20px;">Efficiency</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr><td style="padding:8px 0; color:#555;">Isentropic Eff.</td><td style="text-align:right; font-weight:600;">${(d.eff_is * 100).toFixed(1)} %</td></tr>
                    <tr><td style="padding:8px 0; color:#555;">Volumetric Eff.</td><td style="text-align:right; font-weight:600;">${(d.eff_vol * 100).toFixed(1)} %</td></tr>
                </table>
            </div>
            <div>
                 <div style="font-weight:bold; border-left:4px solid ${themeColor}; padding-left:10px; background:#ecfeff;">Performance</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr><td style="padding:8px 0; color:#555;">Discharge Pressure</td><td style="text-align:right; font-weight:600;">${d.p_out.toFixed(3)} bar</td></tr>
                    <tr><td style="padding:8px 0; color:#555;">Spec. Power</td><td style="text-align:right; font-weight:600;">${d.spec_power.toFixed(2)} kW/(m³/min)</td></tr>
                    ${coolingRow}
                    ${afterCoolRow}
                </table>
            </div>
        </div>
        <div style="margin-top:30px; text-align:center; font-size:10px; color:#999;">v8.32</div>
    </div>`;
}

// --- Helper: Generate Batch Result Table ---
function generateBatchTable(batchData) {
    const rows = batchData.map(d => `
        <tr class="hover:bg-gray-50 border-b transition-colors">
            <td class="py-2 px-3 text-center text-sm font-mono">${d.rpm}</td>
            <td class="py-2 px-3 text-right text-sm font-bold text-teal-700">${(d.v_flow*3600).toFixed(1)}</td>
            <td class="py-2 px-3 text-right text-sm font-mono">${d.power.toFixed(2)}</td>
            <td class="py-2 px-3 text-right text-sm font-mono text-gray-600">${d.spec_power.toFixed(2)}</td>
            <td class="py-2 px-3 text-right text-sm font-mono text-blue-600">${d.t_out.toFixed(1)}</td>
        </tr>
    `).join('');

    return `
    <div class="mt-4 overflow-x-auto rounded border border-gray-200 shadow-sm">
        <div class="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h3 class="text-sm font-bold text-gray-700">Batch Calculation Results (Performance Map)</h3>
        </div>
        <table class="min-w-full bg-white text-sm">
            <thead class="bg-gray-100 text-gray-600 border-b border-gray-200">
                <tr>
                    <th class="py-2 px-3 text-center">RPM</th>
                    <th class="py-2 px-3 text-right">Flow (m³/h)</th>
                    <th class="py-2 px-3 text-right">Power (kW)</th>
                    <th class="py-2 px-3 text-right">Spec. Pwr</th>
                    <th class="py-2 px-3 text-right">T_out (°C)</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>
    `;
}

// --- Core Calculation Logic (Extracted for Reuse) ---
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

    // Flow Rate (Always RPM based for batch, but logic kept generic)
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
                // Handle Flow inputs for single run
                let rpm = 1500;
                let vol_disp = 1000;

                const mode = fd.get('flow_mode_m3');
                if (mode === 'rpm') {
                    rpm = parseFloat(fd.get('rpm_m3'));
                    vol_disp = parseFloat(fd.get('vol_disp_m3'));
                } else {
                    // Back-calculate RPM to fit generic logic if Mass/Vol mode selected
                    // Conversion logic simplified for robustness: use nominal displacement
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
                if(chartDivM3) chartDivM3.classList.add('hidden'); // Hide batch chart
            } else {
                // --- Batch Run ---
                const rpmStart = parseFloat(fd.get('rpm_start_m3'));
                const rpmEnd = parseFloat(fd.get('rpm_end_m3'));
                const rpmStep = parseFloat(fd.get('rpm_step_m3'));
                const volDisp = parseFloat(fd.get('vol_disp_m3_batch')); // Separate input for batch
                
                const batchResults = [];
                // Simple loop with protection
                if (rpmStep <= 0 || rpmEnd < rpmStart) throw new Error("Invalid RPM Range settings.");

                for (let r = rpmStart; r <= rpmEnd; r += rpmStep) {
                    const res = calculateSinglePoint(CP, { ...commonParams, rpm: r, vol_disp: volDisp });
                    batchResults.push(res);
                }
                
                lastBatchData = batchResults;
                lastMode3Data = null;

                // Render Summary
                resultsDivM3.innerHTML = generateBatchTable(batchResults);
                
                // Draw Chart
                if(chartDivM3) {
                    chartDivM3.classList.remove('hidden');
                    drawPerformanceMap('chart-m3', batchResults);
                }
            }

            calcButtonM3.disabled = false; calcButtonM3.textContent = "计算空压机";
            printButtonM3.disabled = false; exportButtonM3.disabled = false;

            printButtonM3.onclick = () => {
                const win = window.open('', '_blank');
                const content = lastBatchData ? generateBatchTable(lastBatchData) : generateAirDatasheet(lastMode3Data);
                win.document.write(`<html><head><title>Air Report</title><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet"></head><body class="p-8">${content}</body></html>`);
                setTimeout(() => win.print(), 200);
            };
            exportButtonM3.onclick = () => {
                if (lastBatchData) exportToExcel(lastBatchData[0], "AirComp_Batch"); // Export first for now
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
        const aiSel = document.getElementById('ai_eff_m3');
        if(aiSel) {
            aiSel.addEventListener('change', () => {
                const val = aiSel.value;
                if (!val) return;
                let isen = 75, vol = 90, coolType = 'adiabatic';
                if (val === 'piston_water') { isen = 72; vol = 85; coolType = 'jacket'; }
                else if (val === 'screw_oil_free') { isen = 75; vol = 92; coolType = 'adiabatic'; }
                else if (val === 'turbo') { isen = 82; vol = 98; coolType = 'adiabatic'; }
                document.getElementById('eff_isen_m3').value = isen;
                document.getElementById('vol_eff_m3').value = vol;
                document.querySelectorAll(`input[name="cooling_type_m3"][value="${coolType}"]`).forEach(r => r.click());
            });
        }
    }
}