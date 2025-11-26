// =====================================================================
// mode4_turbo.js: 模式五 (MVR 透平式 - 离心机)
// 版本: v8.32 (Feature: Real Gas Properties Z/A/k)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, exportToExcel } from './utils.js';

let calcButtonM5, resultsDivM5, calcFormM5, printButtonM5, exportButtonM5, chartDivM5, fluidSelectM5;
let lastMode5Data = null;

// --- Helper: MVR 透平 Datasheet 生成器 ---
function generateTurboDatasheet(d) {
    const themeColor = "#0f766e"; 
    const bgColor = "#f0fdfa";
    const borderColor = "#ccfbf1";

    let injHtml = `<div style="color:#999; font-size:11px;">Disabled</div>`;
    if (d.is_desuperheat && d.m_water > 0) {
        injHtml = `<div style="font-weight:800; color:#0d9488;">${(d.m_water * 3600).toFixed(1)} <span style="font-size:12px">kg/h</span></div>`;
    }

    let stageInfo = "";
    if (d.stages > 1) {
        stageInfo = `<div style="margin-top:5px; font-size:12px; color:#555;">
            Stages: <b>${d.stages}</b> (No Intercooling)
        </div>`;
    }

    // [New in v8.32] Real Gas Properties Block
    const realGasBlock = `
    <div style="margin-top:20px; border-top:1px dashed #ccc; padding-top:10px;">
        <div style="font-size:11px; font-weight:bold; color:#555; margin-bottom:5px; text-transform:uppercase;">Real Gas Properties (Suction)</div>
        <table style="width:100%; font-size:12px; color:#444;">
            <tr>
                <td>Compressibility Z:</td><td style="text-align:right; font-family:monospace; font-weight:bold;">${d.z_in ? d.z_in.toFixed(4) : '-'}</td>
                <td style="padding-left:15px;">Speed of Sound:</td><td style="text-align:right; font-family:monospace; font-weight:bold;">${d.sound_speed_in ? d.sound_speed_in.toFixed(1) + ' m/s' : '-'}</td>
            </tr>
            <tr>
                <td>Isentropic Exp. (k):</td><td style="text-align:right; font-family:monospace;">${d.gamma_in ? d.gamma_in.toFixed(3) : '-'}</td>
                <td style="padding-left:15px;">Density:</td><td style="text-align:right; font-family:monospace;">${(d.m_flow/d.v_flow_in).toFixed(3)} kg/m³</td>
            </tr>
        </table>
    </div>`;

    return `
    <div style="padding: 30px; font-family: 'Segoe UI', sans-serif; background: #fff; color: #333;">
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor};">MVR TURBO DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Centrifugal Compressor Simulation 离心式蒸汽压缩机</div>
                ${stageInfo}
            </div>
            <div style="text-align: right; font-size: 12px; color: #666;">
                Date: <strong>${d.date}</strong><br>
                Fluid: <strong>${d.fluid}</strong>
            </div>
        </div>
        
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px;">
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">Evaporation 蒸发量</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${(d.m_flow * 3600).toFixed(1)} <span style="font-size:14px">kg/h</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">Impeller Power 叶轮功率</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">Injection Water 喷水量</div>
                ${injHtml}
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb;">Suction Conditions 吸气工况</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Pressure 吸气压力</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Saturation Temp 饱和温度</td><td style="text-align: right; font-weight: 600;">${d.t_sat_in.toFixed(1)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Superheat 吸气过热度</td><td style="text-align: right; font-weight: 600; color:${themeColor}">${d.sh_in.toFixed(1)} K</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Volume Flow 吸气流量</td><td style="text-align: right; font-weight: 600;">${(d.v_flow_in * 3600).toFixed(1)} m³/h</td></tr>
                </table>

                <div style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb;">Efficiency Settings 效率设定</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Polytropic Eff. 多变效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_poly * 100).toFixed(1)} %</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">COP 性能系数</td><td style="text-align: right; font-weight: 600;">${d.cop.toFixed(2)}</td></tr>
                </table>
                ${realGasBlock}
            </div>

            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb;">Discharge & Thermal 排气与热管理</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Temp Lift (Sat) 饱和温升</td><td style="text-align: right; font-weight: 600;">${d.dt.toFixed(1)} K</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure 排气压力</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Temp (Dry) 干排温</td><td style="text-align: right; font-weight: 600;">${d.t_out_dry.toFixed(1)} °C</td></tr>
                    ${d.is_desuperheat ? `
                    <tr style="background-color:#f0fdfa;"><td style="padding: 8px 0; color: #0f766e; font-weight:bold;">Final Discharge T 最终排温</td><td style="text-align: right; font-weight: 800; color: #0f766e;">${d.t_out_final.toFixed(1)} °C</td></tr>
                    <tr style="background-color:#f0fdfa;"><td style="padding: 8px 0; color: #555;">Injection Temp 喷水温度</td><td style="text-align: right;">${d.t_water.toFixed(1)} °C</td></tr>
                    ` : `
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #999;">Desuperheating</td><td style="text-align: right; color: #999;">Disabled</td></tr>
                    `}
                </table>
            </div>
        </div>

        <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; font-size: 11px; color: #6b7280;">
            <div style="margin-bottom: 5px; font-weight: bold; color: #374151; font-size: 12px;">
                Prepared by Yanrong Jing (荆炎荣)
            </div>
            <div style="margin-bottom: 8px;">
                Oil-Free Compressor Calculator Pro v8.32
            </div>
        </div>
    </div>
    `;
}

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

function setupAiEff() {
    const select = document.getElementById('ai_eff_m5');
    if (!select) return;
    select.addEventListener('change', () => {
        const val = select.value;
        if (val === 'fan') document.getElementById('eff_poly_m5').value = 75;
        if (val === 'centrifugal') document.getElementById('eff_poly_m5').value = 80;
        if (val === 'multi_stage') document.getElementById('eff_poly_m5').value = 84;
    });
}

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
                // [New] Add to data object
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
                win.document.write(`<html><head><title>MVR Turbo Report</title></head><body style="margin:0">${generateTurboDatasheet(lastMode5Data)}</body></html>`);
                win.document.close();
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