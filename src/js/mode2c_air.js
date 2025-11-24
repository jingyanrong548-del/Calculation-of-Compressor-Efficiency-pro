// =====================================================================
// mode2c_air.js: 模式三 (空压机) 核心逻辑
// 版本: v8.0 (双语版 & 负荷计算)
// =====================================================================

let calcButtonM3, resultsDivM3, calcFormM3, printButtonM3;
let lastMode3Data = null;

// --- Helper: 生成空压机技术规格书 (Bilingual) ---
function generateAirDatasheet(d) {
    // 样式配色 (Cyan Theme)
    const themeColor = "#0891b2"; 
    const bgColor = "#ecfeff";
    const borderColor = "#cffafe";

    return `
    <div style="padding: 30px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #333; width: 100%; box-sizing: border-box;">
        <!-- Header -->
        <div style="border-bottom: 3px solid ${themeColor}; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <div style="font-size: 28px; font-weight: 900; color: ${themeColor}; line-height: 1;">AIR COMPRESSOR DATASHEET</div>
                <div style="font-size: 14px; color: #666; margin-top: 5px;">Thermodynamic Simulation (Humid Air) 湿空气模拟</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #666; line-height: 1.5;">
                Date: <strong>${d.date}</strong><br>
                Model: <strong>${d.ai_model || 'Custom'}</strong>
            </div>
        </div>
        
        <!-- KPI Dashboard -->
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

        <!-- Data Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <!-- Left Column -->
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

            <!-- Right Column -->
            <div>
                 <div style="font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 5px solid ${themeColor}; padding-left: 10px; background: #ecfeff; padding-top:5px; padding-bottom:5px;">Performance Data 性能数据</div>
                 <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Discharge Pressure 排气压力</td><td style="text-align: right; font-weight: 600;">${d.p_out.toFixed(3)} bar</td></tr>
                    <tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px 0; color: #555;">Pressure Ratio 压比</td><td style="text-align: right; font-weight: 600;">${d.pr.toFixed(2)}</td></tr>
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
function getAirFlowRate(formData, v_specific_in) {
    const mode = formData.get('flow_mode_m3');
    const vol_eff = parseFloat(formData.get('vol_eff_m3') || '100') / 100.0;
    
    let m_da = 0; 
    let v_flow_in = 0; 

    if (mode === 'rpm') {
        const rpm = parseFloat(formData.get('rpm_m3'));
        const disp = parseFloat(formData.get('vol_disp_m3')) / 1e6; // cm3 -> m3
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

// --- AI 推荐 ---
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
        resultsDivM3.textContent = "CoolProp 未加载";
        return;
    }
    calcButtonM3.textContent = "计算中...";
    calcButtonM3.disabled = true;

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

            const p_in_pa = p_in * 1e5;
            const t_in_k = t_in + 273.15;
            const p_out_pa = p_out * 1e5;

            const v_da_in = CP.HAPropsSI('V', 'T', t_in_k, 'P', p_in_pa, 'R', rh_in);
            const h_in = CP.HAPropsSI('H', 'T', t_in_k, 'P', p_in_pa, 'R', rh_in);
            const s_in = CP.HAPropsSI('S', 'T', t_in_k, 'P', p_in_pa, 'R', rh_in);
            const w_in = CP.HAPropsSI('W', 'T', t_in_k, 'P', p_in_pa, 'R', rh_in);

            const { m_da, v_flow_in } = getAirFlowRate(formData, v_da_in);

            const h_out_isen = CP.HAPropsSI('H', 'P', p_out_pa, 'S', s_in, 'W', w_in);
            const work_isen = h_out_isen - h_in; 
            const work_real = work_isen / eff_is; 

            let h_out_real = h_in + work_real; 
            let cooling_desc = "Adiabatic (None)";
            let cooling_detail = "";
            let t_out_k = 0;
            let q_jacket = 0; // 夹套热负荷

            if (cooling_type === 'jacket') {
                const jacket_percent = parseFloat(formData.get('jacket_heat_percent_m3') || 15) / 100.0;
                const q_removed_per_kg = work_real * jacket_percent;
                h_out_real = h_in + work_real - q_removed_per_kg;
                
                t_out_k = CP.HAPropsSI('T', 'P', p_out_pa, 'H', h_out_real, 'W', w_in);
                q_jacket = q_removed_per_kg * m_da / 1000.0; // kW

                cooling_desc = "Jacket Water Cooling 夹套水冷";
                cooling_detail = `Heat Removal: ${q_jacket.toFixed(2)} kW (${(jacket_percent*100).toFixed(0)}%)`;
            
            } else if (cooling_type === 'injection') {
                const t_inject = parseFloat(formData.get('T_inject_m3') || 25);
                const heat_removal_ratio = 0.35; 
                const q_removed_per_kg = work_real * heat_removal_ratio;
                h_out_real = h_in + work_real - q_removed_per_kg;
                t_out_k = CP.HAPropsSI('T', 'P', p_out_pa, 'H', h_out_real, 'W', w_in);

                cooling_desc = "Liquid Injection 喷液冷却";
                cooling_detail = `Injection Temp: ${t_inject.toFixed(1)}°C`;
            
            } else {
                t_out_k = CP.HAPropsSI('T', 'P', p_out_pa, 'H', h_out_real, 'W', w_in);
                cooling_desc = "Adiabatic 绝热压缩";
            }

            // 后冷负荷计算 (Mode 3)
            let q_aftercool = 0;
            if (formData.get('enable_cooler_calc_m3') === 'on') {
                const t_target = parseFloat(formData.get('target_temp_m3')) + 273.15;
                // 估算后冷负荷: H_out_real - H(target, saturated)
                // 注意: HAPropsSI 如果温度低于露点，H 包含冷凝水焓值，这里做简化计算
                const h_target = CP.HAPropsSI('H', 'T', t_target, 'P', p_out_pa, 'R', 1.0);
                q_aftercool = (h_out_real - h_target) * m_da / 1000.0;
            }

            const power_shaft = (work_real * m_da) / 1000.0; 
            const spec_power = power_shaft / (v_flow_in * 60); 

            lastMode3Data = {
                date: new Date().toLocaleDateString(),
                ai_model: document.getElementById('ai_eff_m3').options[document.getElementById('ai_eff_m3').selectedIndex].text.split('(')[0].trim(),
                p_in, t_in, rh_in, w_in,
                p_out, t_out: t_out_k - 273.15,
                m_da, v_flow: v_flow_in,
                eff_is, eff_vol, pr: p_out/p_in,
                power: power_shaft, spec_power,
                cooling_desc, cooling_detail,
                q_jacket, q_aftercool
            };

            resultsDivM3.innerHTML = generateAirDatasheet(lastMode3Data);
            
            calcButtonM3.textContent = "计算空压机";
            calcButtonM3.disabled = false;
            printButtonM3.disabled = false;

            printButtonM3.onclick = () => {
                const win = window.open('', '_blank');
                win.document.write(`<html><head><title>Air Comp Report</title></head><body style="margin:0; background:#fff;">${generateAirDatasheet(lastMode3Data)}</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 200);
            };

        } catch (err) {
            resultsDivM3.textContent = "Error: " + err.message;
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
    
    if (calcFormM3) {
        calcFormM3.addEventListener('submit', (e) => { e.preventDefault(); calculateMode3(CP); });
        setupAiEffRecommendation();
    }
}