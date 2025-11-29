// src/js/ui-chart.js
// V18.0 Super Sized Charts: Optimized for Kiosk/Retina Displays

// 确保 Chart.js 已在 index.html 中通过 CDN 引入
// import Chart from 'chart.js/auto'; // 如使用 npm 模式请取消注释

// --- 1. 全局配置 (2X 巨幕化) ---
// 基础字体
Chart.defaults.font.family = "'Inter', 'Noto Sans SC', sans-serif";
Chart.defaults.font.size = 20; // [关键] 默认字号从 12px 提升至 20px
Chart.defaults.color = '#475569'; // Slate-600

// 坐标轴网格
Chart.defaults.scale.grid.color = '#e2e8f0'; // Slate-200
Chart.defaults.scale.grid.lineWidth = 1.5;   // 加粗网格线

// 图例 (Legend)
Chart.defaults.plugins.legend.labels.font = { size: 22, weight: 'bold' };
Chart.defaults.plugins.legend.labels.boxWidth = 24; // 色块变大
Chart.defaults.plugins.legend.labels.padding = 30;  // 间距变大

// 提示框 (Tooltip)
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)'; // Slate-900 (更深)
Chart.defaults.plugins.tooltip.titleFont = { size: 24, weight: 'bold' };
Chart.defaults.plugins.tooltip.bodyFont = { size: 20 };
Chart.defaults.plugins.tooltip.padding = 20;       // 内边距翻倍
Chart.defaults.plugins.tooltip.cornerRadius = 12;  // 圆角加大
Chart.defaults.plugins.tooltip.boxPadding = 8;     // 色块与文字间距

// --- 2. 品牌配色 (High Contrast) ---
const COLORS = {
    hp: { fill: 'rgba(37, 99, 235, 0.9)', border: '#2563eb' }, // Blue-600
    gas: { fill: 'rgba(234, 88, 12, 0.9)', border: '#ea580c' }, // Orange-600
    fuel: { fill: 'rgba(220, 38, 38, 0.9)', border: '#dc2626' }, // Red-600
    coal: { fill: 'rgba(71, 85, 105, 0.9)', border: '#475569' }, // Slate-600
    biomass: { fill: 'rgba(22, 163, 74, 0.9)', border: '#16a34a' }, // Green-600
    electric: { fill: 'rgba(147, 51, 234, 0.9)', border: '#9333ea' }, // Purple-600
    steam: { fill: 'rgba(8, 145, 178, 0.9)', border: '#0891b2' },  // Cyan-600
    opex: '#f59e0b' // Amber-500
};

// --- 实例缓存 ---
let charts = {
    cost: null,
    lcc: null
};

/**
 * 销毁现有图表
 */
export function destroyCharts() {
    if (charts.cost) {
        charts.cost.destroy();
        charts.cost = null;
    }
    if (charts.lcc) {
        charts.lcc.destroy();
        charts.lcc = null;
    }
}

/**
 * 1. 创建年度成本对比柱状图 (堆叠柱状图)
 */
export function createCostChart(ctx, labels, energyCosts, opexCosts) {
    const getColor = (name) => {
        if (!name) return '#cbd5e1';
        const n = name.toLowerCase();
        if (n.includes('热泵') || n.includes('hp')) return COLORS.hp.fill;
        if (n.includes('气') || n.includes('gas')) return COLORS.gas.fill;
        if (n.includes('油') || n.includes('fuel') || n.includes('oil')) return COLORS.fuel.fill;
        if (n.includes('煤') || n.includes('coal')) return COLORS.coal.fill;
        if (n.includes('生物') || n.includes('bio')) return COLORS.biomass.fill;
        if (n.includes('电') || n.includes('elec')) return COLORS.electric.fill;
        if (n.includes('蒸汽') || n.includes('steam')) return COLORS.steam.fill;
        return '#9ca3af';
    };

    const energyBgColors = labels.map(l => getColor(l));

    charts.cost = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '能源成本',
                    data: energyCosts,
                    backgroundColor: energyBgColors,
                    borderRadius: 6, // 圆角加大
                    stack: 'Stack 0',
                    barPercentage: 0.5, // 柱子稍微变宽
                },
                {
                    label: '运维成本',
                    data: opexCosts,
                    backgroundColor: COLORS.opex,
                    borderRadius: 6,
                    stack: 'Stack 0',
                    barPercentage: 0.5,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += parseFloat(context.parsed.y).toFixed(2) + ' 万';
                            }
                            return label;
                        },
                        footer: (tooltipItems) => {
                            let total = 0;
                            tooltipItems.forEach(function(tooltipItem) {
                                total += tooltipItem.parsed.y;
                            });
                            return '总计: ' + total.toFixed(2) + ' 万';
                        }
                    },
                    footerFont: { size: 22, weight: 'bold' } // Footer 字体特大
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { 
                        display: true, 
                        text: '万元/年',
                        font: { size: 18, weight: 'bold' } 
                    },
                    stacked: true,
                    border: { display: false },
                    ticks: { padding: 10 }
                },
                x: { 
                    stacked: true,
                    grid: { display: false },
                    ticks: { font: { size: 18, weight: 'bold' } } // X轴标签加粗加大
                }
            }
        }
    });
    return charts.cost;
}

/**
 * 2. 创建 LCC 成本构成甜甜圈图
 */
export function createLccChart(ctx, data) {
    // 处理负数显示问题
    const plotData = data.map(v => Math.abs(v));

    charts.lcc = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['初始投资', '全周期能源', '全周期运维', '残值回收'],
            datasets: [{
                data: plotData,
                backgroundColor: [
                    '#ef4444', // Red-500
                    '#3b82f6', // Blue-500
                    '#f59e0b', // Amber-500
                    '#10b981'  // Emerald-500
                ],
                borderWidth: 0,
                hoverOffset: 20 // 悬停偏移量加大
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { padding: 25 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const val = context.raw;
                            const total = context.chart._metasets[context.datasetIndex].total;
                            const percentage = ((val / total) * 100).toFixed(1) + '%';
                            const labelStr = context.label;
                            
                            if (labelStr === '残值回收') {
                                return ` ${labelStr}: -${val.toFixed(1)} 万 (${percentage})`;
                            }
                            return ` ${labelStr}: ${val.toFixed(1)} 万 (${percentage})`;
                        }
                    }
                }
            }
        }
    });
    return charts.lcc;
}