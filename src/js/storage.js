// =====================================================================
// storage.js: 工况管理与本地存储模块
// 版本: v1.0 (For v8.34 Case Management)
// =====================================================================

export class CaseStorage {
    static STORAGE_KEY = 'cp_pro_saved_cases_v1';

    /**
     * 获取所有保存的工况列表
     * @returns {Array} [{id, name, date, mode, summary}, ...]
     */
    static listCases() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error("Storage Read Error:", e);
            return [];
        }
    }

    /**
     * 保存当前工况
     * @param {string} name - 用户输入的工况名称
     * @param {string} modeId - 当前模式 (e.g., 'm1', 'm2', 'm3')
     * @param {Object} formDataObj - 表单键值对对象
     * @param {string} summaryText - 简要描述 (如 "3000RPM / 100kW")
     */
    static saveCase(name, modeId, formDataObj, summaryText = "") {
        const cases = this.listCases();
        
        const newCase = {
            id: Date.now().toString(), // 使用时间戳作为唯一ID
            name: name || `Case ${new Date().toLocaleTimeString()}`,
            date: new Date().toLocaleString(),
            mode: modeId,
            summary: summaryText,
            data: formDataObj
        };

        // 新增的排在最前面
        cases.unshift(newCase);
        
        // 限制保存数量，例如最多50条，防止 localStorage 溢出
        if (cases.length > 50) {
            cases.pop();
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cases));
        console.log(`[Storage] Case saved: ${newCase.name}`);
        return newCase;
    }

    /**
     * 删除指定工况
     * @param {string} id 
     */
    static deleteCase(id) {
        let cases = this.listCases();
        const initialLen = cases.length;
        cases = cases.filter(c => c.id !== id);
        
        if (cases.length !== initialLen) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cases));
            console.log(`[Storage] Case deleted: ${id}`);
            return true;
        }
        return false;
    }

    /**
     * 获取单个工况详情
     * @param {string} id 
     */
    static getCase(id) {
        const cases = this.listCases();
        return cases.find(c => c.id === id) || null;
    }

    /**
     * 导出所有数据为 JSON 字符串 (用于备份)
     */
    static exportJson() {
        return localStorage.getItem(this.STORAGE_KEY);
    }

    /**
     * 从 JSON 字符串导入数据 (覆盖或合并)
     * @param {string} jsonStr 
     */
    static importJson(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (Array.isArray(data)) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
                return true;
            }
        } catch (e) {
            console.error("Import Error:", e);
        }
        return false;
    }
}