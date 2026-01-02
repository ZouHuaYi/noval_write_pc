/**
 * Memory Updater - 记忆更新器（重构版）
 * 从生成的文本中提取事实，写入 ChapterExtract（临时账本）
 * 不再直接写入长期记忆，而是通过 ChapterFinalizer 结算
 */

const ExtractWriter = require('../../../memory/extractors/extractWriter');

class MemoryUpdater {
  constructor(memoryManager, workspaceRoot) {
    this.memory = memoryManager;
    this.workspaceRoot = workspaceRoot;
    this.extractWriter = new ExtractWriter(workspaceRoot);
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是小说分析 Agent，而不是记忆系统。

# 核心规则
1. **禁止直接写入任何长期记忆**（角色、剧情、伏笔、世界观）
2. **只能输出 ChapterExtract JSON**
3. **不得重复总结已有事实**，只在发现"可能新增信息"时输出
4. **如果只是确认、强化、换说法**，请在 raw_notes 标明
5. **所有概念请用自然语言**，不要尝试生成 ID

# 核心任务
分析文本，区分"事实"和"修辞"，提取需要记录的关键信息。

# 区分标准

## 事实（需要记录）
- 世界规则（物理/超自然）
- 生物学事实
- 人物不可逆事件（死亡/觉醒）
- 地点的客观属性
- 新概念首次出现

## 修辞（无需记录）
- 情绪描写（愤怒、喜悦等临时情绪）
- 环境描写（除非是重要的新地点）
- 对话中的夸张、比喻
- AI 推测、"可能"、"也许"

# 输出要求
必须返回标准 JSON 格式，不要有任何其他文字。

# 输出结构（ChapterExtract）
\`\`\`json
{
  "chapter": 章节号,
  "fact_candidates": [
    {
      "statement": "事实陈述（客观、不可逆）",
      "type": "world_rule" | "biology" | "irreversible_event" | "location",
      "confidence": "observed" | "canonical",
      "evidence": "证据来源",
      "source_refs": ["章节引用"],
      "concept_refs": ["相关概念表面文本"]
    }
  ],
  "concept_mentions": [
    {
      "surface": "概念表面文本（如'地磁异常'）",
      "context": "出现上下文",
      "chapter": 章节号,
      "description": "概念描述（可选）"
    }
  ],
  "foreshadow_candidates": [
    {
      "surface": "伏笔相关概念表面文本",
      "implied_future": "暗示的未来",
      "chapter": 章节号,
      "state_change": "pending" | "confirmed" | "revealed" | "archived"（可选）
    }
  ],
  "story_state_snapshot": {
    "current_location": "当前地点",
    "global_tension": "low" | "medium" | "high" | "critical",
    "known_threats": ["威胁概念表面文本"],
    "open_mysteries": ["未解之谜概念表面文本"]
  },
  "raw_notes": "如果只是确认已有事实，在这里说明"
}
\`\`\`

# 关键规则
1. **保守原则**：不确定的信息不要记录
2. **客观描述**：只记录发生的事实，不要加入推测
3. **去除修辞**：去除夸张、比喻等修辞成分
4. **明确变化**：只记录确实发生变化的信息
5. **章节定位**：如果知道章节号，一定要填写
6. **概念归一**：同一概念的不同表述都要列出，系统会自动归一

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
   * 更新记忆（重构版：写入 ChapterExtract）
   * @param {string} text - 生成的文本
   * @param {Object} request - 用户请求
   * @param {Object} context - 上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async update(text, request, context, llmCaller) {
    try {
      console.log('💾 开始提取章节信息（写入 ChapterExtract）...');
      console.log('📊 步骤 1/2: 提取章节号...');

      // 提取章节号
      const chapterNum = this.extractChapterNumber(request.userRequest || '');
      if (!chapterNum) {
        console.log('⚠️ 未识别章节号，跳过提取');
        return { success: true, updated: false, reason: 'no_chapter_number' };
      }

      console.log(`   章节号: 第${chapterNum}章`);

      // 使用 LLM 提取事实（输出 ChapterExtract 格式）
      console.log('📊 步骤 2/2: 使用 LLM 提取事实...');
      const extract = await this.extractFacts(text, chapterNum, context, llmCaller);

      // 统计提取到的信息
      const factCount = extract.fact_candidates?.length || 0;
      const conceptCount = extract.concept_mentions?.length || 0;
      const foreshadowCount = extract.foreshadow_candidates?.length || 0;
      
      console.log(`   提取到:`);
      console.log(`   - 事实候选: ${factCount} 个`);
      console.log(`   - 概念提及: ${conceptCount} 个`);
      console.log(`   - 伏笔候选: ${foreshadowCount} 个`);

      // 写入 ChapterExtract（临时账本）
      const writeResult = await this.extractWriter.writeExtract(chapterNum, extract);

      if (!writeResult.success) {
        throw new Error(`写入 ChapterExtract 失败: ${writeResult.error}`);
      }

      console.log(`✅ ChapterExtract 已写入: chapter_${chapterNum}.json`);
      console.log(`   ⚠️  注意：需要调用 ChapterFinalizer 结算后才能写入长期记忆`);

      return {
        success: true,
        updated: true,
        extract_written: true,
        chapter: chapterNum,
        summary: {
          fact_candidates: factCount,
          concept_mentions: conceptCount,
          foreshadow_candidates: foreshadowCount
        }
      };

    } catch (error) {
      console.error('❌ 提取失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 使用 LLM 提取事实（输出 ChapterExtract 格式）
   */
  async extractFacts(text, chapterNum, context, llmCaller) {
    try {
      const userPrompt = this.buildExtractPrompt(text, chapterNum, context);

      const result = await llmCaller({
        systemPrompt: this.systemPrompt,
        userPrompt,
        temperature: 0.2, // 低温度，保证准确性
        maxTokens: 4000
      });

      if (!result.success || !result.response) {
        throw new Error('LLM 调用失败');
      }

      return this.parseExtract(result.response, chapterNum);

    } catch (error) {
      console.error('事实提取失败:', error);
      
      // 返回空 extract
      return {
        chapter: chapterNum,
        fact_candidates: [],
        concept_mentions: [],
        foreshadow_candidates: [],
        story_state_snapshot: {},
        raw_notes: `提取失败: ${error.message}`
      };
    }
  }

  /**
   * 构建提取提示词
   */
  buildExtractPrompt(text, chapterNum, context) {
    let prompt = `# 待分析的文本\n${text}\n\n`;

    prompt += `# 章节号\n${chapterNum}\n\n`;

    // 添加当前记忆状态（简化，用于避免重复）
    if (context.characters && context.characters.length > 0) {
      prompt += `# 已知角色（仅供参考，避免重复记录）\n`;
      for (const char of context.characters.slice(0, 3)) {
        prompt += `- ${char.name} (${char.role})\n`;
      }
      prompt += '\n';
    }

    if (context.foreshadows?.pending) {
      prompt += `# 待揭示的伏笔（仅供参考）\n`;
      for (const f of context.foreshadows.pending.slice(0, 3)) {
        prompt += `- ${f.title}\n`;
      }
      prompt += '\n';
    }

    prompt += `# 任务\n请从文本中提取需要记录到记忆系统的关键事实信息，区分"事实"和"修辞"。\n`;
    prompt += `返回 ChapterExtract JSON 格式。如果只是确认已有事实，请在 raw_notes 中说明。`;

    return prompt;
  }

  /**
   * 解析提取结果（ChapterExtract 格式）
   */
  parseExtract(response, chapterNum) {
    let jsonText = response.trim();

    // 提取 JSON
    const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/) || 
                     jsonText.match(/```([\s\S]*?)```/) ||
                     jsonText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    try {
      const extract = JSON.parse(jsonText);
      
      // 验证和填充默认值
      extract.chapter = chapterNum;
      if (!extract.fact_candidates) extract.fact_candidates = [];
      if (!extract.concept_mentions) extract.concept_mentions = [];
      if (!extract.foreshadow_candidates) extract.foreshadow_candidates = [];
      if (!extract.story_state_snapshot) extract.story_state_snapshot = {};
      if (!extract.raw_notes) extract.raw_notes = '';

      return extract;

    } catch (e) {
      console.error('解析 ChapterExtract 失败:', e.message);
      console.error('原始响应:', response.substring(0, 500));
      
      return {
        chapter: chapterNum,
        fact_candidates: [],
        concept_mentions: [],
        foreshadow_candidates: [],
        story_state_snapshot: {},
        raw_notes: `解析失败: ${e.message}`
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
   * 手动写入 ChapterExtract（无需 LLM）
   * @param {number} chapterNum - 章节号
   * @param {Object} extract - ChapterExtract 数据
   */
  async writeExtractManually(chapterNum, extract) {
    try {
      extract.chapter = chapterNum;
      const result = await this.extractWriter.writeExtract(chapterNum, extract);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成提取摘要
   */
  generateExtractSummary(extract) {
    if (!extract) {
      return '无提取';
    }

    let summary = '';

    // 事实候选
    const factCount = extract.fact_candidates?.length || 0;
    if (factCount > 0) {
      summary += `✅ 提取到 ${factCount} 个事实候选\n`;
    }

    // 概念提及
    const conceptCount = extract.concept_mentions?.length || 0;
    if (conceptCount > 0) {
      summary += `✅ 提取到 ${conceptCount} 个概念提及\n`;
    }

    // 伏笔候选
    const foreshadowCount = extract.foreshadow_candidates?.length || 0;
    if (foreshadowCount > 0) {
      summary += `✅ 提取到 ${foreshadowCount} 个伏笔候选\n`;
    }

    if (!summary) {
      summary = 'ℹ️ 未提取到新信息';
    }

    if (extract.raw_notes) {
      summary += `\n说明：${extract.raw_notes}`;
    }

    return summary;
  }
}

module.exports = MemoryUpdater;

