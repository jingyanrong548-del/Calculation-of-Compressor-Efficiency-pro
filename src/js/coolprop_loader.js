// =====================================================================
// coolprop_loader.js: 动态修补版加载器 & 工质数据库 (v8.39 Extended DB)
// =====================================================================

// 1. 标准 Import (配合 vite.config.js 插件使用)
import Module from './libs/coolprop.js';

export async function loadCoolProp() {
    console.log("正在初始化 CoolProp (ESM Mode)...");

    try {
        const moduleConfig = {
            // 2. 关键修复：动态定位 WASM 文件
            locateFile: (path, prefix) => {
                if (path.endsWith('.wasm')) {
                    const baseUrl = import.meta.env.BASE_URL;
                    // 拼接完整路径 (防止双斜杠 //)
                    const wasmPath = `${baseUrl}coolprop.wasm`.replace('//', '/');
                    console.log(`[WASM Path] Loading from: ${wasmPath}`);
                    return wasmPath;
                }
                return prefix + path;
            }
        };

        // 3. 初始化模块
        const CP = await Module(moduleConfig);
        console.log("CoolProp WASM 初始化成功!");
        return CP;

    } catch (err) {
        console.error("CoolProp 初始化崩溃:", err);
        const basePath = import.meta.env.BASE_URL;
        throw new Error(`WASM 加载失败。尝试访问路径: ${basePath}coolprop.wasm。请检查网络面板 (F12 -> Network)。`);
    }
}

// =====================================================================
// 4. 扩展工质数据库 (Extended Fluid Database v8.39)
// =====================================================================

const fluidInfoData = {
    // --- Standard Refrigerants (-40°C ~ +60°C) ---
    'R134a':        { gwp: 1430, odp: 0,    safety: 'A1' },
    'R410A':        { gwp: 2088, odp: 0,    safety: 'A1' },
    'R32':          { gwp: 675,  odp: 0,    safety: 'A2L' },
    'R404A':        { gwp: 3922, odp: 0,    safety: 'A1' },
    'R507A':        { gwp: 3985, odp: 0,    safety: 'A1' },
    'R407C':        { gwp: 1774, odp: 0,    safety: 'A1' },
    'R22':          { gwp: 1810, odp: 0.055, safety: 'A1 (HCFC)' },
    'R1234yf':      { gwp: '<1', odp: 0,    safety: 'A2L' },
    'R1234ze(E)':   { gwp: '<1', odp: 0,    safety: 'A2L' }, // Usually just R1234ze
    'R290':         { gwp: 3,    odp: 0,    safety: 'A3 (Propane)' },
    'R600a':        { gwp: 3,    odp: 0,    safety: 'A3 (Isobutane)' },
    'R1270':        { gwp: 2,    odp: 0,    safety: 'A3 (Propylene)' },
    'R717':         { gwp: 0,    odp: 0,    safety: 'B2L (Ammonia)' },
    'R744':         { gwp: 1,    odp: 0,    safety: 'A1 (CO2)' },
    
    // --- Legacy (Phased Out) ---
    'R12':          { gwp: 10900, odp: 1.0, safety: 'A1 (CFC)' },
    'R502':         { gwp: 4657,  odp: 0.33, safety: 'A1 (CFC)' },

    // --- High Temp Heat Pump (+60°C ~ +160°C+) ---
    'R245fa':       { gwp: 1030, odp: 0,    safety: 'B1' },
    'R1233zd(E)':   { gwp: 1,    odp: 0.0003, safety: 'A1' },
    'R1336mzz(Z)':  { gwp: 2,    odp: 0,    safety: 'A1 (High Temp)' },
    'R1234ze(Z)':   { gwp: '<1', odp: 0,    safety: 'A2L (High Temp)' },
    'Cyclopentane': { gwp: 11,   odp: 0,    safety: 'A3' },
    'Butane':       { gwp: 4,    odp: 0,    safety: 'A3 (R600)' }, // Corrected mapping for R600
    'Pentane':      { gwp: 5,    odp: 0,    safety: 'A3 (R601)' },
    'Water':        { gwp: 0,    odp: 0,    safety: 'A1 (R718)' },

    // --- Deep Freeze (-100°C ~ -40°C) ---
    'R23':          { gwp: 14800, odp: 0,   safety: 'A1' },
    'R508B':        { gwp: 13396, odp: 0,   safety: 'A1' },
    'R14':          { gwp: 7390,  odp: 0,   safety: 'A1 (CF4)' },
    'Ethane':       { gwp: 6,     odp: 0,   safety: 'A3 (R170)' },
    'Ethylene':     { gwp: 4,     odp: 0,   safety: 'A3 (R1150)' },

    // --- Industrial Gases ---
    'Air':          { gwp: 0,    odp: 0,    safety: 'A1' },
    'Nitrogen':     { gwp: 0,    odp: 0,    safety: 'A1' },
    'Oxygen':       { gwp: 0,    odp: 0,    safety: 'A1 (Oxidizer)' },
    'Argon':        { gwp: 0,    odp: 0,    safety: 'A1' },
    'Helium':       { gwp: 0,    odp: 0,    safety: 'A1' },
    'Hydrogen':     { gwp: 5.8,  odp: 0,    safety: 'A3' }, // Indirect GWP
    'Methane':      { gwp: 29.8, odp: 0,    safety: 'A3 (Natural Gas)' },
    'CarbonMonoxide': { gwp: 1.57, odp: 0,  safety: 'A2 (Toxic)' },
    'CarbonDioxide': { gwp: 1,    odp: 0,   safety: 'A1' }, // Gas phase use

    // --- Specialty Gases ---
    'Neon':         { gwp: 0,    odp: 0,    safety: 'A1' },
    'Krypton':      { gwp: 0,    odp: 0,    safety: 'A1' },
    'Xenon':        { gwp: 0,    odp: 0,    safety: 'A1' },
    'SulfurHexafluoride': { gwp: 22800, odp: 0, safety: 'A1 (SF6)' },

    // Fallback
    'default':      { gwp: 'N/A', odp: 'N/A', safety: 'N/A' }
};

export function updateFluidInfo(selectElement, infoElement, CP) {
    if (!CP) {
        if(infoElement) infoElement.textContent = "--- 物性库尚未加载 ---";
        return;
    }
    
    const fluid = selectElement.value;
    // Handle alias or direct lookup
    const info = fluidInfoData[fluid] || fluidInfoData['default'];
    
    // Visual feedback if info missing but fluid valid
    const gwpStr = info.gwp !== 'N/A' ? `GWP: ${info.gwp}` : 'GWP: Unknown';
    const safetyStr = info.safety !== 'N/A' ? `Safety: ${info.safety}` : '';
    
    try {
        // Special handling for Water in MVR context
        if (fluid === 'Water' && (selectElement.id === 'fluid_m4' || selectElement.id === 'fluid_m5')) {
            infoElement.innerHTML = `
<b>IAPWS-IF97 (Water/Steam)</b>
----------------------------------------
${gwpStr}, ${safetyStr}
MVR 模式推荐使用水工质 (Steam)。
----------------------------------------
临界参数: 373.95°C / 220.64 bar
标准沸点: 99.97°C
            `.trim();
            return;
        }

        const Tcrit_K = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
        const Pcrit_Pa = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
        
        // Try to get Boiling Point (1 atm)
        let Tboil_str = "N/A";
        try {
            const Tboil_K = CP.PropsSI('T', 'P', 101325, 'Q', 0, fluid);
            Tboil_str = `${(Tboil_K - 273.15).toFixed(2)} °C`;
        } catch(e) {
            // Some fluids don't have liquid phase at 1atm (e.g. CO2)
        }
        
        infoElement.innerHTML = `
<b>${fluid} 物性概览:</b>
----------------------------------------
${gwpStr} | ODP: ${info.odp}
${safetyStr}
----------------------------------------
临界温度 (Tc): ${(Tcrit_K - 273.15).toFixed(2)} °C
临界压力 (Pc): ${(Pcrit_Pa / 1e5).toFixed(2)} bar
标准沸点 (Tb): ${Tboil_str}
        `.trim();
        
    } catch (err) {
        console.warn(`Update Fluid Info Failed for ${fluid}:`, err);
        
        // Special error handling for CO2 sublimation
        if ((err.message && err.message.includes("sublimation")) || fluid === 'R744' || fluid === 'CarbonDioxide') {
             // Hardcoded fallback for CO2 to avoid error display
             const Tc = 30.98;
             const Pc = 73.77;
             infoElement.innerHTML = `
<b>${fluid} (Carbon Dioxide)</b>
----------------------------------------
GWP: 1 | ODP: 0 | Safety: A1
----------------------------------------
临界温度 (Tc): ${Tc.toFixed(2)} °C
临界压力 (Pc): ${Pc.toFixed(2)} bar
标准沸点: N/A (在 1atm 下升华, 三相点 -56.6°C)
            `.trim();
        } else {
            infoElement.textContent = `--- 暂无 ${fluid} 详细物性数据 ---\n(计算仍可正常进行)`;
        }
    }
}