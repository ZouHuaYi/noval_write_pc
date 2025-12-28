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

const { safeParseJSON } = require('../utils/jsonParser');
const EventExtractor = require('./eventExtractor');

class ConsistencyChecker {
  constructor(ruleEngine) {
    this.ruleEngine = ruleEngine; // DSL 规则引擎
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
   * 执行一致性校验（4层架构）
   * @param {string} text - 待校验的文本
   * @param {Object} intent - 写作意图
   * @param {Object} context - 记忆上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async check(text, intent, context, llmCaller) {
    try {
      console.log('🔍 开始一致性校验（4层架构）...');

      // 步骤 1: 事件抽取（临时，不写回记忆）
      console.log('📊 步骤 1/5: 抽取事件和状态迁移...');
      const extracted = await this.eventExtractor.extract(text, context, llmCaller);
      const { events, state_transitions } = extracted;
      console.log(`   抽取到 ${events.length} 个事件, ${state_transitions.length} 个状态迁移`);

      // 步骤 2-5: 4层校验
      const layerResults = {
        text: null,      // 第1层：文本层
        state: null,   // 第2层：状态层
        intent: null,  // 第3层：契约层
        arc: null      // 第4层：叙事推进层
      };

      // 第1层：TextRuleCheck（文本层）
      console.log('📝 步骤 2/5: TextRuleCheck（文本层）...');
      layerResults.text = await this.checkTextLayer(text, context, llmCaller);

      // 第2层：StateRuleCheck（状态层）
      console.log('🔄 步骤 3/5: StateRuleCheck（状态层）...');
      layerResults.state = await this.checkStateLayer(text, context, events, state_transitions);

      // 第3层：IntentContractCheck（契约层）
      console.log('🎯 步骤 4/5: IntentContractCheck（契约层）...');
      layerResults.intent = await this.checkIntentLayer(text, intent, context);

      // 第4层：ArcProgressCheck（叙事推进层）
      console.log('📈 步骤 5/5: ArcProgressCheck（叙事推进层）...');
      layerResults.arc = await this.checkArcLayer(text, context, events);

      // 合并4层结果
      const finalResult = this.mergeLayerResults(layerResults);

      // 如果有致命错误或错误，状态为 fail
      const hasFatal = finalResult.errors.some(e => e.severity === 'critical' || e.level === 'FATAL');
      const hasError = finalResult.errors.some(e => 
        e.severity === 'high' || e.severity === 'critical' || 
        e.level === 'ERROR' || e.level === 'FATAL'
      );

      finalResult.status = (hasFatal || hasError) ? 'fail' : 'pass';

      console.log(`✅ 一致性校验完成 - 状态: ${finalResult.status}, 评分: ${finalResult.overall_score}`);
      console.log(`   文本层: ${layerResults.text?.errors?.length || 0} 个问题`);
      console.log(`   状态层: ${layerResults.state?.errors?.length || 0} 个问题`);
      console.log(`   契约层: ${layerResults.intent?.errors?.length || 0} 个问题`);
      console.log(`   推进层: ${layerResults.arc?.errors?.length || 0} 个问题`);

      return finalResult;

    } catch (error) {
      console.error('❌ 一致性校验失败:', error);
      
      return {
        status: 'fail',
        overall_score: 50,
        errors: [{
          type: 'logic',
          severity: 'medium',
          level: 'ERROR',
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
   * 第1层：TextRuleCheck（文本层）
   * 检查文本本身的问题（格式、基础逻辑等）
   */
  async checkTextLayer(text, context, llmCaller) {
    const errors = [];
    const warnings = [];

    // 使用 LLM 检查文本层问题（视角、标点、基础逻辑等）
    try {
      const llmResult = await this.checkWithLLM(text, null, context, [], llmCaller);
      
      // 只保留文本层相关的问题
      for (const error of llmResult.errors || []) {
        if (['pov', 'format', 'logic'].includes(error.type)) {
          errors.push({
            ...error,
            layer: 'text',
            source: 'llm'
          });
        }
      }
    } catch (error) {
      console.error('文本层 LLM 校验失败:', error);
    }

    return {
      layer: 'text',
      errors,
      warnings,
      passed: errors.length === 0
    };
  }

  /**
   * 第2层：StateRuleCheck（状态层）
   * 检查状态迁移是否合法
   */
  async checkStateLayer(text, context, events, stateTransitions) {
    const errors = [];
    const warnings = [];

    if (!this.ruleEngine) {
      return { layer: 'state', errors, warnings, passed: true };
    }

    try {
      // 使用 DSL 规则引擎检查状态相关规则
      const violations = await this.ruleEngine.checkRules({
        text,
        intent: null,
        context,
        events,
        stateTransitions
      });

      // 筛选状态层相关的规则（CHARACTER, WORLD 中的状态规则）
      for (const violation of violations) {
        if (violation.scope === 'CHARACTER' || 
            (violation.scope === 'WORLD' && violation.type === 'state')) {
          errors.push({
            ...violation,
            layer: 'state',
            severity: this.mapLevelToSeverity(violation.level),
            source: 'dsl_rule_engine'
          });
        }
      }
    } catch (error) {
      console.error('状态层校验失败:', error);
    }

    return {
      layer: 'state',
      errors,
      warnings,
      passed: errors.length === 0
    };
  }

  /**
   * 第3层：IntentContractCheck（契约层）
   * 检查是否满足 Intent 契约
   */
  async checkIntentLayer(text, intent, context) {
    const errors = [];
    const warnings = [];

    if (!intent) {
      return { layer: 'intent', errors, warnings, passed: true };
    }

    if (!this.ruleEngine) {
      return { layer: 'intent', errors, warnings, passed: true };
    }

    try {
      // 使用 DSL 规则引擎检查 Intent 契约规则
      const violations = await this.ruleEngine.checkRules({
        text,
        intent,
        context,
        events: [],
        stateTransitions: []
      });

      // 筛选 Intent 层相关的规则
      for (const violation of violations) {
        if (violation.scope === 'INTENT') {
          errors.push({
            ...violation,
            layer: 'intent',
            severity: this.mapLevelToSeverity(violation.level),
            source: 'dsl_rule_engine'
          });
        }
      }
    } catch (error) {
      console.error('契约层校验失败:', error);
    }

    return {
      layer: 'intent',
      errors,
      warnings,
      passed: errors.length === 0
    };
  }

  /**
   * 第4层：ArcProgressCheck（叙事推进层）
   * 检查 Arc 是否推进（防水文）
   */
  async checkArcLayer(text, context, events) {
    const errors = [];
    const warnings = [];

    if (!this.ruleEngine) {
      return { layer: 'arc', errors, warnings, passed: true };
    }

    try {
      // 使用 DSL 规则引擎检查 Arc 推进规则
      const violations = await this.ruleEngine.checkRules({
        text,
        intent: null,
        context,
        events,
        stateTransitions: []
      });

      // 筛选 Arc 层相关的规则
      for (const violation of violations) {
        if (violation.scope === 'ARC') {
          errors.push({
            ...violation,
            layer: 'arc',
            severity: this.mapLevelToSeverity(violation.level),
            source: 'dsl_rule_engine'
          });
        }
      }
    } catch (error) {
      console.error('推进层校验失败:', error);
    }

    return {
      layer: 'arc',
      errors,
      warnings,
      passed: errors.length === 0
    };
  }

  /**
   * 合并4层结果
   */
  mergeLayerResults(layerResults) {
    const allErrors = [];
    const allWarnings = [];

    // 收集所有错误和警告
    for (const layer of Object.values(layerResults)) {
      if (layer?.errors) {
        allErrors.push(...layer.errors);
      }
      if (layer?.warnings) {
        allWarnings.push(...layer.warnings);
      }
    }

    // 去重（基于 message）
    const uniqueErrors = [];
    const seen = new Set();
    
    for (const error of allErrors) {
      const key = error.message || error.rule_id;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueErrors.push(error);
      }
    }

    // 按严重性排序
    const severityOrder = { 
      critical: 0, FATAL: 0,
      high: 1, ERROR: 1,
      medium: 2, WARN: 2,
      low: 3
    };
    uniqueErrors.sort((a, b) => {
      const aSev = severityOrder[a.severity] ?? severityOrder[a.level] ?? 99;
      const bSev = severityOrder[b.severity] ?? severityOrder[b.level] ?? 99;
      return aSev - bSev;
    });

    // 计算评分
    let score = 100;
    for (const error of uniqueErrors) {
      const sev = error.severity || error.level || 'medium';
      if (sev === 'critical' || sev === 'FATAL') score -= 20;
      else if (sev === 'high' || sev === 'ERROR') score -= 10;
      else if (sev === 'medium' || sev === 'WARN') score -= 5;
      else score -= 2;
    }
    score = Math.max(0, score);

    return {
      status: 'pass', // 将在 check() 中根据错误确定
      overall_score: score,
      errors: uniqueErrors,
      warnings: allWarnings,
      analysis: this.generateAnalysis(layerResults, uniqueErrors),
      layer_results: layerResults,
      statistics: {
        total_errors: uniqueErrors.length,
        by_layer: {
          text: layerResults.text?.errors?.length || 0,
          state: layerResults.state?.errors?.length || 0,
          intent: layerResults.intent?.errors?.length || 0,
          arc: layerResults.arc?.errors?.length || 0
        }
      }
    };
  }

  /**
   * 生成分析报告
   */
  generateAnalysis(layerResults, errors) {
    const layers = [];
    if (layerResults.text?.errors?.length > 0) layers.push('文本层');
    if (layerResults.state?.errors?.length > 0) layers.push('状态层');
    if (layerResults.intent?.errors?.length > 0) layers.push('契约层');
    if (layerResults.arc?.errors?.length > 0) layers.push('推进层');

    if (errors.length === 0) {
      return '✅ 所有层校验通过，文本符合要求。';
    }

    let analysis = `发现 ${errors.length} 个问题，涉及 ${layers.join('、')}。`;
    
    const fatalCount = errors.filter(e => e.severity === 'critical' || e.level === 'FATAL').length;
    const errorCount = errors.filter(e => e.severity === 'high' || e.level === 'ERROR').length;
    
    if (fatalCount > 0) {
      analysis += `其中 ${fatalCount} 个致命错误必须修正。`;
    }
    if (errorCount > 0) {
      analysis += `另有 ${errorCount} 个错误需要修正。`;
    }

    return analysis;
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
   * 使用 LLM 深度校验
   */
  async checkWithLLM(text, intent, context, ruleViolations, llmCaller) {
    try {
      const userPrompt = this.buildCheckPrompt(text, intent, context, ruleViolations);

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
      // 返回基于规则的结果
      return {
        status: ruleViolations.length > 0 ? 'fail' : 'pass',
        overall_score: ruleViolations.length > 0 ? 70 : 85,
        errors: [],
        warnings: [],
        analysis: 'LLM 校验失败，仅基于规则引擎结果'
      };
    }
  }

  /**
   * 构建校验提示词
   */
  buildCheckPrompt(text, intent, context, ruleViolations) {
    let prompt = `# 待校验的文本\n${text}\n\n`;

    // 添加写作意图
    if (intent) {
      prompt += `# 写作意图\n`;
      prompt += `目标：${intent.goal}\n`;
      if (intent.constraints) {
        prompt += `禁止项：${intent.constraints.forbidden?.join(', ')}\n`;
        prompt += `必需项：${intent.constraints.required?.join(', ')}\n`;
      }
      prompt += '\n';
    }

    // 添加世界观规则
    if (context.world_rules) {
      prompt += `# 世界观规则\n`;
      prompt += `${JSON.stringify(context.world_rules, null, 2)}\n\n`;
    }

    // 添加人物设定
    if (context.characters && context.characters.length > 0) {
      prompt += `# 人物设定\n`;
      for (const char of context.characters.slice(0, 3)) {
        prompt += `【${char.name}】\n`;
        if (char.personality) {
          prompt += `性格：${char.personality.traits?.join('、')}\n`;
          prompt += `禁忌特质：${char.personality.forbidden_traits?.join('、')}\n`;
        }
        if (char.current_state) {
          prompt += `当前境界：${char.current_state.level}\n`;
        }
        prompt += '\n';
      }
    }

    // 添加规则引擎发现的问题
    if (ruleViolations.length > 0) {
      prompt += `# 规则引擎已发现的问题\n`;
      for (const v of ruleViolations) {
        prompt += `- ${v.message}\n`;
      }
      prompt += '\n';
    }

    prompt += `# 任务\n请仔细分析文本，检查是否存在其他问题。返回纯 JSON 格式的校验结果。`;

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

