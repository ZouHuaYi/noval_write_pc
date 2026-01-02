/**
 * Cognitive Skills - 认知相关 Skills
 * "会思考，但不写字"
 */

class CognitiveSkills {
  constructor(workspaceRoot, dependencies = {}) {
    this.workspaceRoot = workspaceRoot;
    this.memory = dependencies.memory;
    this.chapterPlanner = dependencies.chapterPlanner;
    this.llmCaller = dependencies.llmCaller;
    this.dependencies = dependencies; // 保存完整依赖
  }

  /**
   * plan_chapter - 规划章节
   * 禁止输出正文，只做"导演分镜"
   */
  async planChapter(input, options = {}) {
    const { chapterGoal, contextSummary, targetChapter, previousAnalyses = [] } = input;
    
    if (!this.chapterPlanner) {
      throw new Error('Chapter planner not available');
    }

    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      throw new Error('LLM caller not available');
    }

    // 构建上下文
    const context = {
      world_rules: this.memory?.world?.getRules() || {},
      characters: this.memory?.character?.getMainCharacters() || [],
      plot_state: this.memory?.plot?.getCurrentState() || {}
    };

    // 构建用户请求（用于章节规划器）
    const userRequest = {
      userRequest: chapterGoal
    };

    // 调用章节规划器
    const plan = await this.chapterPlanner.planChapterForContinuation(
      targetChapter,
      previousAnalyses,
      userRequest,
      context,
      llmCaller
    );

    if (!plan.success) {
      throw new Error(`Chapter planning failed: ${plan.error}`);
    }

    // 转换为 Skill 输出格式
    return {
      outline: plan.chapter_structure?.scenes?.map(scene => ({
        scene: scene.id,
        purpose: scene.purpose,
        type: scene.type,
        pacing: scene.pacing,
        emotion: scene.emotion,
        word_count: scene.word_count
      })) || [],
      emotion_curve: plan.emotion_curve,
      pacing_curve: plan.pacing_curve,
      density_curve: plan.density_curve,
      chapter_structure: plan.chapter_structure,
      coherence_links: plan.coherence_links
    };
  }

  /**
   * reflect_previous_output - 反思上一轮输出
   */
  async reflectPreviousOutput(input, options = {}) {
    const { content, context = {} } = input;
    
    if (!content) {
      throw new Error('Content is required for reflection');
    }

    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      // 如果没有 LLM，返回简单的分析
      return {
        issues: ['需要 LLM 支持才能进行深度反思'],
        suggestions: ['请配置 LLM 以启用反思功能']
      };
    }

    // 构建反思提示词
    const systemPrompt = `你是一个小说质量评估专家。请分析给定的文本，找出问题并提出改进建议。

输出格式（JSON）：
{
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`;

    const userPrompt = `请分析以下文本：

${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

请找出：
1. 逻辑问题
2. 风格不一致
3. 情节推进问题
4. 其他可以改进的地方

返回 JSON 格式的分析结果。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 1000
      });

      // 解析结果
      let parsed;
      if (typeof result === 'string') {
        parsed = JSON.parse(result);
      } else if (result.success && result.response) {
        parsed = JSON.parse(result.response);
      } else {
        throw new Error('Invalid LLM response');
      }

      return {
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || []
      };
    } catch (error) {
      console.error('反思失败:', error);
      return {
        issues: ['反思过程出错'],
        suggestions: ['请手动检查文本']
      };
    }
  }

  /**
   * plan_intent - 规划写作意图
   */
  async planIntent(input, options = {}) {
    const { userRequest, context = {}, chapterPlan = null } = input;
    
    if (!userRequest) {
      throw new Error('userRequest is required');
    }

    const intentPlanner = this.dependencies?.intentPlanner;
    const llmCaller = options.llmCaller || this.llmCaller;
    
    if (!intentPlanner) {
      throw new Error('Intent planner not available');
    }

    // 构建请求对象
    const request = {
      userRequest,
      ...context
    };

    // 调用意图规划器
    const intent = await intentPlanner.plan(userRequest, context, llmCaller);
    
    // 如果有关节规划，增强 Intent
    if (chapterPlan && chapterPlan.success) {
      intent.chapter_plan = chapterPlan;
      // 根据章节规划调整意图
      if (chapterPlan.emotion_curve) {
        intent.tone = this.formatEmotionTone(chapterPlan.emotion_curve);
      }
      if (chapterPlan.pacing_curve) {
        intent.writing_guidelines = intent.writing_guidelines || {};
        intent.writing_guidelines.pace = chapterPlan.pacing_curve.overall;
      }
    }

    return {
      goal: intent.goal || userRequest,
      constraints: intent.constraints || {},
      writing_guidelines: intent.writing_guidelines || {}
    };
  }

  /**
   * 格式化情绪基调
   */
  formatEmotionTone(emotionCurve) {
    const start = emotionCurve.start || 0.5;
    const peak = emotionCurve.peak || 0.5;
    const end = emotionCurve.end || 0.5;

    const emotions = [];
    if (start < 0.4) emotions.push('平静');
    else if (start < 0.6) emotions.push('紧张');
    else if (start < 0.8) emotions.push('兴奋');
    else emotions.push('激昂');

    if (peak > start + 0.2) {
      emotions.push('→ 爆发');
    }

    if (end < peak - 0.2) {
      emotions.push('→ 平静');
    }

    return emotions.join(' ');
  }

  /**
   * analyze_curves - 分析节奏、情绪、密度曲线
   */
  async analyzeCurves(input, options = {}) {
    const { content, chapterPlan = null } = input;
    
    if (!content) {
      throw new Error('Content is required for curve analysis');
    }

    const pacingController = this.dependencies?.pacingController;
    const emotionCurveManager = this.dependencies?.emotionCurveManager;
    const densityController = this.dependencies?.densityController;
    const performanceOptimizer = this.dependencies?.performanceOptimizer;

    if (!pacingController || !emotionCurveManager || !densityController) {
      throw new Error('Curve analyzers not available');
    }

    // 并行分析
    let pacingAnalysis, emotionAnalysis, densityAnalysis;
    
    if (performanceOptimizer && performanceOptimizer.parallel) {
      [pacingAnalysis, emotionAnalysis, densityAnalysis] = await performanceOptimizer.parallel([
        () => pacingController.analyzePacing(content),
        () => emotionCurveManager.analyzeEmotionCurve(content),
        () => densityController.analyzeDensity(content)
      ], {
        maxConcurrency: 3
      });
    } else {
      // 顺序执行
      pacingAnalysis = await pacingController.analyzePacing(content);
      emotionAnalysis = await emotionCurveManager.analyzeEmotionCurve(content);
      densityAnalysis = await densityController.analyzeDensity(content);
    }

    // 与目标曲线对比
    let pacingComparison = null;
    let emotionComparison = null;
    let densityComparison = null;

    if (chapterPlan && chapterPlan.success) {
      if (chapterPlan.pacing_curve && pacingController.compareWithTarget) {
        pacingComparison = pacingController.compareWithTarget(
          pacingAnalysis,
          chapterPlan.pacing_curve
        );
      }
      if (chapterPlan.emotion_curve && emotionCurveManager.compareWithTarget) {
        emotionComparison = emotionCurveManager.compareWithTarget(
          emotionAnalysis,
          chapterPlan.emotion_curve
        );
      }
      if (chapterPlan.density_curve && densityController.compareWithTarget) {
        densityComparison = densityController.compareWithTarget(
          densityAnalysis,
          chapterPlan.density_curve
        );
      }
    }

    return {
      pacingAnalysis,
      emotionAnalysis,
      densityAnalysis,
      pacingComparison,
      emotionComparison,
      densityComparison
    };
  }
}

module.exports = CognitiveSkills;

