// =====================================================================
// mode2c_air.js: 模式三 (空压机) 核心逻辑
// 版本: v8.31 (Fixed: Energy Conservation in Water Injection)
// =====================================================================

import { exportToExcel } from './utils.js';

let calcButtonM3, resultsDivM3, calcFormM3, printButtonM3, exportButtonM3;
let lastMode3Data = null;

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
        <div style="margin-top:30px; text-align:center; font-size:10px; color:#999;">v8.31</div>
    </div>`;
}

function getAirFlowRate(formData, v_specific_in) {
    const mode = formData.get('flow_mode_m3');
    const vol_eff = parseFloat(formData.get('vol_eff_m3') || '100') / 100.0;
    
    let m_da = 0; 
    let v_flow_in = 0; 

    if (mode === 'rpm') {
        const rpm = parseFloat(formData.get('rpm_m3'));
        const disp = parseFloat(formData.get('vol_disp_m3')) / 1e6; 
        const v_flow_th = (rpm / 60.0) * disp; 
        v_flow_in = v_flow_th * vol_eff; 
        m_da = v_flow_in / v_specific_in; 
    } else if (mode === 'mass') {
        m_da = parseFloat(formData.get('mass_flow_m3'));
        v_flow_in = m_da * v_specific_in;
    } else if (mode === 'vol') {
        const v_flow_th = parseFloat(formData.get('vol_flow_m3')) / 3600.0;
        v_flow_in = v_flow_th * vol_eff; 
        m_da = v_flow_in / v_specific_in;
    }
    return { m_da, v_flow_in };
}

async function calculateMode3(CP) {
    if (!CP) return;
    calcButtonM3.textContent = "计算中..."; calcButtonM3.disabled = true;

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM3);
            const p_in = parseFloat(formData.get('p_in_m3')) * 1e5;
            const t_in = parseFloat(formData.get('T_in_m3')) + 273.15;
            const rh_in = parseFloat(formData.get('RH_in_m3')) / 100.0;
            const p_out = parseFloat(formData.get('p_out_m3')) * 1e5;
            const eff_is = parseFloat(formData.get('eff_isen_m3')) / 100.0;
            const cooling_type = formData.get('cooling_type_m3'); 
            const stages = parseInt(formData.get('stages_m3') || 1);
            const enable_intercool = document.getElementById('enable_intercool_m3').checked;

            // 1. Init
            const v_da_in = CP.HAPropsSI('V', 'T', t_in, 'P', p_in, 'R', rh_in);
            const w_in = CP.HAPropsSI('W', 'T', t_in, 'P', p_in, 'R', rh_in);
            let current_h = CP.HAPropsSI('H', 'T', t_in, 'P', p_in, 'R', rh_in);
            let current_s = CP.HAPropsSI('S', 'T', t_in, 'P', p_in, 'R', rh_in);
            let current_w = w_in;
            
            const { m_da, v_flow_in } = getAirFlowRate(formData, v_da_in);

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
                // 暂存绝热温度用于判断
                let t_out_adiabatic = CP.HAPropsSI('T', 'P', next_p, 'H', h_out_real, 'W', current_w);
                
                if (cooling_type === 'jacket') {
                    const pct = parseFloat(formData.get('jacket_heat_percent_m3') || 15)/100;
                    const q_rem = work_real * pct;
                    h_out_real -= q_rem;
                    q_jacket += q_rem * m_da / 1000.0; // kW
                    cooling_desc = "Jacket Cooling";
                    // 重新计算温度
                    t_out_adiabatic = CP.HAPropsSI('T', 'P', next_p, 'H', h_out_real, 'W', current_w);
                } else if (cooling_type === 'injection') {
                    const t_target = parseFloat(formData.get('target_t_out_m3')) + 273.15;
                    const t_water_in = parseFloat(formData.get('T_inject_water_m3')) + 273.15;
                    
                    // 如果绝热温度高于目标温度，才进行喷水计算
                    if (t_out_adiabatic > t_target) {
                        // 1. 计算空气在目标温度下的焓 (假设湿度尚未增加)
                        const h_air_target = CP.HAPropsSI('H', 'T', t_target, 'P', next_p, 'W', current_w);
                        
                        // 2. 能量差 (需要移除的热量)
                        const dh_needed = h_out_real - h_air_target;
                        
                        // 3. 计算水的焓变 (从液态到目标温度下的气态)
                        // H_vapor (at partial pressure) - H_liquid (at input)
                        // 简化计算：Latent heat ~ 2500 kJ/kg
                        const h_g = CP.PropsSI('H', 'T', t_target, 'Q', 1, 'Water');
                        const h_f = CP.PropsSI('H', 'T', t_water_in, 'Q', 0, 'Water');
                        const delta_h_water = h_g - h_f;

                        // 4. 计算喷水量
                        const m_w = dh_needed / delta_h_water;
                        
                        m_inj += m_w * m_da; // Total kg/s
                        current_w += m_w;
                        
                        // 5. [关键修复] 能量守恒更新焓值
                        // 新混合物的焓 = 空气(及原水汽)的焓 + 新注入水的焓(液态)
                        // H_new = H_old_mixture + m_w * h_liquid
                        h_out_real = h_out_real + m_w * h_f;
                        
                        t_out_adiabatic = t_target;
                        cooling_desc = "Water Injection";
                    }
                }

                total_work += work_real;
                current_p = next_p;
                current_h = h_out_real;
                final_t = t_out_adiabatic;
                current_s = CP.HAPropsSI('S', 'P', current_p, 'H', current_h, 'W', current_w);

                // Intercooling
                if (enable_intercool && i < stages-1) {
                    current_h = CP.HAPropsSI('H', 'T', t_in, 'P', current_p, 'W', current_w);
                    current_s = CP.HAPropsSI('S', 'T', t_in, 'P', current_p, 'W', current_w);
                }
            }

            // 3. 后冷 & 析水
            let q_aftercool = 0;
            let m_condensate = 0;

            if (formData.get('enable_cooler_calc_m3') === 'on') {
                const t_target_ac = parseFloat(formData.get('target_temp_m3')) + 273.15;
                
                // 目标温度下的饱和含湿量
                const w_sat_ac = CP.HAPropsSI('W', 'T', t_target_ac, 'P', current_p, 'R', 1.0);
                
                let w_final_ac = current_w;
                
                // 判断是否析水
                if (current_w > w_sat_ac) {
                    const w_diff = current_w - w_sat_ac;
                    m_condensate = w_diff * m_da; // kg/s
                    w_final_ac = w_sat_ac;
                }
                
                // 计算后冷负荷: H_discharge - H_aftercooler_out
                // H_aftercooler_out 必须包含析出的液态水焓，或者直接用能量差
                // 简化：Q = m_da * (H_in - H_out_saturated) - m_condensate * H_liquid
                // 但 HAPropsSI 在过饱和区行为复杂。
                // 更稳健的方法：
                // State 1: current_h (Hot air + vapor)
                // State 2: Air + Vapor (Sat) at T_target
                // State 3: Liquid water at T_target
                
                const h_air_sat_out = CP.HAPropsSI('H', 'T', t_target_ac, 'P', current_p, 'W', w_final_ac);
                const h_liquid_water_out = CP.PropsSI('H', 'T', t_target_ac, 'Q', 0, 'Water');
                
                // Energy Balance: H_in = H_air_out + H_liq_out + Q_removed
                // Q_removed = H_in - (H_air_out + (w_in - w_out)*h_liq)
                // 注意：current_h 是 per kg dry air
                
                const mass_water_condensed_per_kg_da = Math.max(0, current_w - w_final_ac);
                const enthalpy_leaving_streams = h_air_sat_out + mass_water_condensed_per_kg_da * h_liquid_water_out;
                
                q_aftercool = (current_h - enthalpy_leaving_streams) * m_da / 1000.0; 
            }

            const power_shaft = (total_work * m_da) / 1000.0; 
            const spec_power = power_shaft / (v_flow_in * 60); 

            lastMode3Data = {
                date: new Date().toLocaleDateString(),
                ai_model: document.getElementById('ai_eff_m3').options[document.getElementById('ai_eff_m3').selectedIndex].text.split('(')[0].trim(),
                p_in: p_in/1e5, t_in: t_in-273.15, rh_in_display: rh_in*100, w_in,
                p_out: p_out/1e5, t_out: final_t-273.15,
                m_da, v_flow: v_flow_in, power: power_shaft, spec_power,
                eff_is, eff_vol: parseFloat(formData.get('vol_eff_m3'))/100,
                stages, intercool: enable_intercool, cooling_desc,
                cooling_info: { m_inj: m_inj * m_da, target_t: 0 },
                q_jacket: q_jacket, // Already in kW
                q_aftercool, m_condensate
            };

            resultsDivM3.innerHTML = generateAirDatasheet(lastMode3Data);
            calcButtonM3.disabled = false; calcButtonM3.textContent = "计算空压机";
            printButtonM3.disabled = false; exportButtonM3.disabled = false;

            printButtonM3.onclick = () => {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Air Report</title></head><body style="margin:0; background:#fff;">${generateAirDatasheet(lastMode3Data)}</body></html>`);
                setTimeout(() => win.print(), 200);
            };
            exportButtonM3.onclick = () => exportToExcel(lastMode3Data, "AirComp_Calc");

        } catch (err) {
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