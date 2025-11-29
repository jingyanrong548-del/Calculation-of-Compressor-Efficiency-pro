// src/js/ui-validator.js
// 输入验证模块：负责检查用户输入是否合法，并提供视觉反馈

const validators = {
    // 必填项：值不能为空
    isRequired: (value) => {
        return value && value.toString().trim().length > 0;
    },
    // 正数：允许0和正小数
    isPositive: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0;
    },
    // 严格正数：必须大于0
    isStrictlyPositive: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
    },
    // 百分比：0-120之间 (放宽上限以支持部分冷凝锅炉效率 >100%)
    isPercentage: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= 0 && num <= 120;
    }
};

/**
 * 验证单个输入框
 * 根据 HTML 元素的 data-validation 属性执行相应的校验规则
 * @param {HTMLElement} inputElement - 输入框 DOM 元素
 * @returns {boolean} - 验证是否通过
 */
export function validateInput(inputElement) {
    const rule = inputElement.dataset.validation;
    if (!rule || !validators[rule]) return true; // 如果没有定义规则，默认通过

    const value = inputElement.value;
    const isValid = validators[rule](value);

    // 视觉反馈：切换红色边框
    if (!isValid) {
        // 验证失败：添加红色警告样式
        inputElement.classList.add('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
        inputElement.classList.remove('border-gray-300', 'focus:ring-blue-500', 'focus:border-blue-500');
    } else {
        // 验证通过：恢复正常样式
        inputElement.classList.remove('border-red-500', 'focus:ring-red-500', 'focus:border-red-500');
        inputElement.classList.add('border-gray-300', 'focus:ring-blue-500', 'focus:border-blue-500');
    }

    return isValid;
}