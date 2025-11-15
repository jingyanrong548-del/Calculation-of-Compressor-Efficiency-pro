// =====================================================================
// ui.js: UI 界面交互逻辑
// 版本: v7.0 (五模式重构)
// 职责: 1. 处理5个主选项卡的切换逻辑。
//        2. 使用通用切换器管理各模式内部的动态表单。
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- (v7.0) 主选项卡切换 (5个独立模式) ---
    const tabBtn1 = document.getElementById('tab-btn-1');
    const tabBtn2 = document.getElementById('tab-btn-2');
    const tabBtn3 = document.getElementById('tab-btn-3');
    const tabBtn4 = document.getElementById('tab-btn-4');
    const tabBtn5 = document.getElementById('tab-btn-5');
    
    const content1 = document.getElementById('tab-content-1');
    const content2 = document.getElementById('tab-content-2');
    const content3 = document.getElementById('tab-content-3');
    const content4 = document.getElementById('tab-content-4');
    const content5 = document.getElementById('tab-content-5');

    const tabs = [
        { btn: tabBtn1, content: content1 },
        { btn: tabBtn2, content: content2 },
        { btn: tabBtn3, content: content3 },
        { btn: tabBtn4, content: content4 },
        { btn: tabBtn5, content: content5 }
    ];

    tabs.forEach(tab => {
        // 确保按钮和内容都存在
        if (tab.btn && tab.content) {
            tab.btn.addEventListener('click', () => {
                // 1. 重置所有
                tabs.forEach(t => {
                    if (t.btn && t.content) {
                        t.btn.classList.remove('active');
                        t.content.style.display = 'none';
                        t.content.classList.remove('active');
                    }
                });
                // 2. 激活当前
                tab.btn.classList.add('active');
                tab.content.style.display = 'block';
                tab.content.classList.add('active');
            });
        }
    });

    // =====================================================================
    // 通用动态切换器 (无需修改函数本身)
    // =====================================================================
    /**
     * 通用单选按钮 (Radio) 切换器 (N-way)
     * @param {string} radioName - The 'name' attribute of the radio buttons.
     * @param {string} prefix - The common prefix for the target div IDs (e.g., 'flow-inputs-')
     * @param {string} suffix - The common suffix for the target div IDs (e.g., '-m1')
     * @param {string} displayType - 'block' or 'grid'
     */
    function setupDynamicToggle(radioName, prefix, suffix, displayType = 'block') {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        if (!radios.length) {
            return;
        }

        const contentDivs = new Map();
        radios.forEach(radio => {
            const divId = `${prefix}${radio.value}${suffix}`;
            const div = document.getElementById(divId);
            if (div) {
                contentDivs.set(radio.value, div);
            }
        });

        if (contentDivs.size === 0) {
            return;
        }

        const toggle = (selectedValue) => {
            contentDivs.forEach((div, value) => {
                const currentDisplayType = (value === 'rpm' || value === 'pt' || value === 'pq' || value === 't_sh' || value === 't_t') ? 'grid' : displayType;

                if (value === selectedValue) {
                    div.style.display = currentDisplayType;
                    div.querySelectorAll('input').forEach(i => {
                        i.required = true;
                        i.disabled = false;
                    });
                } else {
                    div.style.display = 'none';
                    div.querySelectorAll('input').forEach(i => {
                        i.required = false;
                        i.disabled = true;
                    });
                }
            });
        };

        radios.forEach(radio => {
            radio.addEventListener('change', () => toggle(radio.value));
        });

        const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
        if (checkedRadio) {
            toggle(checkedRadio.value);
        } else if (radios.length > 0) {
            toggle(radios[0].value);
        }
    }

    // --- (v7.0) 更新所有切换器的调用以匹配新ID ---
    
    // 模式一: 热泵 (原2A)
    setupDynamicToggle('inlet_define_m1', 'inlet-inputs-', '-m1', 'grid');
    setupDynamicToggle('outlet_define_m1', 'outlet-inputs-', '-m1', 'block');
    setupDynamicToggle('flow_mode_m1', 'flow-inputs-', '-m1');
    
    // 模式二: 气体 (原2B)
    setupDynamicToggle('flow_mode_m2', 'flow-inputs-', '-m2');
    
    // 模式三: 空压机 (原2C) - 其内部切换逻辑在 mode2c_air.js 中处理
    
    // 模式四: MVR 容积式 (原M3)
    setupDynamicToggle('state_define_m4', 'state-inputs-', '-m4', 'grid');
    setupDynamicToggle('flow_mode_m4', 'flow-inputs-', '-m4');

    // 模式五: MVR 透平式 (原M4)
    setupDynamicToggle('state_define_m5', 'state-inputs-', '-m5', 'grid');
    setupDynamicToggle('flow_mode_m5', 'flow-inputs-', '-m5');


    // --- (v7.0) 后冷却器 (Cooler) 复选框 ---
    function setupCoolerToggle(checkboxId, inputsDivId) {
        const checkbox = document.getElementById(checkboxId);
        const inputsDiv = document.getElementById(inputsDivId);
        
        if (!checkbox || !inputsDiv) {
            return;
        }

        const toggle = () => {
            const isChecked = checkbox.checked;
            inputsDiv.style.display = isChecked ? 'block' : 'none';
            inputsDiv.querySelectorAll('input').forEach(i => {
                i.disabled = !isChecked;
            });
        };

        checkbox.addEventListener('change', toggle);
        toggle(); // 初始调用以设置正确状态
    }
    
    // 更新 Cooler Toggle 的调用
    setupCoolerToggle('enable_cooler_calc_m1', 'cooler-inputs-m1'); // 热泵
    setupCoolerToggle('enable_cooler_calc_m2', 'cooler-inputs-m2'); // 气体
    setupCoolerToggle('enable_cooler_calc_m3', 'cooler-inputs-m3'); // 空压机
    
    // --- (v7.0) 移除原模式二的子选项卡切换逻辑 ---
    // (相关代码已全部删除)

});