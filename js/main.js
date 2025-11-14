// =====================================================================
// main.js: 应用主入口 (总指挥)
// 版本: v5.0 (增加模式 2C)
// 职责: 1. 加载 UI 交互 (ui.js)
//        2. 加载 CoolProp 物性库 (coolprop_loader.js)
//        3. 在物性库加载成功后, 初始化所有计算模式 (Mode 1, 2A, 2B, 2C, 3, 4)
// =====================================================================

// 1. 导入所有需要的模块
import { loadCoolProp, updateFluidInfo } from './coolprop_loader.js';
import { initMode1 } from './mode1_eval.js';
import { initMode2 } from './mode2_predict.js';
import { initMode2C } from './mode2c_air.js'; // v5.0 新增
import { initMode3 } from './mode3_mvr.js';
import { initMode4 } from './mode4_turbo.js';

// 2. 导入并执行 UI 交互脚本
// (这个导入会执行 ui.js 里的 'DOMContentLoaded' 监听器)
import './ui.js'; 

// 3. 主应用逻辑: 等待 DOM 加载完毕
document.addEventListener('DOMContentLoaded', () => {

    // 4. 定义所有需要被更新状态的元素
    const buttons = [
        document.getElementById('calc-button-mode-1'),
        document.getElementById('calc-button-mode-2'),  // 模式 2A
        document.getElementById('calc-button-mode-2b'), // 模式 2B
        document.getElementById('calc-button-mode-2c'), // v5.0 新增
        document.getElementById('calc-button-mode-3'),
        document.getElementById('calc-button-mode-4')
    ];
    
    const fluidInfos = [
        { select: document.getElementById('fluid'), info: document.getElementById('fluid-info') },
        { select: document.getElementById('fluid_m2'), info: document.getElementById('fluid-info-m2') },
        { select: document.getElementById('fluid_m2b'), info: document.getElementById('fluid-info-m2b') },
        // v5.0: 模式 2C (空压机) 无工质选择
        { select: document.getElementById('fluid_m3'), info: document.getElementById('fluid-info-m3') },
        { select: document.getElementById('fluid_m4'), info: document.getElementById('fluid-info-m4') }
    ];

    // (v4.2) 按钮的初始文本
    const buttonTexts = {
        'calc-button-mode-1': "计算效率 (模式一)",
        'calc-button-mode-2': "计算性能 (模式 2A)",
        'calc-button-mode-2b': "计算性能 (模式 2B)",
        'calc-button-mode-2c': "计算性能 (模式 2C)", // v5.0 新增
        'calc-button-mode-3': "计算喷水量 (模式三)",
        'calc-button-mode-4': "计算喷水量 (模式四)"
    };
    
    // 5. 立即调用 CoolProp 加载器
    loadCoolProp()
        .then((CP) => {
            // 6. (成功) 物性库加载成功!
            console.log("CoolProp loaded successfully.");

            // 6.1 初始化所有计算模块, 将 CP 实例传入
            initMode1(CP);
            initMode2(CP); // 模式二(v4.2)会同时初始化 2A 和 2B
            initMode2C(CP); // v5.0 新增
            initMode3(CP);
            initMode4(CP);

            // 6.2 更新所有计算按钮的状态
            buttons.forEach(btn => {
                if (btn) {
                    btn.textContent = buttonTexts[btn.id] || "计算";
                    btn.disabled = false;
                }
            });
            
            // 6.3 更新所有物性显示框, 显示默认工质信息
            fluidInfos.forEach(fi => {
                if (fi.select && fi.info) {
                    // 触发一次 updateFluidInfo 来显示初始信息
                    updateFluidInfo(fi.select, fi.info, CP);
                }
            });

        })
        .catch((err) => {
            // 7. (失败) 物性库加载失败!
            console.error("Failed to load CoolProp:", err);
            const errorMsg = `物性库加载失败: ${err.message}`;
            
            // 7.1 禁用所有按钮并显示错误
            buttons.forEach(btn => {
                if (btn) {
                    btn.textContent = "物性库加载失败";
                    btn.disabled = true;
                }
            });
            
            // 7.2 在所有物性框显示错误
            fluidInfos.forEach(fi => {
                if (fi.info) {
                    fi.info.textContent = errorMsg;
                }
            });
        });

});