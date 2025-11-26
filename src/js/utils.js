// =====================================================================
// utils.js: 通用工具库 (图表 & 导出 & 状态表)
// 版本: v8.25 (Fix: Excel Export Robustness)
// =====================================================================

import * as echarts from 'echarts';
// 必须确保项目已安装 xlsx: npm install xlsx
import * as XLSX from 'xlsx';

/**
 * 导出数据到 Excel (双语版)
 * @param {Object} data - 数据对象
 * @param {string} filename - 文件名
 */
export function exportToExcel(data, filename) {
    console.log("[Utils] Starting Excel export...", data);

    // 1. 检查数据是否存在
    if (!data) {
        alert("无数据可导出 (No data). 请先点击计算按钮生成结果。");
        return;
    }

    // 2. 检查依赖库是否加载
    if (!XLSX || !XLSX.utils) {
        alert("错误: 缺少 'xlsx' 库。\n请在 VS Code 终端运行: npm install xlsx\n然后重启开发服务器。");
        console.error("XLSX library not found.");
        return;
    }

    try {
        const rows = [];
        
        // --- 构建表头 ---
        rows.push(["Parameter (参数)", "Value (数值)", "Unit (单位)"]);
        rows.push(["Date 日期", data.date || new Date().toLocaleDateString(), ""]);
        rows.push(["Fluid 工质", data.fluid || "-", ""]);
        if(data.ai_model) rows.push(["Model 模型", data.ai_model, ""]);
        if(data.cycle_type) rows.push(["Cycle Type 循环类型", data.cycle_type, ""]);
        rows.push(["", "", ""]); 

        // --- 辅助函数：添加行 ---
        const addRow = (key, val, unit="") => {
            if (val !== undefined && val !== null && val !== "") {
                // 尝试转为数字以避免 Excel 里的绿色小三角警告
                const num = parseFloat(val);
                const displayVal = isNaN(num) ? val : Number(num.toFixed(4));
                rows.push([key, displayVal, unit]);
            }
        };

        // --- 1. 运行工况 ---
        rows.push(["--- OPERATING CONDITIONS 运行工况 ---", "", ""]);
        addRow("Suction Pressure 吸气压力", data.p_in, "bar");
        addRow("Suction Temp 吸气温度", data.t_in, "°C");
        
        if (data.t_gc_out !== undefined) {
            // CO2 模式
            addRow("Gas Cooler Exit Temp 气冷出口", data.t_gc_out, "°C");
            if (data.p_out) addRow("High Side Pressure 高压侧压力", data.p_out, "bar");
        } else {
            // 常规模式
            if (data.p_out) addRow("Discharge Pressure 排气压力", data.p_out, "bar");
            if (data.t_cond) addRow("Condensing Temp 冷凝温度", data.t_cond, "°C");
        }
        
        if(data.rpm) addRow("Speed 转速", data.rpm, "RPM");
        if(data.m_flow) addRow("Mass Flow 质量流量", data.m_flow * 3600, "kg/h");

        // --- 2. 效率与性能 ---
        rows.push(["", "", ""]);
        rows.push(["--- PERFORMANCE 性能数据 ---", "", ""]);
        if(data.power) addRow("Shaft Power 轴功率", data.power, "kW");
        if(data.q_evap) addRow("Cooling Capacity 制冷量", data.q_evap, "kW");
        if(data.q_cond) addRow("Heating/GC Load 制热/气冷负荷", data.q_cond, "kW");
        
        if(data.cop_c) addRow("COP (Cooling) 制冷系数", data.cop_c, "-");
        if(data.cop_h) addRow("COP (Heating) 制热系数", data.cop_h, "-");
        if(data.cop && !data.cop_c) addRow("COP 性能系数", data.cop, "-");

        // --- 3. 热管理 (如果存在) ---
        if (data.cooling_info) {
            rows.push(["", "", ""]);
            rows.push(["--- THERMAL MANAGEMENT 热管理 ---", "", ""]);
            
            let typeStr = data.cooling_info.type;
            if (typeStr === 'surface') typeStr = "Surface Cooling (表面冷却)";
            else if (typeStr === 'injection') typeStr = "Liquid Injection (喷液冷却)";
            else if (typeStr === 'adiabatic') typeStr = "Adiabatic (绝热)";
            
            addRow("Cooling Strategy 策略", typeStr, "");
            
            if(data.cooling_info.q_loss > 0) addRow("Heat Removed 移除热量", data.cooling_info.q_loss, "kW");
            if(data.cooling_info.m_inj > 0) addRow("Injection Flow 喷射流量", data.cooling_info.m_inj * 3600, "kg/h");
            if(data.cooling_info.t_raw) addRow("Adiabatic Discharge T 绝热排温", data.cooling_info.t_raw, "°C");
        }

        // --- 生成文件 ---
        const ws = XLSX.utils.aoa_to_sheet(rows);
        // 设置列宽
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 15 }]; 

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datasheet");
        
        const finalName = `${filename}_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, finalName);
        
        console.log(`[Utils] Export success: ${finalName}`);

    } catch (err) {
        console.error("[Utils] Export Error:", err);
        alert("导出 Excel 失败:\n" + err.message);
    }
}

/**
 * 在图表下方渲染状态点数据表
 */
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
                <h3 class="text-sm font-bold text-gray-700">Cycle State Points (循环状态点)</h3>
                <span class="text-xs text-gray-500">Auto-generated</span>
            </div>
            <table class="min-w-full">
                <thead class="bg-white text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                        <th class="py-2 px-4 text-center w-16">Pt 点</th>
                        <th class="py-2 px-4 text-left">Location 位置</th>
                        <th class="py-2 px-4 text-right">Pres. 压力 (bar)</th>
                        <th class="py-2 px-4 text-right">Temp. 温度 (°C)</th>
                        <th class="py-2 px-4 text-right">H 焓 (kJ/kg)</th>
                        <th class="py-2 px-4 text-right">S 熵 (kJ/kg·K)</th>
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
 * 绘制压焓图 (P-h Diagram)
 */
export function drawPhDiagram(CP, fluid, cycleData, domId) {
    const dom = document.getElementById(domId);
    if (!dom) return;

    dom.classList.remove('hidden');
    let chart = echarts.getInstanceByDom(dom);
    if (!chart) {
        chart = echarts.init(dom);
    }
    chart.showLoading();

    try {
        // 1. 获取临界参数
        const T_crit = CP.PropsSI('Tcrit', '', 0, '', 0, fluid);
        const P_crit = CP.PropsSI('Pcrit', '', 0, '', 0, fluid);
        const T_min = CP.PropsSI('Tmin', '', 0, '', 0, fluid); 
        
        // 绘图范围设定
        const T_start = T_min + 5; 
        const T_end = T_crit - 0.5; 
        const steps = 100;
        const stepSize = (T_end - T_start) / steps;

        const lineLiquid = [];
        const lineVapor = [];
        let H_crit = 0;

        // 2. 绘制饱和穹顶
        for (let i = 0; i <= steps; i++) {
            const T = T_start + i * stepSize;
            try {
                const P_liq = CP.PropsSI('P', 'T', T, 'Q', 0, fluid);
                const H_liq = CP.PropsSI('H', 'T', T, 'Q', 0, fluid);
                lineLiquid.push([H_liq / 1000.0, P_liq / 1e5]);

                const P_vap = CP.PropsSI('P', 'T', T, 'Q', 1, fluid);
                const H_vap = CP.PropsSI('H', 'T', T, 'Q', 1, fluid);
                lineVapor.push([H_vap / 1000.0, P_vap / 1e5]);
            } catch (e) { /* ignore */ }
        }

        // 计算临界点坐标
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

        // 3. 处理循环点
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
            // 闭合
            if (cycleSeriesData.length > 0) {
                cycleSeriesData.push(cycleSeriesData[0]);
            }
        }

        // 4. ECharts Option
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
                         return `<b>Critical Point 临界点</b><br/>P: ${params.value[1].toFixed(2)} bar<br/>H: ${params.value[0].toFixed(1)} kJ/kg`;
                    }
                    return params.seriesName;
                }
            },
            grid: { top: 70, right: 50, bottom: 50, left: 60 }, // 确保这里有闭合括号
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
                    symbolSize: 8,
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
        window.addEventListener('resize', () => chart.resize());

        // 更新表格
        if (cycleData && cycleData.points) {
            renderStateTable(domId, cycleData.points);
        }

    } catch (err) {
        console.error("Draw Chart Error:", err);
        chart.hideLoading();
        dom.innerHTML = `<div class="p-4 text-center text-red-500">Error drawing chart: ${err.message}</div>`;
    }
}