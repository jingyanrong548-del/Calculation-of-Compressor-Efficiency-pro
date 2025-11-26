console.log("🚀 Main.js is attempting to load...");
alert("Main.js start!"); // 强制弹窗
import '../css/style.css';
// =====================================================================
// main.js: Application Entry Point (Error Handling Added)
// =====================================================================

import { loadCoolProp, updateFluidInfo } from './coolprop_loader.js';
import { initMode1_2 } from './mode2_predict.js';
import { initMode3 } from './mode2c_air.js';
import { initMode4 } from './mode3_mvr.js';
import { initMode5 } from './mode4_turbo.js';
import './ui.js'; // Load UI interactions

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

    // Start Loading
    loadCoolProp()
        .then((CP) => {
            console.log("%c CoolProp WASM Loaded Successfully ", "background: #059669; color: #fff");

            // 1. Initialize Modules
            try {
                initMode1_2(CP);
                initMode3(CP);
                initMode4(CP);
                initMode5(CP);
            } catch (initErr) {
                console.error("Module Init Error:", initErr);
                alert("Error initializing calculation modules. Check console.");
            }

            // 2. Unlock Buttons
            buttons.forEach(btn => {
                if (btn) {
                    btn.textContent = btn.id.includes('co2') ? "Calculate CO₂" : "Calculate (计算)";
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            });
            
            // 3. Update Default Fluid Info
            fluidInfos.forEach(fi => {
                if (fi.select && fi.info) {
                    updateFluidInfo(fi.select, fi.info, CP);
                }
            });

        })
        .catch((err) => {
            console.error("CRITICAL ERROR:", err);
            
            // Visual Error Feedback
            buttons.forEach(btn => {
                if (btn) {
                    btn.textContent = "Library Load Failed";
                    btn.classList.add('bg-red-600', 'text-white');
                }
            });
            
            // Show Alert
            const msg = "无法加载 CoolProp 物性库。\n请检查:\n1. public/coolprop.wasm 文件是否存在\n2. 终端是否有构建错误 (.jsx 错误)";
            alert(msg);
        });

});