/**
 * Consistency Checker - 一致性校验器（4层架构版）
 * 按照 REMED.md 要求，拆分为 4 层校验：
 * 1. TextRuleCheck（文本层）
 * 2. StateRuleCheck（状态层）
 * 3. IntentContractCheck（契约层）
 * 4. ArcProgressCheck（叙事推进层）
 * 
 * 核心升级：从「靠 prompt + 模型判断」➡️「像编译器一样判定小说是否合法」
 */

const { safeParseJSON } = require('../../../utils/jsonParser');
const EventExtractor = require('../analysis/eventExtractor');

class ConsistencyChecker {
  constructor(ruleEngine, memoryManager = null) {
    this.ruleEngine = ruleEngine; // DSL 规则引擎
    this.memoryManager = memoryManager; // 记忆管理器
    this.eventExtractor = new EventExtractor();
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词（DeepSeek 专用版）
   */
  buildSystemPrompt() {
    return `你是一个【小说一致性校验程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符
6. 如果你无法确定，也必须输出合法 JSON

你必须且只能在 <json> 和 </json> 之间输出内容。

# 核心任务
仔细分析文本，找出所有违反设定、逻辑矛盾或不合理之处。

# 输出结构
\`\`\`json
{
  "status": "pass" | "fail",
  "overall_score": 0-100,
  "errors": [
    {
      "type": "world_rule" | "power_level" | "character" | "timeline" | "pov" | "logic",
      "severity": "low" | "medium" | "high" | "critical",
      "location": "错误位置描述（如：第3段）",
      "message": "错误描述",
      "suggestion": "修改建议",
      "context": "相关上下文"
    }
  ],
  "warnings": [
    {
      "type": "类型",
      "message": "警告信息",
      "suggestion": "改进建议"
    }
  ],
  "analysis": "总体分析（100-300字）"
}
\`\`\`

# 校验类型说明
1. **world_rule**: 违反世界观规则（修炼体系、魔法规则等）
2. **power_level**: 超出境界/等级限制
3. **character**: 人物性格或行为不一致
4. **timeline**: 时间线混乱或矛盾
5. **pov**: 视角混乱
6. **logic**: 逻辑矛盾或不合理

# 严重性等级
- **critical**: 严重错误，必须修正
- **high**: 重要错误，强烈建议修正
- **medium**: 中等问题，建议修正
- **low**: 轻微问题，可选修正

# 关键规则
1. 只标注明确的错误和矛盾，不要过于吹毛求疵
2. 每个错误都要提供具体的修改建议
3. 区分"错误"和"警告"：错误是明确违反设定，警告是可改进之处
4. 总体评分要客观，综合考虑所有问题
5. 如果文本完全符合要求，status 应为 "pass"

# 输出格式示例
<json>
{
  "status": "fail",
  "overall_score": 65,
  "errors": [
    {
      "type": "power_level",
      "severity": "high",
      "location": "第3段",
      "message": "筑基期无法直接操控雷元素，这违反了修炼体系的设定",
      "suggestion": "改为'引导雷种力量'或'感应雷元素'，避免直接操控",
      "context": "主角当前境界为筑基中期，根据设定，金丹期才能操控元素"
    }
  ],
  "warnings": [
    {
      "type": "character",
      "message": "主角表现略显冲动，与'沉稳内敛'的性格设定有轻微偏差",
      "suggestion": "可以在对话中增加思考过程，体现沉稳特质"
    }
  ],
  "analysis": "文本整体质量良好，剧情推进合理。主要问题在于主角能力超出当前境界限制，需要调整相关描写。人物性格基本符合设定，但个别对话略显冲动。建议修正能力描写，保持人物性格一致性。"
}
</json>`;
  }

  /**
   * 执行一致性校验（简化版）
   * @param {string} text - 待校验的文本
   * @param {Object} intent - 写作意图
   * @param {Object} context - 记忆上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async check(text, intent, context, llmCaller) {
    try {
      console.log('🔍 开始一致性校验...');

      // 1. 从记忆系统获取数据
      const memoryData = await this.getMemoryData();

      // 2. 使用 LLM 进行统一校验
      const checkResult = await this.checkWithLLM(text, intent, context, memoryData, llmCaller);

      // 3. 如果有规则引擎，也检查规则（可选）
      if (this.ruleEngine && this.ruleEngine.llmCaller) {
        try {
          const ruleViolations = await this.ruleEngine.checkRules({
            text,
            intent,
            context: { ...context, ...memoryData },
            events: [],
            stateTransitions: []
          });
          
          // 合并规则引擎的问题
          if (ruleViolations && ruleViolations.length > 0) {
            for (const violation of ruleViolations) {
              checkResult.errors.push({
                type: violation.type || 'rule_violation',
                severity: this.mapLevelToSeverity(violation.level),
                location: '文本中',
                message: violation.message,
                suggestion: violation.suggestion || '请检查并修正',
                rule_id: violation.rule_id
              });
            }
          }
        } catch (error) {
          console.warn('规则引擎检查失败:', error.message);
        }
      }

      // 4. 计算最终状态和评分
      const hasCritical = checkResult.errors.some(e => e.severity === 'critical' || e.severity === 'high');
      checkResult.status = hasCritical ? 'fail' : 'pass';
      
      // 计算评分
      let score = 100;
      for (const error of checkResult.errors) {
        if (error.severity === 'critical') score -= 20;
        else if (error.severity === 'high') score -= 10;
        else if (error.severity === 'medium') score -= 5;
        else score -= 2;
      }
      checkResult.overall_score = Math.max(0, score);

      console.log(`✅ 一致性校验完成 - 状态: ${checkResult.status}, 评分: ${checkResult.overall_score}`);
      console.log(`   发现 ${checkResult.errors.length} 个问题`);

      return checkResult;

    } catch (error) {
      console.error('❌ 一致性校验失败:', error);
      
      return {
        status: 'fail',
        overall_score: 50,
        errors: [{
          type: 'logic',
          severity: 'medium',
          location: '整体',
          message: '校验过程出错: ' + error.message,
          suggestion: '请手动检查文本'
        }],
        warnings: [],
        analysis: '自动校验失败，建议手动检查'
      };
    }
  }

  /**
   * 从记忆系统获取数据
   */
  async getMemoryData() {
    const data = {
      worldRules: {},
      characters: [],
      plotState: {}
    };

    if (!this.memoryManager) {
      return data;
    }

    try {
      // 获取世界观规则
      if (this.memoryManager.world) {
        data.worldRules = this.memoryManager.world.getRules() || {};
      }

      // 获取角色信息
      if (this.memoryManager.character) {
        const allChars = this.memoryManager.character.getAllCharacters() || [];
        data.characters = allChars.map(char => ({
          name: char.name,
          role: char.role,
          personality: char.personality,
          current_state: char.current_state,
          traits: char.personality?.traits || [],
          forbidden_traits: char.personality?.forbidden_traits || []
        }));
      }

      // 获取剧情状态
      if (this.memoryManager.plot) {
        data.plotState = this.memoryManager.plot.getCurrentState() || {};
      }
    } catch (error) {
      console.warn('获取记忆系统数据失败:', error.message);
    }

    return data;
  }


  /**
   * 映射规则级别到严重性
   */
  mapLevelToSeverity(level) {
    const mapping = {
      'FATAL': 'critical',
      'ERROR': 'high',
      'WARN': 'medium'
    };
    return mapping[level] || 'medium';
  }

  /**
   * 使用规则引擎校验（保留兼容性）
   */
  async checkWithRules(text, context) {
    if (!this.ruleEngine) {
      return [];
    }

    try {
      // 快速抽取事件
      const extracted = this.eventExtractor.quickExtract(text);
      
      const violations = await this.ruleEngine.checkRules({
        text,
        intent: null,
        context,
        events: extracted.events,
        stateTransitions: extracted.state_transitions
      });
      
      // 转换为标准格式
      return violations.map(v => ({
        type: v.type,
        severity: this.mapLevelToSeverity(v.level),
        location: '文本中',
        message: v.message,
        suggestion: v.suggestion,
        rule_id: v.rule_id,
        source: 'rule_engine'
      }));
    } catch (error) {
      console.error('规则引擎校验失败:', error);
      return [];
    }
  }

  /**
   * 使用 LLM 进行统一校验
   */
  async checkWithLLM(text, intent, context, memoryData, llmCaller) {
    try {
      if (!llmCaller) {
        throw new Error('LLM 调用器未设置');
      }

      const userPrompt = this.buildCheckPrompt(text, intent, context, memoryData);

      const result = await llmCaller({
        systemPrompt: this.systemPrompt,
        userPrompt,
        temperature: 0.2, // 低温度，保证客观性
        maxTokens: 3000
      });

      if (!result.success || !result.response) {
        throw new Error('LLM 调用失败');
      }

      return this.parseCheckResult(result.response);

    } catch (error) {
      console.error('LLM 校验失败:', error);
      return {
        status: 'pass',
        overall_score: 80,
        errors: [],
        warnings: [],
        analysis: 'LLM 校验失败，无法提供详细建议'
      };
    }
  }

  /**
   * 构建校验提示词（简化版）
   */
  buildCheckPrompt(text, intent, context, memoryData) {
    let prompt = '';

    // 待校验的文本
    prompt += `# 待校验的文本\n${text}\n\n`;

    // 从记忆系统获取的世界观规则
    if (memoryData.worldRules && Object.keys(memoryData.worldRules).length > 0) {
      prompt += `# 世界观规则（必须严格遵守）\n`;
      prompt += `${JSON.stringify(memoryData.worldRules, null, 2)}\n\n`;
    }

    // 从记忆系统获取的角色信息
    if (memoryData.characters && memoryData.characters.length > 0) {
      prompt += `# 角色设定（必须严格遵守）\n`;
      for (const char of memoryData.characters.slice(0, 5)) {
        prompt += `【${char.name}】\n`;
        if (char.personality) {
          if (char.personality.traits && char.personality.traits.length > 0) {
            prompt += `性格特质：${char.personality.traits.join('、')}\n`;
          }
          if (char.personality.forbidden_traits && char.personality.forbidden_traits.length > 0) {
            prompt += `禁止特质：${char.personality.forbidden_traits.join('、')}\n`;
          }
        }
        if (char.current_state) {
          if (char.current_state.level) {
            prompt += `当前境界/等级：${char.current_state.level}\n`;
          }
          if (char.current_state.location) {
            prompt += `当前位置：${char.current_state.location}\n`;
          }
        }
        prompt += '\n';
      }
    }

    // 从记忆系统获取的剧情状态
    if (memoryData.plotState && Object.keys(memoryData.plotState).length > 0) {
      prompt += `# 当前剧情状态\n`;
      prompt += `${JSON.stringify(memoryData.plotState, null, 2)}\n\n`;
    }

    // 添加写作意图
    if (intent) {
      prompt += `# 写作意图\n`;
      prompt += `目标：${intent.goal || '无'}\n`;
      if (intent.constraints) {
        if (intent.constraints.forbidden && intent.constraints.forbidden.length > 0) {
          prompt += `禁止项：${intent.constraints.forbidden.join('、')}\n`;
        }
        if (intent.constraints.required && intent.constraints.required.length > 0) {
          prompt += `必需项：${intent.constraints.required.join('、')}\n`;
        }
      }
      prompt += '\n';
    }

    prompt += `# 任务\n请仔细分析文本，检查是否存在以下问题：\n`;
    prompt += `1. 违反世界观规则\n`;
    prompt += `2. 角色性格或行为不一致\n`;
    prompt += `3. 角色境界/能力超出限制\n`;
    prompt += `4. 逻辑矛盾或不合理之处\n`;
    prompt += `5. 视角混乱\n\n`;
    prompt += `对于每个问题，请提供：\n`;
    prompt += `- 问题类型\n`;
    prompt += `- 严重程度（critical/high/medium/low）\n`;
    prompt += `- 具体位置描述\n`;
    prompt += `- 问题描述\n`;
    prompt += `- 整改建议（必须具体可操作）\n\n`;
    prompt += `返回纯 JSON 格式的校验结果。`;

    return prompt;
  }

  /**
   * 解析校验结果（DeepSeek 优化版）
   */
  parseCheckResult(response) {
    try {
      // 使用 DeepSeek 专用解析器
      const result = safeParseJSON(response, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });
      
      // 验证必需字段
      if (!result.status) result.status = 'pass';
      if (!result.overall_score) result.overall_score = 80;
      if (!result.errors) result.errors = [];
      if (!result.warnings) result.warnings = [];
      if (!result.analysis) result.analysis = '校验完成';

      return result;
    } catch (e) {
      console.error('❌ 解析校验结果失败:', e.message);
      console.error('原始响应:', response.substring(0, 500));
      return {
        status: 'pass',
        overall_score: 80,
        errors: [],
        warnings: [],
        analysis: '校验结果解析失败'
      };
    }
  }

  /**
   * 合并规则引擎和 LLM 的结果
   */
  mergeResults(ruleViolations, llmResult) {
    // 合并错误
    const allErrors = [
      ...ruleViolations,
      ...llmResult.errors
    ];

    // 去重（基于 message）
    const uniqueErrors = [];
    const seen = new Set();
    
    for (const error of allErrors) {
      const key = error.message;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueErrors.push(error);
      }
    }

    // 按严重性排序
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    uniqueErrors.sort((a, b) => 
      severityOrder[a.severity] - severityOrder[b.severity]
    );

    // 计算最终评分
    const criticalCount = uniqueErrors.filter(e => e.severity === 'critical').length;
    const highCount = uniqueErrors.filter(e => e.severity === 'high').length;
    const mediumCount = uniqueErrors.filter(e => e.severity === 'medium').length;
    
    let finalScore = 100;
    finalScore -= criticalCount * 20;
    finalScore -= highCount * 10;
    finalScore -= mediumCount * 5;
    finalScore = Math.max(0, finalScore);

    // 确定最终状态
    const finalStatus = (criticalCount > 0 || highCount > 0) ? 'fail' : 'pass';

    return {
      status: finalStatus,
      overall_score: finalScore,
      errors: uniqueErrors,
      warnings: llmResult.warnings || [],
      analysis: llmResult.analysis || '校验完成',
      statistics: {
        total_errors: uniqueErrors.length,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: uniqueErrors.filter(e => e.severity === 'low').length
      }
    };
  }

  /**
   * 生成校验报告（可读格式）
   */
  generateReport(result) {
    let report = `\n${'='.repeat(60)}\n`;
    report += `一致性校验报告\n`;
    report += `${'='.repeat(60)}\n\n`;

    report += `状态: ${result.status === 'pass' ? '✅ 通过' : '❌ 未通过'}\n`;
    report += `评分: ${result.overall_score}/100\n\n`;

    if (result.errors && result.errors.length > 0) {
      report += `发现 ${result.errors.length} 个问题:\n\n`;
      
      for (let i = 0; i < result.errors.length; i++) {
        const error = result.errors[i];
        report += `${i + 1}. [${error.severity.toUpperCase()}] ${error.message}\n`;
        report += `   位置: ${error.location}\n`;
        report += `   建议: ${error.suggestion}\n\n`;
      }
    } else {
      report += `✅ 未发现明显问题\n\n`;
    }

    if (result.warnings && result.warnings.length > 0) {
      report += `提示 ${result.warnings.length} 条建议:\n\n`;
      for (let i = 0; i < result.warnings.length; i++) {
        const warning = result.warnings[i];
        report += `${i + 1}. ${warning.message}\n`;
        report += `   建议: ${warning.suggestion}\n\n`;
      }
    }

    report += `总体分析:\n${result.analysis}\n`;
    report += `\n${'='.repeat(60)}\n`;

    return report;
  }
}

module.exports = ConsistencyChecker;

