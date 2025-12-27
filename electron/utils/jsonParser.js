/**
 * DeepSeek 专用 JSON 解析工具
 * 
 * DeepSeek 模型常见问题：
 * 1. 在 JSON 前后添加解释文字
 * 2. 使用 ```json ``` 包裹
 * 3. 输出半截 JSON
 * 4. 使用中文引号
 * 5. 多余或缺少逗号
 */

/**
 * 安全解析 JSON（支持多种容错策略）
 * @param {string} text - 原始文本
 * @param {object} options - 解析选项
 * @returns {object} 解析后的 JSON 对象
 */
function safeParseJSON(text, options = {}) {
  const {
    useSentinel = true,  // 是否使用哨兵标记
    sentinelStart = '<json>',
    sentinelEnd = '</json>',
    fallbackExtract = true  // 是否尝试提取 JSON
  } = options;

  // 清理文本
  let cleanText = text.trim();

  // 策略 1：尝试使用哨兵标记提取
  if (useSentinel) {
    const sentinelRegex = new RegExp(`${escapeRegex(sentinelStart)}([\\s\\S]*?)${escapeRegex(sentinelEnd)}`);
    const sentinelMatch = cleanText.match(sentinelRegex);
    
    if (sentinelMatch) {
      try {
        const jsonStr = sentinelMatch[1].trim();
        return JSON.parse(jsonStr);
      } catch (err) {
        // 继续尝试其他策略
        console.log('哨兵标记内的 JSON 解析失败，尝试其他策略');
      }
    }
  }

  // 策略 2：直接尝试解析
  try {
    return JSON.parse(cleanText);
  } catch (err) {
    // 继续容错处理
  }

  // 策略 3：移除 Markdown 代码块包裹
  cleanText = cleanText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    // 继续容错处理
  }

  // 策略 4：提取第一个 { 到最后一个 }
  if (fallbackExtract) {
    const start = cleanText.indexOf('{');
    const end = cleanText.lastIndexOf('}');
    
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = cleanText.slice(start, end + 1);
      
      try {
        return JSON.parse(jsonStr);
      } catch (err) {
        // 策略 5：尝试修复常见问题
        try {
          const fixed = fixCommonJSONIssues(jsonStr);
          return JSON.parse(fixed);
        } catch (err2) {
          throw new Error(`JSON 解析失败（已尝试所有修复策略）: ${err2.message}`);
        }
      }
    }
  }

  throw new Error('无法从文本中提取有效的 JSON');
}

/**
 * 修复常见的 JSON 问题
 */
function fixCommonJSONIssues(jsonStr) {
  let fixed = jsonStr;

  // 1. 替换中文引号为英文引号
  fixed = fixed
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'");

  // 2. 移除 JSON 中的注释
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');  // 块注释
  fixed = fixed.replace(/\/\/.*/g, '');  // 行注释

  // 3. 移除行尾多余的逗号（在 } 或 ] 前）
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // 4. 修复缺少的逗号（简单情况）
  // 注意：这个规则可能不完美，但能解决一些常见问题
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');

  // 5. 移除零宽字符
  fixed = fixed.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 6. 统一换行符
  fixed = fixed.replace(/\r\n/g, '\n');

  return fixed;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 验证 JSON 对象是否符合预期结构
 * @param {object} data - JSON 对象
 * @param {object} schema - 期望的结构
 * @returns {boolean} 是否符合
 */
function validateJSONStructure(data, schema) {
  if (!data || typeof data !== 'object') return false;

  for (const [key, type] of Object.entries(schema)) {
    if (type === 'required' && !(key in data)) {
      return false;
    }
    if (key in data && type !== 'required' && typeof data[key] !== type) {
      return false;
    }
  }

  return true;
}

module.exports = {
  safeParseJSON,
  fixCommonJSONIssues,
  validateJSONStructure
};

