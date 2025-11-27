// =====================================================================
// stage_config.js: Advanced Multi-Stage Configuration Manager
// 版本: v8.36 (Phase 3: Advanced Multi-Stage Logic)
// =====================================================================

export class StageConfigManager {
    constructor() {
        this.modal = null;
        this.container = null;
        this.stages = 1;
        this.pInGlobal = 1.0;
        this.pOutGlobal = 8.0;
        this.configData = null; // Stores the custom configuration [{p_in, p_out, dp, t_ic}, ...]
    }

    /**
     * 初始化：绑定 DOM 元素
     */
    init() {
        this.modal = document.getElementById('stage-config-modal');
        this.container = document.getElementById('stage-config-container');
        
        // Bind Confirm Button
        const btnConfirm = document.getElementById('btn-confirm-stages');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                if (this.validate()) {
                    this.collectData();
                    this.close();
                    // Dispatch event to notify UI/Calc that advanced config is ready
                    document.dispatchEvent(new Event('advanced-config-updated'));
                    alert(`已应用 ${this.configData.length} 级的高级配置。\n(Advanced configuration applied)`);
                }
            });
        }

        // Bind Cancel/Close Button
        const btnCancel = document.getElementById('btn-cancel-stages');
        if(btnCancel) btnCancel.addEventListener('click', () => this.close());
    }

    /**
     * 打开弹窗并预填数据
     * @param {number} stages - 总级数
     * @param {number} p_in - 总吸气压力
     * @param {number} p_out - 总排气压力
     */
    open(stages, p_in, p_out) {
        this.stages = parseInt(stages);
        this.pInGlobal = parseFloat(p_in);
        this.pOutGlobal = parseFloat(p_out);
        
        if (this.stages < 2) {
            alert("高级配置仅适用于多级压缩 (级数 >= 2)。\nAdvanced config is for multi-stage only.");
            return;
        }

        if (this.modal) {
            this.modal.classList.remove('hidden');
            this.modal.classList.add('flex');
            this.render();
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.add('hidden');
            this.modal.classList.remove('flex');
        }
    }

    /**
     * 渲染输入行
     * 默认逻辑：按等压比 (Equal Pressure Ratio) 分配初始值
     */
    render() {
        if (!this.container) return;
        this.container.innerHTML = '';

        // Calculate Equal PR for defaults
        const prTotal = this.pOutGlobal / this.pInGlobal;
        const prStage = Math.pow(prTotal, 1.0 / this.stages);

        let currentPIn = this.pInGlobal;

        // Header
        const header = document.createElement('div');
        header.className = "grid grid-cols-12 gap-2 mb-2 font-bold text-xs text-gray-600 text-center bg-gray-100 p-2 rounded";
        header.innerHTML = `
            <div class="col-span-1 flex items-center justify-center">#</div>
            <div class="col-span-3 text-left">Inlet P (bar)</div>
            <div class="col-span-3 text-left">Discharge P (bar)</div>
            <div class="col-span-2 text-left">Intercool dP</div>
            <div class="col-span-3 text-left">IC Out T (°C)</div>
        `;
        this.container.appendChild(header);

        // Rows
        for (let i = 1; i <= this.stages; i++) {
            const isLast = i === this.stages;
            
            // Default P_out calculation
            let defaultPOut = currentPIn * prStage;
            // Force last stage to match global P_out exactly
            if (isLast) defaultPOut = this.pOutGlobal;

            const row = document.createElement('div');
            row.className = "grid grid-cols-12 gap-2 mb-2 items-center stage-row p-1 border-b border-gray-50";
            row.dataset.index = i;

            // HTML Structure
            // Stage 1 Inlet is readonly (locked to global). Others are readonly (calculated).
            // Only P_out, dP, T_ic are editable. Next P_in is auto-derived.
            
            row.innerHTML = `
                <div class="col-span-1 text-center font-bold text-teal-700 bg-teal-50 rounded">${i}</div>
                <div class="col-span-3">
                    <input type="number" class="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-gray-100 text-gray-500 stg-p-in" 
                        value="${currentPIn.toFixed(3)}" step="0.01" readonly title="Calculated from Prev Stage">
                </div>
                <div class="col-span-3">
                    <input type="number" class="w-full border border-teal-300 rounded px-2 py-1 text-sm font-bold text-teal-800 stg-p-out focus:ring-2 focus:ring-teal-500 focus:outline-none" 
                        value="${defaultPOut.toFixed(3)}" step="0.01">
                </div>
                <div class="col-span-2">
                    <input type="number" class="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-600 stg-dp" 
                        value="${isLast ? 0 : 0.05}" step="0.01" ${isLast ? 'disabled bg-gray-100' : ''} placeholder="bar">
                </div>
                <div class="col-span-3">
                    <input type="number" class="w-full border border-blue-300 rounded px-2 py-1 text-sm text-blue-600 stg-t-ic" 
                        value="${isLast ? '-' : 35}" step="0.1" ${isLast ? 'disabled bg-gray-100' : ''} placeholder="°C">
                </div>
            `;

            this.container.appendChild(row);

            // Prep for next loop
            currentPIn = defaultPOut - (isLast ? 0 : 0.05); 
        }

        // Bind listeners for cascading updates
        this.bindAutoCalc();
    }

    /**
     * 级间联动逻辑：
     * 修改 Stage N 的 排气压力 或 压损 -> 自动更新 Stage N+1 的 吸气压力
     */
    bindAutoCalc() {
        const rows = this.container.querySelectorAll('.stage-row');
        rows.forEach((row, idx) => {
            const pOutInput = row.querySelector('.stg-p-out');
            const dpInput = row.querySelector('.stg-dp');
            
            const updateNextStage = () => {
                // Only update if there is a next stage
                if (idx + 1 < rows.length) {
                    const nextRow = rows[idx + 1];
                    const nextPInInput = nextRow.querySelector('.stg-p-in');
                    
                    const pOut = parseFloat(pOutInput.value) || 0;
                    const dp = parseFloat(dpInput.value) || 0;
                    
                    // Logic: Next P_in = Current P_out - Pressure Drop
                    const nextPIn = Math.max(0.01, pOut - dp); // Prevent negative
                    nextPInInput.value = nextPIn.toFixed(3);
                    
                    // Recursively update the chain? 
                    // For simplicity, we only update immediate neighbor P_in. 
                    // The user then needs to adjust the next P_out if they want to maintain ratio, 
                    // OR we could hold ratio constant.
                    // Current implementation: Fixed P_out values unless manually changed.
                }
            };

            pOutInput.addEventListener('input', updateNextStage);
            dpInput.addEventListener('input', updateNextStage);
        });
    }

    /**
     * 校验数据合法性
     */
    validate() {
        const rows = this.container.querySelectorAll('.stage-row');
        let valid = true;

        rows.forEach((row, idx) => {
            const pIn = parseFloat(row.querySelector('.stg-p-in').value);
            const pOut = parseFloat(row.querySelector('.stg-p-out').value);
            
            if (pOut <= pIn) {
                alert(`Error at Stage ${idx+1}: Discharge Pressure (${pOut}) must be greater than Inlet Pressure (${pIn}).`);
                valid = false;
            }
        });
        
        // Validate final P_out matches global target?
        // Optional: We can warn user if final stage P_out != Global P_out
        const lastRow = rows[rows.length-1];
        const finalP = parseFloat(lastRow.querySelector('.stg-p-out').value);
        if (Math.abs(finalP - this.pOutGlobal) > 0.1) {
            if(!confirm(`The final stage pressure (${finalP} bar) differs from the main setting (${this.pOutGlobal} bar).\n\nProceed anyway?`)) {
                valid = false;
            }
        }

        return valid;
    }

    /**
     * 收集数据供计算模块使用
     */
    collectData() {
        const rows = this.container.querySelectorAll('.stage-row');
        this.configData = [];
        rows.forEach(row => {
            const isLast = parseInt(row.dataset.index) === this.stages;
            this.configData.push({
                stage: parseInt(row.dataset.index),
                p_in: parseFloat(row.querySelector('.stg-p-in').value),
                p_out: parseFloat(row.querySelector('.stg-p-out').value),
                dp_intercool: isLast ? 0 : (parseFloat(row.querySelector('.stg-dp').value) || 0),
                t_intercool_out: isLast ? null : (parseFloat(row.querySelector('.stg-t-ic').value) || null)
            });
        });
        console.log("[StageConfig] Data collected:", this.configData);
    }

    /**
     * 获取当前配置 (Getter)
     */
    getConfig() {
        return this.configData;
    }
    
    /**
     * 重置配置 (例如在主界面更改了级数)
     */
    reset() {
        this.configData = null;
    }
}

// Export Singleton
export const stageConfigMgr = new StageConfigManager();