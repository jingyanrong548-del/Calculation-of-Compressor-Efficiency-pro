// =====================================================================
// ui.js: UI 界面交互逻辑
// 版本: v8.35 (Feature: Unit Switch & Baseline Pinning)
// =====================================================================

import { CaseStorage } from './storage.js';
import { UnitState } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("UI: Initializing Interface Logic...");

    // -----------------------------------------------------------------
    // 1. 主选项卡 (Tab) 切换逻辑
    // -----------------------------------------------------------------
    const tabIds = [1, 2, 3, 4, 5];
    const tabs = tabIds.map(id => ({
        id: id,
        btn: document.getElementById(`tab-btn-${id}`),
        content: document.getElementById(`tab-content-${id}`)
    })).filter(t => t.btn && t.content);

    tabs.forEach(tab => {
        tab.btn.addEventListener('click', () => {
            tabs.forEach(t => {
                t.btn.classList.remove('active', 'text-teal-600', 'border-teal-600', 'bg-teal-50');
                t.btn.classList.add('text-gray-600');
                t.content.style.display = 'none';
            });
            tab.btn.classList.remove('text-gray-600');
            tab.btn.classList.add('active', 'text-teal-600', 'border-teal-600', 'bg-teal-50');
            tab.content.style.display = 'block';
            window.dispatchEvent(new Event('resize'));
        });
    });

    // -----------------------------------------------------------------
    // 2. 全局控制 (Unit Switch & Baseline) - [New in v8.35]
    // -----------------------------------------------------------------
    function setupGlobalControls() {
        // Unit Toggle
        const unitToggle = document.getElementById('unit-toggle');
        const unitLabel = document.getElementById('unit-label');
        
        if (unitToggle) {
            unitToggle.addEventListener('change', () => {
                const newUnit = UnitState.toggle(); // SI <-> IMP
                if(unitLabel) unitLabel.textContent = newUnit;
                
                // Dispatch event for all modules to re-render datasheet
                document.dispatchEvent(new Event('unit-change'));
            });
        }

        // Pin Baseline Button
        const pinBtn = document.getElementById('btn-pin-baseline');
        if (pinBtn) {
            pinBtn.addEventListener('click', () => {
                // Dispatch event for active module to store its last result as baseline
                document.dispatchEvent(new Event('pin-baseline'));
                
                // Visual feedback
                const originalText = pinBtn.innerHTML;
                pinBtn.innerHTML = "📌 Pinned!";
                pinBtn.classList.add('bg-yellow-100', 'text-yellow-700', 'border-yellow-300');
                setTimeout(() => {
                    pinBtn.innerHTML = originalText;
                    pinBtn.classList.remove('bg-yellow-100', 'text-yellow-700', 'border-yellow-300');
                }, 1500);
            });
        }
    }
    setupGlobalControls();

    // -----------------------------------------------------------------
    // 3. 工况管理 (Case Management)
    // -----------------------------------------------------------------
    const saveModal = document.getElementById('save-modal');
    const loadModal = document.getElementById('load-modal');
    const btnOpenSave = document.getElementById('btn-open-save');
    const btnOpenLoad = document.getElementById('btn-open-load');
    const btnCancelSave = document.getElementById('btn-cancel-save');
    const btnConfirmSave = document.getElementById('btn-confirm-save');
    const btnCloseLoad = document.getElementById('btn-close-load');
    const caseListContainer = document.getElementById('case-list-container');
    const saveNameInput = document.getElementById('save-case-name');

    const toggleModal = (modal, show) => {
        if (show) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };

    const gatherFormData = () => {
        const data = {};
        document.querySelectorAll('input, select').forEach(el => {
            if (!el.name) return;
            if (el.type === 'radio') {
                if (el.checked) data[el.name] = el.value;
            } else if (el.type === 'checkbox') {
                data[el.id || el.name] = el.checked;
            } else {
                data[el.name] = el.value;
            }
        });
        return data;
    };

    const restoreFormData = (data) => {
        document.querySelectorAll('input, select').forEach(el => {
            if (el.type === 'radio') {
                if (data[el.name] === el.value) {
                    el.checked = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (el.type === 'checkbox') {
                const key = el.id || el.name;
                if (data[key] !== undefined) {
                    el.checked = data[key];
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (el.name && data[el.name] !== undefined) {
                el.value = data[el.name];
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };

    if(btnOpenSave) {
        btnOpenSave.addEventListener('click', () => {
            saveNameInput.value = `Case ${new Date().toLocaleTimeString()}`;
            toggleModal(saveModal, true);
            saveNameInput.focus();
        });
    }

    if(btnCancelSave) btnCancelSave.addEventListener('click', () => toggleModal(saveModal, false));

    if(btnConfirmSave) {
        btnConfirmSave.addEventListener('click', () => {
            const name = saveNameInput.value.trim();
            if (!name) { alert("请输入工况名称"); return; }
            const activeTabBtn = document.querySelector('.tab-btn.active');
            const modeName = activeTabBtn ? activeTabBtn.innerText.replace(/\n/g, ' ').trim() : 'Unknown';
            CaseStorage.saveCase(name, modeName, gatherFormData());
            toggleModal(saveModal, false);
            alert("工况已保存! (Case Saved)");
        });
    }

    const renderCaseList = () => {
        const cases = CaseStorage.listCases();
        caseListContainer.innerHTML = '';
        if (cases.length === 0) {
            caseListContainer.innerHTML = `<div class="text-center text-gray-400 py-8">暂无保存的工况 (No saved cases)</div>`;
            return;
        }
        cases.forEach(c => {
            const item = document.createElement('div');
            item.className = "bg-white border border-gray-200 rounded p-3 hover:shadow-md transition flex justify-between items-center";
            item.innerHTML = `
                <div>
                    <div class="font-bold text-gray-800">${c.name}</div>
                    <div class="text-xs text-gray-500">${c.mode} | ${c.date}</div>
                </div>
                <div class="flex space-x-2">
                    <button class="btn-restore px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200">Load</button>
                    <button class="btn-delete px-2 py-1 text-red-400 hover:text-red-600 text-xs">&times;</button>
                </div>
            `;
            item.querySelector('.btn-restore').addEventListener('click', () => {
                if(confirm(`确认加载工况 "${c.name}"?`)) {
                    restoreFormData(c.data);
                    toggleModal(loadModal, false);
                }
            });
            item.querySelector('.btn-delete').addEventListener('click', () => {
                if(confirm(`删除工况 "${c.name}"?`)) {
                    CaseStorage.deleteCase(c.id);
                    renderCaseList(); 
                }
            });
            caseListContainer.appendChild(item);
        });
    };

    if(btnOpenLoad) {
        btnOpenLoad.addEventListener('click', () => {
            renderCaseList();
            toggleModal(loadModal, true);
        });
    }

    if(btnCloseLoad) btnCloseLoad.addEventListener('click', () => toggleModal(loadModal, false));

    window.addEventListener('click', (e) => {
        if (e.target === saveModal) toggleModal(saveModal, false);
        if (e.target === loadModal) toggleModal(loadModal, false);
    });

    // -----------------------------------------------------------------
    // 4. 模式 1 子选项卡切换
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
    // 5. Mode 1 CO2 循环类型切换
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
        update(); 
    }
    setupCo2CycleToggle();

    // -----------------------------------------------------------------
    // 6. 流量输入框切换逻辑
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
        
        if (modeSuffix === 'm3') {
            const batchChk = document.getElementById('batch_mode_m3');
            if(batchChk) batchChk.addEventListener('change', updateVisibility);
        }
        updateVisibility(); 
    }
    ['m1', 'm1_co2', 'm2', 'm3', 'm4', 'm5'].forEach(setupFlowToggle);

    // -----------------------------------------------------------------
    // 7. AI 效率预设联动
    // -----------------------------------------------------------------
    function setupAiPresets() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
        };
        const setRadio = (name, val) => {
            const radios = document.querySelectorAll(`input[name="${name}"]`);
            radios.forEach(r => { if (r.value === val) r.click(); });
        };

        const aiM1 = document.getElementById('ai_eff_m1');
        if (aiM1) aiM1.addEventListener('change', () => {
            const v = aiM1.value;
            if (v === 'scroll') { setVal('eff_isen_m1', 70); setVal('vol_eff_m1', 95); setVal('pr_design_m1', 3.0); }
            else if (v === 'piston') { setVal('eff_isen_m1', 75); setVal('vol_eff_m1', 88); setVal('pr_design_m1', 3.5); }
            else if (v === 'screw') { setVal('eff_isen_m1', 78); setVal('vol_eff_m1', 92); setVal('pr_design_m1', 4.0); }
            else if (v === 'centrifugal') { setVal('eff_isen_m1', 82); setVal('vol_eff_m1', 98); setVal('pr_design_m1', 2.5); }
        });

        const aiM1Co2 = document.getElementById('ai_eff_m1_co2');
        if (aiM1Co2) aiM1Co2.addEventListener('change', () => {
            const v = aiM1Co2.value;
            if (v === 'co2_rotary') { setVal('eff_isen_peak_m1_co2', 0.65); setVal('clearance_m1_co2', 0.03); setVal('poly_index_m1_co2', 1.25); setVal('pr_design_m1_co2', 3.0); }
            else if (v === 'co2_piston') { setVal('eff_isen_peak_m1_co2', 0.72); setVal('clearance_m1_co2', 0.06); setVal('poly_index_m1_co2', 1.30); setVal('pr_design_m1_co2', 3.5); }
        });

        const aiM2 = document.getElementById('ai_eff_m2');
        if (aiM2) aiM2.addEventListener('change', () => {
            const v = aiM2.value;
            if (v === 'piston') { setVal('eff_isen_m2', 75); setVal('vol_eff_m2', 85); }
            else if (v === 'screw') { setVal('eff_isen_m2', 78); setVal('vol_eff_m2', 90); }
            else if (v === 'turbo') { setVal('eff_isen_m2', 82); setVal('vol_eff_m2', 98); }
        });

        const aiM3 = document.getElementById('ai_eff_m3');
        if (aiM3) aiM3.addEventListener('change', () => {
            const v = aiM3.value;
            if (v === 'piston_water') { setVal('eff_isen_m3', 72); setVal('vol_eff_m3', 85); setRadio('cooling_type_m3', 'jacket'); }
            else if (v === 'screw_oil_free') { setVal('eff_isen_m3', 75); setVal('vol_eff_m3', 92); setRadio('cooling_type_m3', 'adiabatic'); }
            else if (v === 'turbo') { setVal('eff_isen_m3', 82); setVal('vol_eff_m3', 98); setRadio('cooling_type_m3', 'adiabatic'); }
        });

        const aiM4 = document.getElementById('ai_eff_m4');
        if(aiM4) aiM4.addEventListener('change', () => {
            if (aiM4.value === 'roots') { setVal('eff_isen_m4', 60); setVal('vol_eff_m4', 75); }
            else if (aiM4.value === 'screw_mvr') { setVal('eff_isen_m4', 75); setVal('vol_eff_m4', 85); }
        });

        const aiM5 = document.getElementById('ai_eff_m5');
        if(aiM5) aiM5.addEventListener('change', () => {
            if (aiM5.value === 'fan') setVal('eff_poly_m5', 75);
            else if (aiM5.value === 'centrifugal') setVal('eff_poly_m5', 80);
            else if (aiM5.value === 'multi_stage') setVal('eff_poly_m5', 84);
        });
    }
    setupAiPresets();

    // -----------------------------------------------------------------
    // 8. 通用显隐 & 业务逻辑联动
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
                targetDiv.classList.remove('hidden'); targetDiv.style.display = 'block';
                targetDiv.querySelectorAll('input').forEach(i => i.disabled = false);
            } else {
                targetDiv.classList.add('hidden'); targetDiv.style.display = 'none';
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
                div.classList.remove('hidden'); div.style.display = 'block';
                div.querySelectorAll('input').forEach(i => i.disabled = false);
            } else {
                div.classList.add('hidden'); div.style.display = 'none';
                div.querySelectorAll('input').forEach(i => i.disabled = true);
            }
        };
        chk.addEventListener('change', update);
        update();
    }

    setupRadioToggle('cooling_mode_m2', 'target_t', 'cooling-inputs-m2');
    setupCheckboxToggle('enable_cooler_calc_m2', 'cooler-inputs-m2');

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