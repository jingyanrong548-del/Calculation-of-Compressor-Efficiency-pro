// =====================================================================
// mode4_turbo.js: 模式五 (MVR 透平式 - 离心机)
// 版本: v8.0 (双语版 & COP计算)
// =====================================================================

import { updateFluidInfo } from './coolprop_loader.js';

let calcButtonM5, resultsDivM5, calcFormM5, printButtonM5, fluidSelectM5;
let lastMode5Data = null;

// --- Helper: MVR 透平 Datasheet 生成器 (Bilingual) ---
function generateTurboDatasheet(d) {
    // 样式配色 (Teal Theme)
    const themeColor = "#0f766e"; 
    const bgColor = "#f0fdfa";
    const borderColor = "#ccfbf1";

    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <!-- Header -->
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">MVR TURBO DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Centrifugal Compressor Simulation 离心式蒸汽压缩机</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Fluid (工质): <strong>${d.fluid}</strong>
            </div>
        </div>
        
        <!-- KPI Dashboard -->
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; margin-bottom: 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Evaporation 蒸发量</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${(d.m_flow * 3600).toFixed(1)} <span style="font-size:14px">kg/h</span></div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Impeller Power 叶轮功率</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.power.toFixed(2)} <span style="font-size:14px">kW</span></div>
            </div>
             <div style="text-align: center;">
                <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">COP 性能系数</div>
                <div style="font-size: 24px; font-weight: 800; color: ${themeColor};">${d.cop.toFixed(2)}</div>
            </div>
        </div>
        
        <!-- Data Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <!-- Left Column -->
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Suction Conditions 吸气工况</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Pressure 吸气压力</td><td style="text-align: right; font-weight: 600;">${d.p_in.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Temp 吸气温度</td><td style="text-align: right; font-weight: 600;">${d.t_in.toFixed(1)} °C</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Suction Volume Flow 吸气流量</td><td style="text-align: right; font-weight: 600;">${(d.v_flow_in * 3600).toFixed(1)} m³/h</td></tr>
                </table>

                <div style="font-size: 14px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Efficiency Settings 效率设定</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Polytropic Eff. 多变效率</td><td style="text-align: right; font-weight: 600;">${(d.eff_poly * 100).toFixed(1)} %</td></tr>
                </table>
            </div>

            <!-- Right Column -->
            <div>
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #f9fafb; padding-top:5px; padding-bottom:5px;">Discharge & System 排气与系统</div>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Temp Lift (Sat) 饱和温升</td><td style="text-align: right; font-weight: 600;">${d.dt.toFixed(1)} K</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure 排气压力</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Temp (Est.) 排气温度</td><td style="text-align: right; font-weight: 600;">${d.t_out.toFixed(1)} °C</td></tr>
                    ${d.m_water > 0 ? `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; font-weight:600; color:${themeColor};">Injection Water 喷水量</td><td style="text-align: right; color:${themeColor}; font-weight: 600;">${(d.m_water * 3600).toFixed(1)} kg/h</td></tr>` : ''}
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

// --- Helper: 获取流量 ---
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

// --- AI 推荐 ---
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

// --- 计算核心 ---
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

            const p_in = p_in_bar * 1e5;
            const t_in_k = t_in + 273.15;
            
            // 1. 压力计算
            const t_sat_in = CP.PropsSI('T', 'P', p_in, 'Q', 1, fluid);
            const t_sat_out = t_sat_in + dt;
            const p_out = CP.PropsSI('P', 'T', t_sat_out, 'Q', 1, fluid);

            // 2. 状态点
            const h_in = CP.PropsSI('H', 'P', p_in, 'T', t_in_k, fluid);
            const d_in = CP.PropsSI('D', 'P', p_in, 'T', t_in_k, fluid);
            const s_in = CP.PropsSI('S', 'P', p_in, 'T', t_in_k, fluid);
            
            // 3. 流量
            const { m_flow, v_flow_in } = getFlowRate(formData, d_in);

            // 4. 压缩功 (Polytropic Approximation)
            // W_poly = (n/n-1) * P1V1 * [(P2/P1)^((n-1)/n) - 1]
            // 这里使用简化等熵功折算：W_shaft = (H_isen_out - H_in) / Eff_poly
            // 注意：这在工业上常用于估算离心机轴功率
            const h_out_is = CP.PropsSI('H', 'P', p_out, 'S', s_in, fluid);
            const w_poly_approx = (h_out_is - h_in); 
            const w_real = w_poly_approx / eff_poly; 
            const h_out_dry = h_in + w_real;
            
            const power = w_real * m_flow / 1000.0;
            
            // 5. COP 计算 (新增)
            const h_gas_sat = CP.PropsSI('H', 'P', p_in, 'Q', 1, fluid);
            const h_liq_sat = CP.PropsSI('H', 'P', p_in, 'Q', 0, fluid);
            const latent_heat = h_gas_sat - h_liq_sat; 
            const q_latent = m_flow * latent_heat / 1000.0; // kW
            const cop = q_latent / power;

            // 6. 喷水
            const h_sat_vap_out = CP.PropsSI('H', 'P', p_out, 'Q', 1, fluid);
            const h_water = CP.PropsSI('H', 'T', t_water + 273.15, 'P', p_out, 'Water');
            let m_water = 0;
            let t_out_calc = CP.PropsSI('T', 'P', p_out, 'H', h_out_dry, fluid) - 273.15;

            if (h_out_dry > h_sat_vap_out) {
                m_water = m_flow * (h_out_dry - h_sat_vap_out) / (h_sat_vap_out - h_water);
                // 喷水后温度即为饱和温度
                t_out_calc = t_sat_out - 273.15;
            }

            lastMode5Data = {
                date: new Date().toLocaleDateString(),
                fluid, p_in: p_in_bar, t_in, m_flow, v_flow_in, dt, eff_poly,
                p_out: p_out/1e5, power, m_water, cop,
                t_out: t_out_calc
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