// =====================================================================
// utils.js: 通用工具库 (图表 & 导出 & 状态表 & 数据持久化 & 单位转换)
// 版本: v8.52 (Optimization: Dynamic Import for XLSX)
// =====================================================================

import * as echarts from 'echarts';
// [Optimization] XLSX removed from static import to reduce initial bundle size

// =====================================================================
// 1. Unit Conversion Infrastructure
// =====================================================================

export const UnitState = {
    current: 'SI', // 'SI' or 'IMP'
    toggle() {
        this.current = this.current === 'SI' ? 'IMP' : 'SI';
        return this.current;
    },
    isMetric() { return this.current === 'SI'; }
};

// Conversion Factors & Labels
const CONVERSIONS = {
    pressure: {
        si: 'bar', imp: 'psi',
        toImp: (v) => v * 14.5038,
        digits: 2
    },
    temp: { // Absolute Temp (Input is Celsius)
        si: '°C', imp: '°F',
        toImp: (v) => (v * 1.8) + 32,
        digits: 1
    },
    delta_temp: { // Temperature Difference
        si: 'K', imp: '°R', 
        toImp: (v) => v * 1.8,
        digits: 1
    },
    flow_vol: {
        si: 'm³/h', imp: 'CFM',
        toImp: (v) => v * 0.588578,
        digits: 1
    },
    std_flow: { // Standard Flow (Nm3/h vs SCFM)
        si: 'Nm³/h', imp: 'SCFM',
        toImp: (v) => v * 0.588578, 
        digits: 1
    },
    flow_mass: {
        si: 'kg/h', imp: 'lb/h',
        toImp: (v) => v * 2.20462,
        digits: 1
    },
    power: {
        si: 'kW', imp: 'HP',
        toImp: (v) => v * 1.34102,
        digits: 2
    },
    spec_power: {
        si: 'kW/(m³/min)', imp: 'kW/100cfm',
        toImp: (v) => v * 1.699, 
        digits: 2
    },
    sec: { // Specific Energy Consumption (MVR)
        si: 'kWh/ton', imp: 'BTU/lb', 
        toImp: (v) => v * 1.9, 
        digits: 2
    },
    vcc: { // Volumetric Cooling Capacity
        si: 'kJ/m³', imp: 'BTU/ft³',
        toImp: (v) => v * 0.0268,
        digits: 0
    },
    density: {
        si: 'kg/m³', imp: 'lb/ft³',
        toImp: (v) => v * 0.062428,
        digits: 3
    },
    enthalpy: {
        si: 'kJ/kg', imp: 'Btu/lb',
        toImp: (v) => v * 0.429923,
        digits: 1
    },
    entropy: {
        si: 'kJ/kg·K', imp: 'Btu/lb·°F',
        toImp: (v) => v * 0.238846,
        digits: 4
    },
    speed: {
        si: 'm/s', imp: 'ft/s',
        toImp: (v) => v * 3.28084,
        digits: 1
    }
};

/**
 * 格式化数值 (用于 UI 显示)
 */
export function formatValue(valueSI, type, overrideDigits = null) {
    if (valueSI === null || valueSI === undefined || valueSI === '' || isNaN(valueSI)) return '-';
    if (!isFinite(valueSI)) return 'Inf';
    
    const def = CONVERSIONS[type];
    if (!def) return Number(valueSI).toFixed(2); 

    let val = valueSI;
    let unit = def.si;
    
    if (!UnitState.isMetric()) {
        val = def.toImp(valueSI);
        unit = def.imp;
    }

    const digits = overrideDigits !== null ? overrideDigits : def.digits;
    return `${val.toFixed(digits)} <span class="text-xs text-gray-400 ml-0.5">${unit}</span>`;
}

export function getConvertedValue(valueSI, type) {
    if (valueSI === null || valueSI === undefined) return null;
    const def = CONVERSIONS[type];
    if (!def) return valueSI;
    return UnitState.isMetric() ? valueSI : def.toImp(valueSI);
}

export function getUnitLabel(type) {
    const def = CONVERSIONS[type];
    if (!def) return '';
    return UnitState.isMetric() ? def.si : def.imp;
}

export function getDiffHtml(current, baseline, inverse = false) {
    if (!baseline || baseline === 0) return '';
    const diffPct = ((current - baseline) / baseline) * 100;
    const absDiff = Math.abs(diffPct);
    if (absDiff < 0.01) return ''; 
    let color = 'text-gray-500';
    const isGood = inverse ? (diffPct < 0) : (diffPct > 0);
    color = isGood ? 'text-green-600' : 'text-red-600';
    const arrow = diffPct > 0 ? '▲' : '▼';
    return `<div class="text-[10px] ${color} font-bold mt-0.5 flex items-center justify-end">
        <span class="mr-1">${arrow}</span>${Math.abs(diffPct).toFixed(1)}% vs Base
    </div>`;
}


// =====================================================================
// 2. Data Persistence (AutoSaveManager)
// =====================================================================

export class AutoSaveManager {
    static STORAGE_KEY = 'v8_26_calc_data';
    static TAB_KEY = 'v8_26_active_tab';

    static init() {
        console.log("[AutoSave] Initializing...");
        this.restoreTab();
        this.load();

        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('input', this.debounce(() => this.save(), 500));
            form.addEventListener('change', this.debounce(() => this.save(), 500));
        });

        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                localStorage.setItem(this.TAB_KEY, index);
            });
        });
    }

    static save() {
        try {
            const data = {};
            const inputs = document.querySelectorAll('input, select');
            inputs.forEach(el => {
                if (!el.name) return;
                if (el.type === 'radio') {
                    if (el.checked) data[el.name] = el.value;
                } else if (el.type === 'checkbox') {
                    data[el.id || el.name] = el.checked;
                } else {
                    data[el.name] = el.value;
                }
            });
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn("[AutoSave] Save failed:", e);
        }
    }

    static load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            
            const inputs = document.querySelectorAll('input, select');
            inputs.forEach(el => {
                if (el.type === 'radio') {
                    if (data[el.name] === el.value) {
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else if (el.type === 'checkbox') {
                    const key = el.id || el.name;
                    if (data[key] !== undefined) {
                        el.checked = data[key];
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else if (el.name && data[el.name] !== undefined) {
                    el.value = data[el.name];
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        } catch (e) {
            console.error("[AutoSave] Load failed:", e);
        }
    }

    static restoreTab() {
        const index = localStorage.getItem(this.TAB_KEY);
        if (index !== null) {
            const btn = document.getElementById(`tab-btn-${parseInt(index) + 1}`);
            if (btn) btn.click();
        } else {
            const btn = document.getElementById('tab-btn-1');
            if(btn) btn.click();
        }
    }

    static debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}


// =====================================================================
// 3. Excel Export (Optimization: Dynamic Import)
// =====================================================================

export async function exportToExcel(data, filename) {
    if (!data) {
        alert("No data to export. (请先计算)");
        return;
    }

    let XLSX;
    try {
        // [Optimization] Load XLSX only when needed
        const module = await import('xlsx');
        XLSX = module.default || module;
    } catch (err) {
        console.error("Failed to load XLSX:", err);
        alert("Error loading Excel library. Please check network or npm install xlsx.");
        return;
    }

    try {
        const rows = [];
        rows.push(["Parameter (参数)", "Value (数值)", "Unit (单位)"]);
        
        const add = (k, v, type) => {
            if (v !== undefined && v !== null) {
                const val = type ? getConvertedValue(v, type) : v;
                const unit = type ? getUnitLabel(type) : '';
                const displayVal = typeof val === 'number' ? Number(val.toFixed(4)) : val;
                rows.push([k, displayVal, unit]);
            }
        };

        rows.push(["--- INFO ---", "", ""]);
        add("Date", data.date);
        add("Fluid", data.fluid);
        add("Unit System", UnitState.current); 
        if(data.is_advanced) add("Config Mode", "Advanced Multi-Stage");

        rows.push(["--- CONDITIONS ---", "", ""]);
        add("Suction Pressure", data.p_in, 'pressure');
        add("Suction Temp", data.t_in, 'temp');
        if(data.z_in) add("Compressibility Z (In)", data.z_in);
        if(data.gamma_in) add("Isentropic Exp k (In)", data.gamma_in);
        
        if (data.p_out) add("Discharge Pressure", data.p_out, 'pressure');
        if (data.t_out) add("Discharge Temp", data.t_out, 'temp');
        if (data.t_cond) add("Condensing Temp", data.t_cond, 'temp');
        if (data.t_gc_out) add("Gas Cooler Exit", data.t_gc_out, 'temp');

        if (data.rpm) add("Speed", data.rpm, '');
        add("Mass Flow", data.m_flow * 3600, 'flow_mass');
        add("Vol Flow (Actual)", (data.v_flow || data.v_flow_in) * 3600, 'flow_vol');
        if(data.v_flow_std) add("Vol Flow (Standard)", data.v_flow_std * 3600, 'std_flow');

        if (data.ihx && data.ihx.enabled) {
            rows.push(["--- IHX (Internal Heat Exchanger) ---", "", ""]);
            add("IHX Effectiveness", data.ihx.eff * 100, null);
            add("IHX Load", data.ihx.q_ihx, 'power');
            add("Suction Temp (After IHX)", data.ihx.t_1b - 273.15, 'temp');
            add("Liquid Temp (After IHX)", data.ihx.t_3b - 273.15, 'temp');
            add("Subcool Gain", data.ihx.t_drop_liq, 'delta_temp');
        }

        rows.push(["--- PERFORMANCE ---", "", ""]);
        add("Shaft Power", data.power, 'power');
        if(data.spec_power) add("Specific Power", data.spec_power, 'spec_power');
        if(data.sec) add("SEC", data.sec, 'sec');

        if(data.q_evap) add("Cooling Capacity", data.q_evap, 'power'); 
        if(data.q_cond) add("Heating Capacity", data.q_cond, 'power');
        
        if(data.cop_c) add("COP (Cooling)", data.cop_c);
        if(data.cop_h) add("COP (Heating)", data.cop_h);
        if(data.vcc) add("VCC", data.vcc, 'vcc');
        
        if(data.heat_rejection_ratio) add("Heat Rejection Ratio", data.heat_rejection_ratio);
        if(data.dew_point) add("Dew Point", data.dew_point, 'temp');

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }]; 

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datasheet");
        XLSX.writeFile(wb, `${filename}_${UnitState.current}.xlsx`);

    } catch (err) {
        console.error("[Utils] Export Error:", err);
        alert("导出 Excel 失败:\n" + err.message);
    }
}


// =====================================================================
// 4. Chart Rendering
// =====================================================================

export function renderStateTable(domId, points) {
    const chartDiv = document.getElementById(domId);
    if (!chartDiv) return;

    let tableDiv = chartDiv.nextElementSibling;
    if (!tableDiv || !tableDiv.classList.contains('state-table-container')) {
        tableDiv = document.createElement('div');
        tableDiv.className = 'state-table-container mt-6 mb-8'; 
        chartDiv.parentNode.insertBefore(tableDiv, chartDiv.nextSibling);
    }

    const rowsHtml = points.map(pt => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="py-3 px-4 font-bold text-teal-700 text-center bg-gray-50">${pt.name}</td>
            <td class="py-3 px-4 text-xs text-gray-600 font-medium">${pt.desc}</td>
            <td class="py-3 px-4 text-right font-mono text-sm text-gray-800">${(pt.p / 1e5).toFixed(2)}</td>
            <td class="py-3 px-4 text-right font-mono text-sm font-bold text-blue-600">${(pt.t - 273.15).toFixed(2)}</td>
            <td class="py-3 px-4 text-right font-mono text-xs text-gray-500">${(pt.h / 1000).toFixed(1)}</td>
            <td class="py-3 px-4 text-right font-mono text-xs text-gray-500">${(pt.s / 1000).toFixed(3)}</td>
        </tr>
    `).join('');

    tableDiv.innerHTML = `
        <div class="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
            <div class="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-sm font-bold text-gray-700">Cycle State Points (SI Units)</h3>
                <span class="text-xs text-gray-500">Auto-generated</span>
            </div>
            <table class="min-w-full">
                <thead class="bg-white text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                        <th class="py-2 px-4 text-center w-16">Pt</th>
                        <th class="py-2 px-4 text-left">Loc</th>
                        <th class="py-2 px-4 text-right">P (bar)</th>
                        <th class="py-2 px-4 text-right">T (°C)</th>
                        <th class="py-2 px-4 text-right">H (kJ/kg)</th>
                        <th class="py-2 px-4 text-right">S (kJ/kg·K)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

export function drawPhDiagram(CP, fluid, cycleData, domId) {
    const dom = document.getElementById(domId);
    if (!dom) return;

    dom.classList.remove('hidden');
    const existingChart = echarts.getInstanceByDom(dom);
    if (existingChart) {
        existingChart.clear(); 
    }

    let chart = existingChart || echarts.init(dom);
    chart.showLoading();

    try {
        const T_crit = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
        const P_crit = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
        const T_min = CP.PropsSI('Tmin', '', 0, '', 0, fluid); 
        
        const T_start = T_min + 5; 
        const T_end = T_crit - 0.5; 
        const steps = 100;
        const stepSize = (T_end - T_start) / steps;

        const lineLiquid = [];
        const lineVapor = [];
        let H_crit = 0;

        for (let i = 0; i <= steps; i++) {
            const T = T_start + i * stepSize;
            try {
                const P_liq = CP.PropsSI('P', 'T', T, 'Q', 0, fluid);
                const H_liq = CP.PropsSI('H', 'T', T, 'Q', 0, fluid);
                lineLiquid.push([H_liq / 1000.0, P_liq / 1e5]);

                const P_vap = CP.PropsSI('P', 'T', T, 'Q', 1, fluid);
                const H_vap = CP.PropsSI('H', 'T', T, 'Q', 1, fluid);
                lineVapor.push([H_vap / 1000.0, P_vap / 1e5]);
            } catch (e) { }
        }

        try {
            H_crit = CP.PropsSI('H', 'T', T_crit, 'P', P_crit, fluid) / 1000.0;
        } catch(e) {
            if(lineLiquid.length > 0) {
                const lastL = lineLiquid[lineLiquid.length-1];
                const lastV = lineVapor[lineVapor.length-1];
                H_crit = (lastL[0] + lastV[0]) / 2;
            }
        }
        const critPointData = [[H_crit, P_crit / 1e5]];

        const cycleSeriesData = [];
        if (cycleData && cycleData.points) {
            cycleData.points.forEach(pt => {
                cycleSeriesData.push({
                    name: pt.name,
                    value: [pt.h / 1000.0, pt.p / 1e5],
                    labelInfo: {
                        t: (pt.t - 273.15).toFixed(2),
                        desc: pt.desc
                    }
                });
            });
            if (cycleSeriesData.length > 0) {
                cycleSeriesData.push(cycleSeriesData[0]);
            }
        }

        const option = {
            title: { 
                text: `P-h Diagram: ${fluid}`, 
                subtext: `Critical Point: ${(T_crit-273.15).toFixed(1)}°C / ${(P_crit/1e5).toFixed(1)} bar`,
                left: 'center', 
                top: 5,
                textStyle: { fontSize: 14, color: '#333' }
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    if (params.seriesName === 'Cycle') {
                        const info = params.data.labelInfo;
                        let s = `<b>Pt ${params.name}</b><br/>`;
                        if(info && info.desc) s += `<span style="font-size:10px; color:#ccc">${info.desc}</span><br/>`;
                        s += `P: ${params.value[1].toFixed(2)} bar<br/>`;
                        s += `H: ${params.value[0].toFixed(1)} kJ/kg<br/>`;
                        if (info) s += `T: ${info.t} °C`;
                        return s;
                    } else if (params.seriesName === 'Critical Point') {
                         return `<b>Critical Point</b><br/>P: ${params.value[1].toFixed(2)} bar`;
                    }
                    return params.seriesName;
                }
            },
            grid: { top: 70, right: 50, bottom: 50, left: 60 },
            xAxis: { 
                name: 'Enthalpy (kJ/kg)', 
                nameLocation: 'middle',
                nameGap: 30,
                type: 'value', 
                scale: true, 
                splitLine: { show: false }
            },
            yAxis: { 
                name: 'Pressure (bar)', 
                type: 'log', 
                logBase: 10, 
                scale: true,
                axisLabel: { formatter: (value) => Number(value).toString() }
            },
            series: [
                { 
                    name: 'Sat. Liquid', 
                    type: 'line', 
                    showSymbol: false, 
                    data: lineLiquid, 
                    lineStyle: { color: '#0000ff', width: 1.5 },
                    silent: true 
                },
                { 
                    name: 'Sat. Vapor', 
                    type: 'line', 
                    showSymbol: false, 
                    data: lineVapor, 
                    lineStyle: { color: '#ff0000', width: 1.5 },
                    silent: true
                },
                {
                    name: 'Critical Point',
                    type: 'scatter',
                    data: critPointData,
                    symbol: 'triangle',
                    symbolSize: 10,
                    itemStyle: { color: '#000' }
                },
                {
                    name: 'Cycle',
                    type: 'line',
                    data: cycleSeriesData,
                    symbol: 'circle',
                    symbolSize: 10,
                    smooth: false,
                    label: { 
                        show: true, 
                        formatter: '{@name}', 
                        position: 'right', 
                        fontWeight: 'bold', 
                        fontSize: 12,
                        color: '#000',
                        distance: 5
                    },
                    lineStyle: { color: '#059669', width: 2.5, type: 'solid' },
                    itemStyle: { color: '#059669', borderColor: '#fff', borderWidth: 1 }
                }
            ]
        };

        chart.hideLoading();
        chart.setOption(option);
        
        let tableDiv = dom.nextElementSibling;
        if (tableDiv && tableDiv.classList.contains('state-table-container')) {
            tableDiv.style.display = 'block';
        }

        window.addEventListener('resize', () => chart.resize());

        if (cycleData && cycleData.points) {
            renderStateTable(domId, cycleData.points);
        }

    } catch (err) {
        console.error("Draw Chart Error:", err);
        chart.hideLoading();
        dom.innerHTML = `<div class="p-4 text-center text-red-500">Error drawing chart: ${err.message}</div>`;
    }
}

export function drawOptimizationCurve(domId, optimizationData, currentP) {
    const dom = document.getElementById(domId);
    if (!dom) return;

    dom.classList.remove('hidden');
    const existingChart = echarts.getInstanceByDom(dom);
    if (existingChart) {
        existingChart.clear(); 
    }

    let chart = existingChart || echarts.init(dom);
    chart.showLoading();

    try {
        const maxCOP = Math.max(...optimizationData.map(d => d.cop));
        let optP = 0;
        optimizationData.forEach(d => { if(d.cop === maxCOP) optP = d.p; });

        const option = {
            title: {
                text: 'CO₂ Transcritical Optimization',
                subtext: `Optimal P: ${optP.toFixed(1)} bar (COP: ${maxCOP.toFixed(3)})`,
                left: 'center',
                textStyle: { color: '#c2410c', fontWeight: 'bold' } 
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const p = params[0].value[0];
                    const cop = params[0].value[1];
                    return `<b>Pressure: ${p.toFixed(1)} bar</b><br/>COP: ${cop.toFixed(3)}`;
                }
            },
            grid: { top: 80, right: 50, bottom: 50, left: 60 },
            xAxis: {
                type: 'value',
                name: 'Gas Cooler Pressure (bar)',
                nameLocation: 'middle',
                nameGap: 30,
                min: (value) => Math.floor(value.min - 5),
                max: (value) => Math.ceil(value.max + 5)
            },
            yAxis: {
                type: 'value',
                name: 'COP (Cooling)',
                scale: true
            },
            series: [
                {
                    name: 'COP Curve',
                    type: 'line',
                    smooth: true,
                    data: optimizationData.map(d => [d.p, d.cop]),
                    lineStyle: { color: '#ea580c', width: 3 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(234, 88, 12, 0.3)' },
                            { offset: 1, color: 'rgba(234, 88, 12, 0.05)' }
                        ])
                    },
                    markLine: {
                        symbol: 'none',
                        data: [
                            { 
                                xAxis: currentP, 
                                label: { formatter: 'Current P', position: 'end' },
                                lineStyle: { color: '#333', type: 'dashed' } 
                            }
                        ]
                    }
                }
            ]
        };

        chart.hideLoading();
        chart.setOption(option);
        
        let tableDiv = dom.nextElementSibling;
        if (tableDiv && tableDiv.classList.contains('state-table-container')) {
            tableDiv.style.display = 'none';
        }

        window.addEventListener('resize', () => chart.resize());

    } catch (err) {
        console.error("Draw Opt Curve Error:", err);
        chart.hideLoading();
    }
}

export function drawPerformanceMap(domId, batchData) {
    const dom = document.getElementById(domId);
    if (!dom) return;

    dom.classList.remove('hidden');
    let chart = echarts.getInstanceByDom(dom);
    if (chart) chart.clear();
    else chart = echarts.init(dom);

    const xData = batchData.map(d => (d.v_flow * 3600).toFixed(1));
    const yPower = batchData.map(d => d.power.toFixed(2));
    const ySpecPower = batchData.map(d => d.spec_power.toFixed(2));

    const option = {
        title: {
            text: 'Performance Curve (Variable RPM)',
            subtext: 'Volume Flow vs Power & Specific Power',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' }
        },
        legend: {
            data: ['Shaft Power (kW)', 'Specific Power (kW/m³/min)'],
            bottom: 0
        },
        grid: {
            left: '3%', right: '4%', bottom: '10%', containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: xData,
            name: 'Flow (m³/h)',
            nameLocation: 'middle',
            nameGap: 25
        },
        yAxis: [
            {
                type: 'value',
                name: 'Power (kW)',
                position: 'left',
                axisLine: { show: true, lineStyle: { color: '#059669' } },
                axisLabel: { formatter: '{value} kW' }
            },
            {
                type: 'value',
                name: 'Spec. Power',
                position: 'right',
                axisLine: { show: true, lineStyle: { color: '#d97706' } },
                axisLabel: { formatter: '{value}' },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: 'Shaft Power (kW)',
                type: 'line',
                data: yPower,
                smooth: true,
                yAxisIndex: 0,
                itemStyle: { color: '#059669' },
                lineStyle: { width: 3 },
                areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0, color:'rgba(5,150,105,0.3)'}, {offset:1, color:'rgba(5,150,105,0.05)'}]) }
            },
            {
                name: 'Specific Power (kW/m³/min)',
                type: 'line',
                data: ySpecPower,
                smooth: true,
                yAxisIndex: 1,
                itemStyle: { color: '#d97706' },
                lineStyle: { width: 3, type: 'dashed' }
            }
        ]
    };

    chart.setOption(option);
    
    let tableDiv = dom.nextElementSibling;
    if (tableDiv && tableDiv.classList.contains('state-table-container')) {
        tableDiv.style.display = 'none';
    }

    window.addEventListener('resize', () => chart.resize());
}