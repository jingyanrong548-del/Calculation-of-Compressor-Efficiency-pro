// =====================================================================
// ui.js: 界面交互模块
// 版本: v3.0
// 职责: 1. 处理主选项卡 (Tabs) 切换
//        2. 处理干式压缩内部的模式 1/2 切换
//        3. 处理所有模式中共用的表单 UI 逻辑 (如流量模式等)
// =====================================================================

/**
 * 辅助函数：设置流量模式 (RPM vs 体积) 的 UI 切换
 * @param {string} modeSelector - 'name' 属性选择器, e.g., "input[name='flow_mode']"
 * @param {string} rpmContainerId - RPM 输入组的 ID
 * @param {string} volContainerId - 体积流量输入组的 ID
 * @param {string} displacementInputId - 排量 input 的 ID
 * @param {string} flowInputId - 流量 input 的 ID
 */
function setupFlowModeToggle(modeSelector, rpmContainerId, volContainerId, displacementInputId, flowInputId) {
    const radios = document.querySelectorAll(modeSelector);
    const rpmInputs = document.getElementById(rpmContainerId);
    const volInputs = document.getElementById(volContainerId);
    const displacementInput = document.getElementById(displacementInputId);
    const flowInput = document.getElementById(flowInputId);

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'rpm') {
                rpmInputs.style.display = 'block';
                volInputs.style.display = 'none';
                displacementInput.required = true;
                flowInput.required = false;
            } else {
                rpmInputs.style.display = 'none';
                volInputs.style.display = 'block';
                displacementInput.required = false;
                flowInput.required = true;
            }
        });
    });
    
    // 触发一次 change 事件以确保初始状态正确
    document.querySelector(`${modeSelector}[value='rpm']`).dispatchEvent(new Event('change'));
}

/**
 * 辅助函数：设置模式一的功率模式 UI 切换
 */
function setupMode1PowerToggle() {
    const radios = document.querySelectorAll("input[name='power_mode']");
    const powerLabel = document.getElementById('power-label');
    const motorEffGroup = document.getElementById('motor-eff-group-m1');
    const motorEffInput = document.getElementById('motor_eff');

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'shaft') {
                powerLabel.textContent = '轴功率 (kW)';
                motorEffGroup.style.display = 'none';
                motorEffInput.required = false;
            } else {
                powerLabel.textContent = '输入功率 (kW) (电机)';
                motorEffGroup.style.display = 'block';
                motorEffInput.required = true;
            }
        });
    });
    // 触发初始状态
    document.querySelector("input[name='power_mode'][value='input']").dispatchEvent(new Event('change'));
}

/**
 * 辅助函数：设置模式一的容量模式 UI 切换
 */
function setupMode1CapacityToggle() {
    const radios = document.querySelectorAll("input[name='capacity_mode']");
    const capacityLabel = document.getElementById('capacity-label');

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'refrigeration') {
                capacityLabel.textContent = '制冷量 (kW)';
            } else {
                capacityLabel.textContent = '制热量 (kW)';
            }
        });
    });
    // 触发初始状态
    document.querySelector("input[name='capacity_mode'][value='heating']").dispatchEvent(new Event('change'));
}

/**
 * 辅助函数：设置模式二的效率模式 UI 切换
 */
function setupMode2EffToggle() {
    const radios = document.querySelectorAll("input[name='eff_mode_m2']");
    const etaSLabel = document.getElementById('eta_s_label_m2');
    const tooltipEtaS = document.getElementById('tooltip-eta-s-m2');
    const motorEffGroup = document.getElementById('motor-eff-group-m2');
    const motorEffInput = document.getElementById('motor_eff_m2');

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'shaft') {
                etaSLabel.childNodes[0].nodeValue = '等熵效率 (η_s) ';
                tooltipEtaS.textContent = '基于【轴功率】。η_s = 理论等熵功率 / 压缩机轴功率。';
                motorEffGroup.style.display = 'none';
                motorEffInput.required = false;
            } else {
                etaSLabel.childNodes[0].nodeValue = '总等熵效率 (η_total) ';
                tooltipEtaS.textContent = '基于【输入功率】。η_total = 理论等熵功率 / 电机输入功率。';
                motorEffGroup.style.display = 'block';
                motorEffInput.required = true;
            }
        });
    });
    // 触发初始状态
    document.querySelector("input[name='eff_mode_m2'][value='input']").dispatchEvent(new Event('change'));
}

/**
 * 辅助函数：设置模式二的后冷却器 UI 切换
 */
function setupMode2CoolerToggle() {
    const checkbox = document.getElementById('enable_cooler_calc_m2');
    const coolerInputs = document.getElementById('cooler-inputs-m2');
    const targetTempInput = document.getElementById('target_temp_m2');

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            coolerInputs.style.display = 'block';
            targetTempInput.required = true;
        } else {
            coolerInputs.style.display = 'none';
            targetTempInput.required = false;
        }
    });
    // 确保初始状态为隐藏
    coolerInputs.style.display = 'none';
    targetTempInput.required = false;
}

/**
 * 主 UI 初始化函数
 * 由 main.js 在物性库加载成功后调用
 */
export function initUI() {
    
    // --- 1. 主选项卡 (Tab) 切换逻辑 ---
    const tabBtnDry = document.getElementById('tab-btn-dry');
    const tabBtnMvr = document.getElementById('tab-btn-mvr');
    const tabContentDry = document.getElementById('tab-content-dry');
    const tabContentMvr = document.getElementById('tab-content-mvr');

    tabBtnDry.addEventListener('click', () => {
        tabBtnDry.classList.add('active');
        tabBtnMvr.classList.remove('active');
        tabContentDry.classList.add('active');
        tabContentMvr.classList.remove('active');
    });

    tabBtnMvr.addEventListener('click', () => {
        tabBtnDry.classList.remove('active');
        tabBtnMvr.classList.add('active');
        tabContentDry.classList.remove('active');
        tabContentMvr.classList.add('active');
    });

    // --- 2. 模式 1 / 模式 2 内部切换逻辑 ---
    const mode1Radio = document.getElementById('mode-1-radio');
    const mode2Radio = document.getElementById('mode-2-radio');
    const mode1Container = document.getElementById('mode-1-container');
    const mode2Container = document.getElementById('mode-2-container');

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
    
    // 确保初始状态正确
    mode1Container.style.display = 'block';
    mode2Container.style.display = 'none';


    // --- 3. 初始化所有模式中的共用 UI 逻辑 ---
    
    // 模式一：流量模式
    setupFlowModeToggle(
        "input[name='flow_mode']", 
        'rpm-inputs-m1', 
        'vol-inputs-m1', 
        'displacement', 
        'flow_m3h'
    );
    // 模式一：功率模式
    setupMode1PowerToggle();
    // 模式一：容量模式
    setupMode1CapacityToggle();

    // 模式二：流量模式
    setupFlowModeToggle(
        "input[name='flow_mode_m2']", 
        'rpm-inputs-m2', 
        'vol-inputs-m2', 
        'displacement_m2', 
        'flow_m3h_m2'
    );
    // 模式二：效率模式
    setupMode2EffToggle();
    // 模式二：后冷却器
    setupMode2CoolerToggle();

    // 模式三：(模式三没有复杂的 UI 切换, 暂时不需要)
    
    console.log("UI 模块已初始化。");
}