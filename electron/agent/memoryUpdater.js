/**
 * Memory Updater - 记忆更新器
 * 从生成的文本中提取事实，更新各层记忆
 */

class MemoryUpdater {
  constructor(memoryManager) {
    this.memory = memoryManager;
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个专业的小说事实提取助手，负责从文本中提取需要记录到记忆系统的关键信息。

# 核心任务
分析文本，区分"事实"和"修辞"，提取需要记录的关键信息。

# 区分标准

## 事实（需要记录）
- 角色状态变化（境界突破、受伤、获得物品）
- 角色关系变化（结盟、决裂、新认识）
- 剧情进展（完成任务、新目标、重大事件）
- 新伏笔埋下或旧伏笔揭示
- 世界规则补充（新的修炼方法、新地点）

## 修辞（无需记录）
- 情绪描写（愤怒、喜悦等临时情绪）
- 环境描写（除非是重要的新地点）
- 对话中的夸张、比喻
- 战斗过程（除非有永久性结果）

# 输出要求
必须返回标准 JSON 格式，不要有任何其他文字。

# 输出结构
\`\`\`json
{
  "has_updates": true | false,
  "character_updates": {
    "角色名": {
      "level": "新境界（如果有变化）",
      "location": "新位置（如果有变化）",
      "injuries": ["新增伤势"],
      "possessions": ["新获得的物品"],
      "skills": ["新掌握的技能"]
    }
  },
  "character_history": {
    "角色名": {
      "chapter": 章节号,
      "event": "事件描述",
      "significance": "minor" | "normal" | "major" | "critical"
    }
  },
  "plot_updates": {
    "completed_events": [
      {
        "name": "事件名称",
        "chapter": 章节号,
        "description": "事件描述",
        "significance": "minor" | "normal" | "major" | "critical"
      }
    ],
    "timeline_events": [
      {
        "chapter": 章节号,
        "time": "时间描述",
        "event": "事件",
        "description": "详情"
      }
    ],
    "current_stage": "当前阶段名（如果有变化）"
  },
  "new_foreshadows": [
    {
      "title": "伏笔标题",
      "content": "伏笔内容",
      "importance": "minor" | "normal" | "major" | "critical",
      "introduced_at": {
        "chapter": 章节号,
        "paragraph": "段落描述"
      }
    }
  ],
  "foreshadow_updates": [
    {
      "id": "伏笔ID（如果知道）",
      "title": "伏笔标题",
      "action": "reveal" | "resolve",
      "details": {
        "chapter": 章节号,
        "content": "揭示/解决的内容"
      }
    }
  ],
  "world_rules": {
    "cultivation_system": "如果有新的修炼体系信息",
    "magic_system": "如果有新的魔法系统信息"
  },
  "explanation": "提取说明（100-200字）"
}
\`\`\`

# 关键规则
1. **保守原则**：不确定的信息不要记录
2. **客观描述**：只记录发生的事实，不要加入推测
3. **去除修辞**：去除夸张、比喻等修辞成分
4. **明确变化**：只记录确实发生变化的信息
5. **章节定位**：如果知道章节号，一定要填写

# 示例

## 输入文本
张明盘膝而坐，运转体内的灵力。雷种在丹田中缓缓融合，一股澎湃的力量涌入四肢百骸。终于，他睁开双眼，筑基成功！从今日起，他踏入了修仙的新境界。

远处的山峰上，一道人影默默注视着他，眼中闪过一丝复杂的神色。

## 输出
\`\`\`json
{
  "has_updates": true,
  "character_updates": {
    "张明": {
      "level": "筑基初期",
      "location": null,
      "injuries": [],
      "possessions": [],
      "skills": []
    }
  },
  "character_history": {
    "张明": {
      "chapter": 10,
      "event": "成功突破筑基期",
      "significance": "major"
    }
  },
  "plot_updates": {
    "completed_events": [
      {
        "name": "主角突破筑基",
        "chapter": 10,
        "description": "张明成功将雷种融合，突破到筑基初期",
        "significance": "major"
      }
    ],
    "timeline_events": [],
    "current_stage": null
  },
  "new_foreshadows": [
    {
      "title": "神秘人物注视",
      "content": "远处山峰上有人影在注视主角突破，眼中神色复杂",
      "importance": "normal",
      "introduced_at": {
        "chapter": 10,
        "paragraph": "突破完成后"
      }
    }
  ],
  "foreshadow_updates": [],
  "world_rules": {},
  "explanation": "主要记录了主角张明突破筑基的重要事件，这是角色成长的关键节点。同时发现一个新伏笔：有神秘人物在暗中观察，这可能在后续剧情中展开。"
}
\`\`\``;
  }

  /**
   * 更新记忆
   * @param {string} text - 生成的文本
   * @param {Object} request - 用户请求
   * @param {Object} context - 上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async update(text, request, context, llmCaller) {
    try {
      console.log('💾 开始更新记忆...');

      // 提取章节号
      const chapterNum = this.extractChapterNumber(request.userRequest || '');

      // 使用 LLM 提取事实
      const facts = await this.extractFacts(text, chapterNum, context, llmCaller);

      if (!facts.has_updates) {
        console.log('ℹ️ 无需更新记忆');
        return { success: true, updated: false };
      }

      // 应用更新
      const result = await this.memory.updateFromText(facts);

      console.log('✅ 记忆更新完成');
      return {
        success: true,
        updated: true,
        result,
        facts
      };

    } catch (error) {
      console.error('❌ 记忆更新失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 使用 LLM 提取事实
   */
  async extractFacts(text, chapterNum, context, llmCaller) {
    try {
      const userPrompt = this.buildExtractPrompt(text, chapterNum, context);

      const result = await llmCaller({
        systemPrompt: this.systemPrompt,
        userPrompt,
        temperature: 0.2, // 低温度，保证准确性
        maxTokens: 3000
      });

      if (!result.success || !result.response) {
        throw new Error('LLM 调用失败');
      }

      return this.parseFacts(result.response);

    } catch (error) {
      console.error('事实提取失败:', error);
      
      // 返回空更新
      return {
        has_updates: false,
        character_updates: {},
        character_history: {},
        plot_updates: {},
        new_foreshadows: [],
        foreshadow_updates: [],
        world_rules: {},
        explanation: '提取失败: ' + error.message
      };
    }
  }

  /**
   * 构建提取提示词
   */
  buildExtractPrompt(text, chapterNum, context) {
    let prompt = `# 待分析的文本\n${text}\n\n`;

    if (chapterNum) {
      prompt += `# 章节号\n${chapterNum}\n\n`;
    }

    // 添加当前记忆状态（简化）
    if (context.characters && context.characters.length > 0) {
      prompt += `# 已知角色\n`;
      for (const char of context.characters.slice(0, 3)) {
        prompt += `- ${char.name} (${char.role})\n`;
      }
      prompt += '\n';
    }

    if (context.foreshadows?.pending) {
      prompt += `# 待揭示的伏笔\n`;
      for (const f of context.foreshadows.pending.slice(0, 3)) {
        prompt += `- ID: ${f.id}, 标题: ${f.title}\n`;
      }
      prompt += '\n';
    }

    prompt += `# 任务\n请从文本中提取需要记录到记忆系统的关键事实信息，区分"事实"和"修辞"。返回纯 JSON 格式。`;

    return prompt;
  }

  /**
   * 解析提取结果
   */
  parseFacts(response) {
    let jsonText = response.trim();

    // 提取 JSON
    const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/) || 
                     jsonText.match(/```([\s\S]*?)```/) ||
                     jsonText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    try {
      const facts = JSON.parse(jsonText);
      
      // 验证和填充默认值
      if (facts.has_updates === undefined) facts.has_updates = false;
      if (!facts.character_updates) facts.character_updates = {};
      if (!facts.character_history) facts.character_history = {};
      if (!facts.plot_updates) facts.plot_updates = {};
      if (!facts.new_foreshadows) facts.new_foreshadows = [];
      if (!facts.foreshadow_updates) facts.foreshadow_updates = [];
      if (!facts.world_rules) facts.world_rules = {};
      if (!facts.explanation) facts.explanation = '提取完成';

      return facts;

    } catch (e) {
      console.error('解析事实提取结果失败:', e.message);
      
      return {
        has_updates: false,
        character_updates: {},
        character_history: {},
        plot_updates: {},
        new_foreshadows: [],
        foreshadow_updates: [],
        world_rules: {},
        explanation: '解析失败',
        parse_error: e.message
      };
    }
  }

  /**
   * 从请求中提取章节号
   */
  extractChapterNumber(request) {
    // 匹配 "第X章"、"第X回"、"Chapter X" 等
    const patterns = [
      /第(\d+)章/,
      /第(\d+)回/,
      /Chapter\s*(\d+)/i,
      /chapter\s*(\d+)/i,
      /(\d+)章/
    ];

    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return null;
  }

  /**
   * 手动更新角色状态（无需 LLM）
   */
  async updateCharacterState(charName, updates) {
    try {
      await this.memory.character.updateCharacterState(charName, updates);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 手动添加剧情事件（无需 LLM）
   */
  async addPlotEvent(event) {
    try {
      await this.memory.plot.addCompletedEvent(event);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 手动添加伏笔（无需 LLM）
   */
  async addForeshadow(foreshadow) {
    try {
      const id = await this.memory.foreshadow.addForeshadow(foreshadow);
      return { success: true, id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成更新摘要
   */
  generateUpdateSummary(updateResult) {
    if (!updateResult.facts) {
      return '无更新';
    }

    const facts = updateResult.facts;
    let summary = '';

    // 角色更新
    const charUpdateCount = Object.keys(facts.character_updates).length;
    if (charUpdateCount > 0) {
      summary += `✅ 更新了 ${charUpdateCount} 个角色的状态\n`;
    }

    // 剧情事件
    const eventCount = facts.plot_updates?.completed_events?.length || 0;
    if (eventCount > 0) {
      summary += `✅ 记录了 ${eventCount} 个剧情事件\n`;
    }

    // 新伏笔
    const foreshadowCount = facts.new_foreshadows?.length || 0;
    if (foreshadowCount > 0) {
      summary += `✅ 添加了 ${foreshadowCount} 个新伏笔\n`;
    }

    // 伏笔更新
    const foreshadowUpdateCount = facts.foreshadow_updates?.length || 0;
    if (foreshadowUpdateCount > 0) {
      summary += `✅ 更新了 ${foreshadowUpdateCount} 个伏笔状态\n`;
    }

    if (!summary) {
      summary = 'ℹ️ 无需更新记忆';
    }

    return summary + `\n说明：${facts.explanation}`;
  }

  /**
   * 验证更新结果
   */
  validateUpdate(facts) {
    const issues = [];

    // 检查角色名是否存在
    for (const charName of Object.keys(facts.character_updates)) {
      const char = this.memory.character.getCharacter(charName);
      if (!char) {
        issues.push(`角色不存在: ${charName}`);
      }
    }

    // 检查章节号是否合理
    for (const event of facts.plot_updates?.completed_events || []) {
      if (event.chapter && (event.chapter < 1 || event.chapter > 1000)) {
        issues.push(`章节号不合理: ${event.chapter}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = MemoryUpdater;

