// =====================================================================
// main.js: 应用主入口 (总指挥)
// 版本: v7.0 (五模式重构)
// 职责: 1. 加载 UI 交互 (ui.js)。
//        2. 加载 CoolProp 物性库 (coolprop_loader.js)。
//        3. 在物性库加载成功后, 初始化所有5个计算模式。
// =====================================================================

// 1. 导入所有需要的模块
import { loadCoolProp, updateFluidInfo } from './coolprop_loader.js';
import { initMode2 } from './mode2_predict.js'; // 将负责初始化新的模式1(热泵)和模式2(气体)
import { initMode2C } from './mode2c_air.js';    // 将负责初始化新的模式3(空压机)
import { initMode3 } from './mode3_mvr.js';      // 将负责初始化新的模式4(MVR 容积式)
import { initMode4 } from './mode4_turbo.js';    // 将负责初始化新的模式5(MVR 透平式)

// 2. 导入并执行 UI 交互脚本
import './ui.js'; 

// 3. 主应用逻辑: 等待 DOM 加载完毕
document.addEventListener('DOMContentLoaded', () => {

    // 4. 定义所有需要被更新状态的元素 (v7.0 更新)
    const buttons = [
        document.getElementById('calc-button-1'), // 模式一: 热泵
        document.getElementById('calc-button-2'), // 模式二: 气体
        document.getElementById('calc-button-3'), // 模式三: 空压机
        document.getElementById('calc-button-4'), // 模式四: MVR 容积式
        document.getElementById('calc-button-5')  // 模式五: MVR 透平式
    ];
    
    const fluidInfos = [
        { select: document.getElementById('fluid_m1'), info: document.getElementById('fluid-info-m1') }, // 热泵
        { select: document.getElementById('fluid_m2'), info: document.getElementById('fluid-info-m2') }, // 气体
        // 模式三 (空压机) 无工质选择
        { select: document.getElementById('fluid_m4'), info: document.getElementById('fluid-info-m4') }, // MVR 容积式
        { select: document.getElementById('fluid_m5'), info: document.getElementById('fluid-info-m5') }  // MVR 透平式
    ];

    // (v7.0) 按钮的初始文本
    const buttonTexts = {
        'calc-button-1': "计算性能 (热泵)",
        'calc-button-2': "计算性能 (气体)",
        'calc-button-3': "计算性能 (空压机)",
        'calc-button-4': "计算喷水量 (MVR 容积式)",
        'calc-button-5': "计算喷水量 (MVR 透平式)"
    };
    
    // 5. 立即调用 CoolProp 加载器
    loadCoolProp()
        .then((CP) => {
            // 6. (成功) 物性库加载成功!
            console.log("CoolProp loaded successfully.");

            // 6.1 初始化所有计算模块, 将 CP 实例传入
            initMode2(CP);
            initMode2C(CP);
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