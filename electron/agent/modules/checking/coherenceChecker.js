/**
 * Coherence Checker - 连贯性检查器
 * 检查情节连贯性、情绪连贯性、节奏连贯性、章节连接
 * 用于续写场景，确保新章节与前章自然衔接
 */

const EventExtractor = require('../analysis/eventExtractor');

class CoherenceChecker {
  constructor(dslRuleEngine = null, memoryManager = null) {
    this.systemPrompt = this.buildSystemPrompt();
    this.dslRuleEngine = dslRuleEngine; // DSL 规则引擎
    this.memoryManager = memoryManager; // 记忆管理器
    this.eventExtractor = new EventExtractor(); // 事件抽取器
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个【小说连贯性检查程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符

你必须且只能在 <json> 和 </json> 之间输出内容。

# 核心任务
检查章节之间的连贯性，包括情节连贯性、情绪连贯性、节奏连贯性。

# 输出结构
\`\`\`json
{
  "overall_coherence": "good" | "fair" | "poor",
  "plot_coherence": {
    "status": "pass" | "fail",
    "score": 0-100,
    "issues": [
      {
        "type": "plot_gap" | "contradiction" | "missing_connection",
        "severity": "low" | "medium" | "high",
        "message": "问题描述",
        "suggestion": "修改建议"
      }
    ]
  },
  "emotion_coherence": {
    "status": "pass" | "fail",
    "score": 0-100,
    "transition": "smooth" | "abrupt" | "unnatural",
    "issues": [
      {
        "type": "emotion_jump" | "emotion_stagnation",
        "severity": "low" | "medium" | "high",
        "message": "问题描述",
        "suggestion": "修改建议"
      }
    ]
  },
  "pacing_coherence": {
    "status": "pass" | "fail",
    "score": 0-100,
    "transition": "smooth" | "abrupt" | "unnatural",
    "issues": [
      {
        "type": "pacing_conflict" | "pacing_stagnation",
        "severity": "low" | "medium" | "high",
        "message": "问题描述",
        "suggestion": "修改建议"
      }
    ]
  },
  "chapter_connection": {
    "status": "pass" | "fail",
    "score": 0-100,
    "connection_points": [
      {
        "type": "cliffhanger_response" | "event_continuation" | "foreshadow_setup",
        "found": true | false,
        "description": "连接点描述"
      }
    ],
    "issues": [
      {
        "type": "missing_connection" | "weak_connection",
        "severity": "low" | "medium" | "high",
        "message": "问题描述",
        "suggestion": "修改建议"
      }
    ]
  }
}
\`\`\`
`;

  }

  /**
   * 检查连贯性（续写场景）
   * @param {Object} newChapter - 新章节（文本或分析结果）
   * @param {Array} previousAnalyses - 前章分析结果
   * @param {Object} chapterPlan - 章节规划
   * @param {Function} llmCaller - LLM 调用函数
   */
  async checkCoherence(newChapter, previousAnalyses, chapterPlan, llmCaller) {
    try {
      console.log('🔍 开始连贯性检查...');

      if (!previousAnalyses || previousAnalyses.length === 0) {
        // 没有前章，跳过连贯性检查
        return {
          success: true,
          overall_coherence: 'good',
          plot_coherence: { status: 'pass', score: 100, issues: [] },
          emotion_coherence: { status: 'pass', score: 100, issues: [] },
          pacing_coherence: { status: 'pass', score: 100, issues: [] },
          chapter_connection: { status: 'pass', score: 100, issues: [] }
        };
      }

      const lastChapter = previousAnalyses[previousAnalyses.length - 1];
      const previousState = this.extractPreviousState(lastChapter);

      // 1. 检查情节连贯性
      const plotCoherence = await this.checkPlotCoherence(newChapter, previousState, llmCaller);

      // 2. 检查情绪连贯性
      const emotionCoherence = this.checkEmotionCoherence(newChapter, previousState, chapterPlan);

      // 3. 检查节奏连贯性
      const pacingCoherence = this.checkPacingCoherence(newChapter, previousState, chapterPlan);

      // 4. 检查章节连接
      const chapterConnection = this.checkChapterConnection(newChapter, previousState, chapterPlan);

      // 5. 检查状态连续性（新增）
      const stateContinuity = await this.checkStateContinuity(
        newChapter,
        previousAnalyses,
        llmCaller
      );

      // 6. 检查状态规则（新增）
      const stateRuleCheck = await this.checkStateRules(
        newChapter,
        previousAnalyses,
        llmCaller
      );

      // 合并状态规则问题到情节连贯性
      if (stateRuleCheck.issues.length > 0) {
        plotCoherence.issues.push(...stateRuleCheck.issues);
        plotCoherence.score -= stateRuleCheck.issues.length * 10;
        plotCoherence.score = Math.max(0, plotCoherence.score);
      }

      // 合并状态连续性问题到情节连贯性
      if (stateContinuity.issues.length > 0) {
        plotCoherence.issues.push(...stateContinuity.issues);
        plotCoherence.score -= stateContinuity.issues.length * 8;
        plotCoherence.score = Math.max(0, plotCoherence.score);
      }

      // 重新计算情节连贯性状态
      plotCoherence.status = plotCoherence.score >= 70 ? 'pass' : 'fail';

      // 计算总体连贯性（包含状态检查）
      const overallScore = (
        plotCoherence.score +
        emotionCoherence.score +
        pacingCoherence.score +
        chapterConnection.score
      ) / 4;

      const overallCoherence = overallScore >= 80 ? 'good' : overallScore >= 60 ? 'fair' : 'poor';

      const result = {
        success: true,
        overall_coherence: overallCoherence,
        overall_score: overallScore,
        plot_coherence: plotCoherence,
        emotion_coherence: emotionCoherence,
        pacing_coherence: pacingCoherence,
        chapter_connection: chapterConnection,
        state_continuity: stateContinuity, // 新增
        state_rule_check: stateRuleCheck // 新增
      };

      console.log(`✅ 连贯性检查完成：总体=${overallCoherence} (${overallScore.toFixed(1)})`);

      return result;

    } catch (error) {
      console.error('❌ 连贯性检查失败:', error);
      return {
        success: false,
        error: error.message,
        overall_coherence: 'unknown'
      };
    }
  }

  /**
   * 提取前章状态
   */
  extractPreviousState(lastChapter) {
    const ending = lastChapter.coherence_points?.ending || {};
    return {
      ending_emotion: ending.emotion || lastChapter.emotion_curve?.end || 0.5,
      ending_pacing: ending.pacing || lastChapter.pacing_curve?.overall || 'medium',
      ending_events: ending.events || [],
      ending_characters: ending.characters || [],
      ending_location: ending.location || '',
      cliffhanger: ending.cliffhanger || '',
      emotion_curve: lastChapter.emotion_curve,
      pacing_curve: lastChapter.pacing_curve
    };
  }

  /**
   * 检查情节连贯性
   */
  async checkPlotCoherence(newChapter, previousState, llmCaller) {
    const issues = [];
    let score = 100;

    // 检查情节间隙
    const plotGaps = this.findPlotGaps(previousState.ending_events, newChapter);
    if (plotGaps.length > 0) {
      issues.push(...plotGaps);
      score -= plotGaps.length * 15;
    }

    // 使用 LLM 深度检查（如果有）
    if (llmCaller && typeof newChapter === 'string') {
      try {
        const llmResult = await this.checkPlotWithLLM(newChapter, previousState, llmCaller);
        if (llmResult.issues && llmResult.issues.length > 0) {
          issues.push(...llmResult.issues);
          score -= llmResult.issues.length * 10;
        }
      } catch (error) {
        console.warn('LLM 情节连贯性检查失败:', error.message);
      }
    }

    score = Math.max(0, Math.min(100, score));

    return {
      status: score >= 70 ? 'pass' : 'fail',
      score,
      issues
    };
  }

  /**
   * 查找情节间隙
   */
  findPlotGaps(previousEvents, newChapter) {
    const issues = [];

    // 如果前章有未完成的事件，检查新章是否回应
    if (previousEvents && previousEvents.length > 0) {
      const lastEvent = previousEvents[previousEvents.length - 1];
      // 简化检查：如果新章开头没有提到相关事件，可能是间隙
      if (typeof newChapter === 'string') {
        const newChapterStart = newChapter.substring(0, 500);
        // 检查是否有关键词连接
        const hasConnection = lastEvent && newChapterStart.includes(lastEvent.substring(0, 10));
        if (!hasConnection && lastEvent.length > 0) {
          issues.push({
            type: 'plot_gap',
            severity: 'medium',
            message: `前章事件"${lastEvent}"在新章开头未得到回应`,
            suggestion: '在新章开头添加过渡，回应前章事件'
          });
        }
      }
    }

    return issues;
  }

  /**
   * 使用 LLM 检查情节连贯性
   */
  async checkPlotWithLLM(newChapterText, previousState, llmCaller) {
    const userPrompt = this.buildPlotCheckPrompt(newChapterText, previousState);

    const result = await llmCaller({
      systemPrompt: this.systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 2000
    });

    if (!result.success || !result.response) {
      throw new Error('LLM 调用失败');
    }

    return this.parseCoherenceResult(result.response);
  }

  /**
   * 检查情绪连贯性
   */
  checkEmotionCoherence(newChapter, previousState, chapterPlan) {
    const issues = [];
    let score = 100;

    // 获取新章开头情绪
    let newChapterEmotion = 0.5;
    if (chapterPlan && chapterPlan.emotion_curve) {
      newChapterEmotion = chapterPlan.emotion_curve.start || 0.5;
    } else if (newChapter && typeof newChapter === 'object' && newChapter.emotion_curve) {
      newChapterEmotion = newChapter.emotion_curve.start || 0.5;
    }

    // 计算情绪跳跃
    const emotionJump = Math.abs(newChapterEmotion - previousState.ending_emotion);

    // 判断转换类型
    let transition = 'smooth';
    if (emotionJump > 0.5) {
      transition = 'abrupt';
      issues.push({
        type: 'emotion_jump',
        severity: 'high',
        message: `情绪跳跃过大：从 ${previousState.ending_emotion.toFixed(2)} 到 ${newChapterEmotion.toFixed(2)}（差值 ${emotionJump.toFixed(2)}）`,
        suggestion: '添加过渡段落，平滑情绪转换'
      });
      score -= 30;
    } else if (emotionJump > 0.3) {
      transition = 'unnatural';
      issues.push({
        type: 'emotion_jump',
        severity: 'medium',
        message: `情绪转换不够平滑：从 ${previousState.ending_emotion.toFixed(2)} 到 ${newChapterEmotion.toFixed(2)}`,
        suggestion: '考虑添加过渡，使情绪转换更自然'
      });
      score -= 15;
    }

    // 检查情绪停滞
    if (emotionJump < 0.1 && previousState.ending_emotion > 0.4 && previousState.ending_emotion < 0.6) {
      issues.push({
        type: 'emotion_stagnation',
        severity: 'low',
        message: '情绪长时间保持在中性水平，可能缺乏起伏',
        suggestion: '考虑增加情绪变化，提升阅读体验'
      });
      score -= 5;
    }

    score = Math.max(0, Math.min(100, score));

    return {
      status: score >= 70 ? 'pass' : 'fail',
      score,
      transition,
      issues
    };
  }

  /**
   * 检查节奏连贯性
   */
  checkPacingCoherence(newChapter, previousState, chapterPlan) {
    const issues = [];
    let score = 100;

    // 获取新章开头节奏
    let newChapterPacing = 'medium';
    if (chapterPlan && chapterPlan.pacing_curve) {
      newChapterPacing = chapterPlan.pacing_curve.variations?.[0]?.pacing || chapterPlan.pacing_curve.overall || 'medium';
    } else if (newChapter && typeof newChapter === 'object' && newChapter.pacing_curve) {
      newChapterPacing = newChapter.pacing_curve.variations?.[0]?.pacing || newChapter.pacing_curve.overall || 'medium';
    }

    const previousPacing = previousState.ending_pacing || 'medium';

    // 检查节奏冲突
    const pacingMap = { slow: 0, medium: 1, fast: 2 };
    const pacingDiff = Math.abs(pacingMap[newChapterPacing] - pacingMap[previousPacing]);

    let transition = 'smooth';
    if (pacingDiff >= 2) {
      // 从 slow 到 fast 或相反，冲突较大
      transition = 'abrupt';
      issues.push({
        type: 'pacing_conflict',
        severity: 'high',
        message: `节奏转换过于突兀：从 ${previousPacing} 到 ${newChapterPacing}`,
        suggestion: '添加过渡段落，平滑节奏转换'
      });
      score -= 25;
    } else if (pacingDiff === 1) {
      // 相邻节奏，可以接受但需要检查
      transition = 'smooth';
      // 不扣分，但记录
    }

    // 检查节奏停滞
    if (pacingDiff === 0 && previousPacing === 'medium') {
      issues.push({
        type: 'pacing_stagnation',
        severity: 'low',
        message: '节奏长时间保持中等，可能缺乏变化',
        suggestion: '考虑增加节奏变化，提升阅读体验'
      });
      score -= 5;
    }

    score = Math.max(0, Math.min(100, score));

    return {
      status: score >= 70 ? 'pass' : 'fail',
      score,
      transition,
      issues
    };
  }

  /**
   * 检查章节连接
   */
  checkChapterConnection(newChapter, previousState, chapterPlan) {
    const issues = [];
    let score = 100;
    const connectionPoints = [];

    // 检查悬念回应
    if (previousState.cliffhanger) {
      const hasResponse = this.checkCliffhangerResponse(newChapter, previousState.cliffhanger);
      connectionPoints.push({
        type: 'cliffhanger_response',
        found: hasResponse,
        description: previousState.cliffhanger
      });

      if (!hasResponse) {
        issues.push({
          type: 'missing_connection',
          severity: 'high',
          message: `未回应前章的悬念："${previousState.cliffhanger}"`,
          suggestion: '在新章开头回应前章的悬念'
        });
        score -= 30;
      }
    }

    // 检查事件延续
    if (previousState.ending_events && previousState.ending_events.length > 0) {
      const lastEvent = previousState.ending_events[previousState.ending_events.length - 1];
      const hasContinuation = this.checkEventContinuation(newChapter, lastEvent);
      connectionPoints.push({
        type: 'event_continuation',
        found: hasContinuation,
        description: lastEvent
      });

      if (!hasContinuation) {
        issues.push({
          type: 'weak_connection',
          severity: 'medium',
          message: `前章事件"${lastEvent}"在新章中未得到延续`,
          suggestion: '在新章中延续前章的事件线索'
        });
        score -= 15;
      }
    }

    // 检查伏笔设置（从章节规划中）
    if (chapterPlan && chapterPlan.coherence_links) {
      const setupPoints = chapterPlan.coherence_links.next_chapter?.setup_points || [];
      for (const point of setupPoints) {
        connectionPoints.push({
          type: 'foreshadow_setup',
          found: true,
          description: point
        });
      }
    }

    score = Math.max(0, Math.min(100, score));

    return {
      status: score >= 70 ? 'pass' : 'fail',
      score,
      connection_points: connectionPoints,
      issues
    };
  }

  /**
   * 检查悬念回应
   */
  checkCliffhangerResponse(newChapter, cliffhanger) {
    if (typeof newChapter === 'string') {
      const newChapterStart = newChapter.substring(0, 1000);
      // 检查是否包含悬念相关的关键词
      const keywords = cliffhanger.substring(0, 20).split('').filter(c => c.trim().length > 0);
      const hasKeywords = keywords.some(keyword => newChapterStart.includes(keyword));
      return hasKeywords;
    }
    return false;
  }

  /**
   * 检查事件延续
   */
  checkEventContinuation(newChapter, event) {
    if (typeof newChapter === 'string') {
      const newChapterStart = newChapter.substring(0, 1000);
      const eventKeywords = event.substring(0, 30).split('').filter(c => c.trim().length > 0);
      const hasKeywords = eventKeywords.some(keyword => newChapterStart.includes(keyword));
      return hasKeywords;
    }
    return false;
  }

  /**
   * 构建情节检查提示词
   */
  buildPlotCheckPrompt(newChapterText, previousState) {
    return `# 前章结尾状态

- 结尾事件：${previousState.ending_events.join('、') || '无'}
- 悬念：${previousState.cliffhanger || '无'}
- 角色：${previousState.ending_characters.join('、') || '无'}
- 地点：${previousState.ending_location || '无'}

# 新章开头文本

${newChapterText.substring(0, 2000)}${newChapterText.length > 2000 ? '\n\n[文本已截断]' : ''}

# 任务
请检查新章开头是否与前章结尾自然衔接，是否存在情节间隙、矛盾或连接薄弱的地方。

返回纯 JSON 格式。`;
  }

  /**
   * 解析连贯性检查结果
   */
  parseCoherenceResult(response) {
    const { safeParseJSON } = require('../../../utils/jsonParser');
    
    try {
      const result = safeParseJSON(response, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });

      // 验证必需字段
      if (!result.plot_coherence) {
        result.plot_coherence = { status: 'pass', score: 100, issues: [] };
      }
      if (!result.emotion_coherence) {
        result.emotion_coherence = { status: 'pass', score: 100, issues: [] };
      }
      if (!result.pacing_coherence) {
        result.pacing_coherence = { status: 'pass', score: 100, issues: [] };
      }
      if (!result.chapter_connection) {
        result.chapter_connection = { status: 'pass', score: 100, issues: [] };
      }

      return result;
    } catch (e) {
      console.error('解析连贯性检查结果失败:', e.message);
      return {
        plot_coherence: { status: 'pass', score: 100, issues: [] },
        emotion_coherence: { status: 'pass', score: 100, issues: [] },
        pacing_coherence: { status: 'pass', score: 100, issues: [] },
        chapter_connection: { status: 'pass', score: 100, issues: [] },
        state_continuity: { valid: true, issues: [] },
        state_rule_check: { issues: [] }
      };
    }
  }

  /**
   * 检查状态连续性（新增）
   */
  async checkStateContinuity(newChapter, previousAnalyses, llmCaller) {
    const issues = [];
    
    try {
      // 1. 从前章分析中提取状态
      const previousStates = this.extractPreviousStates(previousAnalyses);
      
      // 2. 从新章中提取状态（使用 Event Extractor）
      let newStates = {};
      if (typeof newChapter === 'string' && llmCaller) {
        // 构建上下文
        const context = this.buildContextForStateExtraction(previousStates);
        
        // 提取状态迁移
        const extracted = await this.eventExtractor.extract(newChapter, context, llmCaller);
        
        // 转换为状态映射
        newStates = this.convertTransitionsToStates(extracted.state_transitions);
      }

      // 3. 检查状态连续性
      for (const [charName, prevState] of Object.entries(previousStates)) {
        const newState = newStates[charName];
        if (newState) {
          const continuity = this.validateStateContinuity(charName, prevState, newState);
          if (!continuity.valid) {
            issues.push({
              type: 'state_continuity',
              severity: continuity.severity || 'medium',
              message: continuity.message,
              suggestion: continuity.suggestion,
              character: charName
            });
          }
        }
      }

      // 4. 从记忆系统获取状态（如果可用）
      if (this.memoryManager) {
        const memoryStates = await this.getMemoryStates(this.memoryManager);
        const memoryContinuity = this.compareWithMemoryStates(newStates, memoryStates);
        if (memoryContinuity.issues.length > 0) {
          issues.push(...memoryContinuity.issues);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        previousStates,
        newStates
      };

    } catch (error) {
      console.error('状态连续性检查失败:', error);
      return {
        valid: true, // 失败时不影响整体流程
        issues: [],
        error: error.message
      };
    }
  }

  /**
   * 检查状态规则（新增）
   */
  async checkStateRules(newChapter, previousAnalyses, llmCaller) {
    const issues = [];

    if (!this.dslRuleEngine || typeof newChapter !== 'string') {
      return { issues };
    }

    try {
      // 1. 提取状态迁移
      const context = this.buildContextForStateExtraction(
        this.extractPreviousStates(previousAnalyses)
      );
      const extracted = await this.eventExtractor.extract(newChapter, context, llmCaller);

      // 2. 使用规则引擎检查状态规则
      const ruleErrors = await this.dslRuleEngine.checkRules({
        text: newChapter,
        context: context,
        events: extracted.events,
        state_transitions: extracted.state_transitions
      });

      // 3. 过滤状态规则相关的错误
      const stateRuleErrors = ruleErrors.filter(
        e => e.scope === 'CHARACTER' && (e.type === 'STATE_RULE' || e.type === 'TRAIT_RULE')
      );

      // 4. 转换为连贯性问题
      for (const error of stateRuleErrors) {
        issues.push({
          type: 'state_rule_violation',
          severity: error.level === 'FATAL' ? 'high' : error.level === 'ERROR' ? 'medium' : 'low',
          message: error.message,
          suggestion: error.suggestion,
          rule_id: error.rule_id,
          rule_name: error.rule_name
        });
      }

      return { issues };

    } catch (error) {
      console.error('状态规则检查失败:', error);
      return { issues: [] };
    }
  }

  /**
   * 从前章分析中提取状态
   */
  extractPreviousStates(previousAnalyses) {
    const states = {};

    if (!previousAnalyses || previousAnalyses.length === 0) {
      return states;
    }

    const lastChapter = previousAnalyses[previousAnalyses.length - 1];
    const ending = lastChapter.coherence_points?.ending || {};

    // 从结尾信息中提取角色状态
    if (ending.characters && Array.isArray(ending.characters)) {
      for (const charName of ending.characters) {
        // 尝试从记忆系统获取状态
        if (this.memoryManager) {
          const char = this.memoryManager.character.getCharacter(charName);
          if (char) {
            states[charName] = char.current_state;
          }
        } else {
          // 如果没有记忆系统，使用默认状态
          states[charName] = {
            level: 'unknown',
            location: ending.location || 'unknown',
            emotional_state: 'normal'
          };
        }
      }
    }

    return states;
  }

  /**
   * 构建状态提取的上下文
   */
  buildContextForStateExtraction(previousStates) {
    const context = {
      characters: []
    };

    // 从记忆系统获取角色信息
    if (this.memoryManager) {
      for (const [charName, state] of Object.entries(previousStates)) {
        const char = this.memoryManager.character.getCharacter(charName);
        if (char) {
          context.characters.push({
            name: char.name,
            role: char.role,
            current_state: char.current_state,
            personality: char.personality
          });
        }
      }
    } else {
      // 如果没有记忆系统，使用提取的状态
      for (const [charName, state] of Object.entries(previousStates)) {
        context.characters.push({
          name: charName,
          current_state: state
        });
      }
    }

    return context;
  }

  /**
   * 将状态迁移转换为状态映射
   */
  convertTransitionsToStates(stateTransitions) {
    const states = {};

    for (const transition of stateTransitions) {
      if (transition.type === 'character') {
        if (!states[transition.entity]) {
          states[transition.entity] = {};
        }
        // 记录新状态
        // 这里简化处理，实际应该根据状态类型更新对应字段
        if (transition.to) {
          // 尝试解析状态（如 "Dead", "Alive", "Injured" 等）
          if (transition.to.includes('Dead') || transition.to === 'Dead') {
            states[transition.entity].status = 'Dead';
          } else if (transition.to.includes('Alive') || transition.to === 'Alive') {
            states[transition.entity].status = 'Alive';
          } else if (transition.to.includes('Injured') || transition.to === 'Injured') {
            states[transition.entity].status = 'Injured';
          }
        }
      }
    }

    return states;
  }

  /**
   * 验证状态连续性
   */
  validateStateContinuity(charName, prevState, newState) {
    // 检查关键状态变化是否合理
    const prevStatus = prevState.status || prevState.level || 'unknown';
    const newStatus = newState.status || newState.level || 'unknown';

    // 检查死亡状态
    if (prevStatus === 'Dead' && newStatus !== 'Dead') {
      return {
        valid: false,
        severity: 'high',
        message: `角色 ${charName} 在前章已死亡，但在新章中状态变为 ${newStatus}，可能违反"禁止复活"规则`,
        suggestion: '检查是否真的需要复活，或改为其他解释（如：假死、替身等）'
      };
    }

    // 检查状态跳跃（如从未受伤直接死亡）
    if (prevStatus === 'Alive' && newStatus === 'Dead') {
      // 这是合理的，但可以记录
      return { valid: true };
    }

    // 检查境界倒退（通常不合理）
    if (this.isLevelRegression(prevStatus, newStatus)) {
      return {
        valid: false,
        severity: 'medium',
        message: `角色 ${charName} 的境界从 ${prevStatus} 倒退到 ${newStatus}，可能不合理`,
        suggestion: '检查境界变化是否合理，或添加解释（如：受伤、封印等）'
      };
    }

    return { valid: true };
  }

  /**
   * 检查境界倒退
   */
  isLevelRegression(prevLevel, newLevel) {
    // 简化：如果新境界明显低于旧境界，可能是倒退
    // 这里需要根据实际的境界体系来判断
    const levelOrder = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'];
    
    const prevIndex = levelOrder.indexOf(prevLevel);
    const newIndex = levelOrder.indexOf(newLevel);
    
    if (prevIndex >= 0 && newIndex >= 0 && newIndex < prevIndex) {
      return true;
    }

    return false;
  }

  /**
   * 从记忆系统获取状态
   */
  async getMemoryStates(memoryManager) {
    const states = {};
    const characters = memoryManager.character.getAllCharacters();
    
    for (const char of characters) {
      states[char.name] = {
        ...char.current_state,
        state_history: char.state_history ? char.state_history.slice(-5) : [] // 最近5条历史
      };
    }

    return states;
  }

  /**
   * 对比记忆系统状态
   */
  compareWithMemoryStates(newStates, memoryStates) {
    const issues = [];

    for (const [charName, memoryState] of Object.entries(memoryStates)) {
      const newState = newStates[charName];
      if (newState) {
        // 检查关键状态是否一致
        const memoryStatus = memoryState.status || memoryState.level;
        const newStatus = newState.status || newState.level;

        if (memoryStatus && newStatus && memoryStatus !== newStatus) {
          // 检查是否有历史记录支持这个变化
          const hasHistory = memoryState.state_history && 
            memoryState.state_history.some(h => 
              h.to && (h.to.status === newStatus || h.to.level === newStatus)
            );

          if (!hasHistory) {
            issues.push({
              type: 'state_memory_mismatch',
              severity: 'medium',
              message: `角色 ${charName} 的状态从记忆中的 ${memoryStatus} 变为 ${newStatus}，但记忆中没有对应的状态变化历史`,
              suggestion: '确保状态变化在文本中有明确描述，或更新记忆系统'
            });
          }
        }
      }
    }

    return { issues };
  }
}

module.exports = CoherenceChecker;

