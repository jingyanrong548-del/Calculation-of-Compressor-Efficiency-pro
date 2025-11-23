// =====================================================================
// mode4_turbo.js: 模式五 (MVR 透平式 - 离心机)
// 版本: v8.0 (全宽视觉优化版)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

let calcButtonM5, resultsDivM5, calcFormM5, printButtonM5, fluidSelectM5;
let lastMode5Data = null;

function generateTurboDatasheet(d) {
    const themeColor = "#0f766e";
    const bgColor = "#f0fdfa";
    const borderColor = "#ccfbf1";

    // [修改点] width: 100%; 移除 max-width: 210mm
    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <!-- Header -->
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">MVR TURBO DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Centrifugal Compressor Simulation</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Fluid: <strong>${d.fluid}</strong>
            </div>
        </div>
        
        <!-- KPI Dashboard -->
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Evaporation</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${(d.m_flow * 3600).toFixed(1)} <span style="font-size:14px">kg/h</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Impeller Power</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Polytropic Eff.</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${(d.eff_poly*100).toFixed(1)} <span style="font-size:14px">%</span></div>
            </div>
        </div>
        
        <!-- Data Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <!-- Left Column -->
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Suction Conditions</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Pressure</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Temperature</td><td style="text-align: right; font-weight: 600;">${d.t_in.toFixed(1)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Volume Flow</td><td style="text-align: right; font-weight: 600;">${(d.v_flow_in * 3600).toFixed(1)} m³/h</td></tr>
                </table>
            </div>

            <!-- Right Column -->
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Discharge & System</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Temp Lift (Sat)</td><td style="text-align: right; font-weight: 600;">${d.dt.toFixed(1)} K</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                    ${d.m_water > 0 ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Injection Water</td><td style="text-align: right; color: #0891b2; font-weight: 600;">${(d.m_water * 3600).toFixed(1)} kg/h</td></tr>` : ''}
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; font-size: 11px; color: #6b7280;">
            <div style="margin-bottom: 5px; font-weight: bold; color: #374151; font-size: 12px;">
                Prepared by Yanrong Jing (荆炎荣)
            </div>
            <div style="margin-bottom: 8px;">
                Oil-Free Compressor Calculator Pro v8.0
            </div>
            <div style="font-style: italic; color: #9ca3af; max-width: 80%; margin: 0 auto; line-height: 1.5;">
                Disclaimer: This simulation report is provided for engineering reference only. 
                Actual performance may vary based on specific mechanical design, manufacturing tolerances, and operating conditions. 
                The author assumes no liability for any errors, omissions, or consequences arising from the use of this data.
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
        // kg/h -> kg/s
        m_flow = parseFloat(formData.get('mass_flow_m5')) / 3600.0;
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        // m3/h -> m3/s
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
            const p_in_bar = parseFloat(formData.get('p_in_m5'));
            const t_in = parseFloat(formData.get('T_in_m5'));
            const dt = parseFloat(formData.get('delta_T_m5'));
            const eff_poly = parseFloat(formData.get('eff_poly_m5')) / 100.0;
            const t_water = parseFloat(formData.get('T_water_in_m5'));

            // 计算核心 (简化)
            const p_in = p_in_bar * 1e5;
            const t_in_k = t_in + 273.15;
            
            const t_sat_in = CP.PropsSI('T', 'P', p_in, 'Q', 1, fluid);
            const t_sat_out = t_sat_in + dt;
            const p_out = CP.PropsSI('P', 'T', t_sat_out, 'Q', 1, fluid);

            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            
            // 流量
            const { m_flow, v_flow_in } = getFlowRate(formData, d_in);

            // 功耗 (Poly approx)
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_poly_approx = (h_out_is - h_in); 
            const w_real = w_poly_approx / eff_poly; 
            const h_out_dry = h_in + w_real;
            
            const power = w_real * m_flow / 1000.0;
            
             // 喷水
            const h_sat_vap_out = CP.PropsSI('H', 'P', p_out, 'Q', 1, fluid);
            const h_water = CP.PropsSI('H', 'T', t_water + 273.15, 'P', p_out, 'Water');
            let m_water = 0;
            if (h_out_dry > h_sat_vap_out) {
                m_water = m_flow * (h_out_dry - h_sat_vap_out) / (h_sat_vap_out - h_water);
            }

            lastMode5Data = {
                date: new Date().toLocaleDateString(),
                fluid, p_in: p_in_bar, t_in, m_flow, v_flow_in, dt, eff_poly,
                p_out: p_out/1e5, power, m_water
            };

            resultsDivM5.innerHTML = generateTurboDatasheet(lastMode5Data);
            
            calcButtonM5.textContent = "计算透平 MVR";
            calcButtonM5.disabled = false;
            printButtonM5.disabled = false;
            
            printButtonM5.onclick = () => {
                 const win = window.open('', '_blank');
                 win.document.write(`<html><head><title>MVR Turbo Report</title></head><body style="margin:0; background:#fff;">${generateTurboDatasheet(lastMode5Data)}</body></html>`);
                 win.document.close();
                 setTimeout(() => win.print(), 200);
            };

        } catch (err) {
            resultsDivM5.textContent = err.message;
            calcButtonM5.textContent = "计算失败";
            calcButtonM5.disabled = false;
        }
    }, 10);
}

// 导出 init 函数
export function initMode5(CP) {
    calcButtonM5 = document.getElementById('calc-button-5');
    resultsDivM5 = document.getElementById('results-5');
    calcFormM5 = document.getElementById('calc-form-5');
    printButtonM5 = document.getElementById('print-button-5');
    fluidSelectM5 = document.getElementById('fluid_m5');
    
    if (calcFormM5) {
        setupAiEff();
        calcFormM5.addEventListener('submit', (e) => { e.preventDefault(); calculateMode5(CP); });
        fluidSelectM5.addEventListener('change', () => updateFluidInfo(fluidSelectM5, document.getElementById('fluid-info-m5'), CP));
    }
}