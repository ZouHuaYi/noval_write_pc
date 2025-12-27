/**
 * Rewrite Agent - 约束式重写器
 * 基于错误列表和约束条件，对文本进行精确重写
 */

class RewriteAgent {
  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个专业的小说重写助手，负责修正文本中的错误，同时保持原有风格和内容。

# 核心任务
根据指定的错误列表，对文本进行精确修改，只修正错误部分，其他内容保持不变。

# 重写原则（务必遵守）
1. **最小修改原则**：只修改错误相关的内容，其他部分保持原样
2. **保持风格**：保留原文的写作风格、语言习惯和叙事节奏
3. **保持结论**：不改变情节走向、事件结果和人物最终状态
4. **保持情绪**：维持原文的情感基调和氛围
5. **不引入新设定**：不添加原文没有的设定、人物或情节

# 输出要求
必须返回标准 JSON 格式，不要有任何其他文字。

# 输出结构
\`\`\`json
{
  "text": "重写后的完整文本",
  "changes": [
    {
      "location": "第X段",
      "original": "原文片段（50-200字）",
      "revised": "修改后片段（50-200字）",
      "reason": "修改原因",
      "error_type": "对应的错误类型"
    }
  ],
  "explanation": "总体修改说明（100-200字）"
}
\`\`\`

# 重写策略

## 针对不同错误类型的修改方式

### 1. world_rule / power_level（世界观/能力超限）
- 调整能力描写，使其符合当前境界
- 改"直接使用"为"引导/感应"
- 添加限制和代价描写

### 2. character（人物性格）
- 调整对话语气和用词
- 修改行为描写，符合性格特点
- 增加内心活动，体现性格

### 3. timeline（时间线）
- 调整时间表述
- 修正事件顺序
- 确保前后逻辑一致

### 4. pov（视角）
- 统一人称
- 调整视角描写
- 保持视角连贯

### 5. logic（逻辑矛盾）
- 修正矛盾之处
- 补充必要说明
- 保持因果关系

# 示例

## 输入
原文：张明挥手间，雷光闪烁，瞬间击碎了巨石。他的伤势也随之痊愈。

错误：
1. 筑基期无法直接操控雷元素
2. 伤势不可瞬间痊愈

## 输出
\`\`\`json
{
  "text": "张明运转体内的雷种，感应着天地间游离的雷元素。随着灵力的引导，一道微弱的雷光在掌心凝聚，勉强击中了巨石，留下浅浅的焦痕。剧烈的消耗让他喘息不已，但体内的雷种似乎受到刺激，散发出温和的能量，缓缓修复着他的内伤。",
  "changes": [
    {
      "location": "第3段",
      "original": "张明挥手间，雷光闪烁，瞬间击碎了巨石",
      "revised": "张明运转体内的雷种，感应着天地间游离的雷元素。随着灵力的引导，一道微弱的雷光在掌心凝聚，勉强击中了巨石，留下浅浅的焦痕",
      "reason": "修正能力超限问题，改为符合筑基期的'引导'而非'操控'",
      "error_type": "power_level"
    },
    {
      "location": "第3段",
      "original": "他的伤势也随之痊愈",
      "revised": "剧烈的消耗让他喘息不已，但体内的雷种似乎受到刺激，散发出温和的能量，缓缓修复着他的内伤",
      "reason": "修正伤势瞬间痊愈的不合理设定，改为缓慢恢复过程",
      "error_type": "logic"
    }
  ],
  "explanation": "主要修正了两处问题：一是将'操控雷元素'改为'引导雷元素'，符合筑基期的能力限制；二是将'瞬间痊愈'改为'缓慢恢复'，更加合理。修改后保持了原文的叙事节奏和紧张氛围，同时符合世界观设定。"
}
\`\`\`

# 关键提醒
- 重写后的文本长度应与原文相近（允许 ±30% 的变化）
- 保持段落结构和叙事顺序
- 不要过度修改，只针对错误进行调整
- 如果某个错误不影响整体，可以选择性修改`;
  }

  /**
   * 执行重写
   * @param {string} originalText - 原文
   * @param {Object} intent - 写作意图
   * @param {Array} errors - 错误列表
   * @param {Object} context - 记忆上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async rewrite(originalText, intent, errors, context, llmCaller) {
    try {
      console.log(`🔧 开始重写... (发现 ${errors.length} 个错误)`);

      // 如果没有错误，直接返回原文
      if (!errors || errors.length === 0) {
        return {
          text: originalText,
          changes: [],
          explanation: '未发现需要修正的错误'
        };
      }

      // 构建重写提示词
      const userPrompt = this.buildRewritePrompt(originalText, intent, errors, context);

      // 调用 LLM 重写
      const result = await llmCaller({
        systemPrompt: this.systemPrompt,
        userPrompt,
        temperature: 0.3, // 较低温度，保持原文风格
        maxTokens: 4000
      });

      if (!result.success || !result.response) {
        throw new Error('LLM 调用失败');
      }

      // 解析重写结果
      const rewritten = this.parseRewriteResult(result.response, originalText);

      console.log(`✅ 重写完成 - 修改了 ${rewritten.changes.length} 处`);
      return rewritten;

    } catch (error) {
      console.error('❌ 重写失败:', error);
      
      // 返回原文
      return {
        text: originalText,
        changes: [],
        explanation: '重写失败: ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * 构建重写提示词
   */
  buildRewritePrompt(originalText, intent, errors, context) {
    let prompt = `# 原文\n${originalText}\n\n`;

    // 添加写作意图
    if (intent) {
      prompt += `# 写作意图\n`;
      prompt += `目标：${intent.goal}\n`;
      if (intent.constraints) {
        prompt += `\n必须遵守的约束：\n`;
        for (const c of intent.constraints.required || []) {
          prompt += `- ${c}\n`;
        }
        prompt += `\n禁止的操作：\n`;
        for (const f of intent.constraints.forbidden || []) {
          prompt += `- ${f}\n`;
        }
      }
      prompt += '\n';
    }

    // 添加错误列表
    prompt += `# 需要修正的错误\n`;
    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      prompt += `\n${i + 1}. [${error.severity.toUpperCase()}] ${error.type}\n`;
      prompt += `   位置：${error.location}\n`;
      prompt += `   问题：${error.message}\n`;
      prompt += `   建议：${error.suggestion}\n`;
    }
    prompt += '\n';

    // 添加相关上下文（简化版）
    if (context.world_rules?.cultivation_system) {
      prompt += `# 参考信息\n`;
      prompt += `修炼境界：${context.world_rules.cultivation_system.levels?.join(' → ')}\n`;
      if (context.world_rules.cultivation_system.constraints) {
        prompt += `境界限制：${JSON.stringify(context.world_rules.cultivation_system.constraints, null, 2)}\n`;
      }
      prompt += '\n';
    }

    if (context.characters && context.characters.length > 0) {
      const mainChar = context.characters[0];
      prompt += `主要人物：${mainChar.name}\n`;
      if (mainChar.personality) {
        prompt += `性格：${mainChar.personality.traits?.join('、')}\n`;
      }
      if (mainChar.current_state) {
        prompt += `当前境界：${mainChar.current_state.level}\n`;
      }
      prompt += '\n';
    }

    prompt += `# 任务\n请根据上述错误列表，对原文进行精确重写，只修正错误部分，其他内容保持不变。返回纯 JSON 格式。`;

    return prompt;
  }

  /**
   * 解析重写结果
   */
  parseRewriteResult(response, originalText) {
    let jsonText = response.trim();

    // 提取 JSON
    const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/) || 
                     jsonText.match(/```([\s\S]*?)```/) ||
                     jsonText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    try {
      const result = JSON.parse(jsonText);
      
      // 验证必需字段
      if (!result.text) {
        console.warn('重写结果缺少 text 字段，使用原文');
        result.text = originalText;
      }
      if (!result.changes) result.changes = [];
      if (!result.explanation) result.explanation = '重写完成';

      // 验证文本长度是否合理（不应该相差太大）
      const originalLength = originalText.length;
      const newLength = result.text.length;
      const lengthRatio = newLength / originalLength;

      if (lengthRatio < 0.5 || lengthRatio > 2.0) {
        console.warn(`⚠️ 重写后文本长度异常: ${originalLength} → ${newLength}`);
      }

      return result;

    } catch (e) {
      console.error('解析重写结果失败:', e.message);
      
      // 返回原文
      return {
        text: originalText,
        changes: [],
        explanation: '解析失败，返回原文',
        parse_error: e.message
      };
    }
  }

  /**
   * 生成 Diff（简化版）
   * @param {string} original - 原文
   * @param {string} revised - 修改后文本
   */
  generateDiff(original, revised) {
    // 简单的行对比
    const originalLines = original.split('\n');
    const revisedLines = revised.split('\n');
    const diff = [];

    const maxLen = Math.max(originalLines.length, revisedLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      const oldLine = originalLines[i];
      const newLine = revisedLines[i];

      if (oldLine !== newLine) {
        if (oldLine !== undefined) {
          diff.push({ type: 'remove', line: oldLine });
        }
        if (newLine !== undefined) {
          diff.push({ type: 'add', line: newLine });
        }
      } else if (oldLine !== undefined) {
        diff.push({ type: 'same', line: oldLine });
      }
    }

    return diff;
  }

  /**
   * 生成变更摘要
   */
  generateChangeSummary(result) {
    if (!result.changes || result.changes.length === 0) {
      return '未进行任何修改';
    }

    let summary = `共修改 ${result.changes.length} 处：\n\n`;
    
    for (let i = 0; i < result.changes.length; i++) {
      const change = result.changes[i];
      summary += `${i + 1}. ${change.location}\n`;
      summary += `   原因：${change.reason}\n`;
      summary += `   原文：${this.truncate(change.original, 50)}\n`;
      summary += `   改为：${this.truncate(change.revised, 50)}\n\n`;
    }

    summary += `说明：${result.explanation}`;
    
    return summary;
  }

  /**
   * 截断文本
   */
  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * 验证重写质量
   */
  validateRewrite(original, rewritten, errors) {
    const issues = [];

    // 检查长度变化
    const lengthRatio = rewritten.text.length / original.length;
    if (lengthRatio < 0.3) {
      issues.push('重写后文本过短，可能丢失了重要内容');
    } else if (lengthRatio > 3.0) {
      issues.push('重写后文本过长，可能添加了不必要的内容');
    }

    // 检查是否有变更
    if (rewritten.text === original && errors.length > 0) {
      issues.push('文本未发生变化，但存在需要修正的错误');
    }

    // 检查变更数量
    if (rewritten.changes.length === 0 && errors.length > 0) {
      issues.push('未记录任何变更，但存在错误');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = RewriteAgent;

