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
   * plan_chapter_outline - 规划章节大纲（新版本，支持用户编辑）
   */
  async planChapterOutline(input, options = {}) {
    const { chapterGoal, contextSummary, targetChapter, previousAnalyses = [], userModifiedOutline = null } = input;
    
    // 如果用户已经修改了大纲，直接返回（用于确认后继续）
    if (userModifiedOutline) {
      return {
        outline: userModifiedOutline,
        scenes: [],
        requiresUserConfirmation: false
      };
    }
    
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

    // 构建用户请求
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
      throw new Error(`Chapter outline planning failed: ${plan.error}`);
    }

    // 转换为 Markdown 格式的大纲
    const scenes = plan.chapter_structure?.scenes || [];
    let outlineMarkdown = `# 第${targetChapter}章 章节大纲\n\n`;
    outlineMarkdown += `## 章节目标\n${chapterGoal}\n\n`;
    
    if (plan.chapter_structure) {
      outlineMarkdown += `## 章节结构\n`;
      outlineMarkdown += `- 类型: ${plan.chapter_structure.type || '未指定'}\n`;
      outlineMarkdown += `- 总场景数: ${plan.chapter_structure.total_scenes || scenes.length}\n\n`;
    }

    outlineMarkdown += `## 场景列表\n\n`;
    scenes.forEach((scene, index) => {
      outlineMarkdown += `### 场景 ${index + 1}: ${scene.id || `场景${index + 1}`}\n`;
      outlineMarkdown += `- **类型**: ${scene.type || '未指定'}\n`;
      outlineMarkdown += `- **目的**: ${scene.purpose || '未指定'}\n`;
      outlineMarkdown += `- **节奏**: ${scene.pacing || '未指定'}\n`;
      outlineMarkdown += `- **情绪**: ${scene.emotion || '未指定'}\n`;
      outlineMarkdown += `- **密度**: ${scene.density || '未指定'}\n`;
      outlineMarkdown += `- **预计字数**: ${scene.word_count || 0}\n\n`;
    });

    if (plan.emotion_curve) {
      outlineMarkdown += `## 情绪曲线\n`;
      outlineMarkdown += `- 起始: ${plan.emotion_curve.start || 0}\n`;
      outlineMarkdown += `- 峰值: ${plan.emotion_curve.peak || 0}\n`;
      outlineMarkdown += `- 结束: ${plan.emotion_curve.end || 0}\n\n`;
    }

    if (plan.coherence_links) {
      outlineMarkdown += `## 连贯性连接\n`;
      if (plan.coherence_links.previous_chapter) {
        outlineMarkdown += `### 与前章连接\n`;
        plan.coherence_links.previous_chapter.connection_points?.forEach(point => {
          outlineMarkdown += `- ${point}\n`;
        });
      }
      if (plan.coherence_links.next_chapter) {
        outlineMarkdown += `### 为下章铺垫\n`;
        plan.coherence_links.next_chapter.setup_points?.forEach(point => {
          outlineMarkdown += `- ${point}\n`;
        });
      }
    }

    return {
      outline: outlineMarkdown,
      scenes: scenes.map(scene => ({
        title: scene.id || '未命名场景',
        description: scene.purpose || '',
        purpose: scene.purpose || '',
        estimatedLength: scene.word_count || 0
      })),
      requiresUserConfirmation: true
    };
  }

  /**
   * plan_chapter - 规划章节（旧版本，已废弃）
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
   * generate_rewrite_plan - 生成整改方案
   */
  async generateRewritePlan(input, options = {}) {
    const { content, checkResult, context = {} } = input;
    
    if (!content) {
      throw new Error('Content is required for rewrite plan generation');
    }

    if (!checkResult) {
      throw new Error('Check result is required for rewrite plan generation');
    }

    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      // 如果没有 LLM，生成简单的整改方案
      const issues = [];
      if (checkResult.characterIssues && checkResult.characterIssues.length > 0) {
        issues.push(...checkResult.characterIssues.map(issue => `角色问题: ${issue.issue}`));
      }
      if (checkResult.worldRuleIssues && checkResult.worldRuleIssues.length > 0) {
        issues.push(...checkResult.worldRuleIssues.map(issue => `世界观问题: ${issue}`));
      }
      if (checkResult.coherenceIssues && checkResult.coherenceIssues.length > 0) {
        issues.push(...checkResult.coherenceIssues.map(issue => `连贯性问题: ${issue}`));
      }

      return {
        rewritePlan: issues.length > 0 
          ? `需要修改以下问题：\n${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}`
          : '内容检查通过，无需修改',
        priority: checkResult.overallStatus === 'fail' ? 'high' : 'low',
        estimatedChanges: issues.map((issue, i) => ({
          section: '全文',
          issue: issue,
          suggestion: '请根据问题描述进行相应修改'
        }))
      };
    }

    // 构建整改方案生成提示词
    const systemPrompt = `你是一个小说质量改进专家。根据检查结果，生成详细的整改方案。

输出格式（JSON）：
{
  "rewritePlan": "详细的整改方案说明",
  "priority": "high" | "medium" | "low",
  "estimatedChanges": [
    {
      "section": "需要修改的段落描述",
      "issue": "问题描述",
      "suggestion": "修改建议"
    }
  ]
}`;

    const userPrompt = `# 原始内容
${content.substring(0, 3000)}${content.length > 3000 ? '...' : ''}

# 检查结果
${JSON.stringify(checkResult, null, 2)}

请生成详细的整改方案，包括：
1. 需要修改的具体位置
2. 每个问题的修改建议
3. 修改的优先级

返回 JSON 格式的整改方案。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 2000
      });

      // 解析结果（清理可能的代码块标记）
      let responseText = '';
      if (typeof result === 'string') {
        responseText = result;
      } else if (result.success && result.response) {
        responseText = typeof result.response === 'string' ? result.response : String(result.response);
      } else if (result.response) {
        responseText = typeof result.response === 'string' ? result.response : String(result.response);
      } else {
        throw new Error('Invalid LLM response');
      }
      
      // 清理代码块标记
      responseText = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      // 尝试提取 JSON 部分（如果包含其他文本）
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        responseText = jsonMatch[0];
      }
      
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON 解析失败，原始响应:', responseText);
        throw new Error(`JSON 解析失败: ${parseError.message}`);
      }

      return {
        rewritePlan: parsed.rewritePlan || '需要根据检查结果进行修改',
        priority: parsed.priority || (checkResult.overallStatus === 'fail' ? 'high' : 'low'),
        estimatedChanges: parsed.estimatedChanges || []
      };
    } catch (error) {
      console.error('生成整改方案失败:', error);
      // 返回基础整改方案
      const issues = [];
      if (checkResult.characterIssues) issues.push(...checkResult.characterIssues);
      if (checkResult.worldRuleIssues) issues.push(...checkResult.worldRuleIssues);
      if (checkResult.coherenceIssues) issues.push(...checkResult.coherenceIssues);

      return {
        rewritePlan: `需要修改以下问题：\n${issues.map((issue, i) => `${i + 1}. ${typeof issue === 'string' ? issue : issue.issue || issue.message || JSON.stringify(issue)}`).join('\n')}`,
        priority: checkResult.overallStatus === 'fail' ? 'high' : 'low',
        estimatedChanges: issues.map((issue, i) => ({
          section: '全文',
          issue: typeof issue === 'string' ? issue : issue.issue || issue.message || JSON.stringify(issue),
          suggestion: '请根据问题描述进行相应修改'
        }))
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

  /**
   * plan_chapter (合并版) - 合并了 plan_intent, plan_chapter_outline, analyze_previous_chapters
   */
  async planChapterMerged(input, options = {}) {
    const { targetChapter, userRequest, worldRules, characters, plotState, recentCount = 3 } = input;
    
    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      throw new Error('LLM caller not available');
    }

    // 1. 分析前章（如果需要）
    const fileScanner = this.dependencies?.fileScanner;
    const chapterAnalyzer = this.dependencies?.chapterAnalyzer;
    const chapterFileManager = this.dependencies?.chapterFileManager;
    const performanceOptimizer = this.dependencies?.performanceOptimizer;
    let previousAnalyses = [];

    if (targetChapter > 1 && fileScanner && chapterAnalyzer) {
      try {
        // 获取最近 N 章
        const startChapter = Math.max(1, targetChapter - recentCount);
        const chapterNumbers = [];
        
        for (let i = startChapter; i < targetChapter; i++) {
          if (fileScanner.hasChapter && fileScanner.hasChapter(i)) {
            chapterNumbers.push(i);
          }
        }

        if (chapterNumbers.length > 0) {
          const llmCallerForAnalysis = options.llmCaller || this.llmCaller;
          const analysisTasks = chapterNumbers.map(chapterNum => async () => {
            let needsUpdate = true;
            if (chapterFileManager && chapterFileManager.needsAnalysisUpdate) {
              needsUpdate = await chapterFileManager.needsAnalysisUpdate(chapterNum);
            }
            
            if (!needsUpdate && chapterFileManager) {
              const cached = await chapterFileManager.loadAnalysis(chapterNum);
              if (cached) return cached;
            }

            const content = await fileScanner.readChapterContent(chapterNum);
            if (content && llmCallerForAnalysis) {
              const analysis = await chapterAnalyzer.analyzeChapter(chapterNum, content, llmCallerForAnalysis);
              if (analysis && analysis.success) {
                if (chapterFileManager && chapterFileManager.saveAnalysis) {
                  await chapterFileManager.saveAnalysis(chapterNum, analysis);
                }
                return analysis;
              }
            }
            return null;
          });

          let analyses;
          if (performanceOptimizer && performanceOptimizer.parallel) {
            analyses = await performanceOptimizer.parallel(analysisTasks, { maxConcurrency: 2 });
          } else {
            analyses = [];
            for (const task of analysisTasks) {
              const result = await task();
              if (result) analyses.push(result);
            }
          }

          previousAnalyses = analyses.filter(a => a !== null).sort((a, b) => 
            (a.chapterNumber || 0) - (b.chapterNumber || 0)
          );
        }
      } catch (error) {
        console.warn('分析前章失败，继续规划:', error.message);
      }
    }

    // 2. 规划章节大纲
    const outlineResult = await this.planChapterOutline({
      chapterGoal: userRequest || '续写新章节',
      contextSummary: this.buildContextSummary(worldRules, characters, plotState, previousAnalyses),
      targetChapter: targetChapter || 1,
      previousAnalyses
    }, options);

    // 3. 规划写作意图
    const intentResult = await this.planIntent({
      userRequest: userRequest || '续写新章节',
      context: {
        worldRules,
        characters,
        plotState
      },
      chapterPlan: outlineResult
    }, options);

    // 合并结果
    return {
      outline: outlineResult.outline,
      chapterIntent: intentResult, // 包含 goal, constraints, writing_guidelines
      previousAnalyses,
      scenes: outlineResult.scenes || [],
      requiresUserConfirmation: outlineResult.requiresUserConfirmation !== false
    };
  }

  /**
   * 构建上下文摘要（辅助方法）
   */
  buildContextSummary(worldRules, characters, plotState, previousAnalyses) {
    const parts = [];
    if (previousAnalyses && previousAnalyses.length > 0) {
      parts.push(`已分析 ${previousAnalyses.length} 章`);
    }
    if (worldRules) parts.push('已加载世界观');
    if (characters && characters.length > 0) {
      parts.push(`已加载 ${characters.length} 个角色`);
    }
    return parts.join('；') || '无上下文';
  }
}

module.exports = CognitiveSkills;

