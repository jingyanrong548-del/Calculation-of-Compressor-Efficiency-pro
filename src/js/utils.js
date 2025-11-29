// src/js/utils.js
// V17.0 核心工具函数：数值格式化与物理计算辅助

// ==========================================
// 1. 数值格式化函数 (Formatter)
// ==========================================

/**
 * 将数值格式化为“万元”字符串
 * @param {number|string} val - 原始数值 (元)
 * @param {number} decimals - 小数位数，默认 2
 * @returns {string} - 例如 "120.50" (不带单位)
 */
export function fWan(val, decimals = 2) {
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    // 核心逻辑：输入是元，输出是万
    return (num / 10000).toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * 将数值格式化为“元”字符串 (通常用于单价)
 * @param {number|string} val - 原始数值
 * @param {number} decimals - 小数位数，默认 2
 */
export function fYuan(val, decimals = 2) {
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * 格式化整数 (用于小时数、总热量等)
 */
export function fInt(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return Math.round(num).toLocaleString('zh-CN');
}

/**
 * 通用数字格式化 (保留指定小数位)
 */
export function fNum(val, decimals = 2) {
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * 格式化吨数 (通常保留 1 位小数)
 */
export function fTon(val) {
    return fNum(val, 1);
}

/**
 * 格式化 COP/SPF (保留 2 位小数)
 */
export function fCop(val) {
    return fNum(val, 2);
}

/**
 * 格式化百分比
 * @param {number} val - 小数 (如 0.15)
 * @returns {string} - "15.0%"
 */
export function fPercent(val, decimals = 1) {
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return (num * 100).toFixed(decimals) + '%';
}

/**
 * 格式化年限
 */
export function fYears(val) {
    if (typeof val === 'string' && val.includes('>')) return val; // 处理 "> 15" 这种情况
    const num = parseFloat(val);
    if (isNaN(num)) return '-';
    return num.toFixed(1);
}

// ==========================================
// 2. 物理计算辅助函数 (Physics)
// ==========================================

/**
 * 计算锅炉运行效率
 * @param {string} fuelType - 燃料类型 (gas, fuel, coal, biomass)
 * @param {number} fuelAmount - 燃料消耗量
 * @param {number} calorificValue - 燃料热值 (单位需标准化，此处假设 gas为MJ/m3, 固体液体为MJ/kg)
 * @param {string} outputType - 产出类型 ('water' | 'steam')
 * @param {object} params - 产出参数 { mass, tempIn, tempOut, pressure, feedTemp }
 * @returns {object} { efficiency: number(0-100), inputEnergy: number(GJ), outputEnergy: number(GJ), error: string|null }
 */
export function calculateBoilerEfficiency(fuelType, fuelAmount, calorificValue, outputType, params) {
    // 1. 计算总投入能量 (Input Energy) - 单位转换为 GJ
    // 假设 calorificValue 单位：
    // gas: MJ/m³ -> GJ: value / 1000
    // others: MJ/kg -> GJ: value / 1000
    
    if (!fuelAmount || !calorificValue) {
        return { error: "请输入有效的燃料消耗量和热值" };
    }

    const inputEnergyGJ = (fuelAmount * calorificValue) / 1000;

    // 2. 计算总产出能量 (Output Energy) - 单位转换为 GJ
    let outputEnergyGJ = 0;

    if (outputType === 'water') {
        // 热水: Q = c * m * Δt
        // c ≈ 4.186 kJ/(kg·℃)
        // m: 吨 -> kg (* 1000)
        // Q (kJ) = 4.186 * (mass * 1000) * (tempOut - tempIn)
        // Q (GJ) = Q (kJ) / 1,000,000
        
        const { mass, tempIn, tempOut } = params;
        if (!mass || tempIn === undefined || !tempOut) return { error: "请输入完整的热水参数" };
        
        const deltaT = tempOut - tempIn;
        // 4.186 * mass(t) * deltaT = MJ
        // MJ / 1000 = GJ
        outputEnergyGJ = (4.186 * mass * deltaT) / 1000;
        
    } else if (outputType === 'steam') {
        // 蒸汽: 需查表或估算焓值
        // 简化估算：Q = m * (h_steam - h_feedwater)
        // h_steam (饱和蒸汽) ≈ 2750 - 2800 kJ/kg (取决于压力)
        // h_feedwater ≈ 4.186 * temp
        // 这里使用简化经验公式：1吨饱和蒸汽约含热 2.75 GJ (0.8MPa下) - 补水热焓
        
        const { mass, pressure, feedTemp } = params;
        if (!mass || !pressure || feedTemp === undefined) return { error: "请输入完整的蒸汽参数" };

        // 简易焓值估算 (kJ/kg)
        // 饱和蒸汽焓值 h_g (kJ/kg) 对照 0.8MPa ≈ 2769 kJ/kg
        // 简单线性拟合或取平均值，工业低压蒸汽通常在 0.4-1.0MPa，焓值变化不大 (2738 - 2778)
        const steamEnthalpy = 2770; 
        const waterEnthalpy = 4.186 * feedTemp;
        
        // Q (kJ) = (mass * 1000) * (steamEnthalpy - waterEnthalpy)
        outputEnergyGJ = (mass * (steamEnthalpy - waterEnthalpy)) / 1000000;
    }

    if (inputEnergyGJ <= 0) return { error: "计算得出的投入能量无效" };

    const efficiency = (outputEnergyGJ / inputEnergyGJ) * 100;

    return {
        efficiency,
        inputEnergy: inputEnergyGJ,
        outputEnergy: outputEnergyGJ,
        error: null
    };
}