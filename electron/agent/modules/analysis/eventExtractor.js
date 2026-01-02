/**
 * Event Extractor - 事件抽取器
 * 从文本中临时抽取事件和状态迁移，用于规则引擎 Dry Run
 * 不写回记忆，只在校验阶段使用
 */

class EventExtractor {
  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个【小说事件抽取程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符

你必须且只能在 <json> 和 </json> 之间输出内容。

# 核心任务
从文本中抽取所有重要事件和状态迁移，用于一致性校验。

# 输出结构
\`\`\`json
{
  "events": [
    {
      "type": "事件类型（如：BATTLE, DIALOGUE, TRAVEL, TIME_REVERSE, LEVEL_UP, DEATH, REVIVAL 等）",
      "description": "事件描述",
      "characters": ["涉及的角色名称"],
      "location": "发生地点（如果有）",
      "timestamp": "时间戳或相对时间（如果有）"
    }
  ],
  "state_transitions": [
    {
      "type": "character" | "plot" | "world",
      "entity": "实体名称（如角色名）",
      "from": "原状态",
      "to": "新状态",
      "description": "状态变化描述"
    }
  ]
}
\`\`\`
`;

  }

  /**
   * 从文本中抽取事件和状态迁移
   * @param {string} text - 待抽取的文本
   * @param {Object} context - 记忆上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async extract(text, context, llmCaller) {
    try {
      console.log('🔍 开始抽取事件和状态迁移...');

      const userPrompt = this.buildExtractPrompt(text, context);

      const result = await llmCaller({
        systemPrompt: this.systemPrompt,
        userPrompt,
        temperature: 0.2, // 低温度，保证准确性
        maxTokens: 2000
      });

      if (!result.success || !result.response) {
        throw new Error('LLM 调用失败');
      }

      const extracted = this.parseExtractResult(result.response);
      
      console.log(`✅ 抽取完成: ${extracted.events.length} 个事件, ${extracted.state_transitions.length} 个状态迁移`);

      return extracted;
    } catch (error) {
      console.error('❌ 事件抽取失败:', error);
      // 返回空结果，不中断流程
      return {
        events: [],
        state_transitions: []
      };
    }
  }

  /**
   * 构建抽取提示词
   */
  buildExtractPrompt(text, context) {
    let prompt = `# 待抽取的文本\n${text}\n\n`;

    // 添加上下文信息
    if (context.characters && context.characters.length > 0) {
      prompt += `# 已知角色\n`;
      for (const char of context.characters.slice(0, 5)) {
        prompt += `- ${char.name}: ${char.role || '角色'}\n`;
        if (char.current_state?.level) {
          prompt += `  当前境界: ${char.current_state.level}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `# 任务\n请从文本中抽取所有重要事件和状态迁移。\n`;
    prompt += `特别注意：\n`;
    prompt += `1. 角色死亡/复活事件（type: DEATH/REVIVAL）\n`;
    prompt += `2. 时间倒流事件（type: TIME_REVERSE）\n`;
    prompt += `3. 角色状态变化（如：境界提升、受伤、恢复等）\n`;
    prompt += `4. 剧情推进事件（如：战斗、对话、旅行等）\n`;
    prompt += `\n返回纯 JSON 格式。`;

    return prompt;
  }

  /**
   * 解析抽取结果
   */
  parseExtractResult(response) {
    const { safeParseJSON } = require('../../../utils/jsonParser');
    
    try {
      const result = safeParseJSON(response, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });

      // 验证和规范化
      if (!result.events) result.events = [];
      if (!result.state_transitions) result.state_transitions = [];

      // 确保事件格式正确
      result.events = result.events.map(e => ({
        type: e.type || 'UNKNOWN',
        description: e.description || '',
        characters: e.characters || [],
        location: e.location || '',
        timestamp: e.timestamp || ''
      }));

      // 确保状态迁移格式正确
      result.state_transitions = result.state_transitions.map(st => ({
        type: st.type || 'character',
        entity: st.entity || '',
        from: st.from || '',
        to: st.to || '',
        description: st.description || ''
      }));

      return result;
    } catch (e) {
      console.error('❌ 解析抽取结果失败:', e.message);
      return {
        events: [],
        state_transitions: []
      };
    }
  }

  /**
   * 快速抽取（简化版，不调用 LLM）
   * 用于快速检查明显的事件
   */
  quickExtract(text) {
    const events = [];
    const stateTransitions = [];

    // 检测死亡/复活关键词
    const deathKeywords = ['死亡', '死去', '死', '陨落', '殒命'];
    const reviveKeywords = ['复活', '重生', '死而复生', '起死回生'];
    
    for (const keyword of deathKeywords) {
      if (text.includes(keyword)) {
        events.push({
          type: 'DEATH',
          description: `检测到死亡相关描述: ${keyword}`,
          characters: [],
          location: '',
          timestamp: ''
        });
      }
    }

    for (const keyword of reviveKeywords) {
      if (text.includes(keyword)) {
        events.push({
          type: 'REVIVAL',
          description: `检测到复活相关描述: ${keyword}`,
          characters: [],
          location: '',
          timestamp: ''
        });
        
        // 添加状态迁移
        stateTransitions.push({
          type: 'character',
          entity: '未知角色',
          from: 'Dead',
          to: 'Alive',
          description: `检测到复活: ${keyword}`
        });
      }
    }

    // 检测时间倒流
    const timeReverseKeywords = ['时间倒流', '时光倒流', '回到过去', '逆转时间'];
    for (const keyword of timeReverseKeywords) {
      if (text.includes(keyword)) {
        events.push({
          type: 'TIME_REVERSE',
          description: `检测到时间倒流: ${keyword}`,
          characters: [],
          location: '',
          timestamp: ''
        });
      }
    }

    return {
      events,
      state_transitions: stateTransitions
    };
  }
}

module.exports = EventExtractor;

