// =====================================================================
// coolprop_loader.js: CoolProp 物性库加载器 (Updated)
// =====================================================================

import Module from './libs/coolprop.js';

export async function loadCoolProp() {
    try {
        const moduleConfig = {
            locateFile: (path, prefix) => {
                if (path.endsWith('.wasm')) {
                    return 'coolprop.wasm';
                }
                return prefix + path;
            }
        };
        const CP = await Module(moduleConfig);
        return CP;
    } catch (err) {
        console.error("CoolProp WASM 加载失败:", err);
        throw new Error(`CoolProp.js 或 CoolProp.wasm 加载失败。请确保它们位于根目录。 (${err.message})`);
    }
}

// 补充了 R507A 的数据
const fluidInfoData = {
    'R134a':        { gwp: 1430, odp: 0,    safety: 'A1' },
    'R245fa':       { gwp: 1030, odp: 0,    safety: 'B1' },
    'R1233zd(E)':   { gwp: 1,    odp: 0,    safety: 'A1' },
    'R1234ze(Z)':   { gwp: '<1', odp: 0,    safety: 'A2L' },
    'R123':         { gwp: 77,   odp: 0.012, safety: 'B1' },
    'R22':          { gwp: 1810, odp: 0.034, safety: 'A1' },
    'R410A':        { gwp: 2088, odp: 0,    safety: 'A1' },
    'R32':          { gwp: 675,  odp: 0,    safety: 'A2L' },
    'R290':         { gwp: 3,    odp: 0,    safety: 'A3' },
    'R717':         { gwp: 0,    odp: 0,    safety: 'B2L' },
    'R515B':        { gwp: 293,  odp: 0,    safety: 'A1' },
    'R142b':        { gwp: 2310, odp: 0.043, safety: 'A2' },
    'R1336mzz(Z)':  { gwp: 2,    odp: 0,    safety: 'A1' },
    'R744':         { gwp: 1,    odp: 0,    safety: 'A1' },
    'R600a':        { gwp: 3,    odp: 0,    safety: 'A3' },
    'R152a':        { gwp: 124,  odp: 0,    safety: 'A2' },
    'R454B':        { gwp: 466,  odp: 0,    safety: 'A2L' },
    'R513A':        { gwp: 631,  odp: 0,    safety: 'A1' },
    'R236fa':       { gwp: 9810, odp: 0,    safety: 'A1' },
    'R23':          { gwp: 14800, odp: 0,   safety: 'A1' },
    'R1234yf':      { gwp: '<1', odp: 0,    safety: 'A2L' },
    'R1270':        { gwp: 2,    odp: 0,    safety: 'A3' }, 
    'R1150':        { gwp: 2,    odp: 0,    safety: 'A3' },
    // 气体
    'Air':          { gwp: 0,    odp: 0,    safety: 'A1' },
    'Nitrogen':     { gwp: 0,    odp: 0,    safety: 'A1' },
    'Helium':       { gwp: 0,    odp: 0,    safety: 'A1' },
    'Neon':         { gwp: 0,    odp: 0,    safety: 'A1' },
    'Argon':        { gwp: 0,    odp: 0,    safety: 'A1' },
    'Hydrogen':     { gwp: 0,    odp: 0,    safety: 'A3' },
    'Oxygen':       { gwp: 0,    odp: 0,    safety: 'A1 (Oxidizer)' },
    'Methane':      { gwp: 25,   odp: 0,    safety: 'A3' },
    // 新增
    'R507A':        { gwp: 3985, odp: 0,    safety: 'A1' },
    'Water':        { gwp: 0,    odp: 0,    safety: 'A1' },
    'default':      { gwp: 'N/A', odp: 'N/A', safety: 'N/A' }
};

export function updateFluidInfo(selectElement, infoElement, CP) {
    if (!CP) {
        infoElement.textContent = "--- 物性库尚未加载 ---";
        return;
    }
    
    const fluid = selectElement.value;
    const info = fluidInfoData[fluid] || fluidInfoData['default'];
    
    if (!info) {
        infoElement.textContent = `--- 未找到工质 ${fluid} 的 GWP/ODP 信息。 ---`;
        return;
    }
    
    try {
        if (fluid === 'Water' && (selectElement.id === 'fluid_m4' || selectElement.id === 'fluid_m5')) {
            infoElement.innerHTML = `
<b>IAPWS-IF97 (Water)</b>
----------------------------------------
GWP: 0, ODP: 0, Safety: A1
MVR 模式推荐使用水工质。
----------------------------------------
临界温度 (Tc): 647.096 K (373.946 °C)
临界压力 (Pc): 220.64 bar
标准沸点 (Tb): 373.124 K (99.974 °C)
            `.trim();
            return;
        }

        const Tcrit_K = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
        const Pcrit_Pa = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
        const Tboil_K = CP.PropsSI('T', 'P', 101325, 'Q', 0, fluid);
        
        infoElement.innerHTML = `
<b>${fluid} 关键参数:</b>
----------------------------------------
GWP (AR4/AR5): ${info.gwp}
ODP:           ${info.odp}
安全级别:      ${info.safety}
----------------------------------------
临界温度 (Tc): ${Tcrit_K.toFixed(2)} K (${(Tcrit_K - 273.15).toFixed(2)} °C)
临界压力 (Pc): ${(Pcrit_Pa / 1e5).toFixed(2)} bar
标准沸点 (Tb): ${Tboil_K.toFixed(2)} K (${(Tboil_K - 273.15).toFixed(2)} °C)
        `.trim();
        
    } catch (err) {
        console.error(`Update Fluid Info Failed for ${fluid}:`, err);
        if (err.message.includes("sublimation") && fluid === 'R744') {
             const Tcrit_K = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
             const Pcrit_Pa = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
             
             infoElement.innerHTML = `
<b>${fluid} 关键参数:</b>
----------------------------------------
GWP (AR4/AR5): ${info.gwp}
ODP:           ${info.odp}
安全级别:      ${info.safety}
----------------------------------------
临界温度 (Tc): ${Tcrit_K.toFixed(2)} K (${(Tcrit_K - 273.15).toFixed(2)} °C)
临界压力 (Pc): ${(Pcrit_Pa / 1e5).toFixed(2)} bar
标准沸点 (Tb): N/A (在1atm下升华)
            `.trim();
        } else {
            infoElement.textContent = `--- 无法加载 ${fluid} 的物性。 ---\n${err.message}`;
        }
    }
}