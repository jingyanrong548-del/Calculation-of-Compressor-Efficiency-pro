// =====================================================================
// mode2c_air.js: 模式三 (空压机) 核心逻辑
// 版本: v8.27 (Fix: Variable Scope & Turbo Support)
// =====================================================================

import { exportToExcel } from './utils.js';

let calcButtonM3, resultsDivM3, calcFormM3, printButtonM3, exportButtonM3;
let lastMode3Data = null;

// --- Helper: 生成空压机技术规格书 (Bilingual) ---
function generateAirDatasheet(d) {
    const themeColor = "#0891b2"; 
    const bgColor = "#ecfeff";
    const borderColor = "#cffafe";

    // 级数信息
    let stageInfo = "";
    if (d.stages > 1) {
        stageInfo = `<div style="margin-top:5px; font-size:12px; color:#555;">
            Stages: <b>${d.stages}</b> | Intercooling: <b>${d.intercool ? "Yes" : "No"}</b>
        </div>`;
    }

    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">AIR COMPRESSOR DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Thermodynamic Simulation (Humid Air) 湿空气模拟</div>
                ${stageInfo}
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Model: <strong>${d.ai_model || 'Custom'}</strong>
            </div>
        </div>
        
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Shaft Power 轴功率</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Discharge Temp 排气温度</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.t_out.toFixed(1)} <span style="font-size:14px">°C</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">FAD 排气量</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${(d.v_flow * 3600).toFixed(1)} <span style="font-size:14px">m³/h</span></div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #ecfeff; padding-top:5px; padding-bottom:5px;">Inlet Conditions 进口工况</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Ambient Pressure 环境压力</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Ambient Temp (DB) 环境温度</td><td style="text-align: right; font-weight: 600;">${d.t_in.toFixed(2)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Relative Humidity 相对湿度</td><td style="text-align: right; font-weight: 600;">${d.rh_in.toFixed(1)} %</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Humidity Ratio 含湿量</td><td style="text-align: right; font-weight: 600;">${(d.w_in * 1000).toFixed(2)} g/kg</td></tr>
                </table>

                <div style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #ecfeff; padding-top:5px; padding-bottom:5px;">Machine Efficiency 机器效率</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Isentropic Eff. 等熵效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_is * 100).toFixed(1)} %</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Volumetric Eff. 容积效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_vol * 100).toFixed(1)} %</td></tr>
                </table>
            </div>

            <div>
                 <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #ecfeff; padding-top:5px; padding-bottom:5px;">Performance Data 性能数据</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure 排气压力</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Pressure Ratio 总压比</td><td style="text-align: right; font-weight: 600;">${d.pr.toFixed(2)}</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Mass Flow (Dry) 干空气质量流量</td><td style="text-align: right; font-weight: 600;">${(d.m_da * 3600).toFixed(1)} kg/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Specific Power 比功率</td><td style="text-align: right; font-weight: 600;">${d.spec_power.toFixed(2)} kW/(m³/min)</td></tr>
                    
                    ${d.q_jacket > 0 ? `
                    <tr style="border-bottom: 1px solid #eee; color:${themeColor};"><td style="padding: 8px 0; font-weight:600;">Jacket Heat Load 夹套热负荷</td><td style="text-align: right; font-weight: 600;">${d.q_jacket.toFixed(2)} kW</td></tr>
                    ` : ''}
                    
                    ${d.q_aftercool > 0 ? `
                    <tr style="border-bottom: 1px solid #eee; color:${themeColor};"><td style="padding: 8px 0; font-weight:600;">Aftercooler Load 后冷负荷</td><td style="text-align: right; font-weight: 600;">${d.q_aftercool.toFixed(2)} kW</td></tr>
                    ` : ''}
                </table>

                <div style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #ecfeff; padding-top:5px; padding-bottom:5px;">Cooling System 冷却系统</div>
                <div style="font-size: 13px; padding: 5px; color: #555;">
                    <strong>Method:</strong> ${d.cooling_desc}<br>
                    ${d.cooling_detail ? `<span style="color: ${themeColor}; font-weight: 600;">${d.cooling_detail}</span>` : ''}
                </div>
            </div>
        </div>
        
        <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; font-size: 11px; color: #6b7280;">
            <div style="margin-bottom: 5px; font-weight: bold; color: #374151; font-size: 12px;">
                Prepared by Yanrong Jing (荆炎荣)
            </div>
            <div style="margin-bottom: 8px;">
                Oil-Free Compressor Calculator Pro v8.27
            </div>
            <div style="font-style: italic; color: #9ca3af; max-width: 80%; margin: 0 auto; line-height: 1.5;">
                Disclaimer: This simulation report is provided for engineering reference only. 
            </div>
        </div>
    </div>
    `;
}

// --- Helper: 获取流量 ---
function getAirFlowRate(formData, v_specific_in) {
    const mode = formData.get('flow_mode_m3');
    const vol_eff = parseFloat(formData.get('vol_eff_m3') || '100') / 100.0;
    
    let m_da = 0; 
    let v_flow_in = 0; 

    if (mode === 'rpm') {
        const rpm = parseFloat(formData.get('rpm_m3'));
        const disp = parseFloat(formData.get('vol_disp_m3')) / 1e6; 
        v_flow_in = (rpm / 60.0) * disp * vol_eff;
        m_da = v_flow_in / v_specific_in; 
    } else if (mode === 'mass') {
        m_da = parseFloat(formData.get('mass_flow_m3'));
        v_flow_in = m_da * v_specific_in;
    } else if (mode === 'vol') {
        v_flow_in = parseFloat(formData.get('vol_flow_m3')) / 3600.0;
        m_da = v_flow_in / v_specific_in;
    }
    return { m_da, v_flow_in };
}

// --- AI 推荐 (v8.27 Updated) ---
function setupAiEffRecommendation() {
    const select = document.getElementById('ai_eff_m3');
    const isenInput = document.getElementById('eff_isen_m3');
    const volInput = document.getElementById('vol_eff_m3');
    const coolingRadios = document.querySelectorAll('input[name="cooling_type_m3"]');

    if (!select) return;

    select.addEventListener('change', () => {
        const val = select.value;
        if (!val) return;

        let isen = 75, vol = 90, coolType = 'adiabatic';
        switch (val) {
            case 'piston_water': 
                isen = 72; vol = 85; coolType = 'jacket';
                break;
            case 'screw_oil_free': 
                isen = 75; vol = 92; coolType = 'adiabatic'; 
                break;
            case 'screw_injected': 
                isen = 85; vol = 94; coolType = 'injection';
                break;
            case 'turbo': // [New]
                isen = 82; vol = 98; coolType = 'adiabatic';
                break;
        }

        if(isenInput) isenInput.value = isen;
        if(volInput) volInput.value = vol;

        if(coolingRadios.length) {
            coolingRadios.forEach(r => {
                if(r.value === coolType) {
                    r.checked = true;
                    r.dispatchEvent(new Event('change'));
                }
            });
        }
    });
}

// --- 计算核心 ---
async function calculateMode3(CP) {
    if (!CP) {
        if(resultsDivM3) resultsDivM3.textContent = "CoolProp 未加载";
        return;
    }
    if(calcButtonM3) {
        calcButtonM3.textContent = "计算中...";
        calcButtonM3.disabled = true;
    }

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM3);
            
            const p_in = parseFloat(formData.get('p_in_m3'));
            const t_in = parseFloat(formData.get('T_in_m3'));
            const rh_in = parseFloat(formData.get('RH_in_m3')) / 100.0;
            const p_out = parseFloat(formData.get('p_out_m3'));
            const eff_is = parseFloat(formData.get('eff_isen_m3')) / 100.0;
            const eff_vol = parseFloat(formData.get('vol_eff_m3')) / 100.0;
            const cooling_type = formData.get('cooling_type_m3'); 
            
            const stages = parseInt(formData.get('stages_m3') || 1);
            const enable_intercool = document.getElementById('enable_intercool_m3').checked;

            const p_in_pa = p_in * 1e5;
            const t_in_k = t_in + 273.15;
            const p_out_pa = p_out * 1e5;

            // 1. 初始状态 (Unified Variable Names)
            const v_da_in = CP.HAPropsSI('V', 'T', t_in_k, 'P', p_in_pa, 'R', rh_in);
            let current_w = CP.HAPropsSI('W', 'T', t_in_k, 'P', p_in_pa, 'R', rh_in);
            let current_h = CP.HAPropsSI('H', 'T', t_in_k, 'P', p_in_pa, 'W', current_w);
            let current_s = CP.HAPropsSI('S', 'T', t_in_k, 'P', p_in_pa, 'W', current_w);
            
            const { m_da, v_flow_in } = getAirFlowRate(formData, v_da_in);

            // 2. 多级压缩循环
            const pr_total = p_out / p_in;
            const pr_stage = Math.pow(pr_total, 1.0 / stages);
            
            let total_work_per_kg = 0;
            let current_p = p_in_pa;
            let current_t = t_in_k;
            
            let total_q_removed = 0; 
            let cooling_desc = "Adiabatic (None)";
            let cooling_detail = "";

            for (let i = 0; i < stages; i++) {
                let next_p = current_p * pr_stage;
                if (i === stages - 1) next_p = p_out_pa;

                // 等熵过程 (S不变, W不变)
                let h_out_isen = CP.HAPropsSI('H', 'P', next_p, 'S', current_s, 'W', current_w);
                let work_isen = h_out_isen - current_h; 
                let work_real = work_isen / eff_is; 
                
                let h_out_real = current_h + work_real; 

                // 级内冷却
                if (cooling_type === 'jacket') {
                    const jacket_percent = parseFloat(formData.get('jacket_heat_percent_m3') || 15) / 100.0;
                    const q_removed_stage = work_real * jacket_percent;
                    h_out_real -= q_removed_stage;
                    total_q_removed += q_removed_stage;
                    if(i===0) {
                         cooling_desc = "Jacket Water Cooling 夹套水冷";
                         cooling_detail = `Heat Removal Ratio: ${(jacket_percent*100).toFixed(0)}%`;
                    }
                } else if (cooling_type === 'injection') {
                    const heat_removal_ratio = 0.35; 
                    const q_removed_stage = work_real * heat_removal_ratio;
                    h_out_real -= q_removed_stage;
                    if(i===0) {
                        cooling_desc = "Liquid Injection 喷液冷却";
                        cooling_detail = "Injected to Chamber";
                    }
                } else {
                    if(i===0) cooling_desc = "Adiabatic 绝热压缩";
                }

                total_work_per_kg += work_real;

                // 更新状态
                current_p = next_p;
                current_t = CP.HAPropsSI('T', 'P', current_p, 'H', h_out_real, 'W', current_w);
                current_h = h_out_real;
                current_s = CP.HAPropsSI('S', 'P', current_p, 'H', current_h, 'W', current_w);

                // 级间冷却 (Intercooling)
                if (enable_intercool && i < stages - 1) {
                    const t_target = t_in_k; // Cooling target (Input Temp)
                    // Check saturation
                    const w_sat = CP.HAPropsSI('W', 'T', t_target, 'P', current_p, 'R', 1.0);
                    
                    if (current_w > w_sat) {
                        current_w = w_sat; // Condensation occurred
                    }
                    
                    // Reset Temp
                    current_t = t_target;
                    // Recalculate H & S for next stage
                    current_h = CP.HAPropsSI('H', 'T', current_t, 'P', current_p, 'W', current_w);
                    current_s = CP.HAPropsSI('S', 'T', current_t, 'P', current_p, 'W', current_w);
                }
            }

            // 后冷负荷
            let q_aftercool = 0;
            if (formData.get('enable_cooler_calc_m3') === 'on') {
                const t_target = parseFloat(formData.get('target_temp_m3')) + 273.15;
                const h_target = CP.HAPropsSI('H', 'T', t_target, 'P', p_out_pa, 'W', current_w);
                q_aftercool = (current_h - h_target) * m_da / 1000.0;
            }

            const power_shaft = (total_work_per_kg * m_da) / 1000.0; 
            const spec_power = power_shaft / (v_flow_in * 60); 
            const q_jacket_total = total_q_removed * m_da / 1000.0;

            lastMode3Data = {
                date: new Date().toLocaleDateString(),
                ai_model: document.getElementById('ai_eff_m3').options[document.getElementById('ai_eff_m3').selectedIndex].text.split('(')[0].trim(),
                p_in, t_in, rh_in, w_in: current_w, 
                p_out, t_out: current_t - 273.15,
                m_da, v_flow: v_flow_in,
                eff_is, eff_vol, pr: p_out/p_in,
                stages, intercool: enable_intercool,
                power: power_shaft, spec_power,
                cooling_desc, cooling_detail,
                q_jacket: q_jacket_total, q_aftercool
            };

            resultsDivM3.innerHTML = generateAirDatasheet(lastMode3Data);
            
            calcButtonM3.textContent = "计算空压机";
            calcButtonM3.disabled = false;
            printButtonM3.disabled = false;
            exportButtonM3.disabled = false;

            printButtonM3.onclick = () => {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Air Comp Report</title></head><body style="margin:0; background:#fff;">${generateAirDatasheet(lastMode3Data)}</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 200);
            };
            exportButtonM3.onclick = () => exportToExcel(lastMode3Data, "AirComp_Calc");

        } catch (err) {
            resultsDivM3.textContent = "Error: " + err.message;
            console.error(err);
            calcButtonM3.textContent = "计算失败";
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
        setupAiEffRecommendation();
    }
}