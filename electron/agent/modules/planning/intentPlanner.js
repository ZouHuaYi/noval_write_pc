/**
 * Intent Planner - 写作意图规划器
 * 基于记忆和用户需求，生成详细的写作意图
 */

const { safeParseJSON } = require('../../../utils/jsonParser');

class IntentPlanner {
  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词（DeepSeek 优化版）
   */
  buildSystemPrompt() {
    return `你是一个【小说写作规划程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符
6. 如果你无法确定，也必须输出合法 JSON

你必须且只能在 <json> 和 </json> 之间输出内容。

# 核心任务
基于用户需求、小说的世界观、人物设定和剧情状态，制定详细的写作意图，指导后续的文本生成。

# Intent 结构定义
\`\`\`json
{
  "goal": "本次写作的核心目标（50-200字）",
  "narrative_role": ["情节推进", "人物塑造", "氛围营造", ...],
  "tone": "情绪基调和变化（如：紧张 → 爆发 → 平静）",
  "viewpoint": "视角（第一人称/第三人称）",
  "constraints": {
    "forbidden": [
      "禁止的操作（如：引入新人物、违反世界规则）"
    ],
    "required": [
      "必须包含的要素（如：体现代价、保持风格）"
    ]
  },
  "reference_memory": {
    "world_rules": ["相关的世界规则"],
    "characters": ["涉及的角色名称"],
    "plot_context": ["相关的剧情背景"]
  },
  "writing_guidelines": {
    "style": "文风要求",
    "pace": "节奏要求",
    "focus": "重点描写内容"
  }
}
\`\`\`

# 关键规则
1. **遵守世界观**：所有写作意图必须符合世界规则，不可违反设定
2. **尊重人物性格**：确保人物言行符合其性格设定
3. **保持剧情连贯**：基于当前剧情状态制定合理的目标
4. **明确约束**：清晰列出禁止和必需的要素
5. **具体可执行**：目标要具体，可以转化为实际文本

# 输出格式示例
<json>
{
  "goal": "描写主角张明突破筑基期的关键时刻，展现其沉稳性格和修炼体系的严谨性",
  "narrative_role": ["境界突破", "人物成长", "世界观展示"],
  "tone": "紧张 → 专注 → 突破 → 平静",
  "viewpoint": "第三人称近景",
  "constraints": {
    "forbidden": [
      "不可瞬间突破，需要体现过程",
      "不可违反筑基期的境界限制",
      "不可出现不符合世界观的能力"
    ],
    "required": [
      "体现主角沉稳性格",
      "展示修炼体系的细节",
      "保留一定的风险和代价",
      "保持与前文风格一致"
    ]
  },
  "reference_memory": {
    "world_rules": ["修炼体系", "境界限制"],
    "characters": ["张明"],
    "plot_context": ["获得雷种", "积累到临界点"]
  },
  "writing_guidelines": {
    "style": "细腻、写实、不夸张",
    "pace": "前期紧张压迫，突破时爆发，结尾平缓",
    "focus": "内心感悟、身体变化、能量流动"
  }
}
</json>`;
  }

  /**
   * 规划写作意图
   * @param {string} userRequest - 用户需求
   * @param {Object} context - 记忆上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async plan(userRequest, context, llmCaller) {
    try {
      console.log('📝 开始规划写作意图...');

      // 构建用户提示词
      const userPrompt = this.buildUserPrompt(userRequest, context);

      // 调用 LLM 生成 Intent
      const result = await llmCaller({
        systemPrompt: this.systemPrompt,
        userPrompt,
        temperature: 0.3, // 较低温度，保证稳定性
        maxTokens: 2000
      });

      if (!result.success || !result.response) {
        throw new Error('LLM 调用失败: ' + (result.error || '无响应'));
      }

      // 解析 Intent
      const intent = this.parseIntent(result.response);

      // 验证 Intent
      this.validateIntent(intent, context);

      console.log('✅ Intent 规划完成');
      return intent;

    } catch (error) {
      console.error('❌ Intent 规划失败:', error);
      // 返回默认 Intent
      return this.getDefaultIntent(userRequest, context);
    }
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(userRequest, context) {
    let prompt = '';

    // 设定文件（优先显示，特别是前面几章）
    if (context.text_context && context.text_context.settings && context.text_context.settings.length > 0) {
      prompt += `# 基础设定（重要：请严格遵守这些设定）\n`;
      for (const setting of context.text_context.settings) {
        prompt += `\n## ${setting.file}\n`;
        const maxLength = 2000;
        const content = setting.content.length > maxLength 
          ? setting.content.substring(0, maxLength) + '...' 
          : setting.content;
        prompt += `${content}\n`;
      }
      prompt += '\n';
    }

    prompt += `# 用户需求\n${userRequest}\n\n`;

    // 添加世界观信息
    if (context.world_rules) {
      prompt += `# 世界观规则\n`;
      if (context.world_rules.cultivation_system?.levels) {
        prompt += `修炼体系：${context.world_rules.cultivation_system.levels.join(' → ')}\n`;
      }
      if (context.world_rules.cultivation_system?.constraints) {
        prompt += `境界限制：\n${JSON.stringify(context.world_rules.cultivation_system.constraints, null, 2)}\n`;
      }
      if (context.world_rules.magic_system?.elements) {
        prompt += `魔法元素：${context.world_rules.magic_system.elements.join(', ')}\n`;
      }
      prompt += '\n';
    }

    // 添加人物信息
    if (context.characters && context.characters.length > 0) {
      prompt += `# 相关人物\n`;
      for (const char of context.characters.slice(0, 3)) { // 最多3个角色
        prompt += `\n【${char.name}】\n`;
        prompt += `- 角色：${char.role}\n`;
        if (char.personality?.traits) {
          prompt += `- 性格：${char.personality.traits.join('、')}\n`;
        }
        if (char.current_state) {
          prompt += `- 当前状态：${JSON.stringify(char.current_state, null, 2)}\n`;
        }
      }
      prompt += '\n';
    }

    // 添加剧情状态
    if (context.plot_state) {
      prompt += `# 当前剧情状态\n`;
      if (context.plot_state.current_stage) {
        prompt += `阶段：${context.plot_state.current_stage}\n`;
      }
      if (context.plot_state.recent_events) {
        prompt += `最近事件：\n`;
        for (const event of context.plot_state.recent_events.slice(-3)) {
          prompt += `- ${event.name} (第${event.chapter}章)\n`;
        }
      }
      if (context.plot_state.pending_goals) {
        prompt += `待完成目标：\n`;
        for (const goal of context.plot_state.pending_goals.slice(0, 3)) {
          prompt += `- ${goal.name} (优先级: ${goal.priority})\n`;
        }
      }
      prompt += '\n';
    }

    // 添加伏笔信息
    if (context.foreshadows) {
      if (context.foreshadows.pending?.length > 0) {
        prompt += `# 待揭示的伏笔\n`;
        for (const f of context.foreshadows.pending.slice(0, 3)) {
          prompt += `- ${f.title} (重要性: ${f.importance})\n`;
        }
        prompt += '\n';
      }
    }

    prompt += `# 任务\n请基于以上信息，制定详细的写作意图（Intent），确保符合世界观和人物设定，返回纯 JSON 格式。`;

    return prompt;
  }

  /**
   * 解析 Intent
   */
  parseIntent(response) {
    try {
      // 使用 DeepSeek 专用解析器（支持哨兵标记）
      const intent = safeParseJSON(response, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });
      
      console.log('✅ Intent 解析成功');
      return intent;
    } catch (e) {
      console.error('❌ Intent 解析失败:', e.message);
      console.error('原始响应:', response.substring(0, 500));
      throw new Error(`无法解析 Intent JSON: ${e.message}`);
    }
  }

  /**
   * 验证 Intent
   */
  validateIntent(intent, context) {
    // 检查必需字段
    const requiredFields = ['goal', 'narrative_role', 'tone', 'viewpoint', 'constraints'];
    for (const field of requiredFields) {
      if (!intent[field]) {
        throw new Error(`Intent 缺少必需字段: ${field}`);
      }
    }

    // 检查 constraints
    if (!intent.constraints.forbidden || !Array.isArray(intent.constraints.forbidden)) {
      intent.constraints.forbidden = [];
    }
    if (!intent.constraints.required || !Array.isArray(intent.constraints.required)) {
      intent.constraints.required = [];
    }

    // 确保 reference_memory 存在
    if (!intent.reference_memory) {
      intent.reference_memory = {
        world_rules: [],
        characters: [],
        plot_context: []
      };
    }

    console.log('✅ Intent 验证通过');
  }

  /**
   * 获取默认 Intent（当 LLM 失败时）
   */
  getDefaultIntent(userRequest, context) {
    console.log('⚠️ 使用默认 Intent');

    return {
      goal: userRequest,
      narrative_role: ['情节推进'],
      tone: '自然流畅',
      viewpoint: '第三人称',
      constraints: {
        forbidden: [
          '不可违反世界观规则',
          '不可出现人物性格冲突',
          '不可引入未设定的新元素'
        ],
        required: [
          '保持文风一致',
          '符合当前剧情进度',
          '尊重人物性格设定'
        ]
      },
      reference_memory: {
        world_rules: context.world_rules ? Object.keys(context.world_rules) : [],
        characters: context.characters ? context.characters.map(c => c.name) : [],
        plot_context: context.plot_state?.recent_events?.map(e => e.name) || []
      },
      writing_guidelines: {
        style: '保持原有风格',
        pace: '适中',
        focus: '情节推进'
      }
    };
  }

  /**
   * 简化 Intent（用于日志）
   */
  simplifyIntentForLog(intent) {
    return {
      goal: intent.goal?.substring(0, 50) + '...',
      narrative_role: intent.narrative_role,
      constraints_count: {
        forbidden: intent.constraints?.forbidden?.length || 0,
        required: intent.constraints?.required?.length || 0
      }
    };
  }
}

module.exports = IntentPlanner;

