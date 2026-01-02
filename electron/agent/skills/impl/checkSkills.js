/**
 * Check Skills - 检查相关 Skills
 * 一致性守门员
 */

class CheckSkills {
  constructor(workspaceRoot, dependencies = {}) {
    this.workspaceRoot = workspaceRoot;
    this.memory = dependencies.memory;
    this.consistencyChecker = dependencies.consistencyChecker;
    this.llmCaller = dependencies.llmCaller;
    this.dependencies = dependencies; // 保存完整依赖
  }

  /**
   * check_character_consistency - 检查角色一致性
   */
  async checkCharacterConsistency(input, options = {}) {
    const { content, characters = [], context = {} } = input;
    
    if (!content) {
      throw new Error('Content is required for consistency check');
    }

    // 如果没有提供角色列表，从记忆系统获取
    const characterList = characters.length > 0 
      ? characters 
      : (this.memory?.character?.getMainCharacters() || []);

    if (characterList.length === 0) {
      return {
        violations: []
      };
    }

    // 构建检查上下文
    const checkContext = {
      world_rules: context.worldRules || this.memory?.world?.getRules() || {},
      characters: characterList,
      plot_context: context.plotState || {},
      text_context: context.text_context || {}
    };

    // 构建检查意图
    const intent = {
      goal: '检查角色一致性',
      constraints: {}
    };

    const llmCaller = options.llmCaller || this.llmCaller;
    
    // 使用一致性检查器
    if (this.consistencyChecker) {
      const checkResult = await this.consistencyChecker.check(
        content,
        intent,
        checkContext,
        llmCaller
      );

      // 筛选出角色相关的问题
      const characterViolations = (checkResult.errors || [])
        .filter(error => 
          error.type === 'character' || 
          error.message?.includes('角色') ||
          error.message?.includes('人物')
        )
        .map(error => ({
          character: this.extractCharacterName(error.message, characterList),
          issue: error.message,
          severity: error.severity || 'medium',
          location: error.location || '文本中',
          suggestion: error.suggestion || ''
        }));

      return {
        violations: characterViolations
      };
    } else {
      // 如果没有一致性检查器，使用简单的 LLM 检查
      return await this.simpleCharacterCheck(content, characterList, llmCaller);
    }
  }

  /**
   * check_world_rule_violation - 检查世界观规则违反
   */
  async checkWorldRuleViolation(input, options = {}) {
    const { content, worldRules = {}, context = {} } = input;
    
    if (!content) {
      throw new Error('Content is required for world rule check');
    }

    // 如果没有提供世界观规则，从记忆系统获取
    const rules = Object.keys(worldRules).length > 0
      ? worldRules
      : (this.memory?.world?.getRules() || {});

    // 构建检查上下文
    const checkContext = {
      world_rules: rules,
      characters: context.characters || this.memory?.character?.getMainCharacters() || [],
      plot_context: context.plotState || {},
      text_context: context.text_context || {}
    };

    // 构建检查意图
    const intent = {
      goal: '检查世界观规则违反',
      constraints: {}
    };

    const llmCaller = options.llmCaller || this.llmCaller;
    
    // 使用一致性检查器
    if (this.consistencyChecker) {
      const checkResult = await this.consistencyChecker.check(
        content,
        intent,
        checkContext,
        llmCaller
      );

      // 筛选出世界观相关的问题
      const worldViolations = (checkResult.errors || [])
        .filter(error => 
          error.type === 'world_rule' || 
          error.type === 'power_level' ||
          error.message?.includes('世界观') ||
          error.message?.includes('规则') ||
          error.message?.includes('境界')
        )
        .map(error => error.message);

      return {
        violations: worldViolations
      };
    } else {
      // 如果没有一致性检查器，使用简单的 LLM 检查
      return await this.simpleWorldCheck(content, rules, llmCaller);
    }
  }

  /**
   * 从错误消息中提取角色名
   */
  extractCharacterName(message, characters) {
    for (const char of characters) {
      if (message.includes(char.name)) {
        return char.name;
      }
    }
    return '未知角色';
  }

  /**
   * 简单的角色检查（备用方案）
   */
  async simpleCharacterCheck(content, characters, llmCaller) {
    if (!llmCaller) {
      return { violations: [] };
    }

    const systemPrompt = `你是一个角色一致性检查器。检查文本中角色行为是否符合设定。

输出 JSON 格式：
{
  "violations": [
    {
      "character": "角色名",
      "issue": "问题描述",
      "severity": "medium"
    }
  ]
}`;

    const userPrompt = `角色设定：
${JSON.stringify(characters.slice(0, 5), null, 2)}

待检查文本：
${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

请检查角色行为是否一致。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        maxTokens: 1000
      });

      const parsed = typeof result === 'string' 
        ? JSON.parse(result) 
        : (result.response ? JSON.parse(result.response) : result);

      return {
        violations: parsed.violations || []
      };
    } catch (error) {
      console.error('角色检查失败:', error);
      return { violations: [] };
    }
  }

  /**
   * 简单的世界观检查（备用方案）
   */
  async simpleWorldCheck(content, rules, llmCaller) {
    if (!llmCaller) {
      return { violations: [] };
    }

    const systemPrompt = `你是一个世界观规则检查器。检查文本是否违反世界观规则。

输出 JSON 格式：
{
  "violations": ["违反规则1", "违反规则2"]
}`;

    const userPrompt = `世界观规则：
${JSON.stringify(rules, null, 2)}

待检查文本：
${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

请检查是否违反世界观规则。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        maxTokens: 1000
      });

      const parsed = typeof result === 'string' 
        ? JSON.parse(result) 
        : (result.response ? JSON.parse(result.response) : result);

      return {
        violations: parsed.violations || []
      };
    } catch (error) {
      console.error('世界观检查失败:', error);
      return { violations: [] };
    }
  }

  /**
   * check_coherence - 检查连贯性
   */
  async checkCoherence(input, options = {}) {
    const { content, previousAnalyses = [], chapterPlan = null } = input;
    
    if (!content) {
      throw new Error('Content is required for coherence check');
    }

    const coherenceChecker = this.dependencies?.coherenceChecker;
    const llmCaller = options.llmCaller || this.llmCaller;

    if (!coherenceChecker) {
      throw new Error('Coherence checker not available');
    }

    try {
      const result = await coherenceChecker.checkCoherence(
        content,
        previousAnalyses,
        chapterPlan,
        llmCaller
      );

      return {
        overall_coherence: result.overall_coherence || 'fair',
        overall_score: result.overall_score || 70,
        plot_coherence: result.plot_coherence || { issues: [] },
        emotion_coherence: result.emotion_coherence || { issues: [] },
        success: result.success !== false
      };
    } catch (error) {
      console.error('连贯性检查失败:', error);
      return {
        overall_coherence: 'fair',
        overall_score: 70,
        plot_coherence: { issues: [] },
        emotion_coherence: { issues: [] },
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CheckSkills;

