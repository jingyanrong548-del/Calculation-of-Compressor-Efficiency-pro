// =====================================================================
// mode3_mvr.js: 模式四 (MVR 容积式 - 罗茨/螺杆)
// 版本: v8.0 (全宽视觉优化版)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

let calcButtonM4, resultsDivM4, calcFormM4, printButtonM4, fluidSelectM4;
let lastMode4Data = null;

// --- Helper: MVR Datasheet ---
function generateMVRDatasheet(d) {
    // [修改点] width: 100%; 移除 max-width: 210mm
    return `
    <div style="padding: 30px; font-family: sans-serif; background: #fff; width: 100%; box-sizing: border-box;">
        <div style="border-bottom: 3px solid #7e22ce; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: #7e22ce; line-height: 1;">MVR DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Mechanical Vapor Recompression (Volumetric)</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Fluid: <strong>${d.fluid}</strong>
            </div>
        </div>

        <!-- KPI -->
        <div style="background: #faf5ff; border: 1px solid #e9d5ff; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">INJECTION WATER</div>
                <div style="font-size: 24px; font-weight: 800; color: #7e22ce;">${(d.m_water * 3600).toFixed(1)} <span style="font-size:14px">kg/h</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">SHAFT POWER</div>
                <div style="font-size: 24px; font-weight: 800; color: #7e22ce;">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">SAT. TEMP RISE</div>
                <div style="font-size: 24px; font-weight: 800; color: #7e22ce;">${d.dt.toFixed(1)} <span style="font-size:14px">K</span></div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                 <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid #7e22ce; padding-left: 10px; background: #faf5ff; padding-top:5px; padding-bottom:5px;">Process Parameters</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Pressure</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Temp</td><td style="text-align: right; font-weight: 600;">${d.t_in.toFixed(1)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Saturation Temp Out</td><td style="text-align: right; font-weight: 600;">${d.t_sat_out.toFixed(1)} °C</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Temp (Est.)</td><td style="text-align: right; font-weight: 600;">${d.t_out_est.toFixed(1)} °C</td></tr>
                </table>
            </div>
            <div>
                 <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid #7e22ce; padding-left: 10px; background: #faf5ff; padding-top:5px; padding-bottom:5px;">Machine Data</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Operating Speed</td><td style="text-align: right; font-weight: 600;">${d.rpm ? d.rpm + ' RPM' : '-'}</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Volume Flow</td><td style="text-align: right; font-weight: 600;">${(d.v_flow_in * 3600).toFixed(1)} m³/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Evaporation Mass Flow</td><td style="text-align: right; font-weight: 600;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Isentropic Eff.</td><td style="text-align: right; font-weight: 600;">${(d.eff_is*100).toFixed(1)} %</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Volumetric Eff.</td><td style="text-align: right; font-weight: 600;">${(d.eff_vol*100).toFixed(1)} %</td></tr>
                </table>
            </div>
        </div>

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

// --- Helper: 获取流量 (通用) ---
function getFlowRate(formData, density_in) {
    const mode = formData.get('flow_mode_m4');
    let m_flow = 0; 
    let v_flow_in = 0; 
    let rpm = 0;

    if (mode === 'rpm') {
        rpm = parseFloat(formData.get('rpm_m4'));
        const disp = parseFloat(formData.get('vol_disp_m4')) / 1e6; // cm3 -> m3
        const vol_eff = parseFloat(formData.get('vol_eff_m4')) / 100.0;
        v_flow_in = (rpm / 60.0) * disp * vol_eff;
        m_flow = v_flow_in * density_in;
    } else if (mode === 'mass') {
        // MVR 通常输入是 kg/h (蒸发量)
        m_flow = parseFloat(formData.get('mass_flow_m4')) / 3600.0;
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        // m3/h -> m3/s
        v_flow_in = parseFloat(formData.get('vol_flow_m4')) / 3600.0;
        m_flow = v_flow_in * density_in;
    }
    return { m_flow, v_flow_in, rpm };
}

// --- AI 推荐监听 ---
function setupAiEff() {
    const select = document.getElementById('ai_eff_m4');
    if (!select) return;
    select.addEventListener('change', () => {
        const val = select.value;
        if (val === 'roots') {
            document.getElementById('eff_isen_m4').value = 60;
            document.getElementById('vol_eff_m4').value = 75;
        } else if (val === 'screw_mvr') {
            document.getElementById('eff_isen_m4').value = 75;
            document.getElementById('vol_eff_m4').value = 85;
        }
    });
}

// --- 计算核心 ---
async function calculateMode4(CP) {
    if (!CP) return;
    calcButtonM4.textContent = "计算中...";
    calcButtonM4.disabled = true;

    setTimeout(() => {
        try {
            const formData = new FormData(calcFormM4);
            const fluid = formData.get('fluid_m4');
            const p_in_bar = parseFloat(formData.get('p_in_m4'));
            const t_in = parseFloat(formData.get('T_in_m4'));
            const dt = parseFloat(formData.get('delta_T_m4'));
            
            const eff_is = parseFloat(formData.get('eff_isen_m4')) / 100.0;
            const eff_vol = parseFloat(formData.get('vol_eff_m4')) / 100.0;
            const t_water = parseFloat(formData.get('T_water_in_m4'));

            const p_in = p_in_bar * 1e5;
            const t_in_k = t_in + 273.15;

            // 1. 状态点计算
            // 饱和压力检查
            const t_sat_in = CP.PropsSI('T', 'P', p_in, 'Q', 1, fluid);
            const t_sat_out = t_sat_in + dt;
            const p_out = CP.PropsSI('P', 'T', t_sat_out, 'Q', 1, fluid);
            
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);

            // 2. 流量计算
            const { m_flow, v_flow_in, rpm } = getFlowRate(formData, d_in);

            // 3. 压缩功
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_is;
            const h_out_dry = h_in + w_real;
            const power = w_real * m_flow / 1000.0;

            // 4. 喷水计算
            const h_sat_vap_out = CP.PropsSI('H', 'P', p_out, 'Q', 1, fluid);
            const h_water = CP.PropsSI('H', 'T', t_water + 273.15, 'P', p_out, 'Water');
            
            let m_water = 0;
            let t_out_est = CP.PropsSI('T', 'P', p_out, 'H', h_out_dry, fluid) - 273.15;

            if (h_out_dry > h_sat_vap_out) {
                // 需要喷水减温至饱和
                m_water = m_flow * (h_out_dry - h_sat_vap_out) / (h_sat_vap_out - h_water);
                t_out_est = t_sat_out - 273.15; // 喷水后出口为饱和温度
            }

            lastMode4Data = {
                date: new Date().toLocaleDateString(),
                fluid, p_in: p_in_bar, t_in, dt, rpm, eff_is, eff_vol,
                p_out: p_out/1e5, t_sat_out: t_sat_out - 273.15, t_out_est,
                power, m_water, m_flow, v_flow_in
            };

            resultsDivM4.innerHTML = generateMVRDatasheet(lastMode4Data);
            
            calcButtonM4.textContent = "计算喷水量";
            calcButtonM4.disabled = false;
            printButtonM4.disabled = false;
            
            printButtonM4.onclick = () => {
                 const win = window.open('', '_blank');
                 win.document.write(`<html><head><title>MVR Report</title></head><body>${generateMVRDatasheet(lastMode4Data)}</body></html>`);
                 win.document.close();
                 setTimeout(() => win.print(), 200);
            };

        } catch (err) {
            resultsDivM4.textContent = "计算错误: " + err.message;
            calcButtonM4.textContent = "计算失败";
            calcButtonM4.disabled = false;
        }
    }, 10);
}

// 导出 init 函数给 main.js 调用
export function initMode4(CP) {
    calcButtonM4 = document.getElementById('calc-button-4');
    resultsDivM4 = document.getElementById('results-4');
    calcFormM4 = document.getElementById('calc-form-4');
    printButtonM4 = document.getElementById('print-button-4');
    fluidSelectM4 = document.getElementById('fluid_m4');
    
    if (calcFormM4) {
        setupAiEff();
        calcFormM4.addEventListener('submit', (e) => { e.preventDefault(); calculateMode4(CP); });
        fluidSelectM4.addEventListener('change', () => updateFluidInfo(fluidSelectM4, document.getElementById('fluid-info-m4'), CP));
    }
}