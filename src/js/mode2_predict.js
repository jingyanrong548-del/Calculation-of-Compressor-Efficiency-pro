// =====================================================================
// mode2_predict.js: 模式一 (制冷/CO2热泵) & 模式二 (气体)
// 版本: v8.12 (Fix: Mode 2 Button Text Stuck)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, exportToExcel } from './utils.js';

let CP_INSTANCE = null;
let lastMode1Data = null; // 存储 Mode 1 (常规 或 CO2) 的最新计算结果
let lastMode2Data = null; // 存储 Mode 2 的最新计算结果

// DOM Elements
let calcButtonM1, resultsDivM1, calcFormM1, printButtonM1, exportButtonM1, chartDivM1;
let calcButtonM1_CO2, calcFormM1_CO2, btnOptP;
let calcButtonM2, resultsDivM2, calcFormM2, printButtonM2, exportButtonM2, chartDivM2;

// --- Helper: 通用流量计算 ---
function getFlowRate(formData, modeSuffix, density_in, overrideVolEff = null) {
    const mode = formData.get(`flow_mode_${modeSuffix}`);
    let m_flow = 0; 
    let v_flow_in = 0;

    if (mode === 'rpm') {
        const rpm = parseFloat(formData.get(`rpm_${modeSuffix}`));
        const vol_disp = parseFloat(formData.get(`vol_disp_${modeSuffix}`)) / 1e6; // cm3 -> m3
        const vol_eff_val = overrideVolEff !== null 
            ? overrideVolEff 
            : parseFloat(formData.get(`vol_eff_${modeSuffix}`) || '100') / 100.0;
            
        v_flow_in = (rpm / 60.0) * vol_disp * vol_eff_val; 
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

// --- Helper: Datasheet 生成器 (中英双语版) ---
function generateDatasheetHTML(d, title) {
    const isGas = title.includes("GAS");
    const isCO2 = d.fluid === 'R744' || d.fluid === 'Carbon Dioxide';
    
    let themeColor = "#059669"; 
    let bgColor = "#ecfdf5";
    if (isGas) { themeColor = "#0891b2"; bgColor = "#ecfeff"; } 
    if (isCO2) { themeColor = "#ea580c"; bgColor = "#fff7ed"; } 

    // KPI Dashboard (Bilingual)
    let kpiHTML = '';
    if (isGas) {
        kpiHTML = `
            <div style="text-align: center;"><div>Shaft Power <span style="font-size:10px">轴功率</span></div><div style="font-size:24px; font-weight:800; color:${themeColor};">${d.power.toFixed(2)} kW</div></div>
            <div style="text-align: center;"><div>Discharge Temp <span style="font-size:10px">排气温度</span></div><div style="font-size:24px; font-weight:800; color:${themeColor};">${d.t_out.toFixed(1)} °C</div></div>
            <div style="text-align: center;"><div>Pressure Ratio <span style="font-size:10px">压比</span></div><div style="font-size:24px; font-weight:800; color:${themeColor};">${d.pr.toFixed(2)}</div></div>`;
    } else {
        const heatLabel = (d.fluid === 'R744' || d.is_transcritical) ? "Gas Cooler Load <span style='font-size:10px'>气冷负荷</span>" : "Heating Cap. <span style='font-size:10px'>制热量</span>";
        kpiHTML = `
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">Cooling Cap. <span style="font-size:10px">制冷量</span></div>
                <div style="font-size: 22px; font-weight: 800; color: ${themeColor};">${d.q_evap.toFixed(2)} <span style="font-size:14px">kW</span></div>
                <div style="font-size: 11px;">COP (C): <strong>${d.cop_c.toFixed(2)}</strong></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">${heatLabel}</div>
                <div style="font-size: 22px; font-weight: 800; color: ${themeColor};">${d.q_cond.toFixed(2)} <span style="font-size:14px">kW</span></div>
                <div style="font-size: 11px;">COP (H): <strong>${d.cop_h.toFixed(2)}</strong></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">Shaft Power <span style="font-size:10px">轴功率</span></div>
                <div style="font-size: 22px; font-weight: 800; color: #333;">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>`;
    }

    // CO2 Thermal Mgmt Info (Bilingual)
    let thermalRow = '';
    if (isCO2 && d.cooling_info) {
        const ci = d.cooling_info;
        let detail = '';
        if (ci.type === 'surface') detail = `<span style="color:#dc2626">(-${ci.q_loss.toFixed(2)} kW)</span>`;
        if (ci.type === 'injection') detail = `<span style="color:#dc2626">(+${(ci.m_inj*3600).toFixed(1)} kg/h)</span>`;
        
        let typeStr = "Adiabatic (绝热)";
        if (ci.type === 'surface') typeStr = "Surface Cooling (表面冷却)";
        if (ci.type === 'injection') typeStr = "Liquid Injection (喷液冷却)";

        thermalRow = `
        <div style="margin-top: 20px; padding: 10px; background: #fff1f2; border-left: 4px solid #dc2626; border-radius: 4px;">
            <div style="font-weight:bold; color:#991b1b; font-size:12px; margin-bottom:5px;">THERMAL MANAGEMENT 热管理</div>
            <table style="width:100%; font-size:12px;">
                <tr><td style="color:#7f1d1d;">Strategy 策略:</td><td style="font-weight:bold;">${typeStr} ${detail}</td></tr>
                <tr><td style="color:#7f1d1d;">Raw Discharge Temp 原始排温:</td><td style="font-weight:bold; color:#991b1b;">${ci.t_raw.toFixed(1)} °C</td></tr>
                <tr><td style="color:#7f1d1d;">Actual Discharge Temp 实际排温:</td><td style="font-weight:bold; color:#059669;">${d.t_out.toFixed(1)} °C</td></tr>
            </table>
        </div>`;
    }

    const highSideRows = isCO2 ? `
        <tr><td style="padding:5px 0; color:#666;">Gas Cooler Exit Temp <span style="font-size:10px">出口温度</span></td><td style="text-align:right; font-weight:600;">${d.t_gc_out.toFixed(1)} °C ${d.t_warn||''}</td></tr>
        <tr><td style="padding:5px 0; color:#666;">High Side Pressure <span style="font-size:10px">高压侧压力</span></td><td style="text-align:right; font-weight:600;">${d.p_out.toFixed(1)} bar</td></tr>
        ${d.is_transcritical ? `<tr><td style="padding:5px 0; color:${themeColor}; font-size:11px;">Cycle Mode <span style="font-size:10px">循环模式</span></td><td style="text-align:right; color:${themeColor}; font-weight:bold;">Transcritical 跨临界</td></tr>` : 
        `<tr><td style="padding:5px 0; color:#666; font-size:11px;">Cycle Mode <span style="font-size:10px">循环模式</span></td><td style="text-align:right;">Subcritical 亚临界 (SC=${d.sc.toFixed(1)}K)</td></tr>`}
    ` : !isGas ? `
        <tr><td style="padding:5px 0; color:#666;">Condensing Temp <span style="font-size:10px">冷凝温度</span></td><td style="text-align:right; font-weight:600;">${d.t_cond.toFixed(1)} °C</td></tr>
        <tr><td style="padding:5px 0; color:#666;">Subcooling <span style="font-size:10px">过冷度</span></td><td style="text-align:right;">${d.sc.toFixed(1)} K</td></tr>
        <tr><td style="padding:5px 0; color:#666;">Discharge Pressure <span style="font-size:10px">排气压力</span></td><td style="text-align:right;">${d.p_out.toFixed(2)} bar</td></tr>
    ` : `
        <tr><td style="padding:5px 0; color:#666;">Discharge Pressure <span style="font-size:10px">排气压力</span></td><td style="text-align:right; font-weight:600;">${d.p_out.toFixed(2)} bar</td></tr>
    `;

    const loadRows = isCO2 ? `
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Gas Cooler Heat <span style="font-size:10px">气冷负荷</span></td><td style="text-align: right; font-weight: 600;">${d.q_cond.toFixed(2)} kW</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Evaporator Load <span style="font-size:10px">蒸发负荷</span></td><td style="text-align: right;">${d.q_evap.toFixed(2)} kW</td></tr>
    ` : !isGas ? `
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Condenser Load <span style="font-size:10px">冷凝负荷</span></td><td style="text-align: right; font-weight: 600;">${d.q_cond.toFixed(2)} kW</td></tr>
        <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Evaporator Load <span style="font-size:10px">蒸发负荷</span></td><td style="text-align: right;">${d.q_evap.toFixed(2)} kW</td></tr>
    ` : '';

    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">${title}</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Performance Simulation Report 性能仿真报告</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666;">
                Date: <strong>${d.date}</strong><br>Fluid: <strong>${d.fluid}</strong>
            </div>
        </div>
        <div style="background: ${bgColor}; border: 1px solid ${themeColor}33; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px;">${kpiHTML}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding:5px 10px;">Operating Conditions 运行工况</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding:5px 0; color:#666;">Suction Pressure <span style="font-size:10px">吸气压力</span></td><td style="text-align:right;">${d.p_in.toFixed(2)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding:5px 0; color:#666;">Suction Temp <span style="font-size:10px">吸气温度</span></td><td style="text-align:right;">${d.t_in.toFixed(2)} °C</td></tr>
                    ${highSideRows}
                </table>
                <div style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding:5px 10px;">Efficiency Settings 效率设定</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                     <tr><td style="padding:5px 0; color:#666;">Model <span style="font-size:10px">模型</span></td><td style="text-align:right; font-size:12px;">${d.eff_note || 'Standard'}</td></tr>
                     <tr><td style="padding:5px 0; color:#666;">Isentropic Eff. <span style="font-size:10px">等熵效率</span></td><td style="text-align:right; font-weight:bold;">${(d.eff_isen * 100).toFixed(1)} %</td></tr>
                     <tr><td style="padding:5px 0; color:#666;">Volumetric Eff. <span style="font-size:10px">容积效率</span></td><td style="text-align:right; font-weight:bold;">${(d.eff_vol * 100).toFixed(1)} %</td></tr>
                </table>
            </div>
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding:5px 10px;">Performance Data 性能数据</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Mass Flow Rate <span style="font-size:10px">质量流量</span></td><td style="text-align: right; font-weight: 600;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Volume Flow (In) <span style="font-size:10px">吸气体积流量</span></td><td style="text-align: right; font-weight: 600;">${(d.v_flow * 3600).toFixed(1)} m³/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Temp <span style="font-size:10px">排气温度</span></td><td style="text-align: right; font-weight: 600;">${d.t_out.toFixed(2)} °C</td></tr>
                    ${loadRows}
                </table>
                ${thermalRow}
            </div>
        </div>
        <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #999;">Oil-Free Compressor Efficiency Calculator Pro v8.12</div>
    </div>`;
}

// --- 模式 1: 常规制冷计算 ---
async function calculateMode1(CP) {
    if (!CP) return;
    calcButtonM1.disabled = true; calcButtonM1.textContent = "计算中...";

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1);
            const fluid = fd.get('fluid_m1');
            const t_evap = parseFloat(fd.get('T_evap_m1'));
            const sh = parseFloat(fd.get('SH_m1'));
            const t_cond = parseFloat(fd.get('T_cond_m1'));
            const sc = parseFloat(fd.get('SC_m1'));
            let eff_isen = parseFloat(fd.get('eff_isen_m1'))/100;
            
            const p_in = CP.PropsSI('P','T', t_evap+273.15, 'Q', 1, fluid);
            const p_out = CP.PropsSI('P','T', t_cond+273.15, 'Q', 1, fluid);
            const pr_actual = p_out / p_in;

            let eff_note = "Static";
            if (fd.get('enable_dynamic_eff_m1') === 'on') {
                const pr_des = parseFloat(fd.get('pr_design_m1'));
                const factor = 1 - 0.03 * Math.pow(pr_actual - pr_des, 2); 
                eff_isen = eff_isen * Math.max(0.5, factor);
                eff_note = `Dynamic (PR=${pr_actual.toFixed(2)})`;
            }

            const t_in_k = t_evap + sh + 273.15;
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in_k, fluid);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1', d_in);

            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out_k = CP.PropsSI('T','P', p_out, 'H', h_out, fluid);
            const s_out = CP.PropsSI('S','P', p_out, 'H', h_out, fluid);

            const t_liq_k = t_cond + 273.15 - sc;
            const h_liq = CP.PropsSI('H','P', p_out, 'T', t_liq_k, fluid);
            const s_liq = CP.PropsSI('S','P', p_out, 'T', t_liq_k, fluid);

            const h_4 = h_liq;

            const q_evap = (h_in - h_liq) * m_flow / 1000.0; 
            const q_cond = (h_out - h_liq) * m_flow / 1000.0; 
            const power = w_real * m_flow / 1000.0;

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in_k-273.15, p_out: p_out/1e5, t_out: t_out_k-273.15,
                t_cond, sc,
                m_flow, v_flow: v_flow_in, power, q_evap, q_cond, cop_c: q_evap/power, cop_h: q_cond/power,
                eff_isen, eff_vol: parseFloat(fd.get('vol_eff_m1'))/100, eff_note
            };

            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, "STANDARD HEAT PUMP REPORT 制冷热泵报告");
            
            chartDivM1.classList.remove('hidden');
            const points = [
                { name: '1', desc: 'Suction', p: p_in, t: t_in_k, h: h_in, s: s_in },
                { name: '2', desc: 'Discharge', p: p_out, t: t_out_k, h: h_out, s: s_out },
                { name: '3', desc: 'Liq Out', p: p_out, t: t_liq_k, h: h_liq, s: s_liq },
                { name: '4', desc: 'Evap In', p: p_in, t: CP.PropsSI('T','P',p_in,'H',h_4,fluid), h: h_4, s: CP.PropsSI('S','P',p_in,'H',h_4,fluid) }
            ];
            drawPhDiagram(CP, fluid, { points }, 'chart-m1');

            calcButtonM1.disabled = false; calcButtonM1.textContent = "计算常规热泵";
            printButtonM1.disabled = false; exportButtonM1.disabled = false;

        } catch (e) {
            resultsDivM1.innerHTML = `<div class="text-red-500 font-bold">Error: ${e.message}</div>`;
            calcButtonM1.disabled = false;
        }
    }, 10);
}

// --- 模式 1-CO2: 跨临界/亚临界 + 热管理 ---
async function calculateMode1_CO2(CP) {
    if (!CP) return;
    calcButtonM1_CO2.disabled = true; calcButtonM1_CO2.textContent = "计算中...";

    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM1_CO2);
            const fluid = "R744"; 

            // Inputs
            const t_evap = parseFloat(fd.get('T_evap_m1_co2'));
            const sh = parseFloat(fd.get('SH_m1_co2'));
            const t_gc_out = parseFloat(fd.get('T_gc_out_m1_co2'));
            const p_high_bar = parseFloat(fd.get('p_high_m1_co2'));
            const eff_peak = parseFloat(fd.get('eff_isen_peak_m1_co2'));
            const pr_des = parseFloat(fd.get('pr_design_m1_co2'));
            const clearance = parseFloat(fd.get('clearance_m1_co2'));
            const n_index = parseFloat(fd.get('poly_index_m1_co2'));
            const cool_mode = document.querySelector('input[name="cooling_mode_m1_co2"]:checked').value;
            const heat_loss_pct = parseFloat(fd.get('heat_loss_ratio_m1_co2') || 0);
            const target_t_out = parseFloat(fd.get('target_t_out_m1_co2') || 120);

            // 1. 吸气 (Point 1)
            const p_in = CP.PropsSI('P', 'T', t_evap + 273.15, 'Q', 1, fluid);
            const t_in_k = t_evap + sh + 273.15;
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);

            // 2. 效率与流量
            const p_out = p_high_bar * 1e5;
            const pr_act = p_out / p_in;
            
            let eff_vol = 0.98 * (1.0 - clearance * (Math.pow(pr_act, 1.0/n_index) - 1.0));
            eff_vol = Math.max(0.1, Math.min(0.99, eff_vol));
            
            const deviation = (pr_act - pr_des) / pr_des;
            let eff_isen = eff_peak * (1.0 - 0.25 * Math.pow(deviation, 2));
            eff_isen = Math.max(0.3, eff_isen);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm1_co2', d_in, eff_vol);

            // 3. 原始排气 (Point 2 Raw)
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out_raw = h_in + w_real;
            const t_out_raw_k = CP.PropsSI('T', 'P', p_out, 'H', h_out_raw, fluid);
            const power_shaft = w_real * m_flow / 1000.0;

            // 4. 冷却修正
            let h_out_final = h_out_raw;
            let t_out_final_k = t_out_raw_k;
            let m_inj = 0;
            let q_loss = 0;
            let m_total_dis = m_flow; 

            // 3. 气冷器/冷凝器出口 (Point 3) - 亚临界逻辑修复
            const p_crit = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
            const is_transcritical = p_out > p_crit;
            let h_gc_out, t_gc_out_k, sc_val = 0;
            let warning_msg = "";

            if (is_transcritical) {
                t_gc_out_k = t_gc_out + 273.15;
                h_gc_out = CP.PropsSI('H', 'P', p_out, 'T', t_gc_out_k, fluid);
            } else {
                // 亚临界计算
                const t_sat_cond = CP.PropsSI('T', 'P', p_out, 'Q', 0, fluid);
                t_gc_out_k = t_gc_out + 273.15;
                
                if (t_gc_out_k >= t_sat_cond) {
                    t_gc_out_k = t_sat_cond - 0.1; 
                    warning_msg = `(Auto-corrected to ${(t_gc_out_k-273.15).toFixed(1)}°C)`;
                }
                sc_val = t_sat_cond - t_gc_out_k;
                h_gc_out = CP.PropsSI('H', 'P', p_out, 'T', t_gc_out_k, fluid);
            }
            const s_gc_out = CP.PropsSI('S', 'P', p_out, 'H', h_gc_out, fluid);

            // 4. 节流后/蒸发入口 (Point 4)
            const h_4 = h_gc_out; 
            const p_4 = p_in;
            const t_4_k = CP.PropsSI('T', 'P', p_4, 'H', h_4, fluid);
            const s_4 = CP.PropsSI('S', 'P', p_4, 'H', h_4, fluid);

            // Cooling Logic
            if (cool_mode === 'surface') {
                q_loss = power_shaft * (heat_loss_pct / 100.0);
                const dh = (q_loss * 1000.0) / m_flow;
                h_out_final = h_out_raw - dh;
                t_out_final_k = CP.PropsSI('T', 'P', p_out, 'H', h_out_final, fluid);
            } else if (cool_mode === 'injection') {
                const h_inj_src = h_gc_out;
                const t_target_k = target_t_out + 273.15;
                if (t_target_k < t_out_raw_k) {
                    const h_target = CP.PropsSI('H', 'P', p_out, 'T', t_target_k, fluid);
                    const num = m_flow * (h_out_raw - h_target);
                    const den = h_target - h_inj_src;
                    if (den > 0) {
                        m_inj = num / den;
                        h_out_final = h_target;
                        t_out_final_k = t_target_k;
                        m_total_dis = m_flow + m_inj;
                    }
                }
            }

            // 5. Energy Balance
            const q_evap = (h_in - h_gc_out) * m_flow / 1000.0;
            const q_cond = (h_out_final - h_gc_out) * m_total_dis / 1000.0;
            const s_out_final = CP.PropsSI('S', 'P', p_out, 'H', h_out_final, fluid);

            lastMode1Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in_k - 273.15,
                p_out: p_out/1e5, t_out: t_out_final_k - 273.15,
                t_gc_out, is_transcritical, sc: sc_val, t_warn: warning_msg,
                m_flow: m_flow, v_flow: v_flow_in,
                power: power_shaft, q_evap, q_cond,
                cop_c: q_evap/power_shaft, cop_h: q_cond/power_shaft,
                pr: pr_act, eff_isen, eff_vol,
                eff_note: `Physical (Cl=${clearance})`,
                cooling_info: { type: cool_mode, t_raw: t_out_raw_k - 273.15, q_loss, m_inj }
            };

            const sheetTitle = is_transcritical ? "CO2 TRANSCRITICAL REPORT 跨临界报告" : "CO2 SUBCRITICAL REPORT 亚临界报告";
            resultsDivM1.innerHTML = generateDatasheetHTML(lastMode1Data, sheetTitle);

            chartDivM1.classList.remove('hidden');
            const points = [
                { name: '1', desc: 'Suction', p: p_in, t: t_in_k, h: h_in, s: s_in },
                { name: '2', desc: 'Discharge', p: p_out, t: t_out_final_k, h: h_out_final, s: s_out_final },
                { name: '3', desc: 'GC/Cond Out', p: p_out, t: t_gc_out_k, h: h_gc_out, s: s_gc_out },
                { name: '4', desc: 'Evap In', p: p_4, t: t_4_k, h: h_4, s: s_4 }
            ];
            drawPhDiagram(CP, fluid, { points }, 'chart-m1');

            calcButtonM1_CO2.disabled = false; calcButtonM1_CO2.textContent = "🔥 计算 CO2 (R744) 循环";
            printButtonM1.disabled = false; exportButtonM1.disabled = false;

        } catch (err) {
            resultsDivM1.innerHTML = `<div class="p-4 bg-red-50 text-red-600 border border-red-200 rounded"><strong>Calculation Failed:</strong><br>${err.message}</div>`;
            calcButtonM1_CO2.disabled = false;
        }
    }, 10);
}

// --- 模式 2: 气体预测 ---
async function calculateMode2(CP) {
    if (!CP) return;
    calcButtonM2.disabled = true; calcButtonM2.textContent = "计算中...";
    setTimeout(() => {
        try {
            const fd = new FormData(calcFormM2);
            const fluid = fd.get('fluid_m2');
            const p_in = parseFloat(fd.get('p_in_m2')) * 1e5;
            const t_in = parseFloat(fd.get('T_in_m2')) + 273.15;
            const p_out = parseFloat(fd.get('p_out_m2')) * 1e5;
            let eff_isen = parseFloat(fd.get('eff_isen_m2'))/100;
            
            const h_in = CP.PropsSI('H','P', p_in, 'T', t_in, fluid);
            const s_in = CP.PropsSI('S','P', p_in, 'T', t_in, fluid);
            const d_in = CP.PropsSI('D','P', p_in, 'T', t_in, fluid);

            const h_out_is = CP.PropsSI('H','P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_isen;
            const h_out = h_in + w_real;
            const t_out = CP.PropsSI('T','P', p_out, 'H', h_out, fluid);
            const s_out = CP.PropsSI('S','P', p_out, 'H', h_out, fluid);

            let { m_flow, v_flow_in } = getFlowRate(fd, 'm2', d_in);
            const power = w_real * m_flow / 1000;

            let q_aftercool = 0;
            if (fd.get('enable_cooler_calc_m2') === 'on') {
                const t_target = parseFloat(fd.get('target_temp_m2')) + 273.15;
                const h_target = CP.PropsSI('H', 'P', p_out, 'T', t_target, fluid);
                q_aftercool = (h_out - h_target) * m_flow / 1000.0;
            }

            lastMode2Data = {
                date: new Date().toLocaleDateString(), fluid,
                p_in: p_in/1e5, t_in: t_in-273.15, p_out: p_out/1e5, t_out: t_out-273.15,
                m_flow, v_flow: v_flow_in, power, pr: p_out/p_in, q_aftercool,
                eff_isen, eff_vol: parseFloat(fd.get('vol_eff_m2'))/100, eff_note: "Standard"
            };
            resultsDivM2.innerHTML = generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT 气体压缩报告");
            chartDivM2.classList.remove('hidden');
            drawPhDiagram(CP, fluid, { points: [
                { name: '1', desc: 'Suction', p: p_in, t: t_in, h: h_in, s: s_in },
                { name: '2', desc: 'Discharge', p: p_out, t: t_out, h: h_out, s: s_out }
            ]}, 'chart-m2');

            // [FIX v8.12] Button text reset
            calcButtonM2.disabled = false; 
            calcButtonM2.textContent = "计算气体压缩";
            printButtonM2.disabled = false;
            exportButtonM2.disabled = false;
        } catch(e) { 
            resultsDivM2.textContent = e.message; 
            calcButtonM2.disabled = false; 
            calcButtonM2.textContent = "计算失败";
        }
    }, 10);
}

// --- 初始化入口 ---
export function initMode1_2(CP) {
    CP_INSTANCE = CP;
    
    // Elements
    calcButtonM1 = document.getElementById('calc-button-1');
    resultsDivM1 = document.getElementById('results-1');
    calcFormM1 = document.getElementById('calc-form-1');
    printButtonM1 = document.getElementById('print-button-1');
    exportButtonM1 = document.getElementById('export-button-1');
    chartDivM1 = document.getElementById('chart-m1');
    calcButtonM1_CO2 = document.getElementById('calc-button-1-co2');
    calcFormM1_CO2 = document.getElementById('calc-form-1-co2');
    btnOptP = document.getElementById('btn-opt-p-high');

    // Print/Export Logic (Bilingual Titles)
    if (printButtonM1) {
        printButtonM1.onclick = () => {
            if (lastMode1Data) {
                const title = lastMode1Data.fluid === 'R744' ? "CO2 (R744) CYCLE REPORT" : "HEAT PUMP REPORT 制冷热泵报告";
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>${title}</title></head><body style="margin:0">${generateDatasheetHTML(lastMode1Data, title)}</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 200);
            } else { alert("请先进行计算 Please Calculate First"); }
        };
    }
    if (exportButtonM1) {
        exportButtonM1.onclick = () => {
            if (lastMode1Data) exportToExcel(lastMode1Data, lastMode1Data.fluid === 'R744' ? "CO2_Cycle_Result" : "HeatPump_Result");
            else alert("请先进行计算 Please Calculate First");
        };
    }

    if (calcFormM1) {
        const aiSel = document.getElementById('ai_eff_m1');
        const fluidSelectM1 = document.getElementById('fluid_m1');
        aiSel.addEventListener('change', () => {
            if(aiSel.value === 'scroll') { document.getElementById('eff_isen_m1').value = 70; document.getElementById('pr_design_m1').value = 3.0; }
            if(aiSel.value === 'piston') { document.getElementById('eff_isen_m1').value = 75; document.getElementById('pr_design_m1').value = 3.5; }
            if(aiSel.value === 'screw') { document.getElementById('eff_isen_m1').value = 78; document.getElementById('pr_design_m1').value = 3.0; }
        });
        calcFormM1.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1(CP); });
        fluidSelectM1.addEventListener('change', () => updateFluidInfo(fluidSelectM1, document.getElementById('fluid-info-m1'), CP));
    }

    if (calcFormM1_CO2) {
        const aiCo2 = document.getElementById('ai_eff_m1_co2');
        aiCo2.addEventListener('change', () => {
            const isen = document.getElementById('eff_isen_peak_m1_co2');
            const cl = document.getElementById('clearance_m1_co2');
            const pr = document.getElementById('pr_design_m1_co2');
            if (aiCo2.value === 'co2_rotary') { isen.value = 0.68; cl.value = 0.04; pr.value = 3.2; }
            if (aiCo2.value === 'co2_piston') { isen.value = 0.72; cl.value = 0.06; pr.value = 3.5; }
        });
        btnOptP.addEventListener('click', () => {
            const t = parseFloat(document.getElementById('T_gc_out_m1_co2').value);
            if (!isNaN(t)) {
                const p_opt = 2.75 * t - 6.5;
                document.getElementById('p_high_m1_co2').value = Math.max(75, p_opt.toFixed(1)); 
            }
        });
        const radios = document.querySelectorAll(`input[name="flow_mode_m1_co2"]`);
        radios.forEach(r => r.addEventListener('change', () => {
             const val = document.querySelector(`input[name="flow_mode_m1_co2"]:checked`).value;
             document.getElementById('flow-inputs-rpm-m1_co2').style.display = (val === 'rpm') ? 'grid' : 'none';
             document.getElementById('flow-inputs-mass-m1_co2').style.display = (val === 'mass') ? 'block' : 'none';
             document.getElementById('flow-inputs-vol-m1_co2').style.display = (val === 'vol') ? 'block' : 'none';
        }));
        calcFormM1_CO2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode1_CO2(CP); });
    }

    // Mode 2
    calcButtonM2 = document.getElementById('calc-button-2');
    resultsDivM2 = document.getElementById('results-2');
    calcFormM2 = document.getElementById('calc-form-2');
    printButtonM2 = document.getElementById('print-button-2');
    exportButtonM2 = document.getElementById('export-button-2');
    chartDivM2 = document.getElementById('chart-m2');
    
    if (printButtonM2) {
        printButtonM2.onclick = () => {
            if (lastMode2Data) {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Gas Report</title></head><body style="margin:0">${generateDatasheetHTML(lastMode2Data, "GAS COMPRESSOR REPORT 气体压缩报告")}</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 200);
            }
        };
    }
    if (exportButtonM2) {
        exportButtonM2.onclick = () => { if(lastMode2Data) exportToExcel(lastMode2Data, "Gas_Compressor_Result"); };
    }
    if (calcFormM2) {
        calcFormM2.addEventListener('submit', (e) => { e.preventDefault(); calculateMode2(CP); });
        const fluidSelectM2 = document.getElementById('fluid_m2');
        fluidSelectM2.addEventListener('change', () => updateFluidInfo(fluidSelectM2, document.getElementById('fluid-info-m2'), CP));
    }
}