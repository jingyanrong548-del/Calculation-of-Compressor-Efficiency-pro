// =====================================================================
// ui.js: UI 界面交互逻辑 (v8.28: Fix Mode 3 & Thermal Toggles)
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
    // 4. 流量输入框切换逻辑 (通用)
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

            setDisplay(divRpm, val === 'rpm', 'grid');
            setDisplay(divMass, val === 'mass');
            setDisplay(divVol, val === 'vol');
        };

        radios.forEach(r => r.addEventListener('change', updateVisibility));
        updateVisibility(); 
    }

    ['m1', 'm1_co2', 'm2', 'm3', 'm4', 'm5'].forEach(setupFlowToggle);

    // -----------------------------------------------------------------
    // 5. 通用显隐工具 (Radio & Checkbox)
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

    // -----------------------------------------------------------------
    // 6. 绑定业务逻辑联动
    // -----------------------------------------------------------------

    // Mode 2 Gas
    setupRadioToggle('cooling_mode_m2', 'target_t', 'cooling-inputs-m2');
    setupCheckboxToggle('enable_cooler_calc_m2', 'cooler-inputs-m2');

    // Mode 3 Air (Fix for v8.28)
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
                // 强制显示 "预期排温" 输入框
                injDiv.style.display = show ? 'block' : 'none';
                injDiv.classList.toggle('hidden', !show);
                injDiv.querySelectorAll('input').forEach(i => i.disabled = !show);
            }
        };
        m3Radios.forEach(r => r.addEventListener('change', updateM3));
        updateM3(); // Init
    }
    setupCheckboxToggle('enable_cooler_calc_m3', 'cooler-inputs-m3');

    // Mode 4 & 5 Desuperheating
    setupCheckboxToggle('enable_desuperheat_m4', 'desuperheat-inputs-m4');
    setupCheckboxToggle('enable_desuperheat_m5', 'desuperheat-inputs-m5');

    // Mode 1 Helper Toggles
    setupCheckboxToggle('enable_dynamic_eff_m1', 'dynamic-eff-inputs-m1');

    console.log("UI: Initialization Complete.");
});