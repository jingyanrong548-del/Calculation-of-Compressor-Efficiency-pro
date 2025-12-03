// =====================================================================
// ui.js: UI 界面交互逻辑
// 版本: v8.53 (Feature: Brand Models Quick Select)
// =====================================================================

import { CaseStorage } from './storage.js';
import { UnitState } from './utils.js';
import { stageConfigMgr } from './stage_config.js';

// --- 1. Compressor Model Database (v8.53) ---
const COMPRESSOR_DB = [
    // Danfoss Fixed
    { id: 'SY240', brand: 'Danfoss', disp: 347.8, rpm: 2900, type: 'fixed' },
    { id: 'SY300', brand: 'Danfoss', disp: 437.5, rpm: 2900, type: 'fixed' },
    { id: 'SY380', brand: 'Danfoss', disp: 531.2, rpm: 2900, type: 'fixed' },
    // Danfoss Variable
    { id: 'VCH115', brand: 'Danfoss', disp: 115.0, rpm: 4500, type: 'variable', range: '1800-8400' },
    // Copeland Fixed
    { id: 'ZW150KBE-TFP-522', brand: 'Copeland', disp: 203.0, rpm: 2900, type: 'fixed' },
    // Copeland Variable
    { id: 'ZWV112BC-4X9-550', brand: 'Copeland', disp: 110.0, rpm: 4500, type: 'variable', range: '1800-6000' }
];

document.addEventListener('DOMContentLoaded', () => {
    console.log("UI: Initializing Interface Logic...");

    // Init Stage Manager
    if (stageConfigMgr && stageConfigMgr.init) {
        stageConfigMgr.init();
    }

    // -----------------------------------------------------------------
    // 2. 主选项卡 (Tab) 切换逻辑
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
    // 3. 全局控制 (Unit Switch & Baseline)
    // -----------------------------------------------------------------
    function setupGlobalControls() {
        const unitToggle = document.getElementById('unit-toggle');
        const unitLabel = document.getElementById('unit-label');

        if (unitToggle) {
            unitToggle.addEventListener('change', () => {
                const newUnit = UnitState.toggle();
                if (unitLabel) unitLabel.textContent = newUnit;
                document.dispatchEvent(new Event('unit-change'));
            });
        }
        // ✅ [插入] 绑定退出按钮逻辑
        const btnExit = document.getElementById('btn-exit');
        if (btnExit) {
            btnExit.addEventListener('click', () => {
                if (confirm("Close the application?")) {
                    window.close(); // 尝试关闭窗口
                    // 如果是 PWA 或被脚本拦截无法关闭，提示用户
                    setTimeout(() => alert("Web 浏览器限制自动关闭。\n请手动关闭标签页或应用窗口。"), 200);
                }
            });
        }
        const pinBtn = document.getElementById('btn-pin-baseline');
        if (pinBtn) {
            pinBtn.addEventListener('click', () => {
                document.dispatchEvent(new Event('pin-baseline'));
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
    // 4. 工况管理 (Case Management)
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
        if (!modal) return;
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
        if (window.refreshAllToggles) window.refreshAllToggles();
    };

    if (btnOpenSave) {
        btnOpenSave.addEventListener('click', () => {
            if (saveNameInput) saveNameInput.value = `Case ${new Date().toLocaleTimeString()}`;
            toggleModal(saveModal, true);
            if (saveNameInput) saveNameInput.focus();
        });
    }
    if (btnCancelSave) btnCancelSave.addEventListener('click', () => toggleModal(saveModal, false));
    if (btnConfirmSave) {
        btnConfirmSave.addEventListener('click', () => {
            const name = saveNameInput.value.trim();
            if (!name) { alert("请输入工况名称"); return; }
            const activeTabBtn = document.querySelector('.tab-btn.active');
            const modeName = activeTabBtn ? activeTabBtn.innerText.replace(/\n/g, ' ').trim() : 'Unknown';
            CaseStorage.saveCase(name, modeName, gatherFormData());
            toggleModal(saveModal, false);
            alert("工况已保存!");
        });
    }

    const renderCaseList = () => {
        const cases = CaseStorage.listCases();
        if (!caseListContainer) return;
        caseListContainer.innerHTML = '';
        if (cases.length === 0) {
            caseListContainer.innerHTML = `<div class="text-center text-gray-400 py-8">暂无保存的工况</div>`;
            return;
        }
        cases.forEach(c => {
            const item = document.createElement('div');
            item.className = "bg-white border border-gray-200 rounded p-3 hover:shadow-md transition flex justify-between items-center";
            item.innerHTML = `
                <div><div class="font-bold text-gray-800">${c.name}</div><div class="text-xs text-gray-500">${c.mode} | ${c.date}</div></div>
                <div class="flex space-x-2">
                    <button class="btn-restore px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200">Load</button>
                    <button class="btn-delete px-2 py-1 text-red-400 hover:text-red-600 text-xs">&times;</button>
                </div>`;
            item.querySelector('.btn-restore').addEventListener('click', () => {
                if (confirm(`确认加载工况 "${c.name}"?`)) { restoreFormData(c.data); toggleModal(loadModal, false); }
            });
            item.querySelector('.btn-delete').addEventListener('click', () => {
                if (confirm(`删除工况 "${c.name}"?`)) { CaseStorage.deleteCase(c.id); renderCaseList(); }
            });
            caseListContainer.appendChild(item);
        });
    };

    if (btnOpenLoad) { btnOpenLoad.addEventListener('click', () => { renderCaseList(); toggleModal(loadModal, true); }); }
    if (btnCloseLoad) btnCloseLoad.addEventListener('click', () => toggleModal(loadModal, false));
    window.addEventListener('click', (e) => {
        if (e.target === saveModal) toggleModal(saveModal, false);
        if (e.target === loadModal) toggleModal(loadModal, false);
    });

    // -----------------------------------------------------------------
    // 5. Mode 1 Logic (Includes Brand Selector)
    // -----------------------------------------------------------------
    const btnStd = document.getElementById('sub-tab-std');
    const btnCo2 = document.getElementById('sub-tab-co2');
    const panelStd = document.getElementById('panel-m1-std');
    const panelCo2 = document.getElementById('panel-m1-co2');

    // [NEW] Compressor Selector Logic
    function setupCompressorSelector() {
        const selector = document.getElementById('compressor_model_selector_m1');
        if (!selector) return;

        selector.addEventListener('change', () => {
            const modelId = selector.value;
            const modelData = COMPRESSOR_DB.find(m => m.id === modelId);

            if (modelData) {
                // 1. Force RPM Mode
                const rpmRadio = document.querySelector('input[name="flow_mode_m1"][value="rpm"]');
                if (rpmRadio) {
                    rpmRadio.checked = true;
                    rpmRadio.dispatchEvent(new Event('change'));
                }

                // 2. Set Displacement
                const dispInput = document.querySelector('input[name="vol_disp_m1"]');
                if (dispInput) {
                    dispInput.value = modelData.disp;
                    // Visual feedback
                    dispInput.classList.add('bg-green-50', 'text-green-800', 'font-bold');
                    setTimeout(() => dispInput.classList.remove('bg-green-50', 'text-green-800', 'font-bold'), 1000);
                }

                // 3. Set RPM & Tooltip
                const rpmInput = document.querySelector('input[name="rpm_m1"]');
                if (rpmInput) {
                    rpmInput.value = modelData.rpm;
                    if (modelData.type === 'variable' && modelData.range) {
                        rpmInput.title = `Variable Speed Range: ${modelData.range} RPM`;
                    } else {
                        rpmInput.title = "Fixed Speed";
                    }
                }

                // 4. Auto-Set Efficiency Model to 'Scroll'
                const effSelect = document.getElementById('ai_eff_m1');
                if (effSelect) {
                    effSelect.value = 'scroll';
                    effSelect.dispatchEvent(new Event('change')); // Trigger preset values
                }
            }
        });
    }
    setupCompressorSelector();

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

    function setupCo2CycleToggle() {
        const radios = document.querySelectorAll('input[name="cycle_type_m1_co2"]');
        const divTrans = document.getElementById('inputs-transcritical-m1-co2');
        const divSub = document.getElementById('inputs-subcritical-m1-co2');
        if (!radios.length || !divTrans || !divSub) return;
        const update = () => {
            const val = document.querySelector('input[name="cycle_type_m1_co2"]:checked')?.value;
            if (!val) return;
            if (val === 'transcritical') {
                divTrans.classList.remove('hidden'); divSub.classList.add('hidden');
                divTrans.querySelectorAll('input').forEach(i => i.disabled = false);
                divSub.querySelectorAll('input').forEach(i => i.disabled = true);
            } else {
                divTrans.classList.add('hidden'); divSub.classList.remove('hidden');
                divTrans.querySelectorAll('input').forEach(i => i.disabled = true);
                divSub.querySelectorAll('input').forEach(i => i.disabled = false);
            }
        };
        radios.forEach(r => r.addEventListener('change', update));
        update();
    }
    setupCo2CycleToggle();

    function setupCo2EffModelToggle() {
        const radios = document.querySelectorAll('input[name="eff_model_m1_co2"]');
        const divFixed = document.getElementById('eff-inputs-fixed-m1-co2');
        const divPhys = document.getElementById('eff-inputs-physical-m1-co2');
        if (!radios.length || !divFixed || !divPhys) return;
        const update = () => {
            const val = document.querySelector('input[name="eff_model_m1_co2"]:checked')?.value;
            if (val === 'fixed') {
                divFixed.classList.remove('hidden'); divFixed.classList.add('grid');
                divPhys.classList.add('hidden'); divPhys.classList.remove('grid');
            } else {
                divFixed.classList.add('hidden'); divFixed.classList.remove('grid');
                divPhys.classList.remove('hidden'); divPhys.classList.add('grid');
            }
        };
        radios.forEach(r => r.addEventListener('change', update));
        update();
    }
    setupCo2EffModelToggle();

    // -----------------------------------------------------------------
    // 6. Dynamic Labels for IHX Context
    // -----------------------------------------------------------------
    function setupDynamicLabels() {
        // Standard Heat Pump
        const ihxStd = document.getElementById('enable_ihx_m1');
        const lblShStd = document.getElementById('lbl_sh_m1');
        const lblScStd = document.getElementById('lbl_sc_m1');

        if (ihxStd && lblShStd && lblScStd) {
            const updateStd = () => {
                if (ihxStd.checked) {
                    lblShStd.textContent = "Evap SH (K)";
                    lblScStd.textContent = "Cond SC (K)";
                } else {
                    lblShStd.textContent = "SH (K)";
                    lblScStd.textContent = "SC (K)";
                }
            };
            ihxStd.addEventListener('change', updateStd);
            updateStd(); // Init
        }

        // CO2 Heat Pump
        const ihxCo2 = document.getElementById('enable_ihx_m1_co2');
        const lblShCo2 = document.getElementById('lbl_sh_m1_co2');
        const lblScCo2 = document.getElementById('lbl_sc_m1_co2');

        if (ihxCo2 && lblShCo2 && lblScCo2) {
            const updateCo2 = () => {
                if (ihxCo2.checked) {
                    lblShCo2.textContent = "Evap SH (K)";
                    lblScCo2.textContent = "Cond SC (K)";
                } else {
                    lblShCo2.textContent = "SH (K)";
                    lblScCo2.textContent = "Subcool (K)";
                }
            };
            ihxCo2.addEventListener('change', updateCo2);
            updateCo2(); // Init
        }
    }
    setupDynamicLabels();

    // -----------------------------------------------------------------
    // 7. Multi-Stage Advanced Logic (Mode 3)
    // -----------------------------------------------------------------
    function setupStageConfigM3() {
        const inputStagesM3 = document.getElementById('stages_m3');
        const btnStageConfig = document.getElementById('btn-open-stage-config');

        if (inputStagesM3 && btnStageConfig) {
            const resetConfigVisuals = () => {
                if (btnStageConfig) {
                    btnStageConfig.classList.remove('bg-yellow-100', 'text-yellow-800', 'border-yellow-300');
                    btnStageConfig.classList.add('bg-white', 'text-yellow-700', 'border-yellow-300');
                    btnStageConfig.textContent = "⚙️ Adv. Config";
                    if (stageConfigMgr) stageConfigMgr.reset();
                }
            };

            const checkStageCount = () => {
                const n = parseInt(inputStagesM3.value) || 1;
                if (n >= 2) {
                    btnStageConfig.disabled = false;
                    btnStageConfig.classList.remove('opacity-50', 'cursor-not-allowed');
                } else {
                    btnStageConfig.disabled = true;
                    btnStageConfig.classList.add('opacity-50', 'cursor-not-allowed');
                    resetConfigVisuals();
                }
            };

            inputStagesM3.addEventListener('input', checkStageCount);
            checkStageCount();

            btnStageConfig.addEventListener('click', () => {
                const pIn = parseFloat(document.querySelector('input[name="p_in_m3"]').value) || 1.013;
                const pOut = parseFloat(document.querySelector('input[name="p_out_m3"]').value) || 8.0;
                const stages = parseInt(inputStagesM3.value) || 1;
                if (stageConfigMgr) stageConfigMgr.open(stages, pIn, pOut);
            });
        }

        document.addEventListener('advanced-config-updated', () => {
            if (btnStageConfig) {
                btnStageConfig.classList.add('bg-yellow-100', 'text-yellow-800', 'border-yellow-300');
                btnStageConfig.classList.remove('bg-white', 'text-yellow-700', 'border-yellow-300');
                btnStageConfig.textContent = "⚙️ Configured";
            }
        });

        const m3Triggers = document.querySelectorAll('input[name="p_in_m3"], input[name="p_out_m3"]');
        m3Triggers.forEach(el => el.addEventListener('input', () => {
            if (inputStagesM3) inputStagesM3.dispatchEvent(new Event('input'));
        }));
    }
    setupStageConfigM3();


    // -----------------------------------------------------------------
    // 8. Flow Inputs Toggle
    // -----------------------------------------------------------------
    function setupFlowToggle(modeSuffix) {
        const radioName = `flow_mode_${modeSuffix}`;
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);

        const divRpm = document.getElementById(`flow-inputs-rpm-${modeSuffix}`);
        const divMass = document.getElementById(`flow-inputs-mass-${modeSuffix}`);
        const divVol = document.getElementById(`flow-inputs-vol-${modeSuffix}`);

        if (!radios.length) return;

        const toggleEl = (el, show, displayType = 'block') => {
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

        const updateVisibility = () => {
            const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
            const val = checkedRadio ? checkedRadio.value : 'rpm';

            let showBatch = false, showRpm = false, showMass = false, showVol = false;

            if (modeSuffix === 'm3') {
                const batchChk = document.getElementById('batch_mode_m3');
                const divBatch = document.getElementById('flow-inputs-batch-m3');
                const isBatch = batchChk && batchChk.checked;

                if (isBatch) {
                    showBatch = true;
                    toggleEl(divBatch, true, 'block');
                } else {
                    toggleEl(divBatch, false);
                    if (val === 'rpm') showRpm = true;
                    if (val === 'mass') showMass = true;
                    if (val === 'vol') showVol = true;
                }
            } else {
                if (val === 'rpm') showRpm = true;
                if (val === 'mass') showMass = true;
                if (val === 'vol') showVol = true;
            }

            toggleEl(divRpm, showRpm, 'grid');
            toggleEl(divMass, showMass, 'block');
            toggleEl(divVol, showVol, 'block');
        };

        radios.forEach(r => r.addEventListener('change', updateVisibility));

        if (modeSuffix === 'm3') {
            const batchChk = document.getElementById('batch_mode_m3');
            if (batchChk) batchChk.addEventListener('change', updateVisibility);
        }

        updateVisibility();
    }
    ['m1', 'm1_co2', 'm2', 'm3', 'm4', 'm5'].forEach(setupFlowToggle);

    // -----------------------------------------------------------------
    // 9. AI Presets
    // -----------------------------------------------------------------
    function setupAiPresets() {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); } };
        const setRadio = (name, val) => { document.querySelectorAll(`input[name="${name}"]`).forEach(r => { if (r.value === val) r.click(); }); };

        const aiM1 = document.getElementById('ai_eff_m1');
        if (aiM1) aiM1.addEventListener('change', () => {
            const v = aiM1.value;

            // 👇 修改这一行 (Scroll: Isen 60%, Vol 90%)
            if (v === 'scroll') { setVal('eff_isen_m1', 60); setVal('vol_eff_m1', 90); setVal('pr_design_m1', 3.0); }

            else if (v === 'piston') { setVal('eff_isen_m1', 75); setVal('vol_eff_m1', 88); setVal('pr_design_m1', 3.5); }
            else if (v === 'screw') { setVal('eff_isen_m1', 78); setVal('vol_eff_m1', 92); setVal('pr_design_m1', 4.0); }
            else if (v === 'centrifugal') { setVal('eff_isen_m1', 82); setVal('vol_eff_m1', 98); setVal('pr_design_m1', 2.5); }
        });
        const aiM1Co2 = document.getElementById('ai_eff_m1_co2');
        if (aiM1Co2) aiM1Co2.addEventListener('change', () => {
            const v = aiM1Co2.value;
            if (v === 'co2_rotary') { document.querySelector('input[name="eff_model_m1_co2"][value="physical"]').click(); setVal('eff_isen_peak_m1_co2', 0.65); setVal('clearance_m1_co2', 0.03); setVal('poly_index_m1_co2', 1.25); setVal('pr_design_m1_co2', 3.0); }
            else if (v === 'co2_piston') { document.querySelector('input[name="eff_model_m1_co2"][value="fixed"]').click(); setVal('eff_isen_m1_co2', 70); setVal('vol_eff_m1_co2', 85); }
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
        if (aiM4) aiM4.addEventListener('change', () => {
            if (aiM4.value === 'roots') { setVal('eff_isen_m4', 60); setVal('vol_eff_m4', 75); }
            else if (aiM4.value === 'screw_mvr') { setVal('eff_isen_m4', 75); setVal('vol_eff_m4', 85); }
        });
        const aiM5 = document.getElementById('ai_eff_m5');
        if (aiM5) aiM5.addEventListener('change', () => {
            if (aiM5.value === 'fan') setVal('eff_poly_m5', 75);
            else if (aiM5.value === 'centrifugal') setVal('eff_poly_m5', 80);
            else if (aiM5.value === 'multi_stage') setVal('eff_poly_m5', 84);
        });
    }
    setupAiPresets();

    // -----------------------------------------------------------------
    // 10. Helper Toggles
    // -----------------------------------------------------------------
    function setupRadioToggle(name, targetValue, targetDivId) {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        const targetDiv = document.getElementById(targetDivId);
        if (!radios.length || !targetDiv) return;
        const update = () => {
            const checked = document.querySelector(`input[name="${name}"]:checked`);
            if (!checked) return;
            const shouldShow = (checked.value === targetValue);
            const toggleEl = (el, s) => {
                if (!el) return;
                if (s) { el.classList.remove('hidden'); el.style.display = 'block'; el.querySelectorAll('input').forEach(i => i.disabled = false); }
                else { el.classList.add('hidden'); el.style.display = 'none'; el.querySelectorAll('input').forEach(i => i.disabled = true); }
            };
            toggleEl(targetDiv, shouldShow);
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
            const toggleEl = (el, s) => {
                if (!el) return;
                if (s) { el.classList.remove('hidden'); el.style.display = 'block'; el.querySelectorAll('input').forEach(i => i.disabled = false); }
                else { el.classList.add('hidden'); el.style.display = 'none'; el.querySelectorAll('input').forEach(i => i.disabled = true); }
            };
            toggleEl(div, shouldShow);
        };
        chk.addEventListener('change', update);
        update();
    }

    setupRadioToggle('cooling_mode_m2', 'target_t', 'cooling-inputs-m2');
    setupCheckboxToggle('enable_cooler_calc_m2', 'cooler-inputs-m2');

    const m3Radios = document.querySelectorAll('input[name="cooling_type_m3"]');
    if (m3Radios.length) {
        const updateM3 = () => {
            const checked = document.querySelector('input[name="cooling_type_m3"]:checked');
            if (!checked) return;
            const val = checked.value;
            const jacketDiv = document.getElementById('jacket-inputs-m3');
            const injDiv = document.getElementById('injection-inputs-m3');

            const toggle = (el, s) => {
                if (!el) return;
                el.style.display = s ? 'block' : 'none';
                if (s) { el.classList.remove('hidden'); el.querySelectorAll('input').forEach(i => i.disabled = false); }
                else { el.classList.add('hidden'); el.querySelectorAll('input').forEach(i => i.disabled = true); }
            };
            toggle(jacketDiv, val === 'jacket');
            toggle(injDiv, val === 'injection');
        };
        m3Radios.forEach(r => r.addEventListener('change', updateM3));
        updateM3();
    }

    setupCheckboxToggle('enable_cooler_calc_m3', 'cooler-inputs-m3');
    setupCheckboxToggle('enable_desuperheat_m4', 'desuperheat-inputs-m4');
    setupCheckboxToggle('enable_desuperheat_m5', 'desuperheat-inputs-m5');
    setupCheckboxToggle('enable_dynamic_eff_m1', 'dynamic-eff-inputs-m1');
    setupCheckboxToggle('enable_ihx_m1', 'ihx-inputs-m1');
    setupCheckboxToggle('enable_ihx_m1_co2', 'ihx-inputs-m1_co2');

    window.refreshAllToggles = () => {
        document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]').forEach(el => {
            el.dispatchEvent(new Event('change'));
        });
    };

    console.log("UI: Initialization Complete.");
});