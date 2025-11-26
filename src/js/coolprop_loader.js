// =====================================================================
// coolprop_loader.js: 动态修补版加载器 (配合 Vite 插件使用)
// =====================================================================

// 1. 这里直接使用标准 Import
// 注意：虽然物理文件 coolprop.js 没有 export，但 vite.config.js 里的插件
// 会在构建时自动注入 "export default Module;"，所以这里不会报错。
import Module from './libs/coolprop.js';

export async function loadCoolProp() {
    console.log("正在初始化 CoolProp (ESM Mode + Vite Plugin Fix)...");

    try {
        const moduleConfig = {
            // 2. 关键配置：重写 locateFile
            // 官方源码中的 import.meta.url 可能会去 src/js/libs/ 下找 wasm。
            // 我们通过这个钩子，强制浏览器去根目录 public/ 下找 /coolprop.wasm。
            locateFile: (path, prefix) => {
                if (path.endsWith('.wasm')) {
                    return '/coolprop.wasm';
                }
                return prefix + path;
            }
        };

        // 3. 初始化模块
        // Module 是一个函数，调用它会返回一个 Promise，resolve 后得到核心实例 CP
        const CP = await Module(moduleConfig);
        console.log("CoolProp WASM 初始化成功!");
        return CP;

    } catch (err) {
        console.error("CoolProp 初始化崩溃:", err);
        throw new Error(`WASM 加载失败: ${err.message}. (请检查 vite.config.js 是否配置了插件)`);
    }
}

// =====================================================================
// 下方是工质数据与 UI 更新逻辑 (保持完整，未修改)
// =====================================================================

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
        if(infoElement) infoElement.textContent = "--- 物性库尚未加载 ---";
        return;
    }
    
    const fluid = selectElement.value;
    const info = fluidInfoData[fluid] || fluidInfoData['default'];
    
    if (!info) {
        if(infoElement) infoElement.textContent = `--- 未找到工质 ${fluid} 的 GWP/ODP 信息。 ---`;
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
        
        // 部分工质可能没有定义的沸点，加 try-catch 保护
        let Tboil_str = "N/A";
        try {
            const Tboil_K = CP.PropsSI('T', 'P', 101325, 'Q', 0, fluid);
            Tboil_str = `${(Tboil_K - 273.15).toFixed(2)} °C`;
        } catch(e) {}
        
        infoElement.innerHTML = `
<b>${fluid} 关键参数:</b>
----------------------------------------
GWP (AR4/AR5): ${info.gwp}
ODP:           ${info.odp}
安全级别:      ${info.safety}
----------------------------------------
临界温度 (Tc): ${Tcrit_K.toFixed(2)} K (${(Tcrit_K - 273.15).toFixed(2)} °C)
临界压力 (Pc): ${(Pcrit_Pa / 1e5).toFixed(2)} bar
标准沸点 (Tb): ${Tboil_str}
        `.trim();
        
    } catch (err) {
        console.warn(`Update Fluid Info Failed for ${fluid}:`, err);
        infoElement.textContent = `Fluid: ${fluid} (Info N/A)`;
    }
}