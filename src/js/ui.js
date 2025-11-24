// =====================================================================
// ui.js: UI 界面交互逻辑 (全模式通用 & 流量控制中心)
// 版本: v8.13 (Fix: Flow Inputs Visibility & CO2 Support)
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------------
    // 1. 主选项卡 (Tab) 切换逻辑
    // -----------------------------------------------------------------
    const tabs = [
        { btn: document.getElementById('tab-btn-1'), content: document.getElementById('tab-content-1') },
        { btn: document.getElementById('tab-btn-2'), content: document.getElementById('tab-content-2') },
        { btn: document.getElementById('tab-btn-3'), content: document.getElementById('tab-content-3') },
        { btn: document.getElementById('tab-btn-4'), content: document.getElementById('tab-content-4') },
        { btn: document.getElementById('tab-btn-5'), content: document.getElementById('tab-content-5') }
    ];

    tabs.forEach(tab => {
        if (tab.btn && tab.content) {
            tab.btn.addEventListener('click', () => {
                // Deactivate all
                tabs.forEach(t => {
                    if (t.btn && t.content) {
                        t.btn.classList.remove('active');
                        t.content.style.display = 'none';
                        t.content.classList.remove('active');
                    }
                });
                // Activate clicked
                tab.btn.classList.add('active');
                tab.content.style.display = 'block';
                tab.content.classList.add('active');
            });
        }
    });

    // -----------------------------------------------------------------
    // 2. 流量模式切换器 (RPM / Mass / Vol) - 核心修复
    // -----------------------------------------------------------------
    function setupFlowToggle(modeSuffix) {
        // 查找该模式下的所有单选按钮
        const radios = document.querySelectorAll(`input[name="flow_mode_${modeSuffix}"]`);
        if (!radios.length) return;

        // 查找对应的输入容器
        const divRpm = document.getElementById(`flow-inputs-rpm-${modeSuffix}`);
        const divMass = document.getElementById(`flow-inputs-mass-${modeSuffix}`);
        const divVol = document.getElementById(`flow-inputs-vol-${modeSuffix}`);

        const toggle = () => {
            // 获取当前选中的值
            const checked = document.querySelector(`input[name="flow_mode_${modeSuffix}"]:checked`);
            if (!checked) return;
            
            const val = checked.value;

            // 通用显示/隐藏函数 (使用 classList 操作 hidden)
            const setVisible = (div, isVisible) => {
                if (!div) return;
                if (isVisible) {
                    div.classList.remove('hidden');
                    // 针对 RPM 这种 Grid 布局的特殊处理
                    if (div.id.includes('rpm')) {
                        div.style.display = 'grid'; 
                    } else {
                        div.style.display = 'block';
                    }
                    setInputsRequired(div, true);
                } else {
                    div.classList.add('hidden');
                    div.style.display = 'none';
                    setInputsRequired(div, false);
                }
            };

            setVisible(divRpm, val === 'rpm');
            setVisible(divMass, val === 'mass');
            setVisible(divVol, val === 'vol');
        };

        // 绑定事件
        radios.forEach(r => r.addEventListener('change', toggle));
        
        // [Fix] 立即初始化一次状态
        toggle();
    }

    // 辅助函数：设置必填状态
    function setInputsRequired(container, isRequired) {
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
            input.required = isRequired;
            input.disabled = !isRequired; // 禁用隐藏的输入框以防止提交干扰
        });
    }

    // [Fix] 包含 m1_co2 的完整列表
    const allModes = ['m1', 'm1_co2', 'm2', 'm3', 'm4', 'm5'];
    allModes.forEach(suffix => {
        setupFlowToggle(suffix);
    });


    // -----------------------------------------------------------------
    // 3. 模式三 (空压机) 冷却方式切换
    // -----------------------------------------------------------------
    function setupMode3CoolingToggle() {
        const radios = document.querySelectorAll('input[name="cooling_type_m3"]');
        const divJacket = document.getElementById('jacket-inputs-m3');
        const divInjection = document.getElementById('injection-inputs-m3');

        if (!radios.length) return;

        const toggle = () => {
            const checked = document.querySelector('input[name="cooling_type_m3"]:checked');
            if (!checked) return;
            const val = checked.value;

            if (divJacket) {
                const show = (val === 'jacket');
                divJacket.style.display = show ? 'block' : 'none';
                if(!show) divJacket.classList.add('hidden'); else divJacket.classList.remove('hidden');
                setInputsRequired(divJacket, show);
            }
            if (divInjection) {
                const show = (val === 'injection');
                divInjection.style.display = show ? 'block' : 'none';
                if(!show) divInjection.classList.add('hidden'); else divInjection.classList.remove('hidden');
                setInputsRequired(divInjection, show);
            }
        };

        radios.forEach(r => r.addEventListener('change', toggle));
        toggle();
    }
    setupMode3CoolingToggle();

    // -----------------------------------------------------------------
    // 4. 后冷却器 (Cooler) 复选框切换
    // -----------------------------------------------------------------
    function setupCoolerToggle(checkboxId, inputsDivId) {
        const checkbox = document.getElementById(checkboxId);
        const inputsDiv = document.getElementById(inputsDivId);
        
        if (!checkbox || !inputsDiv) return;

        const toggle = () => {
            const isChecked = checkbox.checked;
            inputsDiv.style.display = isChecked ? 'block' : 'none';
            if(!isChecked) inputsDiv.classList.add('hidden'); else inputsDiv.classList.remove('hidden');
            setInputsRequired(inputsDiv, isChecked);
        };

        checkbox.addEventListener('change', toggle);
        toggle();
    }
    
    setupCoolerToggle('enable_cooler_calc_m2', 'cooler-inputs-m2');
    setupCoolerToggle('enable_cooler_calc_m3', 'cooler-inputs-m3');

});