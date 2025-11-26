// =====================================================================
// ui.js: UI 界面交互逻辑
// 版本: v8.33 (Feature: AI Efficiency Presets & Event-Driven UI)
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("UI: Initializing Interface Logic...");

    // -----------------------------------------------------------------
    // 1. 主选项卡 (Tab) 切换逻辑 (Main Tabs 1-5)
    // -----------------------------------------------------------------
    const tabIds = [1, 2, 3, 4, 5];
    
    const tabs = tabIds.map(id => ({
        id: id,
        btn: document.getElementById(`tab-btn-${id}`),
        content: document.getElementById(`tab-content-${id}`)
    })).filter(t => t.btn && t.content);

    tabs.forEach(tab => {
        tab.btn.addEventListener('click', () => {
            // Reset all
            tabs.forEach(t => {
                t.btn.classList.remove('active', 'text-teal-600', 'border-teal-600', 'bg-teal-50');
                t.btn.classList.add('text-gray-600');
                t.content.style.display = 'none';
            });
            // Activate current
            tab.btn.classList.remove('text-gray-600');
            tab.btn.classList.add('active', 'text-teal-600', 'border-teal-600', 'bg-teal-50');
            tab.content.style.display = 'block';
            
            window.dispatchEvent(new Event('resize'));
        });
    });

    // -----------------------------------------------------------------
    // 2. 模式 1 子选项卡切换 (常规制冷 vs CO2循环)
    // -----------------------------------------------------------------
    const btnStd = document.getElementById('sub-tab-std');
    const btnCo2 = document.getElementById('sub-tab-co2');
    const panelStd = document.getElementById('panel-m1-std');
    const panelCo2 = document.getElementById('panel-m1-co2');

    if (btnStd && btnCo2 && panelStd && panelCo2) {
        const switchMode1Tab = (isCo2) => {
            if (isCo2) {
                btnStd.classList.remove('active', 'bg-green-600', 'text-white', 'border-green-600');
                btnCo2.classList.add('active', 'bg-gray-800', 'text-white', 'border-gray-800');
                panelStd.classList.add('hidden'); 
                panelCo2.classList.remove('hidden');
            } else {
                btnCo2.classList.remove('active', 'bg-gray-800', 'text-white', 'border-gray-800');
                btnStd.classList.add('active', 'bg-green-600', 'text-white', 'border-green-600');
                panelCo2.classList.add('hidden');
                panelStd.classList.remove('hidden');
            }
        };
        btnStd.addEventListener('click', () => switchMode1Tab(false));
        btnCo2.addEventListener('click', () => switchMode1Tab(true));
    }

    // -----------------------------------------------------------------
    // 3. Mode 1 CO2 循环类型切换 (跨临界 vs 亚临界)
    // -----------------------------------------------------------------
    function setupCo2CycleToggle() {
        const radios = document.querySelectorAll('input[name="cycle_type_m1_co2"]');
        const divTrans = document.getElementById('inputs-transcritical-m1-co2');
        const divSub = document.getElementById('inputs-subcritical-m1-co2');

        if (!radios.length || !divTrans || !divSub) return;

        const update = () => {
            const val = document.querySelector('input[name="cycle_type_m1_co2"]:checked')?.value;
            if (!val) return;

            if (val === 'transcritical') {
                divTrans.classList.remove('hidden');
                divSub.classList.add('hidden');
                divTrans.querySelectorAll('input').forEach(i => i.disabled = false);
                divSub.querySelectorAll('input').forEach(i => i.disabled = true);
            } else {
                divTrans.classList.add('hidden');
                divSub.classList.remove('hidden');
                divTrans.querySelectorAll('input').forEach(i => i.disabled = true);
                divSub.querySelectorAll('input').forEach(i => i.disabled = false);
            }
        };

        radios.forEach(r => r.addEventListener('change', update));
        update(); // Init
    }
    setupCo2CycleToggle();

    // -----------------------------------------------------------------
    // 4. 流量输入框切换逻辑 (通用 + Mode 3 Batch)
    // -----------------------------------------------------------------
    function setupFlowToggle(modeSuffix) {
        const radioName = `flow_mode_${modeSuffix}`;
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        
        if (!radios.length) return;

        const updateVisibility = () => {
            const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
            if (!checkedRadio) return;
            
            const val = checkedRadio.value;
            const divRpm = document.getElementById(`flow-inputs-rpm-${modeSuffix}`);
            const divMass = document.getElementById(`flow-inputs-mass-${modeSuffix}`);
            const divVol = document.getElementById(`flow-inputs-vol-${modeSuffix}`);

            const setDisplay = (el, show, displayType = 'block') => {
                if (!el) return;
                if (show) {
                    el.classList.remove('hidden');
                    el.style.display = displayType;
                    el.querySelectorAll('input').forEach(i => i.disabled = false);
                } else {
                    el.classList.add('hidden');
                    el.style.display = 'none';
                    el.querySelectorAll('input').forEach(i => i.disabled = true);
                }
            };

            // Mode 3 (Air) Batch Logic
            if (modeSuffix === 'm3') {
                const isBatch = document.getElementById('batch_mode_m3')?.checked;
                const divBatch = document.getElementById('flow-inputs-batch-m3');
                
                if (val === 'rpm') {
                    setDisplay(divRpm, !isBatch, 'grid');
                    setDisplay(divBatch, isBatch, 'block');
                } else {
                    setDisplay(divRpm, false);
                    setDisplay(divBatch, false);
                }
            } else {
                setDisplay(divRpm, val === 'rpm', 'grid');
            }

            setDisplay(divMass, val === 'mass');
            setDisplay(divVol, val === 'vol');
        };

        radios.forEach(r => r.addEventListener('change', updateVisibility));
        
        // Mode 3 Special Batch Toggle Listener
        if (modeSuffix === 'm3') {
            const batchChk = document.getElementById('batch_mode_m3');
            if(batchChk) {
                batchChk.addEventListener('change', updateVisibility);
            }
        }

        updateVisibility(); 
    }

    ['m1', 'm1_co2', 'm2', 'm3', 'm4', 'm5'].forEach(setupFlowToggle);

    // -----------------------------------------------------------------
    // 5. AI 效率预设联动逻辑 (New in v8.33)
    // -----------------------------------------------------------------
    function setupAiPresets() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                // 触发 input 事件以通知 AutoSave 或其他监听器
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };

        const setRadio = (name, val) => {
            const radios = document.querySelectorAll(`input[name="${name}"]`);
            radios.forEach(r => {
                if (r.value === val) {
                    r.click(); // Click triggers change event automatically
                }
            });
        };

        // --- Mode 1: Standard Heat Pump ---
        const aiM1 = document.getElementById('ai_eff_m1');
        if (aiM1) {
            aiM1.addEventListener('change', () => {
                const v = aiM1.value;
                if (v === 'scroll') { setVal('eff_isen_m1', 70); setVal('vol_eff_m1', 95); setVal('pr_design_m1', 3.0); }
                else if (v === 'piston') { setVal('eff_isen_m1', 75); setVal('vol_eff_m1', 88); setVal('pr_design_m1', 3.5); }
                else if (v === 'screw') { setVal('eff_isen_m1', 78); setVal('vol_eff_m1', 92); setVal('pr_design_m1', 4.0); }
                else if (v === 'centrifugal') { setVal('eff_isen_m1', 82); setVal('vol_eff_m1', 98); setVal('pr_design_m1', 2.5); }
            });
        }

        // --- Mode 1: CO2 Cycle ---
        const aiM1Co2 = document.getElementById('ai_eff_m1_co2');
        if (aiM1Co2) {
            aiM1Co2.addEventListener('change', () => {
                const v = aiM1Co2.value;
                if (v === 'co2_rotary') { 
                    setVal('eff_isen_peak_m1_co2', 0.65); 
                    setVal('clearance_m1_co2', 0.03); 
                    setVal('poly_index_m1_co2', 1.25);
                    setVal('pr_design_m1_co2', 3.0);
                }
                else if (v === 'co2_piston') { 
                    setVal('eff_isen_peak_m1_co2', 0.72); 
                    setVal('clearance_m1_co2', 0.06); 
                    setVal('poly_index_m1_co2', 1.30);
                    setVal('pr_design_m1_co2', 3.5);
                }
            });
        }

        // --- Mode 2: Gas Compressor ---
        const aiM2 = document.getElementById('ai_eff_m2');
        if (aiM2) {
            aiM2.addEventListener('change', () => {
                const v = aiM2.value;
                if (v === 'piston') { setVal('eff_isen_m2', 75); setVal('vol_eff_m2', 85); }
                else if (v === 'screw') { setVal('eff_isen_m2', 78); setVal('vol_eff_m2', 90); }
                else if (v === 'turbo') { setVal('eff_isen_m2', 82); setVal('vol_eff_m2', 98); }
            });
        }

        // --- Mode 3: Air Compressor ---
        const aiM3 = document.getElementById('ai_eff_m3');
        if (aiM3) {
            aiM3.addEventListener('change', () => {
                const v = aiM3.value;
                if (v === 'piston_water') { 
                    setVal('eff_isen_m3', 72); 
                    setVal('vol_eff_m3', 85); 
                    setRadio('cooling_type_m3', 'jacket');
                } else if (v === 'screw_oil_free') { 
                    setVal('eff_isen_m3', 75); 
                    setVal('vol_eff_m3', 92); 
                    setRadio('cooling_type_m3', 'adiabatic'); // Default, user can switch to injection
                } else if (v === 'turbo') { 
                    setVal('eff_isen_m3', 82); 
                    setVal('vol_eff_m3', 98); 
                    setRadio('cooling_type_m3', 'adiabatic');
                }
            });
        }

        // --- Mode 4 & 5: MVR (Legacy Support) ---
        const aiM4 = document.getElementById('ai_eff_m4');
        if(aiM4) {
            aiM4.addEventListener('change', () => {
                const v = aiM4.value;
                if (v === 'roots') { setVal('eff_isen_m4', 60); setVal('vol_eff_m4', 75); }
                else if (v === 'screw_mvr') { setVal('eff_isen_m4', 75); setVal('vol_eff_m4', 85); }
            });
        }
        const aiM5 = document.getElementById('ai_eff_m5');
        if(aiM5) {
            aiM5.addEventListener('change', () => {
                const v = aiM5.value;
                if (v === 'fan') setVal('eff_poly_m5', 75);
                else if (v === 'centrifugal') setVal('eff_poly_m5', 80);
                else if (v === 'multi_stage') setVal('eff_poly_m5', 84);
            });
        }
    }
    setupAiPresets();

    // -----------------------------------------------------------------
    // 6. 通用显隐工具 & 业务逻辑联动
    // -----------------------------------------------------------------
    function setupRadioToggle(name, targetValue, targetDivId) {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        const targetDiv = document.getElementById(targetDivId);
        if (!radios.length || !targetDiv) return;

        const update = () => {
            const checked = document.querySelector(`input[name="${name}"]:checked`);
            if (!checked) return;
            const shouldShow = (checked.value === targetValue);
            if (shouldShow) {
                targetDiv.classList.remove('hidden');
                targetDiv.style.display = 'block';
                targetDiv.querySelectorAll('input').forEach(i => i.disabled = false);
            } else {
                targetDiv.classList.add('hidden');
                targetDiv.style.display = 'none';
                targetDiv.querySelectorAll('input').forEach(i => i.disabled = true);
            }
        };
        radios.forEach(r => r.addEventListener('change', update));
        update();
    }

    function setupCheckboxToggle(chkId, divId) {
        const chk = document.getElementById(chkId);
        const div = document.getElementById(divId);
        if (!chk || !div) return;

        const update = () => {
            const shouldShow = chk.checked;
            if (shouldShow) {
                div.classList.remove('hidden');
                div.style.display = 'block';
                div.querySelectorAll('input').forEach(i => i.disabled = false);
            } else {
                div.classList.add('hidden');
                div.style.display = 'none';
                div.querySelectorAll('input').forEach(i => i.disabled = true);
            }
        };
        chk.addEventListener('change', update);
        update();
    }

    // Bind Business Logic Toggles
    setupRadioToggle('cooling_mode_m2', 'target_t', 'cooling-inputs-m2');
    setupCheckboxToggle('enable_cooler_calc_m2', 'cooler-inputs-m2');

    // Mode 3 Air Cooling Logic
    const m3Radios = document.querySelectorAll('input[name="cooling_type_m3"]');
    if(m3Radios.length) {
        const updateM3 = () => {
            const checked = document.querySelector('input[name="cooling_type_m3"]:checked');
            if(!checked) return;
            const val = checked.value;
            const jacketDiv = document.getElementById('jacket-inputs-m3');
            const injDiv = document.getElementById('injection-inputs-m3');
            if(jacketDiv) {
                const show = (val === 'jacket');
                jacketDiv.style.display = show ? 'block' : 'none';
                jacketDiv.classList.toggle('hidden', !show);
                jacketDiv.querySelectorAll('input').forEach(i => i.disabled = !show);
            }
            if(injDiv) {
                const show = (val === 'injection');
                injDiv.style.display = show ? 'block' : 'none';
                injDiv.classList.toggle('hidden', !show);
                injDiv.querySelectorAll('input').forEach(i => i.disabled = !show);
            }
        };
        m3Radios.forEach(r => r.addEventListener('change', updateM3));
        updateM3(); 
    }
    setupCheckboxToggle('enable_cooler_calc_m3', 'cooler-inputs-m3');

    setupCheckboxToggle('enable_desuperheat_m4', 'desuperheat-inputs-m4');
    setupCheckboxToggle('enable_desuperheat_m5', 'desuperheat-inputs-m5');
    setupCheckboxToggle('enable_dynamic_eff_m1', 'dynamic-eff-inputs-m1');

    console.log("UI: Initialization Complete.");
});