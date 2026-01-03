/**
 * DSL Rule Engine - DSL 规则引擎（LLM 驱动版）
 * 支持可执行的规则 DSL，使用 LLM 进行语义判断，无硬编码
 * 
 * 规则类型：
 * - WORLD: 世界观规则（永远强制）
 * - CHARACTER: 人物规则
 * - HISTORY: 历史一致性规则
 * - INTENT: Intent 契约规则
 * - ARC: Arc 推进规则
 * 
 * 规则级别：
 * - FATAL: 致命错误，必须修正
 * - ERROR: 错误，需要修正
 * - WARN: 警告，记录但允许
 */

class DSLRuleEngine {
  constructor(workspaceRoot, llmCaller = null) {
    this.workspaceRoot = workspaceRoot;
    this.llmCaller = llmCaller;
    this.rules = {
      WORLD: [],
      CHARACTER: [],
      HISTORY: [],
      INTENT: [],
      ARC: []
    };
    this.loaded = false;
  }

  /**
   * 设置 LLM 调用器
   */
  setLLMCaller(llmCaller) {
    this.llmCaller = llmCaller;
  }

  /**
   * 加载规则（从 JSON 文件）
   */
  async loadRules(defaultRulesPath, customRulesPath) {
    const fs = require('fs').promises;
    
    try {
      console.log('📋 加载 DSL 规则...');

      // 加载默认规则
      let defaultRules = { rules: [] };
      try {
        const content = await fs.readFile(defaultRulesPath, 'utf-8');
        defaultRules = JSON.parse(content);
      } catch (e) {
        console.warn('⚠️ 默认规则加载失败，使用空规则');
      }

      // 加载自定义规则
      let customRules = { rules: [] };
      try {
        const content = await fs.readFile(customRulesPath, 'utf-8');
        customRules = JSON.parse(content);
      } catch (e) {
        console.log('📝 未找到自定义规则');
      }

      // 合并规则
      const allRules = [
        ...(defaultRules.rules || []),
        ...(customRules.rules || [])
      ];

      // 按类型分类
      this.rules = {
        WORLD: [],
        CHARACTER: [],
        HISTORY: [],
        INTENT: [],
        ARC: []
      };

      for (const rule of allRules) {
        if (rule.enabled === false) continue;
        
        const scope = rule.scope || rule.type?.toUpperCase();
        if (this.rules[scope]) {
          this.rules[scope].push(rule);
        }
      }

      this.loaded = true;
      const total = Object.values(this.rules).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`✅ 已加载 ${total} 条 DSL 规则`);
      console.log(`   - WORLD: ${this.rules.WORLD.length}`);
      console.log(`   - CHARACTER: ${this.rules.CHARACTER.length}`);
      console.log(`   - HISTORY: ${this.rules.HISTORY.length}`);
      console.log(`   - INTENT: ${this.rules.INTENT.length}`);
      console.log(`   - ARC: ${this.rules.ARC.length}`);

      return { success: true, count: total };
    } catch (error) {
      console.error('❌ 加载 DSL 规则失败:', error);
      this.loaded = true;
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行规则检查（Dry Run，不写回记忆）
   * 合并所有规则到一次 LLM 调用中，提高效率
   * @param {Object} params - 检查参数
   * @param {string} params.text - 待检查的文本
   * @param {Object} params.intent - 写作意图
   * @param {Object} params.context - 记忆上下文
   * @param {Object} params.events - 抽取的事件（临时）
   * @param {Object} params.stateTransitions - 状态迁移（临时）
   */
  async checkRules(params) {
    if (!this.loaded) {
      throw new Error('规则引擎未加载');
    }

    if (!this.llmCaller) {
      throw new Error('LLM 调用器未设置');
    }

    const { text, intent, context, events = [], stateTransitions = [] } = params;

    // 收集所有规则
    const allRules = [
      ...this.rules.WORLD.map(r => ({ ...r, scope: 'WORLD' })),
      ...this.rules.CHARACTER.map(r => ({ ...r, scope: 'CHARACTER' })),
      ...this.rules.HISTORY.map(r => ({ ...r, scope: 'HISTORY' })),
      ...this.rules.INTENT.map(r => ({ ...r, scope: 'INTENT' })),
      ...this.rules.ARC.map(r => ({ ...r, scope: 'ARC' }))
    ];

    if (allRules.length === 0) {
      return [];
    }

    // 一次性检查所有规则
    return await this.evaluateAllRules(allRules, text, intent, context, events, stateTransitions);
  }

  /**
   * 一次性评估所有规则（LLM 驱动）
   */
  async evaluateAllRules(allRules, text, intent, context, events, stateTransitions) {
    try {
      const systemPrompt = `你是一个严格的规则检查器。你的任务是检查文本是否违反了给定的所有规则。

# 规则列表

${allRules.map((rule, index) => `
## 规则 ${index + 1}
- 规则ID: ${rule.id}
- 规则名称: ${rule.name || rule.id}
- 规则类型: ${rule.scope}
- 规则级别: ${rule.level || 'FATAL'}
- 规则断言: ${JSON.stringify(rule.assert, null, 2)}
${rule.message ? `- 规则说明: ${rule.message}` : ''}
${rule.suggestion ? `- 建议: ${rule.suggestion}` : ''}
`).join('\n')}

# 上下文信息

## 世界观
${JSON.stringify(context.worldRules || {}, null, 2)}

## 角色信息
${JSON.stringify(context.characters || [], null, 2)}

## 剧情状态
${JSON.stringify(context.plotState || {}, null, 2)}

## 历史记录
${JSON.stringify(context.history || context.previousAnalyses || [], null, 2)}

## 事件列表
${JSON.stringify(events, null, 2)}

## 状态迁移
${JSON.stringify(stateTransitions, null, 2)}

## 写作意图
${JSON.stringify(intent || {}, null, 2)}

# 任务

请仔细分析文本和所有规则，找出所有违规情况。对于每个违规，需要提供：
1. 违反的规则ID
2. 违规原因
3. 违规位置（如段落、句子等）
4. 涉及的角色或实体（如果有）
5. 状态迁移信息（如果有）

特别注意：
- **世界观规则**：检查文本是否违反世界观设定
- **人物规则**：检查角色行为、性格一致性、状态迁移合法性
- **历史一致性规则**：检查事件是否与历史记录矛盾
- **Intent 契约规则**：检查文本是否实现了写作意图，是否违反了意图约束
- **Arc 推进规则**：检查 Arc 阶段是否推进，是否存在水文

# 输出格式（JSON）

{
  "violations": [
    {
      "rule_id": "规则ID",
      "rule_name": "规则名称",
      "type": "违规类型（world_rule/character/history/intent/arc）",
      "level": "违规级别（FATAL/ERROR/WARN）",
      "scope": "规则类型（WORLD/CHARACTER/HISTORY/INTENT/ARC）",
      "message": "违规消息",
      "suggestion": "修正建议",
      "matched_condition": "匹配的条件描述",
      "location": "违规位置（可选）",
      "character": "涉及的角色（可选）",
      "state_transition": "状态迁移信息（可选）",
      "validation_error": "验证错误详情（可选）",
      "contradicting_event": "矛盾的事件（可选）",
      "contradicting_history": "矛盾的历史记录（可选）",
      "unfulfilled_goal": "未实现的目标（可选）",
      "violated_constraint": "违反的约束（可选）",
      "arc_progress": "Arc 推进情况（可选）",
      "is_padding": "是否为水文（可选）"
    }
  ]
}

如果没有违规，返回：
{
  "violations": []
}`;

      const userPrompt = `# 待检查的文本

${text}

请检查这段文本是否违反了上述所有规则。`;

      const result = await this.llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 2000 // 增加 token 限制以支持多个违规情况
      });

      const response = this.parseLLMResponse(result);
      
      if (response && response.violations && Array.isArray(response.violations)) {
        // 确保每个违规都有正确的结构
        return response.violations.map(v => ({
          rule_id: v.rule_id,
          rule_name: v.rule_name || v.rule_id,
          type: v.type || this.getViolationTypeByScope(v.scope),
          level: v.level || 'FATAL',
          scope: v.scope,
          message: v.message || `违反规则: ${v.rule_id}`,
          suggestion: v.suggestion || '请修正违规内容',
          matched_condition: v.matched_condition || '',
          location: v.location,
          character: v.character,
          state_transition: v.state_transition,
          validation_error: v.validation_error,
          contradicting_event: v.contradicting_event,
          contradicting_history: v.contradicting_history,
          unfulfilled_goal: v.unfulfilled_goal,
          violated_constraint: v.violated_constraint,
          arc_progress: v.arc_progress,
          is_padding: v.is_padding
        }));
      }

      return [];
    } catch (error) {
      console.error('评估所有规则失败:', error);
      // 如果合并调用失败，可以回退到逐个检查（可选）
      return await this.evaluateRulesFallback(allRules, text, intent, context, events, stateTransitions);
    }
  }

  /**
   * 根据规则类型获取违规类型
   */
  getViolationTypeByScope(scope) {
    const typeMap = {
      'WORLD': 'world_rule',
      'CHARACTER': 'character',
      'HISTORY': 'history',
      'INTENT': 'intent',
      'ARC': 'arc'
    };
    return typeMap[scope] || 'unknown';
  }

  /**
   * 回退方案：逐个检查规则（当合并调用失败时）
   */
  async evaluateRulesFallback(allRules, text, intent, context, events, stateTransitions) {
    const violations = [];
    
    for (const rule of allRules) {
      try {
        let violation = null;
        
        switch (rule.scope) {
          case 'WORLD':
            violation = await this.evaluateWorldRule(rule, text, context, events);
            break;
          case 'CHARACTER':
            violation = await this.evaluateCharacterRule(rule, text, context, stateTransitions);
            break;
          case 'HISTORY':
            violation = await this.evaluateHistoryRule(rule, events, context);
            break;
          case 'INTENT':
            violation = await this.evaluateIntentRule(rule, text, intent);
            break;
          case 'ARC':
            violation = await this.evaluateArcRule(rule, text, context, events);
            break;
        }
        
        if (violation) {
          violations.push(violation);
        }
      } catch (error) {
        console.error(`评估规则失败: ${rule.id}`, error);
      }
    }
    
    return violations;
  }

  /**
   * 评估世界观规则（LLM 驱动）
   */
  async evaluateWorldRule(rule, text, context, events) {
    try {
      if (!this.llmCaller) return null;

      const systemPrompt = `你是一个严格的世界观规则检查器。你的任务是检查文本是否违反了给定的世界观规则。

# 规则信息
- 规则ID: ${rule.id}
- 规则名称: ${rule.name || rule.id}
- 规则级别: ${rule.level || 'FATAL'}
- 规则断言: ${JSON.stringify(rule.assert, null, 2)}
${rule.message ? `- 规则说明: ${rule.message}` : ''}
${rule.suggestion ? `- 建议: ${rule.suggestion}` : ''}

# 世界观上下文
${JSON.stringify(context.worldRules || {}, null, 2)}

# 事件列表
${JSON.stringify(events, null, 2)}

# 任务
请仔细分析文本和规则，判断是否违反了规则。如果违反，返回详细的违规信息；如果没有违反，返回 null。

# 输出格式（JSON）
{
  "violated": true/false,
  "reason": "违反原因（如果 violated 为 true）",
  "matched_condition": "匹配的条件描述",
  "location": "违规位置（如段落、句子等）"
}`;

      const userPrompt = `# 待检查的文本

${text}

请检查这段文本是否违反了上述世界观规则。`;

      const result = await this.llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 500
      });

      const response = this.parseLLMResponse(result);
      if (response && response.violated) {
        return {
          rule_id: rule.id,
          rule_name: rule.name || rule.id,
          type: 'world_rule',
          level: rule.level || 'FATAL',
          scope: 'WORLD',
          message: rule.message || response.reason || `违反世界观规则: ${rule.id}`,
          suggestion: rule.suggestion || '请修正违反世界观的内容',
          matched_condition: response.matched_condition || JSON.stringify(rule.assert),
          location: response.location
        };
      }

      return null;
    } catch (error) {
      console.error(`评估世界观规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估人物规则（LLM 驱动）
   */
  async evaluateCharacterRule(rule, text, context, stateTransitions) {
    try {
      if (!this.llmCaller) return null;

      const systemPrompt = `你是一个严格的人物规则检查器。你的任务是检查文本中的人物行为、状态迁移是否符合角色设定和规则。

# 规则信息
- 规则ID: ${rule.id}
- 规则名称: ${rule.name || rule.id}
- 规则级别: ${rule.level || 'ERROR'}
- 规则断言: ${JSON.stringify(rule.assert, null, 2)}
${rule.message ? `- 规则说明: ${rule.message}` : ''}
${rule.suggestion ? `- 建议: ${rule.suggestion}` : ''}

# 角色信息
${JSON.stringify(context.characters || [], null, 2)}

# 状态迁移
${JSON.stringify(stateTransitions, null, 2)}

# 任务
请仔细分析文本、角色设定、状态迁移和规则，判断是否违反了规则。特别注意：
1. 角色性格一致性
2. 状态迁移的合法性（如：死亡 -> 活着 需要特殊条件）
3. 角色行为是否符合设定

# 输出格式（JSON）
{
  "violated": true/false,
  "reason": "违反原因（如果 violated 为 true）",
  "character": "涉及的角色名称",
  "matched_condition": "匹配的条件描述",
  "state_transition": "状态迁移信息（如果有）",
  "validation_error": "验证错误详情（如果有）"
}`;

      const userPrompt = `# 待检查的文本

${text}

请检查这段文本中的人物行为、状态迁移是否符合上述规则。`;

      const result = await this.llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 500
      });

      const response = this.parseLLMResponse(result);
      if (response && response.violated) {
        return {
          rule_id: rule.id,
          rule_name: rule.name || rule.id,
          type: 'character',
          level: rule.level || 'ERROR',
          scope: 'CHARACTER',
          message: rule.message || response.reason || `违反人物规则: ${rule.id}`,
          suggestion: rule.suggestion || '请调整文本以符合角色设定',
          matched_condition: response.matched_condition || JSON.stringify(rule.assert),
          character: response.character,
          state_transition: response.state_transition,
          validation_error: response.validation_error
        };
      }

      return null;
    } catch (error) {
      console.error(`评估人物规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估历史一致性规则（LLM 驱动）
   */
  async evaluateHistoryRule(rule, events, context) {
    try {
      if (!this.llmCaller) return null;

      const systemPrompt = `你是一个严格的历史一致性检查器。你的任务是检查事件是否与已有历史记录矛盾。

# 规则信息
- 规则ID: ${rule.id}
- 规则名称: ${rule.name || rule.id}
- 规则级别: ${rule.level || 'FATAL'}
- 规则断言: ${JSON.stringify(rule.assert, null, 2)}
${rule.message ? `- 规则说明: ${rule.message}` : ''}
${rule.suggestion ? `- 建议: ${rule.suggestion}` : ''}

# 历史记录
${JSON.stringify(context.history || context.previousAnalyses || [], null, 2)}

# 任务
请仔细分析新事件与历史记录，判断是否存在矛盾。特别注意：
1. 事件的时间顺序
2. 事件的因果关系
3. 事件的重复或冲突

# 输出格式（JSON）
{
  "violated": true/false,
  "reason": "违反原因（如果 violated 为 true）",
  "contradicting_event": "矛盾的事件信息",
  "contradicting_history": "矛盾的历史记录"
}`;

      const userPrompt = `# 新事件列表

${JSON.stringify(events, null, 2)}

请检查这些事件是否与历史记录矛盾。`;

      const result = await this.llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 500
      });

      const response = this.parseLLMResponse(result);
      if (response && response.violated) {
        return {
          rule_id: rule.id,
          rule_name: rule.name || rule.id,
          type: 'history',
          level: rule.level || 'FATAL',
          scope: 'HISTORY',
          message: rule.message || response.reason || '事件与历史记录矛盾',
          suggestion: rule.suggestion || '请检查事件是否与已有历史冲突',
          matched_condition: response.contradicting_event || 'contradict',
          contradicting_event: response.contradicting_event,
          contradicting_history: response.contradicting_history
        };
      }

      return null;
    } catch (error) {
      console.error(`评估历史规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估 Intent 契约规则（LLM 驱动）
   */
  async evaluateIntentRule(rule, text, intent) {
    try {
      if (!this.llmCaller) return null;
      if (!intent) return null;

      const systemPrompt = `你是一个严格的写作意图契约检查器。你的任务是检查文本是否实现了写作意图，是否违反了意图约束。

# 规则信息
- 规则ID: ${rule.id}
- 规则名称: ${rule.name || rule.id}
- 规则级别: ${rule.level || 'FATAL'}
- 规则断言: ${JSON.stringify(rule.assert, null, 2)}
${rule.message ? `- 规则说明: ${rule.message}` : ''}
${rule.suggestion ? `- 建议: ${rule.suggestion}` : ''}

# 写作意图
${JSON.stringify(intent, null, 2)}

# 任务
请仔细分析文本和写作意图，判断：
1. 文本是否实现了意图中的目标（goal）
2. 文本是否违反了意图中的约束（constraints）
3. 文本是否符合写作指南（writing_guidelines）

# 输出格式（JSON）
{
  "violated": true/false,
  "reason": "违反原因（如果 violated 为 true）",
  "unfulfilled_goal": "未实现的目标（如果有）",
  "violated_constraint": "违反的约束（如果有）"
}`;

      const userPrompt = `# 待检查的文本

${text}

请检查这段文本是否实现了写作意图，是否违反了意图约束。`;

      const result = await this.llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 500
      });

      const response = this.parseLLMResponse(result);
      if (response && response.violated) {
        return {
          rule_id: rule.id,
          rule_name: rule.name || rule.id,
          type: 'intent',
          level: rule.level || 'FATAL',
          scope: 'INTENT',
          message: rule.message || response.reason || `违反意图契约: ${rule.id}`,
          suggestion: rule.suggestion || '请确保文本实现了写作意图',
          matched_condition: response.unfulfilled_goal || response.violated_constraint || 'intent_violation',
          unfulfilled_goal: response.unfulfilled_goal,
          violated_constraint: response.violated_constraint
        };
      }

      return null;
    } catch (error) {
      console.error(`评估 Intent 规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估 Arc 推进规则（LLM 驱动）
   */
  async evaluateArcRule(rule, text, context, events) {
    try {
      if (!this.llmCaller) return null;

      const systemPrompt = `你是一个严格的剧情推进检查器。你的任务是检查文本是否推进了剧情 Arc。

# 规则信息
- 规则ID: ${rule.id}
- 规则名称: ${rule.name || rule.id}
- 规则级别: ${rule.level || 'ERROR'}
- 规则断言: ${JSON.stringify(rule.assert, null, 2)}
${rule.message ? `- 规则说明: ${rule.message}` : ''}
${rule.suggestion ? `- 建议: ${rule.suggestion}` : ''}

# 剧情上下文
${JSON.stringify(context.plotState || {}, null, 2)}

# 任务
请仔细分析文本和事件，判断：
1. Arc 阶段是否发生变化或加强
2. 是否有新的事件或情节推进
3. 是否存在水文（无意义的填充内容）

# 输出格式（JSON）
{
  "violated": true/false,
  "reason": "违反原因（如果 violated 为 true）",
  "arc_progress": "Arc 推进情况",
  "is_padding": "是否为水文（true/false）"
}`;

      const userPrompt = `# 待检查的文本

${text}

# 事件列表

${JSON.stringify(events, null, 2)}

请检查这段文本是否推进了剧情 Arc。`;

      const result = await this.llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 500
      });

      const response = this.parseLLMResponse(result);
      if (response && response.violated) {
        return {
          rule_id: rule.id,
          rule_name: rule.name || rule.id,
          type: 'arc',
          level: rule.level || 'ERROR',
          scope: 'ARC',
          message: rule.message || response.reason || 'Arc 阶段未推进',
          suggestion: rule.suggestion || '请增加情节推进或事件',
          matched_condition: response.arc_progress || 'arc.phase: must_change_or_intensify',
          arc_progress: response.arc_progress,
          is_padding: response.is_padding
        };
      }

      return null;
    } catch (error) {
      console.error(`评估 Arc 规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 验证状态迁移（LLM 驱动）
   */
  async validateStateTransition(transition, context) {
    try {
      if (!this.llmCaller) {
        return { valid: true }; // 如果没有 LLM，默认通过
      }

      const systemPrompt = `你是一个严格的状态迁移验证器。你的任务是验证角色状态迁移是否合法。

# 状态迁移信息
${JSON.stringify(transition, null, 2)}

# 角色信息
${JSON.stringify(context.characters || [], null, 2)}

# 任务
请仔细分析状态迁移，判断：
1. 状态迁移是否合法（如：死亡 -> 活着 需要特殊条件）
2. 状态迁移是否符合角色设定
3. 状态迁移是否需要特殊条件（如：复活法术、时间倒流等）

# 输出格式（JSON）
{
  "valid": true/false,
  "reason": "验证结果说明",
  "suggestion": "建议（如果 valid 为 false）",
  "required_conditions": ["需要的条件列表（如果有）"],
  "valid_options": ["合法的状态迁移选项（如果有）"]
}`;

      const userPrompt = `请验证这个状态迁移是否合法。`;

      const result = await this.llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.1,
        maxTokens: 400
      });

      const response = this.parseLLMResponse(result);
      return response || { valid: true };
    } catch (error) {
      console.error('验证状态迁移失败:', error);
      return { valid: true }; // 出错时默认通过，避免阻塞
    }
  }

  /**
   * 解析 LLM 响应
   */
  parseLLMResponse(result) {
    try {
      let responseText = '';
      
      if (typeof result === 'string') {
        responseText = result;
      } else if (result && result.response) {
        responseText = typeof result.response === 'string' 
          ? result.response 
          : JSON.stringify(result.response);
      } else if (result && result.text) {
        responseText = result.text;
      } else {
        return null;
      }

      // 尝试提取 JSON
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       responseText.match(/(\{[\s\S]*\})/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // 如果无法解析 JSON，尝试从文本中提取信息
      return null;
    } catch (error) {
      console.error('解析 LLM 响应失败:', error);
      return null;
    }
  }

  /**
   * 检查是否有致命错误
   */
  hasFatalError(violations) {
    return violations.some(v => v.level === 'FATAL');
  }

  /**
   * 检查是否有错误
   */
  hasError(violations) {
    return violations.some(v => v.level === 'FATAL' || v.level === 'ERROR');
  }

  /**
   * 获取规则统计
   */
  getStatistics() {
    return {
      total: Object.values(this.rules).reduce((sum, arr) => sum + arr.length, 0),
      by_scope: {
        WORLD: this.rules.WORLD.length,
        CHARACTER: this.rules.CHARACTER.length,
        HISTORY: this.rules.HISTORY.length,
        INTENT: this.rules.INTENT.length,
        ARC: this.rules.ARC.length
      }
    };
  }
}

module.exports = DSLRuleEngine;
