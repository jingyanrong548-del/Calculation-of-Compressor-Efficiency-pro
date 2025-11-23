// =====================================================================
// mode2_predict.js: 模式一 (制冷热泵) & 模式二 (气体)
// 版本: v8.0 (全宽视觉优化版)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

let CP_INSTANCE = null;
let lastMode1Data = null;
let lastMode2Data = null;

let calcButtonM1, resultsDivM1, calcFormM1, printButtonM1;
let calcButtonM2, resultsDivM2, calcFormM2, printButtonM2;

// --- Helper: 获取流量 ---
function getFlowRate(formData, modeSuffix, density_in) {
    const mode = formData.get(`flow_mode_${modeSuffix}`);
    let m_flow = 0; 
    let v_flow_in = 0;

    if (mode === 'rpm') {
        const rpm = parseFloat(formData.get(`rpm_${modeSuffix}`));
        const vol_disp = parseFloat(formData.get(`vol_disp_${modeSuffix}`)) / 1e6; 
        const vol_eff_raw = parseFloat(formData.get(`vol_eff_${modeSuffix}`) || '100') / 100.0;
        v_flow_in = (rpm / 60.0) * vol_disp * vol_eff_raw; 
        m_flow = v_flow_in * density_in;
    } else if (mode === 'mass') {
        m_flow = parseFloat(formData.get(`mass_flow_${modeSuffix}`));
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        v_flow_in = parseFloat(formData.get(`vol_flow_${modeSuffix}`)) / 3600.0;
        m_flow = v_flow_in * density_in;
    }
    return { m_flow, v_flow_in };
}

// --- Helper: Datasheet 生成器 (全宽版) ---
function generateDatasheetHTML(d, title) {
    const isGas = title.includes("GAS");
    const themeColor = isGas ? "#0891b2" : "#059669"; // Cyan vs Emerald
    const bgColor = isGas ? "#ecfeff" : "#ecfdf5";    
    const borderColor = isGas ? "#cffafe" : "#d1fae5";

    // KPI 内容
    let kpiHTML = '';
    if (isGas) {
        kpiHTML = `
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Shaft Power</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Discharge Temp</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.t_out.toFixed(1)} <span style="font-size:14px">°C</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Pressure Ratio</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.pr.toFixed(2)}</div>
            </div>`;
    } else {
        kpiHTML = `
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Heating Capacity</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.q_cool.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Shaft Power</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">COP (Heating)</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.cop_h.toFixed(2)}</div>
            </div>`;
    }
    
    // [修改点] width: 100%; 移除 max-width: 210mm
    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <!-- Header -->
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">${title}</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Performance Simulation Report</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Fluid: <strong>${d.fluid}</strong>
            </div>
        </div>

        <!-- KPI Dashboard -->
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            ${kpiHTML}
        </div>

        <!-- Data Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <!-- Left Column -->
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Operating Conditions</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Pressure</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Temp</td><td style="text-align: right; font-weight: 600;">${d.t_in.toFixed(2)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                    ${!isGas ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Temp (Est.)</td><td style="text-align: right;">${d.t_out.toFixed(1)} °C</td></tr>` : ''}
                </table>

                <div style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Efficiency Settings</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Model</td><td style="text-align: right; font-size: 12px;">${d.eff_note}</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Isentropic Eff.</td><td style="text-align: right; font-weight: 600;">${(d.eff_isen * 100).toFixed(1)} %</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Volumetric Eff.</td><td style="text-align: right; font-weight: 600;">${(d.eff_vol * 100).toFixed(1)} %</td></tr>
                </table>
            </div>

            <!-- Right Column -->
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Flow & Performance</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Mass Flow Rate</td><td style="text-align: right; font-weight: 600;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Volume Flow</td><td style="text-align: right; font-weight: 600;">${(d.v_flow * 3600).toFixed(1)} m³/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Isentropic Discharge T</td><td style="text-align: right;">${d.t_out_s ? d.t_out_s.toFixed(2) : '-'} °C</td></tr>
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

// --- AI 推荐 ---
function setupAiEff(selectId, isenId, volId, prId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.addEventListener('change', () => {
        const val = sel.value;
        let isen = 0, vol = 0, pr = 3.0;
        if (val === 'scroll') { isen=70; vol=95; pr=3.0; }
        else if (val === 'piston') { isen=75; vol=85; pr=3.5; }
        else if (val === 'screw') { isen=78; vol=90; pr=3.0; }
        else if (val === 'centrifugal') { isen=82; vol=100; pr=2.5; }
        else if (val === 'piston_air') { isen=70; vol=80; pr=8.0; }
        else if (val === 'screw_oil_free') { isen=75; vol=85; pr=3.5; }
        else if (val === 'process_screw') { isen=78; vol=90; pr=4.0; }

        if (isen > 0) {
            document.getElementById(isenId).value = isen;
            if(volId) document.getElementById(volId).value = vol;
            if(prId && document.getElementById(prId)) document.getElementById(prId).value = pr;
        }
    });
}

// --- 模式 1 计算 ---
async function calculateMode1() {
    if (!CP_INSTANCE) return;
    calcButtonM1.disabled = true;
    calcButtonM1.textContent = "计算中...";

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1);
            const fluid = fd.get('fluid_m1');
            const t_evap = parseFloat(fd.get('T_evap_m1'));
            const sh = parseFloat(fd.get('SH_m1'));
            const t_cond = parseFloat(fd.get('T_cond_m1'));
            const sc = parseFloat(fd.get('SC_m1'));
            
            let eff_isen = parseFloat(fd.get('eff_isen_m1'))/100;
            let eff_vol = parseFloat(fd.get('vol_eff_m1'))/100;
            const mot_eff = parseFloat(fd.get('motor_eff_m1'))/100;

            const p_in = CP_INSTANCE.PropsSI('P','T', t_evap+273.15, 'Q', 1, fluid);
            const p_out = CP_INSTANCE.PropsSI('P','T', t_cond+273.15, 'Q', 1, fluid);
            const pr_actual = p_out / p_in;

            let eff_note = "Static";
            if (fd.get('enable_dynamic_eff_m1') === 'on') {
                const pr_des = parseFloat(fd.get('pr_design_m1'));
                const factor = 1 - 0.03 * Math.pow(pr_actual - pr_des, 2);
                eff_isen = eff_isen * Math.max(0.5, factor);
                eff_note = `Dynamic (PR=${pr_actual.toFixed(2)})`;
            }

            const t_in_k = t_evap + sh + 273.15;
            const d_in = CP_INSTANCE.PropsSI('D','P', p_in, 'T', t_in_k, fluid);
            const h_in = CP_INSTANCE.PropsSI('H','P', p_in, 'T', t_in_k, fluid);
            const s_in = CP_INSTANCE.PropsSI('S','P', p_in, 'T', t_in_k, fluid);

            const mode = fd.get('flow_mode_m1');
            let m_flow = 0, v_flow_in = 0;
            if (mode === 'rpm') {
                const rpm = parseFloat(fd.get('rpm_m1'));
                const disp = parseFloat(fd.get('vol_disp_m1')) / 1e6;
                v_flow_in = (rpm / 60.0) * disp * eff_vol;
                m_flow = v_flow_in * d_in;
            } else {
                const res = getFlowRate(fd, 'm1', d_in);
                m_flow = res.m_flow;
                v_flow_in = res.v_flow_in;
            }

            const h_out_is = CP_INSTANCE.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out = CP_INSTANCE.PropsSI('T','P', p_out, 'H', h_out, fluid) - 273.15;
            const t_out_s = CP_INSTANCE.PropsSI('T','P', p_out, 'S', s_in, fluid) - 273.15;

            const h_liq = CP_INSTANCE.PropsSI('H','P', p_out, 'T', t_cond+273.15-sc, fluid);
            const q_cond = (h_out - h_liq) * m_flow / 1000;
            const power = w_real * m_flow / 1000;

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_evap+sh, p_out: p_out/1e5, t_out, t_out_s,
                m_flow, v_flow: v_flow_in, power: power/mot_eff, q_cool: q_cond,
                pr: pr_actual, eff_note, eff_isen, eff_vol, cop_h: q_cond/(power/mot_eff)
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "HEAT PUMP DATASHEET");
            
            calcButtonM1.textContent = "计算热泵性能";
            calcButtonM1.disabled = false;
            printButtonM1.disabled = false;
            
            printButtonM1.onclick = () => {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Report</title></head><body style="margin:0; background:#fff;">${generateDatasheetHTML(lastMode1Data, "HEAT PUMP DATASHEET")}</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 200);
            };

        } catch (e) {
            resultsDivM1.innerHTML = `<div style="color:red; padding:10px;">Calculation Error: ${e.message}</div>`;
            calcButtonM1.textContent = "计算失败";
            calcButtonM1.disabled = false;
        }
    }, 10);
}

// --- 模式 2 计算 ---
async function calculateMode2() {
    if (!CP_INSTANCE) return;
    calcButtonM2.disabled = true;
    calcButtonM2.textContent = "计算中...";

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM2);
            const fluid = fd.get('fluid_m2');
            const p_in = parseFloat(fd.get('p_in_m2')) * 1e5;
            const t_in = parseFloat(fd.get('T_in_m2')) + 273.15;
            const p_out = parseFloat(fd.get('p_out_m2')) * 1e5;
            
            let eff_isen = parseFloat(fd.get('eff_isen_m2'))/100;
            let eff_vol = parseFloat(fd.get('vol_eff_m2'))/100;
            const pr_actual = p_out / p_in;

            let eff_note = "Static";
            if (fd.get('enable_dynamic_eff_m2') === 'on') {
                const pr_des = parseFloat(fd.get('pr_design_m2'));
                const factor = 1 - 0.03 * Math.pow(pr_actual - pr_des, 2);
                eff_isen = eff_isen * Math.max(0.5, factor);
                eff_note = `Dynamic (PR=${pr_actual.toFixed(2)})`;
            }

            const d_in = CP_INSTANCE.PropsSI('D','P', p_in, 'T', t_in, fluid);
            const h_in = CP_INSTANCE.PropsSI('H','P', p_in, 'T', t_in, fluid);
            const s_in = CP_INSTANCE.PropsSI('S','P', p_in, 'T', t_in, fluid);

            const mode = fd.get('flow_mode_m2');
            let m_flow = 0, v_flow_in = 0;
            if (mode === 'rpm') {
                const rpm = parseFloat(fd.get('rpm_m2'));
                const disp = parseFloat(fd.get('vol_disp_m2')) / 1e6;
                v_flow_in = (rpm / 60.0) * disp * eff_vol;
                m_flow = v_flow_in * d_in;
            } else {
                const res = getFlowRate(fd, 'm2', d_in);
                m_flow = res.m_flow;
                v_flow_in = res.v_flow_in;
            }

            const h_out_is = CP_INSTANCE.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out = CP_INSTANCE.PropsSI('T','P', p_out, 'H', h_out, fluid) - 273.15;
            const t_out_s = CP_INSTANCE.PropsSI('T','P', p_out, 'S', s_in, fluid) - 273.15; 

            const power = w_real * m_flow / 1000;

            lastMode2Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in-273.15, p_out: p_out/1e5, t_out, t_out_s,
                m_flow, v_flow: v_flow_in, power, pr: pr_actual,
                eff_note, eff_isen, eff_vol
            };

            resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR DATASHEET");
            
            calcButtonM2.textContent = "计算气体压缩";
            calcButtonM2.disabled = false;
            printButtonM2.disabled = false;

            printButtonM2.onclick = () => {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Report</title></head><body style="margin:0; background:#fff;">${generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR DATASHEET")}</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 200);
            };

        } catch (e) {
            resultsDivM2.innerHTML = `<div style="color:red">Error: ${e.message}</div>`;
            calcButtonM2.textContent = "计算失败";
            calcButtonM2.disabled = false;
        }
    }, 10);
}

export function initMode1_2(CP) {
    CP_INSTANCE = CP;
    
    calcButtonM1 = document.getElementById('calc-button-1');
    resultsDivM1 = document.getElementById('results-1');
    calcFormM1 = document.getElementById('calc-form-1');
    printButtonM1 = document.getElementById('print-button-1');
    if (calcFormM1) {
        setupAiEff('ai_eff_m1', 'eff_isen_m1', 'vol_eff_m1', 'pr_design_m1');
        calcFormM1.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1(); });
    }

    calcButtonM2 = document.getElementById('calc-button-2');
    resultsDivM2 = document.getElementById('results-2');
    calcFormM2 = document.getElementById('calc-form-2');
    printButtonM2 = document.getElementById('print-button-2');
    if (calcFormM2) {
        setupAiEff('ai_eff_m2', 'eff_isen_m2', 'vol_eff_m2', 'pr_design_m2');
        calcFormM2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode2(); });
    }
}