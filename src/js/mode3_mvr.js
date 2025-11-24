// =====================================================================
// mode3_mvr.js: 模式四 (MVR 容积式 - 罗茨/螺杆)
// 版本: v8.3 (集成状态点表格)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';
import { drawPhDiagram, exportToExcel } from './utils.js';

let calcButtonM4, resultsDivM4, calcFormM4, printButtonM4, exportButtonM4, chartDivM4, fluidSelectM4;
let lastMode4Data = null;

// --- Helper: MVR Datasheet ---
function generateMVRDatasheet(d) {
    const themeColor = "#7e22ce"; 
    const bgColor = "#faf5ff";
    const borderColor = "#e9d5ff";

    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">MVR DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Mechanical Vapor Recompression (Volumetric) 机械蒸汽再压缩</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Fluid (工质): <strong>${d.fluid}</strong>
            </div>
        </div>

        <!-- KPI -->
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Injection Water 喷水量</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${(d.m_water * 3600).toFixed(1)} <span style="font-size:14px">kg/h</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Shaft Power 轴功率</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">COP 性能系数</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.cop.toFixed(2)}</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                 <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #faf5ff; padding-top:5px; padding-bottom:5px;">Process Parameters 工艺参数</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Pressure 吸气压力</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Temp 吸气温度</td><td style="text-align: right; font-weight: 600;">${d.t_in.toFixed(1)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure 排气压力</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Sat. Temp Rise 饱和温升</td><td style="text-align: right; font-weight: 600;">${d.dt.toFixed(1)} K</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Sat. Temp Out 出口饱和温度</td><td style="text-align: right; font-weight: 600;">${d.t_sat_out.toFixed(1)} °C</td></tr>
                     <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Temp (Est.) 排气温度</td><td style="text-align: right; font-weight: 600;">${d.t_out_est.toFixed(1)} °C</td></tr>
                </table>
            </div>
            <div>
                 <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #faf5ff; padding-top:5px; padding-bottom:5px;">Machine Data 机器数据</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Operating Speed 转速</td><td style="text-align: right; font-weight: 600;">${d.rpm ? d.rpm + ' RPM' : '-'}</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Volume Flow 吸气流量</td><td style="text-align: right; font-weight: 600;">${(d.v_flow_in * 3600).toFixed(1)} m³/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Evaporation Mass Flow 蒸发量</td><td style="text-align: right; font-weight: 600;">${(d.m_flow * 3600).toFixed(1)} kg/h</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Isentropic Eff. 等熵效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_is*100).toFixed(1)} %</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Volumetric Eff. 容积效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_vol*100).toFixed(1)} %</td></tr>
                </table>
            </div>
        </div>

        <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; font-size: 11px; color: #6b7280;">
            <div style="margin-bottom: 5px; font-weight: bold; color: #374151; font-size: 12px;">
                Prepared by Yanrong Jing (荆炎荣)
            </div>
            <div style="margin-bottom: 8px;">
                Oil-Free Compressor Calculator Pro v8.3
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

// --- Helper: 获取流量 ---
function getFlowRate(formData, density_in) {
    const mode = formData.get('flow_mode_m4');
    let m_flow = 0; 
    let v_flow_in = 0; 
    let rpm = 0;

    if (mode === 'rpm') {
        rpm = parseFloat(formData.get('rpm_m4'));
        const disp = parseFloat(formData.get('vol_disp_m4')) / 1e6; 
        const vol_eff = parseFloat(formData.get('vol_eff_m4')) / 100.0;
        v_flow_in = (rpm / 60.0) * disp * vol_eff;
        m_flow = v_flow_in * density_in;
    } else if (mode === 'mass') {
        m_flow = parseFloat(formData.get('mass_flow_m4')) / 3600.0;
        v_flow_in = m_flow / density_in;
    } else if (mode === 'vol') {
        v_flow_in = parseFloat(formData.get('vol_flow_m4')) / 3600.0;
        m_flow = v_flow_in * density_in;
    }
    return { m_flow, v_flow_in, rpm };
}

// --- AI 推荐 ---
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
            const t_sat_in = CP.PropsSI('T', 'P', p_in, 'Q', 1, fluid);
            const t_sat_out = t_sat_in + dt;
            const p_out = CP.PropsSI('P', 'T', t_sat_out, 'Q', 1, fluid);
            
            // Point 1: 吸气
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);

            // 2. 流量计算
            const { m_flow, v_flow_in, rpm } = getFlowRate(formData, d_in);

            // 3. 压缩功 (Point 2: Dry)
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_real = (h_out_is - h_in) / eff_is;
            const h_out_dry = h_in + w_real;
            
            // [新增] 计算干排气点的 T 和 S (用于表格)
            const t_out_dry = CP.PropsSI('T', 'P', p_out, 'H', h_out_dry, fluid);
            const s_out_dry = CP.PropsSI('S', 'P', p_out, 'H', h_out_dry, fluid);
            
            const power = w_real * m_flow / 1000.0;

            // 4. COP 计算
            const h_gas_sat = CP.PropsSI('H', 'P', p_in, 'Q', 1, fluid);
            const h_liq_sat = CP.PropsSI('H', 'P', p_in, 'Q', 0, fluid);
            const latent_heat = h_gas_sat - h_liq_sat; 
            const q_latent = m_flow * latent_heat / 1000.0; 
            const cop = q_latent / power;

            // 5. 喷水计算
            const h_sat_vap_out = CP.PropsSI('H', 'P', p_out, 'Q', 1, fluid);
            const h_water = CP.PropsSI('H', 'T', t_water + 273.15, 'P', p_out, 'Water');
            
            let m_water = 0;
            let t_out_est = t_out_dry - 273.15;

            // 构造状态点数组
            const points = [
                { name: '1', desc: 'Suction (吸气)', p: p_in, t: t_in_k, h: h_in, s: s_in },
                { name: '2', desc: 'Discharge Dry (干排气)', p: p_out, t: t_out_dry, h: h_out_dry, s: s_out_dry }
            ];

            if (h_out_dry > h_sat_vap_out) {
                // 需要喷水
                m_water = m_flow * (h_out_dry - h_sat_vap_out) / (h_sat_vap_out - h_water);
                t_out_est = t_sat_out - 273.15;
                
                // Point 3: 喷水后饱和态
                const t_mix = t_sat_out;
                const h_mix = h_sat_vap_out;
                const s_mix = CP.PropsSI('S', 'P', p_out, 'Q', 1, fluid);
                points.push({ name: '3', desc: 'After Injection (喷水后)', p: p_out, t: t_mix, h: h_mix, s: s_mix });
            }

            lastMode4Data = {
                date: new Date().toLocaleDateString(),
                fluid, p_in: p_in_bar, t_in, dt, rpm, eff_is, eff_vol,
                p_out: p_out/1e5, t_sat_out: t_sat_out - 273.15, t_out_est,
                power, m_water, m_flow, v_flow_in, cop
            };

            resultsDivM4.innerHTML = generateMVRDatasheet(lastMode4Data);
            
            // [新增] 绘制图表 + 表格
            chartDivM4.classList.remove('hidden');
            const cycleData = { points: points };
            drawPhDiagram(CP, fluid, cycleData, 'chart-m4');

            calcButtonM4.textContent = "计算喷水量";
            calcButtonM4.disabled = false;
            printButtonM4.disabled = false;
            exportButtonM4.disabled = false;
            
            printButtonM4.onclick = () => {
                 const win = window.open('', '_blank');
                 win.document.write(`<html><head><title>MVR Report</title></head><body>${generateMVRDatasheet(lastMode4Data)}</body></html>`);
                 win.document.close();
                 setTimeout(() => win.print(), 200);
            };
            exportButtonM4.onclick = () => exportToExcel(lastMode4Data, "MVR_Volumetric_Calc");

        } catch (err) {
            resultsDivM4.textContent = "计算错误: " + err.message;
            calcButtonM4.textContent = "计算失败";
            calcButtonM4.disabled = false;
        }
    }, 10);
}

export function initMode4(CP) {
    calcButtonM4 = document.getElementById('calc-button-4');
    resultsDivM4 = document.getElementById('results-4');
    calcFormM4 = document.getElementById('calc-form-4');
    printButtonM4 = document.getElementById('print-button-4');
    exportButtonM4 = document.getElementById('export-button-4');
    chartDivM4 = document.getElementById('chart-m4');
    fluidSelectM4 = document.getElementById('fluid_m4');
    
    if (calcFormM4) {
        setupAiEff();
        calcFormM4.addEventListener('submit', (e) => { e.preventDefault(); calculateMode4(CP); });
        fluidSelectM4.addEventListener('change', () => updateFluidInfo(fluidSelectM4, document.getElementById('fluid-info-m4'), CP));
    }
}