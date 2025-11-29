// src/js/ui-dashboard.js
// 负责 V17.0 Dashboard 布局的核心交互逻辑 (侧边栏折叠、Tabs切换、导出按钮状态、全局通知等)

// --- 状态管理 ---
const state = {
    activeTab: 'charts', // 默认激活 '图表分析'
    accordionState: {
        'accordion-project': true,   // 默认展开
        'accordion-scheme': false,
        'accordion-operating': false,
        'accordion-financial': false
    },
    notifierTimeout: null // 用于管理通知定时器
};

/**
 * 初始化仪表盘的所有交互逻辑
 */
export function initializeDashboard() {
    setupAccordion();
    setupTabs();
    setupMobileSidebar();
    
    // 初始化时，触发一次Tab状态更新，确保正确显示
    switchTab(state.activeTab);
}

/**
 * 1. 侧边栏折叠面板 (Accordion) 逻辑
 */
function setupAccordion() {
    const headers = document.querySelectorAll('.accordion-header');
    
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const contentId = header.getAttribute('aria-controls');
            const content = document.getElementById(contentId);
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            
            // 切换当前面板状态
            toggleAccordionItem(header, content, !isExpanded);
            
            // 可选：如果希望由手风琴效果（展开一个时关闭其他），可以在这里遍历关闭其他
            // 目前保持独立折叠，允许用户同时打开多个参数组
        });
    });
}

function toggleAccordionItem(header, content, shouldOpen) {
    if (!header || !content) return;
    
    if (shouldOpen) {
        content.classList.remove('hidden');
        // 稍微延迟添加 open 类以触发 CSS 动画 (如果有)
        requestAnimationFrame(() => {
            content.classList.add('open');
            header.setAttribute('aria-expanded', 'true');
        });
    } else {
        content.classList.remove('open');
        header.setAttribute('aria-expanded', 'false');
        // 等待动画结束后隐藏 (这里简化处理直接隐藏，可配合 CSS transition)
        setTimeout(() => {
            if (header.getAttribute('aria-expanded') === 'false') {
                content.classList.add('hidden');
            }
        }, 300); // 需与 CSS duration 匹配
    }
}

/**
 * 手动展开指定的 Accordion (供外部调用，例如校验出错时定位)
 * @param {string} groupId - 如 'accordion-project'
 */
export function openAccordionGroup(groupId) {
    const container = document.getElementById(groupId);
    if (!container) return;
    
    const header = container.querySelector('.accordion-header');
    const content = container.querySelector('.accordion-content');
    
    if (header && content) {
        toggleAccordionItem(header, content, true);
        // 滚动到该位置
        setTimeout(() => {
            header.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

/**
 * 2. 结果区标签页 (Tabs) 逻辑
 */
function setupTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    
    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = link.dataset.tab;
            if (targetTab) {
                switchTab(targetTab);
            }
        });
    });
}

export function switchTab(tabId) {
    // 1. 更新 Links 状态
    document.querySelectorAll('.tab-link').forEach(link => {
        if (link.dataset.tab === tabId) {
            link.classList.add('tab-active');
        } else {
            link.classList.remove('tab-active');
        }
    });

    // 2. 更新 Content 状态
    document.querySelectorAll('.tab-content').forEach(content => {
        // content 的 ID 约定为 "tab-{tabId}"
        if (content.id === `tab-${tabId}`) {
            content.classList.remove('hidden');
            // 触发可能存在的图表重绘 (Chart.js 有时在 hidden 容器中渲染会有大小问题)
            triggerChartResize(content);
        } else {
            content.classList.add('hidden');
        }
    });

    state.activeTab = tabId;
}

// 辅助：当 Tab 切换显示时，触发内部 Canvas 的 resize
function triggerChartResize(container) {
    const canvases = container.querySelectorAll('canvas');
    canvases.forEach(canvas => {
        // 手动触发 window resize 事件通常能强制刷新布局
        window.dispatchEvent(new Event('resize'));
    });
}

/**
 * 3. 移动端侧边栏逻辑 (预留)
 */
function setupMobileSidebar() {
    // 预留位置
}

/**
 * 4. 界面状态更新辅助函数
 */

// 更新导出按钮状态
export function setExportButtonState(isEnabled) {
    const btn = document.getElementById('export-report-btn');
    if (!btn) return;

    if (isEnabled) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:bg-blue-700', 'shadow-md');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.classList.remove('hover:bg-blue-700', 'shadow-md');
    }
}

// 滚动到结果区域
export function scrollToResults() {
    const mainArea = document.getElementById('main-results-area');
    if (mainArea && window.innerWidth < 1024) { // 仅在移动端/平板端自动滚
        mainArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * 在结果区域显示 Empty State (占位符)
 */
export function showResultsPlaceholder() {
    const placeholder = document.getElementById('report-placeholder');
    const content = document.getElementById('report-content');
    
    if (placeholder) placeholder.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    
    // 重置卡片数据
    updateResultCard('annual-saving', '-- 万');
    updateResultCard('irr', '-- %');
    updateResultCard('pbp', '-- 年');
    updateResultCard('co2-reduction', '-- 吨');
}

/**
 * 显示实际结果内容
 */
export function showResultsContent() {
    const placeholder = document.getElementById('report-placeholder');
    const content = document.getElementById('report-content');
    
    if (placeholder) placeholder.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    
    // 重新校准 Tab
    switchTab(state.activeTab);
}

/**
 * 更新单个结果卡片的数值
 */
export function updateResultCard(key, value, colorClass = null) {
    const el = document.getElementById(`card-${key}`);
    if (el) {
        el.textContent = value;
        if (colorClass) {
            el.className = el.className.replace(/text-\w+-\d+/, colorClass);
        }
    }
}

/**
 * [新增] 显示全局通知
 * @param {string} message - 通知内容
 * @param {'success'|'error'|'info'} type - 通知类型
 * @param {number} duration - 显示时长 (毫秒)
 */
export function showGlobalNotification(message, type = 'info', duration = 3000) {
    const notifier = document.getElementById('global-notifier');
    const notifierText = document.getElementById('global-notifier-text');
    const iconSuccess = document.getElementById('global-notifier-icon-success');
    const iconError = document.getElementById('global-notifier-icon-error');
    
    if (!notifier || !notifierText) return;

    if (state.notifierTimeout) clearTimeout(state.notifierTimeout);

    notifierText.textContent = message;
    notifier.className = 'fixed top-5 right-5 z-50 max-w-sm p-4 rounded-lg shadow-lg flex items-center transition-opacity transition-transform duration-300';
    
    if (iconSuccess) iconSuccess.classList.add('hidden');
    if (iconError) iconError.classList.add('hidden');
    
    if (type === 'success') {
        notifier.classList.add('bg-green-100', 'text-green-800');
        if (iconSuccess) iconSuccess.classList.remove('hidden');
    } else if (type === 'error') {
        notifier.classList.add('bg-red-100', 'text-red-800');
        if (iconError) iconError.classList.remove('hidden');
    } else {
        notifier.classList.add('bg-blue-100', 'text-blue-800');
        if (iconSuccess) iconSuccess.classList.remove('hidden');
    }
    
    notifier.classList.remove('hidden', 'opacity-0', 'translate-x-full');
    
    state.notifierTimeout = setTimeout(() => {
        notifier.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => notifier.classList.add('hidden'), 300);
    }, duration);
}