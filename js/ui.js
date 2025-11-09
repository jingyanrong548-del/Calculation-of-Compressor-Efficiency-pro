// =====================================================================
// ui.js: UI 界面交互逻辑
// 版本: v4.2 (新增 M2 子选项卡)
// 职责: 1. 处理主选项卡 (M1/M2, M3, M4)
//        2. 处理 M1/M2 模式电台
//        3. 处理所有流量模式电台
//        4. 处理 MVR 状态定义电台
//        5. 处理后冷却器复选框
//        6. (新增) 处理 M2A / M2B 子选项卡
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 主选项卡切换 (干式, MVR容积式, MVR透平式) ---
    const tabBtnDry = document.getElementById('tab-btn-dry');
    const tabBtnMvr = document.getElementById('tab-btn-mvr');
    const tabBtnTurbo = document.getElementById('tab-btn-turbo');
    
    const contentDry = document.getElementById('tab-content-dry');
    const contentMvr = document.getElementById('tab-content-mvr');
    const contentTurbo = document.getElementById('tab-content-turbo');

    const tabs = [
        { btn: tabBtnDry, content: contentDry },
        { btn: tabBtnMvr, content: contentMvr },
        { btn: tabBtnTurbo, content: contentTurbo }
    ];

    tabs.forEach(tab => {
        if (tab.btn) {
            tab.btn.addEventListener('click', () => {
                // 1. 重置所有
                tabs.forEach(t => {
                    t.btn.classList.remove('active');
                    t.content.style.display = 'none';
                    t.content.classList.remove('active');
                });
                // 2. 激活当前
                tab.btn.classList.add('active');
                tab.content.style.display = 'block';
                tab.content.classList.add('active');
            });
        }
    });

    // --- 模式一 / 模式二 电台切换 ---
    const mode1Radio = document.getElementById('mode-1-radio');
    const mode2Radio = document.getElementById('mode-2-radio');
    const mode1Container = document.getElementById('mode-1-container');
    const mode2Container = document.getElementById('mode-2-container');

    if (mode1Radio && mode2Radio && mode1Container && mode2Container) {
        mode1Radio.addEventListener('change', () => {
            if (mode1Radio.checked) {
                mode1Container.style.display = 'block';
                mode2Container.style.display = 'none';
            }
        });
        mode2Radio.addEventListener('change', () => {
            if (mode2Radio.checked) {
                mode1Container.style.display = 'none';
                mode2Container.style.display = 'block';
            }
        });
    }

    // --- 流量模式 (Flow Mode) 电台切换 ---
    // Helper function to setup flow mode toggles
    function setupFlowModeToggle(radioName, rpmInputsId, volInputsId) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        const rpmInputs = document.getElementById(rpmInputsId);
        const volInputs = document.getElementById(volInputsId);

        if (!radios.length || !rpmInputs || !volInputs) return;

        const toggle = (val) => {
            if (val === 'rpm') {
                rpmInputs.style.display = 'block';
                volInputs.style.display = 'none';
                rpmInputs.querySelectorAll('input').forEach(i => i.required = true);
                volInputs.querySelectorAll('input').forEach(i => i.required = false);
            } else {
                rpmInputs.style.display = 'none';
                volInputs.style.display = 'block';
                rpmInputs.querySelectorAll('input').forEach(i => i.required = false);
                volInputs.querySelectorAll('input').forEach(i => i.required = true);
            }
        };

        radios.forEach(radio => {
            radio.addEventListener('change', () => toggle(radio.value));
        });
        
        // 初始状态
        const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
        if (checkedRadio) {
            toggle(checkedRadio.value);
        }
    }

    setupFlowModeToggle('flow_mode', 'rpm-inputs-m1', 'vol-inputs-m1');
    setupFlowModeToggle('flow_mode_m2', 'rpm-inputs-m2', 'vol-inputs-m2');
    setupFlowModeToggle('flow_mode_m2b', 'rpm-inputs-m2b', 'vol-inputs-m2b'); // v4.2 新增
    setupFlowModeToggle('flow_mode_m3', 'rpm-inputs-m3', 'vol-inputs-m3');
    setupFlowModeToggle('flow_mode_m4', 'mass-inputs-m4', 'vol-inputs-m4'); // M4 是 mass/vol
    

    // --- 功率模式 (Power Mode) 切换 ---
    function setupPowerModeToggle(radioName, motorEffGroupId) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        const motorEffGroup = document.getElementById(motorEffGroupId);

        if (!radios.length || !motorEffGroup) return;

        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'input') {
                    motorEffGroup.style.display = 'block';
                    motorEffGroup.querySelector('input').required = true;
                } else {
                    motorEffGroup.style.display = 'none';
                    motorEffGroup.querySelector('input').required = false;
                }
            });
        });
        
        // 初始状态
        const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
        if (checkedRadio) {
             checkedRadio.dispatchEvent(new Event('change'));
        }
    }
    
    setupPowerModeToggle('power_mode', 'motor-eff-group-m1');
    setupPowerModeToggle('eff_mode_m2', 'motor-eff-group-m2'); // M2 效率模式
    setupPowerModeToggle('eff_mode_m2b', 'motor-eff-group-m2b'); // M2B 效率模式 (v4.2 新增)


    // --- 容量模式 (Capacity Mode) 切换 ---
    const capacityRadios = document.querySelectorAll('input[name="capacity_mode"]');
    const capacityLabel = document.getElementById('capacity-label');
    if (capacityRadios.length && capacityLabel) {
        capacityRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'heating') {
                    capacityLabel.textContent = '制热量 (kW)';
                } else {
                    capacityLabel.textContent = '制冷量 (kW)';
                }
            });
        });
    }
    
    // --- 功率标签 (Power Label) 切换 ---
    const powerRadios = document.querySelectorAll('input[name="power_mode"]');
    const powerLabel = document.getElementById('power-label');
    if(powerRadios.length && powerLabel) {
        powerRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'input') {
                    powerLabel.textContent = '输入功率 (kW) (电机)';
                } else {
                    powerLabel.textContent = '轴功率 (kW)';
                }
            });
        });
    }

    // --- M2 效率标签 (Efficiency Label) 切换 ---
    const effRadiosM2 = document.querySelectorAll('input[name="eff_mode_m2"]');
    const effLabelM2 = document.getElementById('eta_s_label_m2');
    const effTooltipM2 = document.getElementById('tooltip-eta-s-m2');
    if (effRadiosM2.length && effLabelM2 && effTooltipM2) {
        effRadiosM2.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'input') {
                    effLabelM2.childNodes[0].nodeValue = '总等熵效率 (η_total) ';
                    effTooltipM2.textContent = '基于【输入功率】。η_total = 理论等熵功率 / 电机输入功率。';
                } else {
                    effLabelM2.childNodes[0].nodeValue = '等熵效率 (η_s) ';
                    effTooltipM2.textContent = '基于【轴功率】。η_s = 理论等熵功率 / 压缩机轴功率。';
                }
            });
        });
    }

    // --- M2B 效率标签 (Efficiency Label) 切换 (v4.2 新增) ---
    const effRadiosM2B = document.querySelectorAll('input[name="eff_mode_m2b"]');
    const effLabelM2B = document.getElementById('eta_s_label_m2b');
    const effTooltipM2B = document.getElementById('tooltip-eta-s-m2b');
    if (effRadiosM2B.length && effLabelM2B && effTooltipM2B) {
        effRadiosM2B.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'input') {
                    effLabelM2B.childNodes[0].nodeValue = '总等熵效率 (η_total) ';
                    effTooltipM2B.textContent = '基于【输入功率】。η_total = 理论等熵功率 / 电机输入功率。';
                } else {
                    effLabelM2B.childNodes[0].nodeValue = '等熵效率 (η_s) ';
                    effTooltipM2B.textContent = '基于【轴功率】。η_s = 理论等熵功率 / 压缩机轴功率。';
                }
            });
        });
    }

    // --- MVR 状态定义 (Inlet/Outlet) 电台切换 ---
    function setupStateToggle(radioName, tempInputDivId, pressInputDivId) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        const tempDiv = document.getElementById(tempInputDivId);
        const pressDiv = document.getElementById(pressInputDivId);

        if (!radios.length || !tempDiv || !pressDiv) return;

        const toggle = (val) => {
            if (val === 'temp') {
                tempDiv.style.display = 'block';
                pressDiv.style.display = 'none';
                tempDiv.querySelector('input').required = true;
                pressDiv.querySelector('input').required = false;
            } else {
                tempDiv.style.display = 'none';
                pressDiv.style.display = 'block';
                tempDiv.querySelector('input').required = false;
                pressDiv.querySelector('input').required = true;
            }
        };

        radios.forEach(radio => {
            radio.addEventListener('change', () => toggle(radio.value));
        });
        
        // 初始状态
        const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
        if (checkedRadio) {
            toggle(checkedRadio.value);
        }
    }

    setupStateToggle('inlet_mode_m3', 'inlet-temp-m3', 'inlet-press-m3');
    setupStateToggle('outlet_mode_m3', 'outlet-temp-m3', 'outlet-press-m3');
    setupStateToggle('inlet_mode_m4', 'inlet-temp-m4', 'inlet-press-m4');
    setupStateToggle('outlet_mode_m4', 'outlet-temp-m4', 'outlet-press-m4');


    // --- 后冷却器 (Cooler) 复选框 ---
    function setupCoolerToggle(checkboxId, inputsDivId) {
        const checkbox = document.getElementById(checkboxId);
        const inputsDiv = document.getElementById(inputsDivId);
        
        if (!checkbox || !inputsDiv) return;

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                inputsDiv.style.display = 'block';
            } else {
                inputsDiv.style.display = 'none';
            }
        });
    }
    
    setupCoolerToggle('enable_cooler_calc_m2', 'cooler-inputs-m2');
    setupCoolerToggle('enable_cooler_calc_m2b', 'cooler-inputs-m2b'); // v4.2 新增
    
    // ==========================================================
    // v4.2 新增: 模式 2A / 2B 子选项卡切换
    // ==========================================================
    const tabBtn2A = document.getElementById('tab-btn-mode-2a');
    const tabBtn2B = document.getElementById('tab-btn-mode-2b');
    const content2A = document.getElementById('mode-2a-content');
    const content2B = document.getElementById('mode-2b-content');

    if (tabBtn2A && tabBtn2B && content2A && content2B) {
        tabBtn2A.addEventListener('click', () => {
            tabBtn2A.classList.add('active');
            tabBtn2B.classList.remove('active');
            content2A.style.display = 'block';
            content2B.style.display = 'none';
            
            // 确保 M2 容器在主电台被选中时可见
            mode2Container.style.display = 'block';
            mode1Container.style.display = 'none';
            mode2Radio.checked = true;
        });

        tabBtn2B.addEventListener('click', () => {
            tabBtn2B.classList.add('active');
            tabBtn2A.classList.remove('active');
            content2B.style.display = 'block';
            content2A.style.display = 'none';
            
            // 确保 M2 容器在主电台被选中时可见
            mode2Container.style.display = 'block';
            mode1Container.style.display = 'none';
            mode2Radio.checked = true;
        });
    }

});