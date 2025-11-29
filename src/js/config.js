// src/js/config.js
// V17.0 全局配置、常量定义与默认参数

/**
 * 燃料默认数据 (价格、热值、排放因子)
 * 用于当用户在下拉菜单选择特定燃料类型时自动填充
 */
export const fuelData = {
    diesel: {
        price: 8900,
        calorific: 42.6,
        factor: 3090,
        priceTooltip: '默认值: 8900 元/吨 (0号柴油)',
        calorificTooltip: '默认值: 42.6 MJ/kg',
        factorTooltip: '默认值: 3090 kgCO₂/吨'
    },
    heavy_oil: {
        price: 6500,
        calorific: 41.8,
        factor: 3170,
        priceTooltip: '默认值: 6500 元/吨 (重油)',
        calorificTooltip: '默认值: 41.8 MJ/kg',
        factorTooltip: '默认值: 3170 kgCO₂/吨'
    },
    residual_oil: {
        price: 5500,
        calorific: 40.2,
        factor: 3250,
        priceTooltip: '默认值: 5500 元/吨 (渣油)',
        calorificTooltip: '默认值: 40.2 MJ/kg',
        factorTooltip: '默认值: 3250 kgCO₂/吨'
    }
};

/** 单位换算常量 */
export const MJ_PER_KCAL = 0.004184;
export const KCAL_PER_KWH = 860.42;

/**
 * 单位换算器配置
 * 定义输入框(inputId)与单位下拉框(selectId)之间的换算关系
 */
export const converters = [
    {
        selectId: 'heatingLoadUnit', inputId: 'heatingLoad',
        conversions: { 'kW': 1, 'kcal/h': KCAL_PER_KWH }
    },
    {
        selectId: 'annualHeatingUnit', inputId: 'annualHeating',
        conversions: { 
            'kWh': 1, 
            'KJ': 3600,
            'MJ': 3.6,
            'GJ': 0.0036,
            '万大卡': KCAL_PER_KWH / 10000
        }
    }
];

/**
 * 默认参数表 (用于“恢复默认”功能)
 * 键名对应 HTML 元素的 ID
 */
export const defaultParameters = {
  // 项目基础
  'projectName': '示例项目',
  'heatingLoad': '1000',
  'operatingHours': '2000',
  'annualHeating': '2000000',
  
  // 方案与投资
  'hpCapex': '200',
  'storageCapex': '0',
  'hpSalvageRate': '5',
  
  // 运行参数
  'hpCop': '3.0',
  'simple_avg_price': '0.7',
  'gasPrice': '4.2',
  'coalPrice': '1000',
  'fuelPrice': '8900',
  'steamPrice': '300',
  
  // 效率
  'gasBoilerEfficiency': '92',
  'coalBoilerEfficiency': '80',
  'fuelBoilerEfficiency': '90',
  'biomassBoilerEfficiency': '85',

  // 财务
  'discountRate': '8',
  'lccYears': '15',
  'energyInflationRate': '3',
  'opexInflationRate': '5'
};

// 导出所有需要被管理的输入框 ID 列表
export const ALL_INPUT_IDS = Object.keys(defaultParameters);