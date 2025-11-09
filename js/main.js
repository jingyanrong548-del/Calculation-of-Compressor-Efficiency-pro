// =====================================================================
// main.js: 应用程序主入口
// 版本: v3.0
// 职责: 1. 导入所有模块
//        2. 加载 CoolProp 物性库
//        3. 初始化所有 UI 和计算模式
// =====================================================================

// 1. 导入所有必需的模块
import { loadCoolProp, updateFluidInfo } from './coolprop_loader.js';
import { initUI } from './ui.js';
import { initMode1 } from './mode1_eval.js';
import { initMode2 } from './mode2_predict.js';
import { initMode3 } from './mode3_mvr.js';

// 2. 定义一个函数来更新所有结果/按钮的状态
function updateGlobalUIState(state, messageOrCP) {
    const allButtons = [
        document.getElementById('calc-button-mode-1'),
        document.getElementById('calc-button-mode-2'),
        document.getElementById('calc-button-mode-3')
    ];
    
    const allResults = [
        document.getElementById('results-mode-1'),
        document.getElementById('results-mode-2'),
        document.getElementById('results-mode-3')
    ];

    if (state === 'loading') {
        const msg = "--- 正在加载物性库 (coolprop.js & coolprop.wasm)... ---";
        allResults.forEach(res => { if(res) res.textContent = msg; });
        allButtons.forEach(btn => { 
            if(btn) {
                btn.disabled = true;
                btn.textContent = "正在加载...";
            }
        });
    } else if (state === 'success') {
        const msg = "--- 物性库加载成功，请输入参数并点击计算 ---";
        allResults.forEach(res => { if(res) res.textContent = msg; });
        
        // 激活按钮
        allButtons[0].disabled = false;
        allButtons[0].textContent = "计算效率 (模式一)";
        allButtons[1].disabled = false;
        allButtons[1].textContent = "计算性能 (模式二)";
        allButtons[2].disabled = false;
        allButtons[2].textContent = "计算喷水量 (模式三)";

        // 成功后，立即更新所有物性信息显示
        const CP = messageOrCP;
        updateFluidInfo(document.getElementById('fluid'), document.getElementById('fluid-info'), CP);
        updateFluidInfo(document.getElementById('fluid_m2'), document.getElementById('fluid-info-m2'), CP);
        updateFluidInfo(document.getElementById('fluid_m3'), document.getElementById('fluid-info-m3'), CP);

    } else if (state === 'error') {
        const errorMsg = `物性库加载失败: ${messageOrCP}\n\n请检查文件路径是否正确，并确保使用本地服务器 (http://) 运行。`;
        allResults.forEach(res => { if(res) res.textContent = errorMsg; });
        allButtons.forEach(btn => { 
            if(btn) {
                btn.disabled = true;
                btn.textContent = "加载失败";
            }
        });
    }
}

// 3. 定义主启动函数
async function startApp() {
    // 3.1 立即显示“正在加载”
    updateGlobalUIState('loading');

    try {
        // 3.2 尝试加载物性库 (最关键的异步步骤)
        const CP = await loadCoolProp();
        
        // 3.3 物性库加载成功
        console.log("CoolProp 物性库加载成功。");
        updateGlobalUIState('success', CP);

        // 3.4 开始初始化所有功能模块，并将 CP 实例传递给它们
        
        // 初始化主 UI 逻辑 (选项卡切换, 模式一/二切换)
        initUI(); 
        
        // 初始化模式一 (评估)
        initMode1(CP);
        
        // 初始化模式二 (预测)
        initMode2(CP);
        
        // 初始化模式三 (MVR)
        initMode3(CP);

        console.log("压缩机计算器 v3.0 已成功启动。");

    } catch (err) {
        // 3.5 物性库加载失败
        console.error("应用程序启动失败:", err);
        updateGlobalUIState('error', err.message);
    }
}

// 4. 执行启动
startApp();