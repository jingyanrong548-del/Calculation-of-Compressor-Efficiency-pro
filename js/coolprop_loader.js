// =====================================================================
// coolprop_loader.js: CoolProp 物性库加载器
// 版本: v3.0
// 职责: 1. 异步加载 CoolProp WASM 模块
//        2. 提供一个公共的 updateFluidInfo 函数
// =====================================================================

// 导入 CoolProp JS 包装器
// **重要:** 路径 './coolprop.js' 是相对于 index.html 的
import Module from '../coolprop.js';

// 1. 异步加载函数
/**
 * 异步加载 CoolProp WASM 模块.
 * @returns {Promise<object>} 返回 CoolProp (CP) 实例.
 */
export async function loadCoolProp() {
    try {
        const CP = await Module();
        return CP;
    } catch (err) {
        console.error("CoolProp WASM 加载失败:", err);
        // 将错误抛出，由 main.js 捕获
        throw new Error(`CoolProp.js 或 CoolProp.wasm 加载失败。请确保它们与 index.html 在同一目录。 (${err.message})`);
    }
}


// 2. 公共的流体信息更新函数

// 定义流体的静态信息 (GWP, ODP, Safety)
const fluidInfoData = {
    'R134a':        { gwp: 1430, odp: 0,    safety: 'A1' },
    'R245fa':       { gwp: 1030, odp: 0,    safety: 'B1' },
    'R1233zd(E)':   { gwp: 7,    odp: 0,    safety: 'A1' },
    'R1234ze(E)':   { gwp: 1,    odp: 0,    safety: 'A2L' },
    'R123':         { gwp: 77,   odp: 0.02, safety: 'B1' },
    'R22':          { gwp: 1810, odp: 0.055,safety: 'A1' },
    'R410A':        { gwp: 2088, odp: 0,    safety: 'A1' },
    'R32':          { gwp: 675,  odp: 0,    safety: 'A2L' },
    'R290':         { gwp: 3,    odp: 0,    safety: 'A3' },
    'R717':         { gwp: 0,    odp: 0,    safety: 'B2L' },
    'R515B':        { gwp: 299,  odp: 0,    safety: 'A1' },
    'R142b':        { gwp: 1980, odp: 0.057,safety: 'A2' },
    'R1336mzz(Z)':  { gwp: 7,    odp: 0,    safety: 'A1' },
    'R744':         { gwp: 1,    odp: 0,    safety: 'A1' }, // CO2
    'R600a':        { gwp: 3,    odp: 0,    safety: 'A3' }, // Isobutane
    'R152a':        { gwp: 138,  odp: 0,    safety: 'A2' },
    'R454B':        { gwp: 466,  odp: 0,    safety: 'A2L' },
    'R513A':        { gwp: 631,  odp: 0,    safety: 'A1' },
    'Water':        { gwp: 0,    odp: 0,    safety: 'A1' }  // IAPWS-IF97
};

/**
 * 更新界面上的流体信息 <pre> 标签.
 * @param {HTMLSelectElement} selectElement - 触发事件的 <select> 元素.
 * @param {HTMLPreElement} infoElement - 用于显示信息的 <pre> 元素.
 * @param {object} CP - 已加载的 CoolProp 实例.
 */
export function updateFluidInfo(selectElement, infoElement, CP) {
    if (!CP) {
        infoElement.textContent = "物性库实例未加载。";
        return;
    }
    
    const fluid = selectElement.value;
    const info = fluidInfoData[fluid];
    
    if (!info) {
        infoElement.textContent = `未找到 ${fluid} 的 GWP/ODP/安全信息。`;
        return;
    }

    try {
        // 特殊处理 R744 (CO2) 和 Water (IAPWS-IF97)
        if (fluid === 'R744' || fluid === 'Water') {
            const Tcrit_K = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
            const Pcrit_Pa = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
            const name = (fluid === 'R744') ? 'CO2' : 'Water';
            let warning = (fluid === 'R744') ? "(警告: R744 常用于跨临界循环)" : "(基于 IAPWS-IF97 标准)";
            
            infoElement.innerHTML = `
<b>${fluid} (${name}) 关键参数:</b>
----------------------------------------
GWP (AR4/AR5): ${info.gwp}
ODP:           ${info.odp}
安全级别:      ${info.safety}
----------------------------------------
临界温度 (Tc): ${Tcrit_K.toFixed(2)} K (${(Tcrit_K - 273.15).toFixed(2)} °C)
临界压力 (Pc): ${(Pcrit_Pa / 1e5).toFixed(2)} bar
(注意: 沸点为升华点或标准沸点)
${warning}
            `.trim();
            return;
        }

        // 处理其他制冷剂
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
        // 捕捉 R744 可能的二次失败 (例如 "sublimation")
        if (err.message.includes("sublimation") && fluid === 'R744') {
             const Tcrit_K = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
             const Pcrit_Pa = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
             infoElement.innerHTML = `
<b>${fluid} (CO2) 关键参数:</b>
----------------------------------------
GWP (AR4/AR5): ${info.gwp}
ODP:           ${info.odp}
安全级别:      ${info.safety}
--------------------------------E:--------
临界温度 (Tc): ${Tcrit_K.toFixed(2)} K (${(Tcrit_K - 273.15).toFixed(2)} °C)
临界压力 (Pc): ${(Pcrit_Pa / 1e5).toFixed(2)} bar
(注意: 1 atm 下为升华点, 非沸点)
(警告: R744 常用于跨临界循环)
            `.trim();
        } else {
            infoElement.textContent = `获取 ${fluid} 热力学参数失败: ${err.message}`;
        }
    }
}