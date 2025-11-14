// =====================================================================
// ui.js: UI 界面交互逻辑
// 版本: v5.1 (修复版)
// 职责: 1. (v4.4) 处理主选项卡 (M1, M2, M3, M4)
//        2. (v5.1) [重写] 使用通用的 setupDynamicToggle 修复 N-way 切换
//        3. (v5.0) 处理后冷却器复选框 (M2A, M2B, M2C)
//        4. (v5.0) 处理 M2A / M2B / M2C 子选项卡
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- (v4.4) 主选项卡切换 (M1, M2, M3, M4) ---
    const tabBtnM1 = document.getElementById('tab-btn-m1');
    const tabBtnM2 = document.getElementById('tab-btn-m2');
    const tabBtnM3 = document.getElementById('tab-btn-m3');
    const tabBtnM4 = document.getElementById('tab-btn-m4');
    
    const contentM1 = document.getElementById('tab-content-m1');
    const contentM2 = document.getElementById('tab-content-m2');
    const contentM3 = document.getElementById('tab-content-m3');
    const contentM4 = document.getElementById('tab-content-m4');

    const tabs = [
        { btn: tabBtnM1, content: contentM1 },
        { btn: tabBtnM2, content: contentM2 },
        { btn: tabBtnM3, content: contentM3 },
        { btn: tabBtnM4, content: contentM4 }
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
    // (v5.1 修复) 通用动态切换器
    // =====================================================================
    /**
     * (v5.1 修复)
     * 通用单选按钮 (Radio) 切换器 (N-way)
     * 自动匹配 radio 的 value 和 div 的 ID
     * @param {string} radioName - The 'name' attribute of the radio buttons.
     * @param {string} prefix - The common prefix for the target div IDs (e.g., 'flow-inputs-')
     * @param {string} suffix - The common suffix for the target div IDs (e.g., '-m1')
     * @param {string} displayType - 'block' or 'grid' (for M3/M4 state inputs)
     */
    function setupDynamicToggle(radioName, prefix, suffix, displayType = 'block') {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        if (!radios.length) {
            // console.warn(`setupDynamicToggle: No radios found for name="${radioName}"`);
            return;
        }

        // 存储所有相关的 div
        const contentDivs = new Map();
        radios.forEach(radio => {
            // e.g., radio.value = 'rpm'
            // divId = 'flow-inputs-rpm-m1'
            const divId = `${prefix}${radio.value}${suffix}`;
            const div = document.getElementById(divId);
            if (div) {
                contentDivs.set(radio.value, div);
            } else {
                // console.warn(`setupDynamicToggle: Cannot find div with ID: ${divId}`);
            }
        });

        if (contentDivs.size === 0) {
            // console.warn(`setupDynamicToggle: No content divs found for ${radioName}`);
            return;
        }

        const toggle = (selectedValue) => {
            contentDivs.forEach((div, value) => {
                if (value === selectedValue) {
                    div.style.display = displayType;
                    div.querySelectorAll('input').forEach(i => i.required = true);
                } else {
                    div.style.display = 'none';
                    div.querySelectorAll('input').forEach(i => i.required = false);
                }
            });
        };

        radios.forEach(radio => {
            radio.addEventListener('change', () => toggle(radio.value));
        });

        // 初始状态
        const checkedRadio = document.querySelector(`input[name="${radioName}"]:checked`);
        if (checkedRadio) {
            toggle(checkedRadio.value);
        } else {
            toggle(radios[0].value); // 默认激活第一个
        }
    }

    // --- (v5.1 修复) 流量模式 (Flow Mode) ---
    // M1: 3-way (rpm, mass, vol)
    setupDynamicToggle('flow_mode_m1', 'flow-inputs-', '-m1');
    // M2A: 3-way (rpm, mass, vol)
    setupDynamicToggle('flow_mode_m2', 'flow-inputs-', '-m2');
    // M2B: 3-way (rpm, mass, vol)
    setupDynamicToggle('flow_mode_m2b', 'flow-inputs-', '-m2b');
    // M4: 2-way (mass, vol)
    setupDynamicToggle('flow_mode_m4', 'flow-inputs-', '-m4');

    // --- (v5.1 修复) MVR 状态定义 (Inlet/Outlet) ---
    // M3: 2-way (PT, PQ)
    setupDynamicToggle('state_define_m3', 'state-inputs-', '-m3', 'grid');
    // M4: 2-way (PT, PQ)
    setupDynamicToggle('state_define_m4', 'state-inputs-', '-m4', 'grid');


    // --- (v5.0) 后冷却器 (Cooler) 复选框 ---
    function setupCoolerToggle(checkboxId, inputsDivId) {
        const checkbox = document.getElementById(checkboxId);
        const inputsDiv = document.getElementById(inputsDivId);
        
        if (!checkbox || !inputsDiv) {
            // console.warn(`setupCoolerToggle: Missing elements for ${checkboxId}`);
            return;
        }

        const toggle = () => {
            if (checkbox.checked) {
                inputsDiv.style.display = 'block';
            } else {
                inputsDiv.style.display = 'none';
            }
        };

        checkbox.addEventListener('change', toggle);
        toggle(); // 初始调用以设置正确状态
    }
    
    setupCoolerToggle('enable_cooler_calc_m2', 'cooler-inputs-m2');
    setupCoolerToggle('enable_cooler_calc_m2b', 'cooler-inputs-m2b');
    setupCoolerToggle('enable_cooler_calc_m2c', 'cooler-inputs-m2c'); // v5.0 新增
    
    
    // ==========================================================
    // (v5.0) 模式 2A / 2B / 2C 子选项卡切换
    // ==========================================================
    const tabBtn2A = document.getElementById('tab-btn-mode-2a');
    const tabBtn2B = document.getElementById('tab-btn-mode-2b');
    const tabBtn2C = document.getElementById('tab-btn-mode-2c'); // v5.0 新增
    
    const content2A = document.getElementById('mode-2a-content');
    const content2B = document.getElementById('mode-2b-content');
    const content2C = document.getElementById('mode-2c-content'); // v5.0 新增

    // (v5.0 采用更健壮的列表循环方式)
    const subTabs2 = [
        { btn: tabBtn2A, content: content2A },
        { btn: tabBtn2B, content: content2B },
        { btn: tabBtn2C, content: content2C } // v5.0 新增
    ];

    subTabs2.forEach(tab => {
        // 确保按钮和内容都存在
        if (tab.btn && tab.content) {
            tab.btn.addEventListener('click', () => {
                // 1. 重置所有 M2 子选项卡
                subTabs2.forEach(t => {
                    if (t.btn && t.content) {
                        t.btn.classList.remove('active');
                        t.content.style.display = 'none';
                    }
                });
                // 2. 激活当前
                tab.btn.classList.add('active');
                tab.content.style.display = 'block';
            });
        }
    });

});