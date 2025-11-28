console.log("🚀 Main.js is attempting to load...");

import '../css/style.css';
// =====================================================================
// main.js: Application Entry Point (v8.34 PWA Enabled)
// =====================================================================

import { loadCoolProp, updateFluidInfo } from './coolprop_loader.js';
import { initMode1_2 } from './mode2_predict.js';
import { initMode3 } from './mode2c_air.js';
import { initMode4 } from './mode3_mvr.js';
import { initMode5 } from './mode4_turbo.js';
import { AutoSaveManager } from './utils.js';
import './ui.js'; // Load UI interactions (includes Case Management logic)

// --- 1. PWA Service Worker Registration ---
// 仅在浏览器支持且在非开发环境（或需要测试离线功能时）生效
// --- 1. PWA Service Worker (强制注销模式 - 用于开发调试) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister(); // <--- 强制注销所有 SW
                console.log("🧹 Service Worker 已强制注销，请再次刷新页面！");
            }
        });
    });
}

// --- 2. App Initialization ---
document.addEventListener('DOMContentLoaded', () => {

    const buttons = [
        document.getElementById('calc-button-1'), 
        document.getElementById('calc-button-1-co2'), 
        document.getElementById('calc-button-2'), 
        document.getElementById('calc-button-3'), 
        document.getElementById('calc-button-4'), 
        document.getElementById('calc-button-5')
    ];
    
    const fluidInfos = [
        { select: document.getElementById('fluid_m1'), info: document.getElementById('fluid-info-m1') },
        { select: document.getElementById('fluid_m2'), info: document.getElementById('fluid-info-m2') },
        { select: document.getElementById('fluid_m4'), info: document.getElementById('fluid-info-m4') },
        { select: document.getElementById('fluid_m5'), info: document.getElementById('fluid-info-m5') }
    ];

    // Lock buttons initially
    buttons.forEach(btn => {
        if(btn) {
            btn.disabled = true;
            btn.textContent = "Loading Library...";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });

    // Start Loading WASM
    loadCoolProp()
        .then((CP) => {
            console.log("%c CoolProp WASM Loaded Successfully ", "background: #059669; color: #fff");

            // Initialize Calculation Modules
            try {
                initMode1_2(CP);
                initMode3(CP);
                initMode4(CP);
                initMode5(CP);
                
                // Initialize AutoSave (Last State Persistence)
                // Delayed slightly to ensure UI listeners are attached
                setTimeout(() => {
                    AutoSaveManager.init();
                }, 100); 

            } catch (initErr) {
                console.error("Module Init Error:", initErr);
                alert("Error initializing calculation modules. Check console.");
            }

            // Unlock Buttons & Restore Text
            buttons.forEach(btn => {
                if (btn) {
                    // Restore specific Chinese labels
                    if(btn.id === 'calc-button-1') btn.textContent = "计算常规热泵";
                    else if(btn.id === 'calc-button-1-co2') btn.textContent = "🔥 计算 CO2 (R744) 循环";
                    else if(btn.id === 'calc-button-2') btn.textContent = "计算气体压缩";
                    else if(btn.id === 'calc-button-3') btn.textContent = "计算空压机";
                    else if(btn.id === 'calc-button-4') btn.textContent = "计算喷水量";
                    else if(btn.id === 'calc-button-5') btn.textContent = "计算透平 MVR";
                    else btn.textContent = "Calculate";

                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            });
            
            // Update Default Fluid Info
            fluidInfos.forEach(fi => {
                if (fi.select && fi.info) {
                    updateFluidInfo(fi.select, fi.info, CP);
                }
            });

        })
        .catch((err) => {
            console.error("CRITICAL ERROR:", err);
            
            buttons.forEach(btn => {
                if (btn) {
                    btn.textContent = "Library Load Failed";
                    btn.classList.add('bg-red-600', 'text-white');
                }
            });
            
            const msg = "无法加载 CoolProp 物性库 (WASM Load Failed)。\n请检查网络连接，或确保 coolprop.wasm 文件存在。";
            alert(msg);
        });

});