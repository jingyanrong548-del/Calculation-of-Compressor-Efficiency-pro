// src/js/ui.js
// V18.2: Font Sizes Maximized & Comparison Feature Fixed

import { fuelData, converters, ALL_INPUT_IDS, defaultParameters } from './config.js'; 
import { validateInput } from './ui-validator.js';
import { calculateBoilerEfficiency, fWan, fYuan, fInt, fNum, fTon, fCop, fPercent, fYears } from './utils.js';
import * as Dashboard from './ui-dashboard.js';
import { createCostChart, createLccChart, destroyCharts } from './ui-chart.js';

// --- 全局状态 ---
let latestResults = null;

// --- 1. HTML 生成器 (字体进一步加大) ---

function generateProjectInputsHTML() {
    return `
        <div class="mb-8">
            <label class="block text-2xl font-bold text-gray-700 mb-4">项目名称</label>
            <input type="text" id="projectName" value="示例项目" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 track-change shadow-sm">
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-300">
            <label class="block text-2xl font-bold text-gray-700 mb-6">计算模式</label>
            <div class="grid grid-cols-3 gap-6">
                <label class="cursor-pointer flex flex-col items-center p-6 border-4 border-gray-100 rounded-3xl hover:bg-blue-50 has-[:checked]:bg-blue-100 has-[:checked]:border-blue-600 transition-all">
                    <input type="radio" name="calcMode" value="annual" class="mb-3 w-8 h-8 accent-blue-600" checked>
                    <span class="text-2xl font-bold text-gray-800">模式A</span>
                    <span class="text-lg text-gray-500 mt-2 font-bold">(年时)</span>
                </label>
                <label class="cursor-pointer flex flex-col items-center p-6 border-4 border-gray-100 rounded-3xl hover:bg-blue-50 has-[:checked]:bg-blue-100 has-[:checked]:border-blue-600 transition-all">
                    <input type="radio" name="calcMode" value="total" class="mb-3 w-8 h-8 accent-blue-600">
                    <span class="text-2xl font-bold text-gray-800">模式B</span>
                    <span class="text-lg text-gray-500 mt-2 font-bold">(总量)</span>
                </label>
                <label class="cursor-pointer flex flex-col items-center p-6 border-4 border-gray-100 rounded-3xl hover:bg-blue-50 has-[:checked]:bg-blue-100 has-[:checked]:border-blue-600 transition-all">
                    <input type="radio" name="calcMode" value="daily" class="mb-3 w-8 h-8 accent-blue-600">
                    <span class="text-2xl font-bold text-gray-800">模式C</span>
                    <span class="text-lg text-gray-500 mt-2 font-bold">(间歇)</span>
                </label>
            </div>
        </div>

        <div id="input-group-load" class="space-y-8 mt-8">
            <div>
                <label class="flex justify-between items-center text-2xl font-bold text-gray-700 mb-4">
                    <span>制热负荷 (设计值)</span>
                    <select id="heatingLoadUnit" class="text-3xl font-extrabold border-none bg-transparent p-0 text-blue-600 focus:ring-0 cursor-pointer hover:text-blue-800"><option value="kW">kW</option><option value="kcal/h">kcal/h</option></select>
                </label>
                <input type="number" id="heatingLoad" data-base-value="1000" value="1000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" data-validation="isPositive">
            </div>
        </div>

        <div id="input-group-hours-a" class="space-y-8 mt-8">
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">年运行小时 (h)</label>
                <input type="number" id="operatingHours" value="2000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" data-validation="isPositive">
            </div>
        </div>

        <div id="input-group-total" class="space-y-8 mt-8 hidden">
            <div>
                <label class="flex justify-between items-center text-2xl font-bold text-gray-700 mb-4">
                    <span>年总加热量</span>
                    <select id="annualHeatingUnit" class="text-3xl font-extrabold border-none bg-transparent p-0 text-blue-600 focus:ring-0 cursor-pointer"><option value="kWh">kWh</option><option value="GJ">GJ</option><option value="万大卡">万大卡</option></select>
                </label>
                <input type="number" id="annualHeating" data-base-value="2000000" value="2000000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" data-validation="isPositive">
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">年运行小时 (反推)</label>
                <input type="number" id="operatingHours_B" value="2000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm" placeholder="输入小时数">
            </div>
        </div>

        <div id="input-group-daily" class="space-y-8 mt-8 hidden">
            <div class="grid grid-cols-2 gap-8">
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">日运行 (h)</label>
                    <input type="number" id="dailyHours" value="8" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">年天数 (d)</label>
                    <input type="number" id="annualDays" value="300" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">平均负荷率 (%)</label>
                <input type="number" id="loadFactor" value="70" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
        </div>
    `;
}

function generateSchemeInputsHTML() {
    return `
        <div class="hidden">
            <input type="radio" id="modeStandard" name="schemeAMode" value="standard" checked>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-8">
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">热泵投资 (万)</label>
                <div class="relative">
                    <input type="number" id="hpCapex" value="200" class="w-full pl-6 pr-10 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium focus:ring-4 focus:ring-blue-500 focus:border-blue-500 transition-shadow track-change shadow-sm" data-validation="isPositive">
                </div>
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">储能投资 (万)</label>
                <input type="number" id="storageCapex" value="0" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
        </div>
        
        <div class="pt-8 border-t-2 border-gray-200">
             <label class="block text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <span class="w-3 h-8 bg-blue-600 rounded-full mr-4"></span>对比基准配置
             </label>
             <div class="space-y-6">
                ${['gas|天然气|80', 'coal|燃煤|60', 'electric|电锅炉|50', 'steam|蒸汽|0', 'fuel|燃油|70', 'biomass|生物质|75'].map(item => {
                    const [key, name, defCapex] = item.split('|');
                    return `
                    <div class="flex items-center justify-between group related-to-${key} transition-all duration-300 p-4 rounded-2xl border-2 border-transparent hover:border-blue-100 hover:bg-blue-50/50">
                        <div class="flex items-center">
                            <input type="checkbox" id="compare_${key}" data-target="${key}" class="comparison-toggle h-10 w-10 text-blue-600 rounded-lg focus:ring-4 focus:ring-blue-500 track-change cursor-pointer accent-blue-600" checked>
                            <label for="compare_${key}" class="ml-5 text-2xl text-gray-700 font-bold cursor-pointer select-none">${name}</label>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xl text-gray-400 mr-4 font-bold">投资(万)</span>
                            <div class="relative w-44">
                                <input type="number" id="${key}BoilerCapex" value="${defCapex}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-2xl text-right track-change focus:ring-2 focus:ring-blue-500 bg-white focus:bg-white transition-colors font-medium shadow-sm" placeholder="0">
                            </div>
                            <input type="hidden" id="${key}SalvageRate" value="${key === 'steam' ? 0 : 5}">
                        </div>
                    </div>
                    `;
                }).join('')}
             </div>
        </div>
    `;
}

function generateOperatingInputsHTML() {
    return `
        <div>
            <label class="block text-2xl font-bold text-gray-700 mb-4 tooltip-container">
                工业热泵 SPF (能效)
                <span class="tooltip-text text-lg p-4">全年综合性能系数</span>
            </label>
            <input type="number" id="hpCop" value="3.0" step="0.1" class="w-full px-6 py-5 border-2 border-blue-300 bg-blue-50 rounded-2xl text-4xl font-bold text-blue-800 track-change shadow-sm" data-validation="isStrictlyPositive">
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-200 space-y-8">
             <div>
                <div class="flex justify-between items-center mb-4">
                    <label class="block text-2xl font-bold text-gray-700">电价配置 (元/kWh)</label>
                    <button type="button" id="addPriceTierBtn" class="text-lg text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-5 py-2 rounded-xl border-2 border-blue-100">+ 添加时段</button>
                </div>
                <div id="priceTiersContainer" class="space-y-4 mb-4"></div>
                <input type="hidden" id="simple_avg_price" value="0.7" class="track-change"> 
             </div>

             <div class="grid grid-cols-2 gap-8">
                 <div class="related-to-gas">
                    <label class="block text-2xl font-bold text-gray-700 mb-4">气价 (元/m³)</label>
                    <input type="number" id="gasPrice" value="4.2" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
                <div class="related-to-coal"><label class="block text-2xl font-bold text-gray-700 mb-4">煤价 (元/t)</label><input type="number" id="coalPrice" value="1000" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
                <div class="related-to-steam"><label class="block text-2xl font-bold text-gray-700 mb-4">汽价 (元/t)</label><input type="number" id="steamPrice" value="300" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
                <div class="related-to-fuel"><label class="block text-2xl font-bold text-gray-700 mb-4">油价 (元/t)</label><input type="number" id="fuelPrice" value="8900" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
                <div class="related-to-biomass"><label class="block text-2xl font-bold text-gray-700 mb-4">生物质 (元/t)</label><input type="number" id="biomassPrice" value="850" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm"></div>
             </div>
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-200">
            <label class="block text-2xl font-bold text-gray-700 mb-6">锅炉效率 (%)</label>
            <div class="space-y-6">
                ${[
                    {id:'gas', label:'气', val:92}, {id:'coal', label:'煤', val:80}, 
                    {id:'fuel', label:'油', val:90}, {id:'biomass', label:'生物', val:85}
                ].map(item => `
                    <div class="flex items-center justify-between related-to-${item.id}">
                        <span class="text-2xl font-bold text-gray-600 w-20">${item.label}</span>
                        <div class="flex-1 flex items-center space-x-4">
                            <input type="number" id="${item.id}BoilerEfficiency" value="${item.val}" class="flex-1 px-6 py-4 border-2 border-gray-300 rounded-2xl text-2xl track-change shadow-sm">
                            <button type="button" class="eff-calc-btn text-blue-600 bg-blue-50 hover:bg-blue-100 px-6 py-4 rounded-2xl text-lg border-2 border-blue-200 font-bold transition-colors" data-target="${item.id}BoilerEfficiency" data-fuel="${item.id}">反推</button>
                        </div>
                    </div>
                `).join('')}
                <div class="hidden">
                    <input type="number" id="electricBoilerEfficiency" value="98">
                    <input type="number" id="steamEfficiency" value="98">
                </div>
            </div>
        </div>

        <div class="pt-8 border-t-2 border-dashed border-gray-200">
            <label class="block text-2xl font-bold text-gray-700 mb-6">运维成本 (万/年)</label>
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <span class="text-2xl font-bold text-blue-600 w-32">工业热泵</span>
                    <input type="number" id="hpOpexCost" value="2.5" class="flex-1 px-6 py-4 border-2 border-blue-200 bg-blue-50 rounded-2xl text-2xl track-change shadow-sm font-bold text-blue-800">
                </div>
                ${[
                    {id:'gas', label:'天然气', val:1.8}, {id:'coal', label:'燃煤', val:6.8},
                    {id:'electric', label:'电锅炉', val:0.4}, {id:'steam', label:'蒸汽', val:0},
                    {id:'fuel', label:'燃油', val:1.9}, {id:'biomass', label:'生物质', val:6.3}
                ].map(item => `
                    <div class="flex items-center justify-between related-to-${item.id}">
                        <span class="text-2xl font-bold text-gray-600 w-32">${item.label}</span>
                        <input type="number" id="${item.id}OpexCost" value="${item.val}" class="flex-1 px-6 py-4 border-2 border-gray-300 rounded-2xl text-2xl track-change shadow-sm">
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="hidden">
            <input type="number" id="gasCalorific" value="35.57">
            <input type="number" id="coalCalorific" value="29.3">
            <input type="number" id="fuelCalorific" value="42.6">
            <input type="number" id="biomassCalorific" value="16.32">
            <input type="number" id="steamCalorific" value="700">
            <input type="checkbox" id="greenElectricityToggle">
            <input type="number" id="gridFactor" value="0.57">
            <input type="number" id="gasFactor" value="1.97">
            <input type="number" id="coalFactor" value="2420">
            <input type="number" id="fuelFactor" value="3090">
            <input type="number" id="steamFactor" value="0.35">
            <input type="number" id="biomassFactor" value="0">
            <input type="number" id="hybridLoadShare" value="50">
            <select id="hybridAuxHeaterType"><option value="electric">Electric</option></select>
            <input type="number" id="hybridAuxHeaterCapex" value="30">
            <input type="number" id="hybridAuxHeaterOpex" value="0.5">
            <input type="number" id="botAnnualRevenue" value="150">
            <input type="number" id="botAnnualEnergyCost" value="60">
            <input type="number" id="botAnnualOpexCost" value="5">
            <input type="number" id="botEquityRatio" value="30">
            <input type="number" id="botLoanInterestRate" value="5">
            <input type="number" id="botDepreciationYears" value="10">
            <input type="number" id="botVatRate" value="13">
            <input type="number" id="botSurtaxRate" value="12">
            <input type="number" id="botIncomeTaxRate" value="25">
             <select id="heatingLoadUnit_dummy" class="hidden"><option value="kW">kW</option></select>
             <select id="annualHeatingUnit_dummy" class="hidden"><option value="kWh">kWh</option></select>
        </div>
    `;
}

function generateFinancialInputsHTML() {
    return `
        <div class="space-y-8">
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">分析年限 (年)</label>
                <input type="number" id="lccYears" value="15" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
            <div>
                <label class="block text-2xl font-bold text-gray-700 mb-4">折现率 (%)</label>
                <input type="number" id="discountRate" value="8" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
            </div>
            <div class="grid grid-cols-2 gap-8">
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">能源涨幅(%)</label>
                    <input type="number" id="energyInflationRate" value="3" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
                <div>
                    <label class="block text-2xl font-bold text-gray-700 mb-4">运维涨幅(%)</label>
                    <input type="number" id="opexInflationRate" value="5" class="w-full px-6 py-5 border-2 border-gray-300 rounded-2xl text-3xl font-medium track-change shadow-sm">
                </div>
            </div>
        </div>
    `;
}

// --- 初始化与逻辑 ---

export function initializeUI(handleCalculate) {
    injectAccordionContent('accordion-project', '1. 项目与负荷', generateProjectInputsHTML());
    injectAccordionContent('accordion-scheme', '2. 方案与投资', generateSchemeInputsHTML());
    injectAccordionContent('accordion-operating', '3. 运行参数', generateOperatingInputsHTML());
    injectAccordionContent('accordion-financial', '4. 财务模型', generateFinancialInputsHTML());

    Dashboard.initializeDashboard();

    const calcBtn = document.getElementById('calculateBtn');
    if (calcBtn) calcBtn.addEventListener('click', () => handleCalculate());

    setupSimpleUnitConverter('heatingLoadUnit', 'heatingLoad', {'kW': 1, 'kcal/h': 1/1.163}); 

    const modeRadios = document.querySelectorAll('input[name="calcMode"]');
    modeRadios.forEach(r => r.addEventListener('change', updateCalcModeUI));
    updateCalcModeUI(); 

    const toggles = document.querySelectorAll('.comparison-toggle');
    toggles.forEach(t => t.addEventListener('change', updateComparisonStyles));
    updateComparisonStyles();

    const addTierBtn = document.getElementById('addPriceTierBtn');
    if (addTierBtn) {
        addTierBtn.addEventListener('click', () => {
            addNewPriceTier();
            handleCalculate();
        });
    }
    addNewPriceTier("平均电价", "0.7", "100");

    setupEfficiencyCalculator();
    setupExportButton();

    const resetBtn = document.getElementById('btn-reset-params');
    if(resetBtn) resetBtn.addEventListener('click', resetParams);
    
    // [修复] 监听启用对比开关，控制暂存按钮显示
    const scenarioToggle = document.getElementById('enableScenarioComparison');
    if (scenarioToggle) {
        scenarioToggle.addEventListener('change', () => {
            const saveBtn = document.getElementById('saveScenarioBtn');
            const scenarioTab = document.querySelector('.tab-link[data-tab="scenarios"]');
            if(scenarioToggle.checked) {
                if(saveBtn) saveBtn.classList.remove('hidden');
                if(scenarioTab) scenarioTab.classList.remove('hidden');
            } else {
                if(saveBtn) saveBtn.classList.add('hidden');
                if(scenarioTab) scenarioTab.classList.add('hidden');
            }
        });
        // 触发一次初始化
        scenarioToggle.dispatchEvent(new Event('change'));
    }
    
    window.updateSimplePriceTier = function(val) {}; 
}

function addNewPriceTier(name = "", price = "", dist = "") {
    const container = document.getElementById('priceTiersContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'price-tier-entry flex gap-4 items-center mb-4';
    div.innerHTML = `
        <input type="text" class="tier-name w-1/3 px-4 py-3 border-2 border-gray-300 rounded-xl text-xl" placeholder="时段名" value="${name}">
        <input type="number" class="tier-price w-1/4 px-4 py-3 border-2 border-gray-300 rounded-xl text-xl" placeholder="价格" value="${price}">
        <span class="text-gray-400 text-xl font-bold">@</span>
        <input type="number" class="tier-dist w-1/4 px-4 py-3 border-2 border-gray-300 rounded-xl text-xl" placeholder="比例%" value="${dist}">
        <button type="button" class="text-red-500 hover:text-red-700 px-4 text-3xl font-bold remove-tier-btn">×</button>
    `;
    div.querySelector('.remove-tier-btn').addEventListener('click', () => {
        if (container.children.length > 1) { div.remove(); document.getElementById('calculateBtn')?.click(); } else { alert("至少保留一个电价时段"); }
    });
    div.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => document.getElementById('calculateBtn')?.click());
    });
    container.appendChild(div);
}

function injectAccordionContent(containerId, title, contentHTML) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <button class="accordion-header flex justify-between items-center w-full px-8 py-6 bg-white hover:bg-gray-50 focus:outline-none transition-colors duration-200 cursor-pointer" type="button" aria-expanded="true" aria-controls="${containerId}-content">
            <span class="text-3xl font-extrabold text-gray-900">${title}</span>
            <svg class="accordion-icon w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div id="${containerId}-content" class="accordion-content open px-8 py-8 border-t-2 border-gray-100">
            ${contentHTML}
        </div>
    `;
}

function updateCalcModeUI() {
    const mode = document.querySelector('input[name="calcMode"]:checked').value;
    document.getElementById('input-group-load').classList.toggle('hidden', mode === 'total');
    document.getElementById('input-group-hours-a').classList.toggle('hidden', mode !== 'annual');
    document.getElementById('input-group-total').classList.toggle('hidden', mode !== 'total');
    document.getElementById('input-group-daily').classList.toggle('hidden', mode !== 'daily');
}

// [核心修复] 变灰但不锁死
function updateComparisonStyles() {
    document.querySelectorAll('.comparison-toggle').forEach(toggle => {
        const target = toggle.dataset.target;
        const containers = document.querySelectorAll(`.related-to-${target}`);
        containers.forEach(container => {
            const inputs = container.querySelectorAll('input:not(.comparison-toggle), button');
            if(!toggle.checked) {
                container.classList.add('opacity-40', 'grayscale');
                inputs.forEach(i => i.disabled = true);
            } else {
                container.classList.remove('opacity-40', 'grayscale');
                inputs.forEach(i => i.disabled = false);
            }
        });
    });
}

function setupSimpleUnitConverter(selectId, inputId, factors) {
    const sel = document.getElementById(selectId);
    const inp = document.getElementById(inputId);
    if(!sel || !inp) return;
    sel.addEventListener('change', () => {});
}

function resetParams() { if(confirm('确定要恢复默认参数吗？')) location.reload(); }

function setupExportButton() {
    const btn = document.getElementById('export-report-btn');
    if (btn) btn.addEventListener('click', () => { if (!latestResults) { alert("请先进行计算"); return; } buildPrintReport(latestResults); setTimeout(() => { window.print(); }, 500); });
}

function buildPrintReport(results) {
    const container = document.getElementById('print-report-container');
    if (!container) return;
    const dateStr = new Date().toLocaleString('zh-CN');
    const bestComp = results.comparisons.sort((a, b) => b.annualSaving - a.annualSaving)[0];
    let costChartImg = '', lccChartImg = '';
    const chart1 = document.getElementById('costComparisonChart');
    const chart2 = document.getElementById('lccBreakdownChart');
    if(chart1) costChartImg = chart1.toDataURL();
    if(chart2) lccChartImg = chart2.toDataURL();
    let irrDisplay = '--';
    if(bestComp) { irrDisplay = (bestComp.irr === null || bestComp.irr === -Infinity || bestComp.irr < -1) ? '无法回收' : fPercent(bestComp.irr); }

    const html = `
        <div class="print-header text-center mb-8 border-b pb-4">
            <h1 class="text-3xl font-bold mb-2">工业热泵经济与环境效益分析报告</h1>
            <p class="text-sm text-gray-500">项目：${results.inputs.projectName} | 生成日期: ${dateStr}</p>
        </div>
        <div class="print-section mb-8">
            <h3 class="text-xl font-bold border-l-4 border-black pl-3 mb-4 bg-gray-100 py-1">1. 分析结论摘要</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="border p-4 rounded"><p class="text-gray-500">年节省金额</p><p class="text-2xl font-bold">${bestComp ? fWan(bestComp.annualSaving) : '-'} 万</p></div>
                <div class="border p-4 rounded"><p class="text-gray-500">内部收益率 (IRR)</p><p class="text-2xl font-bold">${irrDisplay}</p></div>
                <div class="border p-4 rounded"><p class="text-gray-500">动态回收期</p><p class="text-2xl font-bold">${bestComp ? bestComp.dynamicPBP : '-'} 年</p></div>
                <div class="border p-4 rounded"><p class="text-gray-500">年碳减排</p><p class="text-2xl font-bold">${bestComp ? fNum(bestComp.co2Reduction, 1) : '-'} 吨</p></div>
            </div>
        </div>
        <div class="print-section mb-8">
            <h3 class="text-xl font-bold border-l-4 border-black pl-3 mb-4 bg-gray-100 py-1">2. 核心图表分析</h3>
            <div class="flex justify-between items-start gap-4">
                <div style="width: 48%; border:1px solid #eee; padding:10px;"><h4 class="text-center font-bold mb-2">年度成本对比</h4><img src="${costChartImg}" style="width:100%;"></div>
                <div style="width: 48%; border:1px solid #eee; padding:10px;"><h4 class="text-center font-bold mb-2">LCC 成本构成</h4><img src="${lccChartImg}" style="width:100%;"></div>
            </div>
        </div>
        <div class="print-section">
            <h3 class="text-xl font-bold border-l-4 border-black pl-3 mb-4 bg-gray-100 py-1">3. 详细数据对比表</h3>
            <table class="print-table w-full text-xs border-collapse border border-gray-300">
                <thead>
                    <tr class="bg-gray-200">
                        <th class="border p-2">方案名称</th><th class="border p-2">投资(万)</th><th class="border p-2">年能耗(万)</th><th class="border p-2">年运维(万)</th><th class="border p-2">年总成本</th><th class="border p-2">年节省</th><th class="border p-2">回收期(年)</th><th class="border p-2">IRR</th><th class="border p-2">LCC总值</th><th class="border p-2">LCC节省</th><th class="border p-2">减排(t)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="border p-2 font-bold">工业热泵</td><td class="border p-2">${fWan(results.hp.initialInvestment)}</td><td class="border p-2">${fWan(results.hp.annualEnergyCost)}</td><td class="border p-2">${fWan(results.hp.annualOpex)}</td><td class="border p-2">${fWan(results.hp.annualTotalCost)}</td><td class="border p-2">-</td><td class="border p-2">-</td><td class="border p-2">-</td><td class="border p-2">${fWan(results.hp.lcc.total)}</td><td class="border p-2">-</td><td class="border p-2">-</td>
                    </tr>
                    ${results.comparisons.map(c => `<tr><td class="border p-2">${c.name}</td><td class="border p-2">${fWan(c.initialInvestment)}</td><td class="border p-2">${fWan(c.annualEnergyCost)}</td><td class="border p-2">${fWan(c.annualOpex)}</td><td class="border p-2">${fWan(c.annualTotalCost)}</td><td class="border p-2 font-bold">${fWan(c.annualSaving)}</td><td class="border p-2">${c.dynamicPBP}</td><td class="border p-2">${c.irr === null || c.irr < -1 ? 'N/A' : fPercent(c.irr)}</td><td class="border p-2">${fWan(c.lccTotal)}</td><td class="border p-2">${fWan(c.lccSaving)}</td><td class="border p-2">${fNum(c.co2, 1)}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div class="mt-8 text-xs text-gray-400 text-center border-t pt-2">Powered by Phoenix Plan V18.2</div>
    `;
    container.innerHTML = html;
}

let currentEfficiencyTargetId = null;
function setupEfficiencyCalculator() {
    const modal = document.getElementById('eff-calc-modal');
    const closeBtn = document.getElementById('eff-calc-close-btn');
    const calcBtn = document.getElementById('ec-calc-btn');
    const applyBtn = document.getElementById('ec-apply-btn');
    const fuelUnitLabel = document.getElementById('ec-fuel-unit');
    if (!modal) return; 
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.eff-calc-btn');
        if (btn) {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const fuelType = btn.dataset.fuel;
            currentEfficiencyTargetId = targetId;
            const select = document.getElementById('ec-fuel-type');
            if(select) { select.value = fuelType; fuelUnitLabel.textContent = (fuelType === 'gas') ? 'm³' : 'kg'; }
            modal.classList.remove('hidden');
        }
    });
    if(closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if(calcBtn) calcBtn.addEventListener('click', () => {
        const fuelType = document.getElementById('ec-fuel-type').value;
        const fuelAmount = parseFloat(document.getElementById('ec-fuel-amount').value);
        let calorificValue = 0;
        if (fuelType === 'gas') calorificValue = parseFloat(document.getElementById('gasCalorific').value);
        else if (fuelType === 'fuel') calorificValue = parseFloat(document.getElementById('fuelCalorific').value);
        else if (fuelType === 'coal') calorificValue = parseFloat(document.getElementById('coalCalorific').value);
        else if (fuelType === 'biomass') calorificValue = parseFloat(document.getElementById('biomassCalorific').value);
        const outputType = document.querySelector('input[name="ec-output-type"]:checked').value;
        let params = {};
        if (outputType === 'water') {
            params = { mass: parseFloat(document.getElementById('ec-water-mass').value), tempIn: parseFloat(document.getElementById('ec-water-in-temp').value), tempOut: parseFloat(document.getElementById('ec-water-out-temp').value) };
        } else {
            params = { mass: parseFloat(document.getElementById('ec-steam-mass').value), pressure: parseFloat(document.getElementById('ec-steam-pressure').value), feedTemp: parseFloat(document.getElementById('ec-steam-feed-temp').value) };
        }
        const result = calculateBoilerEfficiency(fuelType, fuelAmount, calorificValue, outputType, params);
        const display = document.getElementById('ec-result-display');
        if (result.error) { display.textContent = "Error"; display.className = "text-3xl font-black text-red-500 tracking-tight"; applyBtn.disabled = true; } 
        else { display.textContent = result.efficiency.toFixed(1) + " %"; display.className = "text-3xl font-black text-blue-600 tracking-tight"; applyBtn.disabled = false; applyBtn.dataset.value = result.efficiency.toFixed(1); }
    });
    if(applyBtn) applyBtn.addEventListener('click', () => {
        if (currentEfficiencyTargetId && applyBtn.dataset.value) {
            const target = document.getElementById(currentEfficiencyTargetId);
            if (target) { target.value = applyBtn.dataset.value; modal.classList.add('hidden'); document.getElementById('calculateBtn')?.click(); }
        }
    });
}

// --- 数据读取 ---
export function readAllInputs(showErrorCallback) {
    const getVal = (id) => { const el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : 0; };
    const priceTiers = [];
    document.querySelectorAll('.price-tier-entry').forEach(entry => { priceTiers.push({ name: entry.querySelector('.tier-name').value, price: parseFloat(entry.querySelector('.tier-price').value) || 0, dist: parseFloat(entry.querySelector('.tier-dist').value) || 0 }); });
    if(priceTiers.length === 0) priceTiers.push({name:'默认', price:0.7, dist:100});
    const calcMode = document.querySelector('input[name="calcMode"]:checked').value;
    let heatingLoad = 0, operatingHours = 0, annualHeatingDemandKWh = 0;
    if (calcMode === 'annual') { heatingLoad = getVal('heatingLoad'); operatingHours = getVal('operatingHours'); annualHeatingDemandKWh = heatingLoad * operatingHours; } 
    else if (calcMode === 'total') { annualHeatingDemandKWh = getVal('annualHeating'); operatingHours = getVal('operatingHours_B'); heatingLoad = operatingHours > 0 ? annualHeatingDemandKWh / operatingHours : 0; } 
    else { heatingLoad = getVal('heatingLoad'); operatingHours = getVal('dailyHours') * getVal('annualDays') * (getVal('loadFactor')/100); annualHeatingDemandKWh = heatingLoad * operatingHours; }
    
    return {
        projectName: document.getElementById('projectName').value, analysisMode: 'standard', isHybridMode: false, priceTiers, heatingLoad, operatingHours, annualHeatingDemandKWh,
        lccYears: getVal('lccYears'), discountRate: getVal('discountRate') / 100, energyInflationRate: getVal('energyInflationRate') / 100, opexInflationRate: getVal('opexInflationRate') / 100,
        hpHostCapex: getVal('hpCapex') * 10000, hpStorageCapex: getVal('storageCapex') * 10000, hpSalvageRate: getVal('hpSalvageRate') / 100, hpCop: getVal('hpCop'), hpOpexCost: getVal('hpOpexCost') * 10000,
        gasBoilerCapex: getVal('gasBoilerCapex') * 10000, gasSalvageRate: 0.05, gasBoilerEfficiency: getVal('gasBoilerEfficiency') / 100, gasPrice: getVal('gasPrice'), gasCalorific: getVal('gasCalorific'), gasFactor: getVal('gasFactor'), gasOpexCost: getVal('gasOpexCost') * 10000,
        fuelBoilerCapex: getVal('fuelBoilerCapex') * 10000, fuelSalvageRate: 0.05, fuelBoilerEfficiency: getVal('fuelBoilerEfficiency') / 100, fuelPrice: getVal('fuelPrice'), fuelCalorific: getVal('fuelCalorific'), fuelFactor: getVal('fuelFactor'), fuelOpexCost: getVal('fuelOpexCost') * 10000,
        coalBoilerCapex: getVal('coalBoilerCapex') * 10000, coalSalvageRate: 0.05, coalBoilerEfficiency: getVal('coalBoilerEfficiency') / 100, coalPrice: getVal('coalPrice'), coalCalorific: getVal('coalCalorific'), coalFactor: getVal('coalFactor'), coalOpexCost: getVal('coalOpexCost') * 10000,
        steamCapex: getVal('steamCapex') * 10000, steamSalvageRate: 0, steamEfficiency: 0.98, steamPrice: getVal('steamPrice'), steamCalorific: getVal('steamCalorific'), steamFactor: getVal('steamFactor'), steamOpexCost: getVal('steamOpexCost') * 10000,
        compare: { gas: document.getElementById('compare_gas').checked, coal: document.getElementById('compare_coal').checked, fuel: document.getElementById('compare_fuel').checked, electric: document.getElementById('compare_electric').checked, steam: document.getElementById('compare_steam').checked, biomass: document.getElementById('compare_biomass').checked },
        biomassBoilerCapex: getVal('biomassBoilerCapex') * 10000, biomassSalvageRate: 0, biomassBoilerEfficiency: getVal('biomassBoilerEfficiency')/100, biomassPrice: getVal('biomassPrice'), biomassCalorific: getVal('biomassCalorific'), biomassFactor: getVal('biomassFactor'), biomassOpexCost: getVal('biomassOpexCost') * 10000,
        electricBoilerCapex: getVal('electricBoilerCapex') * 10000, electricSalvageRate: 0.05, electricBoilerEfficiency: getVal('electricBoilerEfficiency')/100, electricOpexCost: getVal('electricOpexCost') * 10000, gridFactor: 0.57, isGreenElectricity: false
    };
}

// --- 渲染逻辑 (大字号表格) ---

export function renderDashboard(results) {
    latestResults = results;
    Dashboard.showResultsContent(); Dashboard.scrollToResults(); Dashboard.setExportButtonState(true);
    const bestComp = results.comparisons.sort((a, b) => b.annualSaving - a.annualSaving)[0];
    
    if (bestComp) {
        Dashboard.updateResultCard('annual-saving', `${fWan(bestComp.annualSaving)} 万`);
        let irrText = '--'; let irrClass = 'text-gray-500';
        if (bestComp.irr === null || bestComp.irr === -Infinity || bestComp.irr < -1) { irrText = '无法回收'; irrClass = 'text-gray-500'; } 
        else { irrText = fPercent(bestComp.irr); irrClass = bestComp.irr > 0.08 ? 'text-green-600' : (bestComp.irr > 0 ? 'text-yellow-600' : 'text-gray-500'); }
        Dashboard.updateResultCard('irr', irrText, irrClass);
        Dashboard.updateResultCard('pbp', `${bestComp.dynamicPBP} 年`);
        Dashboard.updateResultCard('co2-reduction', `${fNum(bestComp.co2Reduction, 1)} 吨`);
    } else {
        Dashboard.updateResultCard('annual-saving', '--'); Dashboard.updateResultCard('irr', '--');
    }
    
    setTimeout(() => {
        destroyCharts();
        const labels = ['热泵', ...results.comparisons.map(c => c.name)];
        const eCosts = [results.hp.annualEnergyCost/10000, ...results.comparisons.map(c => c.annualEnergyCost/10000)];
        const oCosts = [results.hp.annualOpex/10000, ...results.comparisons.map(c => c.annualOpex/10000)];
        const ctxCost = document.getElementById('costComparisonChart');
        if(ctxCost) createCostChart(ctxCost, labels, eCosts, oCosts);
        const ctxLcc = document.getElementById('lccBreakdownChart');
        if(ctxLcc) { const d = results.hp.lcc; createLccChart(ctxLcc, [d.capex/10000, d.energy/10000, d.opex/10000, d.residual/10000]); }
    }, 100);

    const dataTab = document.getElementById('tab-data-table');
    if (dataTab) {
        dataTab.innerHTML = `
            <div class="overflow-x-auto pb-6">
                <table class="min-w-full text-xl text-left text-gray-700">
                    <thead class="text-lg font-extrabold text-gray-900 uppercase bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                            <th class="px-6 py-6 whitespace-nowrap">方案名称</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">初始投资(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年能源成本(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年运维成本(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年总成本(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">年节省(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-center">静态回收期</th>
                            <th class="px-6 py-6 whitespace-nowrap text-center">动态回收期</th>
                            <th class="px-6 py-6 whitespace-nowrap text-center">IRR</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">LCC总值(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">LCC节省(万)</th>
                            <th class="px-6 py-6 whitespace-nowrap text-right">碳减排(吨)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y-2 divide-gray-100">
                        <tr class="bg-blue-50/50 border-b-2 border-gray-200 font-bold text-gray-900">
                            <td class="px-6 py-6 whitespace-nowrap">工业热泵 (本方案)</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${fWan(results.hp.initialInvestment)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${fWan(results.hp.annualEnergyCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${fWan(results.hp.annualOpex)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${fWan(results.hp.annualTotalCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">${fWan(results.hp.lcc.total)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">-</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right">-</td>
                        </tr>
                        ${results.comparisons.map(c => `
                        <tr class="bg-white hover:bg-gray-50 transition-colors">
                            <td class="px-6 py-6 whitespace-nowrap font-bold text-gray-800">${c.name}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${fWan(c.initialInvestment)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${fWan(c.annualEnergyCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${fWan(c.annualOpex)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${fWan(c.annualTotalCost)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-bold text-green-600">${fWan(c.annualSaving)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center font-medium">${c.paybackPeriod}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center font-medium">${c.dynamicPBP} 年</td>
                            <td class="px-6 py-6 whitespace-nowrap text-center font-bold text-blue-600">${
                                c.irr === null || c.irr < -1 ? '<span class="text-gray-400">N/A</span>' : fPercent(c.irr)
                            }</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right font-medium">${fWan(c.lccTotal)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right text-green-600 font-bold">${fWan(c.lccSaving)}</td>
                            <td class="px-6 py-6 whitespace-nowrap text-right text-green-600 font-bold">${fNum(c.co2Reduction, 1)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="text-lg text-gray-400 mt-6">* 注：LCC (全生命周期成本) 已包含资金时间价值，折现率 ${fPercent(results.inputs.discountRate)}。</p>
        `;
    }
    
    const conclusionTab = document.getElementById('tab-conclusion');
    if (conclusionTab && bestComp) {
        const isGood = bestComp.irr > 0.08;
        conclusionTab.innerHTML = `<div class="p-10 ${isGood ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'} border rounded-3xl"><h3 class="text-4xl font-extrabold ${isGood ? 'text-green-800' : 'text-yellow-800'} mb-6">${isGood ? '🚀 推荐投资' : '⚖️ 投资回报一般'}</h3><p class="text-2xl text-gray-700 leading-relaxed font-medium">相比于 <strong>${bestComp.name}</strong>，工业热泵方案预计每年可节省 <strong>${fWan(bestComp.annualSaving)} 万元</strong>。全生命周期（${results.inputs.lccYears}年）累计节省 <strong>${fWan(bestComp.lccSaving)} 万元</strong>。静态回收期为 ${bestComp.paybackPeriod}，动态回收期为 ${bestComp.dynamicPBP} 年。</p></div>`;
    }
}