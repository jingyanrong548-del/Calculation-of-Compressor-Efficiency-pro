// =====================================================================
// utils.js: 通用工具库 (图表 & 导出 & 状态表)
// 版本: v8.3 (新增状态点数据表)
// =====================================================================

import * as echarts from 'echarts';
import * as XLSX from 'xlsx';

/**
 * 导出数据到 Excel
 * @param {Object} data - 数据对象
 * @param {string} filename - 文件名
 */
export function exportToExcel(data, filename) {
    if (!data) {
        alert("无数据可导出 (No data to export)");
        return;
    }

    const rows = [];
    
    // Header
    rows.push(["Parameter (参数)", "Value (数值)", "Unit (单位)"]);
    rows.push(["Date", data.date || new Date().toLocaleDateString(), ""]);
    rows.push(["Fluid", data.fluid || "-", ""]);
    if(data.ai_model) rows.push(["Model", data.ai_model, ""]);
    rows.push(["", "", ""]); 

    // Helper
    const addRow = (key, val, unit="") => {
        if (val !== undefined && val !== null) {
            const formattedVal = typeof val === 'number' ? val.toFixed(4) : val;
            rows.push([key, formattedVal, unit]);
        }
    };

    // 自动遍历第一层属性 (简单处理)
    // 实际项目中，建议根据 data 结构显式添加，或者保留之前硬编码的顺序以保证美观
    // 这里为了通用性，保留之前的逻辑或根据传入 data 动态生成
    // 假设调用方传入的是扁平化或包含特定 key 的对象
    
    // --- Inputs ---
    rows.push(["--- INPUTS ---", "", ""]);
    if(data.p_in) addRow("Suction Pressure", data.p_in, "bar");
    if(data.t_in) addRow("Suction Temp", data.t_in, "°C");
    if(data.p_out) addRow("Discharge Pressure", data.p_out, "bar");
    if(data.rpm) addRow("Speed", data.rpm, "RPM");
    
    // --- Results ---
    rows.push(["", "", ""]);
    rows.push(["--- RESULTS ---", "", ""]);
    if(data.power) addRow("Shaft Power", data.power, "kW");
    if(data.m_flow) addRow("Mass Flow", data.m_flow * 3600, "kg/h");
    if(data.t_out) addRow("Discharge Temp", data.t_out, "°C");
    if(data.q_evap) addRow("Cooling Capacity", data.q_evap, "kW");
    if(data.q_cond) addRow("Heating Capacity", data.q_cond, "kW");
    if(data.cop_c) addRow("COP (Cooling)", data.cop_c, "-");
    if(data.cop_h) addRow("COP (Heating)", data.cop_h, "-");
    
    // Create Sheet
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }];

    // Create Book
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datasheet");
    
    // Download
    XLSX.writeFile(wb, `${filename}_${new Date().getTime()}.xlsx`);
}

/**
 * [核心新增] 在图表下方渲染状态点数据表
 * @param {string} domId - 图表容器 ID
 * @param {Array} points - 状态点数组 [{name:'1', desc:'Suction', p:Pa, t:K, h:J/kg, s:J/kgK}, ...]
 */
export function renderStateTable(domId, points) {
    const chartDiv = document.getElementById(domId);
    if (!chartDiv) return;

    // 1. 查找或创建表格容器
    // 避免重复添加：先检查 chartDiv 的下一个兄弟元素是不是我们的表格容器
    let tableDiv = chartDiv.nextElementSibling;
    if (!tableDiv || !tableDiv.classList.contains('state-table-container')) {
        tableDiv = document.createElement('div');
        tableDiv.className = 'state-table-container mt-6 mb-8'; // Tailwind margin
        chartDiv.parentNode.insertBefore(tableDiv, chartDiv.nextSibling);
    }

    // 2. 生成表格 HTML
    // 使用 Tailwind CSS 样式
    const rowsHtml = points.map(pt => `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="py-3 px-4 font-bold text-teal-700 text-center bg-gray-50">${pt.name}</td>
            <td class="py-3 px-4 text-xs text-gray-600 font-medium">${pt.desc}</td>
            <td class="py-3 px-4 text-right font-mono text-sm text-gray-800">${(pt.p / 1e5).toFixed(3)}</td>
            <td class="py-3 px-4 text-right font-mono text-sm font-bold text-blue-600">${(pt.t - 273.15).toFixed(2)}</td>
            <td class="py-3 px-4 text-right font-mono text-xs text-gray-500">${(pt.h / 1000).toFixed(1)}</td>
            <td class="py-3 px-4 text-right font-mono text-xs text-gray-500">${(pt.s / 1000).toFixed(3)}</td>
        </tr>
    `).join('');

    tableDiv.innerHTML = `
        <div class="overflow-x-auto border border-gray-200 rounded-lg shadow-sm bg-white">
            <div class="bg-gray-100 px-4 py-2 border-b border-gray-200">
                <h3 class="text-sm font-bold text-gray-700">Cycle State Points (循环状态点)</h3>
            </div>
            <table class="min-w-full">
                <thead class="bg-white text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                        <th class="py-2 px-4 text-center w-16">Point</th>
                        <th class="py-2 px-4 text-left">Location (位置)</th>
                        <th class="py-2 px-4 text-right">Pres. (bar)</th>
                        <th class="py-2 px-4 text-right">Temp. (°C)</th>
                        <th class="py-2 px-4 text-right">Enthalpy (kJ/kg)</th>
                        <th class="py-2 px-4 text-right">Entropy (kJ/kg·K)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * 绘制压焓图 (P-h Diagram) 并调用表格渲染
 * @param {Object} CP - CoolProp 实例
 * @param {string} fluid - 工质名称
 * @param {Object} cycleData - 包含 points 的数据对象
 * @param {string} domId - 图表容器 ID
 */
export function drawPhDiagram(CP, fluid, cycleData, domId) {
    const dom = document.getElementById(domId);
    if (!dom) return;

    // 确保容器可见
    dom.classList.remove('hidden');
    
    // 初始化图表
    let chart = echarts.getInstanceByDom(dom);
    if (!chart) {
        chart = echarts.init(dom);
    }
    chart.showLoading();

    try {
        // 1. 计算饱和曲线 (Dome)
        const T_crit = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
        const T_min = CP.PropsSI('Tmin', '', 0, '', 0, fluid);
        
        // 稍微缩减范围以防计算报错
        const T_start = T_min + 5; 
        const T_end = T_crit - 2.0; 
        const steps = 60;
        const stepSize = (T_end - T_start) / steps;

        const lineLiquid = [];
        const lineVapor = [];

        for (let i = 0; i <= steps; i++) {
            const T = T_start + i * stepSize;
            try {
                const P_liq = CP.PropsSI('P', 'T', T, 'Q', 0, fluid);
                const H_liq = CP.PropsSI('H', 'T', T, 'Q', 0, fluid);
                const P_vap = CP.PropsSI('P', 'T', T, 'Q', 1, fluid);
                const H_vap = CP.PropsSI('H', 'T', T, 'Q', 1, fluid);
                
                // ECharts [x, y] -> [H(kJ/kg), P(bar)]
                lineLiquid.push([H_liq / 1000.0, P_liq / 1e5]);
                lineVapor.push([H_vap / 1000.0, P_vap / 1e5]);
            } catch (e) { /* ignore calculation errors near crit point */ }
        }

        // 2. 处理循环点 (Cycle Lines)
        const cycleSeriesData = [];
        if (cycleData && cycleData.points) {
            cycleData.points.forEach(pt => {
                cycleSeriesData.push({
                    name: pt.name,
                    value: [pt.h / 1000.0, pt.p / 1e5],
                    // 额外数据供 Tooltip 使用
                    labelInfo: {
                        t: (pt.t - 273.15).toFixed(2),
                        desc: pt.desc
                    }
                });
            });
            // 闭合循环
            if (cycleSeriesData.length > 0) {
                cycleSeriesData.push(cycleSeriesData[0]);
            }
        }

        // 3. ECharts Option
        const option = {
            title: { 
                text: `Pressure-Enthalpy Diagram: ${fluid}`, 
                left: 'center', 
                top: 10,
                textStyle: { fontSize: 14, color: '#333' }
            },
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    if (params.seriesName === 'Cycle') {
                        const info = params.data.labelInfo;
                        let s = `<b>Point ${params.name}</b><br/>`;
                        if(info && info.desc) s += `<span style="font-size:10px; color:#ccc">${info.desc}</span><br/>`;
                        s += `P: ${params.value[1].toFixed(3)} bar<br/>`;
                        s += `H: ${params.value[0].toFixed(1)} kJ/kg<br/>`;
                        if (info) s += `T: ${info.t} °C`;
                        return s;
                    }
                    return params.seriesName;
                }
            },
            grid: { top: 60, right: 50, bottom: 50, left: 60 },
            xAxis: { 
                name: 'Enthalpy (kJ/kg)', 
                nameLocation: 'middle',
                nameGap: 30,
                type: 'value', 
                scale: true, 
                splitLine: { show: false },
                axisLabel: { formatter: '{value}' }
            },
            yAxis: { 
                name: 'Pressure (bar)', 
                type: 'log', 
                logBase: 10, 
                scale: true,
                axisLabel: { formatter: (value) => Number(value).toString() } // 简化的对数标签
            },
            series: [
                { 
                    name: 'Sat. Liquid', 
                    type: 'line', 
                    showSymbol: false, 
                    data: lineLiquid, 
                    lineStyle: { color: '#0000ff', width: 1.5 },
                    silent: true // 不触发 tooltip
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
                    name: 'Cycle',
                    type: 'line',
                    data: cycleSeriesData,
                    symbol: 'circle',
                    symbolSize: 8,
                    label: { 
                        show: true, 
                        formatter: '{@name}', 
                        position: 'right', 
                        fontWeight: 'bold', 
                        fontSize: 12,
                        color: '#000',
                        distance: 5
                    },
                    lineStyle: { color: '#059669', width: 2.5 },
                    itemStyle: { color: '#059669', borderColor: '#fff', borderWidth: 1 }
                }
            ]
        };

        chart.hideLoading();
        chart.setOption(option);
        
        // 响应式
        window.addEventListener('resize', () => chart.resize());

        // [关键] 调用表格渲染函数
        if (cycleData && cycleData.points) {
            renderStateTable(domId, cycleData.points);
        }

    } catch (err) {
        console.error("Draw Chart Error:", err);
        chart.hideLoading();
        dom.innerHTML = `<div class="p-4 text-center text-red-500">Error drawing chart: ${err.message}</div>`;
    }
}