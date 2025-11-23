// =====================================================================
// coolprop_loader.js: CoolProp 物性库加载器
// =====================================================================

// [修改点 1] 路径更新：指向 libs 文件夹
import Module from './libs/coolprop.js';

// 1. 异步加载函数
/**
 * 异步加载 CoolProp WASM 模块.
 * @returns {Promise<object>} 返回 CoolProp (CP) 实例.
 */
export async function loadCoolProp() {
    try {
        const moduleConfig = {
            locateFile: (path, prefix) => {
                if (path.endsWith('.wasm')) {
                    // [修改点 2] 路径更新：告诉浏览器 .wasm 文件在网站根目录
                    // (因为我们把它放在了 public 文件夹里)
                    return '/coolprop.wasm';
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

// 2. 公共的流体信息更新函数 (保持原样)
// [注意：请确保你保留了原文件下方的 fluidInfoData 对象和 updateFluidInfo 函数]
// 如果你担心粘贴出错，只需把上面 import 和 loadCoolProp 函数这部分替换掉即可，
// 下面的 updateFluidInfo 和 fluidInfoData 不需要改动。

// --- 为了方便，你可以直接复制下面这部分覆盖整个文件，包含了所有内容 ---

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
    'Air':          { gwp: 0,    odp: 0,    safety: 'A1' },
    'Nitrogen':     { gwp: 0,    odp: 0,    safety: 'A1' },
    'Helium':       { gwp: 0,    odp: 0,    safety: 'A1' },
    'Neon':         { gwp: 0,    odp: 0,    safety: 'A1' },
    'Argon':        { gwp: 0,    odp: 0,    safety: 'A1' },
    'Water':        { gwp: 0,    odp: 0,    safety: 'A1' },
    'Hydrogen':     { gwp: 0,    odp: 0,    safety: 'A3' },
    'Oxygen':       { gwp: 0,    odp: 0,    safety: 'A1 (Oxidizer)' },
    'Methane':      { gwp: 25,   odp: 0,    safety: 'A3' },
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
安全级别:      ${info.safety} (毒性[A/B] / 可燃性[1/2L/2/3])
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