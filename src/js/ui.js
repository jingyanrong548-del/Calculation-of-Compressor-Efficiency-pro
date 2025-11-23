// =====================================================================
// ui.js: UI 界面交互逻辑 (全模式通用)
// 版本: v7.6 (Tab管理 & 动态表单控制)
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
    // 2. 流量模式切换器 (RPM / Mass / Vol)
    // -----------------------------------------------------------------
    // 此函数会自动查找 HTML 中 id 为 flow-inputs-rpm-mX, flow-inputs-mass-mX 等的容器
    // 并根据 name="flow_mode_mX" 的 radio 状态进行显隐切换
    function setupFlowToggle(modeSuffix) {
        const radios = document.querySelectorAll(`input[name="flow_mode_${modeSuffix}"]`);
        if (!radios.length) return;

        const divRpm = document.getElementById(`flow-inputs-rpm-${modeSuffix}`);
        const divMass = document.getElementById(`flow-inputs-mass-${modeSuffix}`);
        const divVol = document.getElementById(`flow-inputs-vol-${modeSuffix}`);

        const toggle = () => {
            // 获取当前被选中的值
            const checked = document.querySelector(`input[name="flow_mode_${modeSuffix}"]:checked`);
            if (!checked) return;
            
            const val = checked.value;

            // 切换 Grid/Block 显示
            // RPM 容器通常包含两个输入框(转速+排量)，所以用 Grid 布局更佳
            if (divRpm) {
                divRpm.style.display = (val === 'rpm') ? 'grid' : 'none';
                setInputsRequired(divRpm, val === 'rpm');
            }
            if (divMass) {
                divMass.style.display = (val === 'mass') ? 'block' : 'none';
                setInputsRequired(divMass, val === 'mass');
            }
            if (divVol) {
                divVol.style.display = (val === 'vol') ? 'block' : 'none';
                setInputsRequired(divVol, val === 'vol');
            }
        };

        // 绑定事件
        radios.forEach(r => r.addEventListener('change', toggle));
        
        // 初始化一次状态
        toggle();
    }

    // 辅助函数：设置输入框的 required 属性，防止隐藏的输入框阻碍表单提交
    function setInputsRequired(container, isRequired) {
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
            input.required = isRequired;
            // 可选：禁用隐藏的输入框以避免回车提交意外数据
            input.disabled = !isRequired;
        });
    }

    // 对 5 个模式分别应用流量切换逻辑
    ['m1', 'm2', 'm3', 'm4', 'm5'].forEach(suffix => {
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
                setInputsRequired(divJacket, show);
            }
            if (divInjection) {
                const show = (val === 'injection');
                divInjection.style.display = show ? 'block' : 'none';
                setInputsRequired(divInjection, show);
            }
        };

        radios.forEach(r => r.addEventListener('change', toggle));
        toggle();
    }

    setupMode3CoolingToggle();

});