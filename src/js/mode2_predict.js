// =====================================================================
// mode2_predict.js: 模式一 (制冷热泵) & 模式二 (气体)
// 版本: v8.1 (修复 CP 作用域错误)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

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

// --- Helper: Datasheet 生成器 ---
function generateDatasheetHTML(d, title) {
    const isGas = title.includes("GAS");
    const themeColor = isGas ? "#0891b2" : "#059669"; 
    const bgColor = isGas ? "#ecfeff" : "#ecfdf5";    
    const borderColor = isGas ? "#cffafe" : "#d1fae5";

    let kpiHTML = '';
    if (isGas) {
        kpiHTML = `
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Shaft Power 轴功率</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Discharge Temp 排气温度</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.t_out.toFixed(1)} <span style="font-size:14px">°C</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Pressure Ratio 压比</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.pr.toFixed(2)}</div>
            </div>`;
    } else {
        kpiHTML = `
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase;">Cooling Cap. 制冷量</div>
                <div style="font-size: 22px; font-weight: 800; color: ${themeColor};">${d.q_evap.toFixed(2)} <span style="font-size:14px">kW</span></div>
                <div style="font-size: 11px; color: #666; margin-top: 4px;">COP (Cool): <strong>${d.cop_c.toFixed(2)}</strong></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase;">Heating Cap. 制热量</div>
                <div style="font-size: 22px; font-weight: 800; color: ${themeColor};">${d.q_cond.toFixed(2)} <span style="font-size:14px">kW</span></div>
                <div style="font-size: 11px; color: #666; margin-top: 4px;">COP (Heat): <strong>${d.cop_h.toFixed(2)}</strong></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase;">Shaft Power 轴功率</div>
                <div style="font-size: 22px; font-weight: 800; color: #333;">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>`;
    }
    
    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">${title}</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Performance Simulation Report 性能模拟报告</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Fluid (工质): <strong>${d.fluid}</strong>
            </div>
        </div>

        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            ${kpiHTML}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Operating Conditions 运行工况</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Pressure 吸气压力</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Temp 吸气温度</td><td style="text-align: right; font-weight: 600;">${d.t_in.toFixed(2)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure 排气压力</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                    ${!isGas ? `
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Evap Temp / Superheat</td><td style="text-align: right;">${d.t_evap.toFixed(1)}°C / ${d.sh.toFixed(1)}K</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Cond Temp / Subcool</td><td style="text-align: right;">${d.t_cond.toFixed(1)}°C / ${d.sc.toFixed(1)}K</td></tr>
                    ` : ''}
                </table>

                <div style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Efficiency Settings 效率设定</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Calc Model 模型</td><td style="text-align: right; font-size: 12px;">${d.eff_note}</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Isentropic Eff. 等熵效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_isen * 100).toFixed(1)} %</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Volumetric Eff. 容积效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_vol * 100).toFixed(1)} %</td></tr>
                </table>
            </div>

            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Performance Data 性能数据</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Mass Flow Rate 质量流量</td><td style="text-align: right; font-weight: 600;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Volume Flow (In) 吸气流量</td><td style="text-align: right; font-weight: 600;">${(d.v_flow * 3600).toFixed(1)} m³/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Temp 排气温度</td><td style="text-align: right; font-weight: 600;">${d.t_out.toFixed(2)} °C</td></tr>
                    
                    ${isGas && d.q_aftercool > 0 ? `
                    <tr style="border-bottom: 1px solid #eee; color:${themeColor};"><td style="padding: 8px 0; font-weight:600;">Aftercooler Load 后冷负荷</td><td style="text-align: right; font-weight: 600;">${d.q_aftercool.toFixed(2)} kW</td></tr>
                    ` : ''}
                    
                    ${!isGas ? `
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Condenser Load 冷凝负荷</td><td style="text-align: right;">${d.q_cond.toFixed(2)} kW</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Evaporator Load 蒸发负荷</td><td style="text-align: right;">${d.q_evap.toFixed(2)} kW</td></tr>
                    ` : ''}
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

// --- AI 推荐 (保持) ---
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

// --- 模式 1 计算 (制冷热泵) - 修复 CP 传递 ---
async function calculateMode1(CP) {
    if (!CP) {
        resultsDivM1.textContent = "Calculation Error: CP is not defined (Module not loaded)";
        return;
    }
    calcButtonM1.disabled = true;
    calcButtonM1.textContent = "计算中...";

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1);
            const fluid = fd.get('fluid_m1');
            
            // 1. 获取参数
            const t_evap = parseFloat(fd.get('T_evap_m1'));
            const sh = parseFloat(fd.get('SH_m1'));
            const t_cond = parseFloat(fd.get('T_cond_m1'));
            const sc = parseFloat(fd.get('SC_m1'));
            
            let eff_isen = parseFloat(fd.get('eff_isen_m1'))/100;
            let eff_vol = parseFloat(fd.get('vol_eff_m1'))/100;
            const mot_eff = parseFloat(fd.get('motor_eff_m1'))/100;

            // 2. 压力计算 (使用传入的 CP)
            const p_in = CP.PropsSI('P','T', t_evap+273.15, 'Q', 1, fluid);
            const p_out = CP.PropsSI('P','T', t_cond+273.15, 'Q', 1, fluid);
            const pr_actual = p_out / p_in;

            // 3. 动态效率修正
            let eff_note = "Static (Fixed)";
            if (fd.get('enable_dynamic_eff_m1') === 'on') {
                const pr_des = parseFloat(fd.get('pr_design_m1'));
                const factor = 1 - 0.03 * Math.pow(pr_actual - pr_des, 2);
                eff_isen = eff_isen * Math.max(0.5, factor);
                eff_note = `Dynamic (PR=${pr_actual.toFixed(2)})`;
            }

            // 4. 状态点 (使用传入的 CP)
            const t_in_k = t_evap + sh + 273.15;
            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in_k, fluid);
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in_k, fluid);

            // 5. 流量计算
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

            // 6. 压缩功 (使用传入的 CP)
            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out = CP.PropsSI('T','P', p_out, 'H', h_out, fluid) - 273.15;
            const t_out_s = CP.PropsSI('T','P', p_out, 'S', s_in, fluid) - 273.15;

            // 7. 负荷计算
            const h_liq = CP.PropsSI('H','P', p_out, 'T', t_cond+273.15-sc, fluid);
            
            const q_evap = (h_in - h_liq) * m_flow / 1000.0; // kW
            const q_cond = (h_out - h_liq) * m_flow / 1000.0; // kW
            const power_shaft = (w_real * m_flow) / 1000.0; // kW
            
            const cop_c = q_evap / power_shaft;
            const cop_h = q_cond / power_shaft;

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_evap+sh, p_out: p_out/1e5, t_out, t_out_s,
                t_evap, sh, t_cond, sc,
                m_flow, v_flow: v_flow_in, power: power_shaft,
                q_evap, q_cond, cop_c, cop_h,
                pr: pr_actual, eff_note, eff_isen, eff_vol
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "HEAT PUMP / REFRIGERATION DATASHEET");
            
            calcButtonM1.textContent = "计算热泵性能";
            calcButtonM1.disabled = false;
            printButtonM1.disabled = false;
            
            printButtonM1.onclick = () => {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Report</title></head><body style="margin:0; background:#fff;">${generateDatasheetHTML(lastMode1Data, "HEAT PUMP / REFRIGERATION DATASHEET")}</body></html>`);
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

// --- 模式 2 计算 (气体) - 修复 CP 传递 ---
async function calculateMode2(CP) {
    if (!CP) return;
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

            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in, fluid);
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in, fluid);

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

            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out = CP.PropsSI('T','P', p_out, 'H', h_out, fluid) - 273.15;
            const t_out_s = CP.PropsSI('T','P', p_out, 'S', s_in, fluid) - 273.15;

            const power = w_real * m_flow / 1000;

            // 后冷却负荷计算 (Mode 2)
            let q_aftercool = 0;
            if (fd.get('enable_cooler_calc_m2') === 'on') {
                const t_target = parseFloat(fd.get('target_temp_m2')) + 273.15;
                const h_target = CP.PropsSI('H', 'P', p_out, 'T', t_target, fluid);
                q_aftercool = (h_out - h_target) * m_flow / 1000.0;
            }

            lastMode2Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in-273.15, p_out: p_out/1e5, t_out, t_out_s,
                m_flow, v_flow: v_flow_in, power, pr: pr_actual,
                q_aftercool,
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
    // [修改] 不再使用全局 CP_INSTANCE，直接透传 CP
    
    calcButtonM1 = document.getElementById('calc-button-1');
    resultsDivM1 = document.getElementById('results-1');
    calcFormM1 = document.getElementById('calc-form-1');
    printButtonM1 = document.getElementById('print-button-1');
    if (calcFormM1) {
        setupAiEff('ai_eff_m1', 'eff_isen_m1', 'vol_eff_m1', 'pr_design_m1');
        calcFormM1.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1(CP); });
    }

    calcButtonM2 = document.getElementById('calc-button-2');
    resultsDivM2 = document.getElementById('results-2');
    calcFormM2 = document.getElementById('calc-form-2');
    printButtonM2 = document.getElementById('print-button-2');
    if (calcFormM2) {
        setupAiEff('ai_eff_m2', 'eff_isen_m2', 'vol_eff_m2', 'pr_design_m2');
        calcFormM2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode2(CP); });
    }
}