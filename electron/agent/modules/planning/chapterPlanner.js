/**
 * Chapter Planner - 章节级规划器
 * 规划章节整体结构、情绪曲线、节奏曲线、密度曲线
 * 支持续写模式：基于前章状态规划新章节
 */

class ChapterPlanner {
  constructor(memoryManager = null) {
    this.systemPrompt = this.buildSystemPrompt();
    this.memoryManager = memoryManager; // 记忆管理器
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个【小说章节规划程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符

你必须且只能在 <json> 和 </json> 之间输出内容。

# 核心任务
规划章节的整体结构、情绪曲线、节奏曲线、密度曲线和连贯性连接点。

# 输出结构
\`\`\`json
{
  "chapter_structure": {
    "type": "setup" | "conflict" | "climax" | "resolution",
    "total_scenes": 5,
    "scenes": [
      {
        "id": "scene_1",
        "type": "setup",
        "purpose": "引入冲突",
        "pacing": "medium",
        "emotion": "tension",
        "density": "medium",
        "word_count": 400,
        "position": 0.2
      }
    ],
    "plot_beats": [
      {
        "beat": "inciting_incident",
        "description": "主角发现异常",
        "position": 0.3
      }
    ]
  },
  "emotion_curve": {
    "start": 0.3,
    "peak": 0.8,
    "end": 0.5,
    "points": [
      {"position": 0.0, "emotion": 0.3, "type": "tension"},
      {"position": 0.6, "emotion": 0.8, "type": "climax"},
      {"position": 1.0, "emotion": 0.5, "type": "resolution"}
    ]
  },
  "pacing_curve": {
    "overall": "fast",
    "variations": [
      {"position": 0.0, "pacing": "medium"},
      {"position": 0.4, "pacing": "fast"},
      {"position": 0.8, "pacing": "slow"}
    ]
  },
  "density_curve": {
    "overall": "medium",
    "variations": [
      {"position": 0.0, "density": "low"},
      {"position": 0.5, "density": "high"},
      {"position": 1.0, "density": "medium"}
    ]
  },
  "coherence_links": {
    "previous_chapter": {
      "connection_points": [
        "延续上一章的悬念",
        "回应上一章的伏笔"
      ]
    },
    "next_chapter": {
      "setup_points": [
        "埋下新的伏笔",
        "设置新的悬念"
      ]
    }
  }
}
\`\`\`
`;

  }

  /**
   * 规划新章节（续写模式）
   * @param {number} targetChapter - 目标章节编号
   * @param {Array} previousAnalyses - 前章分析结果
   * @param {Object} userRequest - 用户请求
   * @param {Object} context - 记忆上下文
   * @param {Function} llmCaller - LLM 调用函数
   */
  async planChapterForContinuation(targetChapter, previousAnalyses, userRequest, context, llmCaller) {
    try {
      console.log(`📋 开始规划第 ${targetChapter} 章（续写模式）...`);

      // 分析前章状态
      const previousState = this.analyzePreviousChapters(previousAnalyses);

      // 确定章节类型
      const chapterType = this.determineChapterType(previousState, userRequest);

      // 生成规划（使用 LLM 或规则）
      let plan = null;
      if (llmCaller) {
        plan = await this.planWithLLM(targetChapter, previousState, chapterType, userRequest, context, llmCaller);
      } else {
        plan = this.planWithRules(targetChapter, previousState, chapterType, userRequest);
      }

      // 从记忆系统获取当前状态并调整规划（新增）
      if (this.memoryManager) {
        const currentStates = await this.extractCurrentStates();
        plan.current_states = currentStates;
        
        // 基于当前状态调整规划
        if (plan.chapter_structure && plan.chapter_structure.scenes) {
          plan.chapter_structure.scenes = this.adjustScenesBasedOnStates(
            plan.chapter_structure.scenes,
            currentStates
          );
        }
      }

      console.log(`✅ 章节规划完成：类型=${plan.chapter_structure.type}, 情绪=${plan.emotion_curve.end.toFixed(2)}`);

      return {
        success: true,
        chapterNumber: targetChapter,
        ...plan
      };

    } catch (error) {
      console.error(`❌ 规划章节失败: 第${targetChapter}章`, error);
      return {
        success: false,
        chapterNumber: targetChapter,
        error: error.message
      };
    }
  }

  /**
   * 分析前章状态
   */
  analyzePreviousChapters(previousAnalyses) {
    if (!previousAnalyses || previousAnalyses.length === 0) {
      return {
        ending_emotion: 0.5,
        ending_pacing: 'medium',
        ending_density: 'medium',
        ending_events: [],
        cliffhanger: '',
        trend: 'stable'
      };
    }

    const lastChapter = previousAnalyses[previousAnalyses.length - 1];
    const ending = lastChapter.coherence_points?.ending || {};

    // 分析趋势
    let trend = 'stable';
    if (previousAnalyses.length >= 2) {
      const prev = previousAnalyses[previousAnalyses.length - 2];
      const curr = lastChapter;
      const prevEmotion = prev.emotion_curve?.end || 0.5;
      const currEmotion = curr.emotion_curve?.end || 0.5;
      
      if (currEmotion > prevEmotion + 0.2) {
        trend = 'rising';
      } else if (currEmotion < prevEmotion - 0.2) {
        trend = 'falling';
      }
    }

    return {
      ending_emotion: ending.emotion || lastChapter.emotion_curve?.end || 0.5,
      ending_pacing: ending.pacing || lastChapter.pacing_curve?.overall || 'medium',
      ending_density: lastChapter.density_curve?.overall || 'medium',
      ending_events: ending.events || [],
      cliffhanger: ending.cliffhanger || '',
      trend,
      lastChapterType: lastChapter.structure?.type || 'unknown'
    };
  }

  /**
   * 确定章节类型
   */
  determineChapterType(previousState, userRequest) {
    // 基于前章状态和用户请求确定类型
    const request = userRequest?.userRequest || '';
    
    // 关键词匹配
    if (request.includes('高潮') || request.includes('突破') || request.includes('关键')) {
      return 'climax';
    }
    if (request.includes('冲突') || request.includes('战斗') || request.includes('对抗')) {
      return 'conflict';
    }
    if (request.includes('结束') || request.includes('解决') || request.includes('完成')) {
      return 'resolution';
    }

    // 基于前章状态推断
    if (previousState.trend === 'rising' && previousState.ending_emotion > 0.7) {
      return 'climax'; // 情绪上升，可能是高潮
    }
    if (previousState.lastChapterType === 'climax') {
      return 'resolution'; // 前章是高潮，这章可能是解决
    }
    if (previousState.cliffhanger) {
      return 'conflict'; // 有悬念，可能是冲突
    }

    return 'conflict'; // 默认
  }

  /**
   * 使用 LLM 规划
   */
  async planWithLLM(targetChapter, previousState, chapterType, userRequest, context, llmCaller) {
    const userPrompt = this.buildPlanningPrompt(targetChapter, previousState, chapterType, userRequest, context);

    const result = await llmCaller({
      systemPrompt: this.systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 3000
    });

    if (!result.success || !result.response) {
      throw new Error('LLM 调用失败');
    }

    const plan = this.parsePlanningResult(result.response);
    
    // 确保连贯性连接点
    plan.coherence_links = this.ensureCoherenceLinks(plan, previousState);

    return plan;
  }

  /**
   * 使用规则规划（不依赖 LLM）
   */
  planWithRules(targetChapter, previousState, chapterType, userRequest) {
    // 生成情绪曲线（从前章结尾开始）
    const emotionCurve = this.generateEmotionCurve(chapterType, previousState.ending_emotion);

    // 生成节奏曲线（考虑前章节奏）
    const pacingCurve = this.generatePacingCurve(chapterType, previousState.ending_pacing);

    // 生成密度曲线
    const densityCurve = this.generateDensityCurve(chapterType);

    // 生成场景结构
    const scenes = this.generateScenes(chapterType);

    // 设计连贯性连接点
    const coherenceLinks = this.designCoherenceLinks(previousState, targetChapter);

    return {
      chapter_structure: {
        type: chapterType,
        total_scenes: scenes.length,
        scenes,
        plot_beats: this.generatePlotBeats(chapterType)
      },
      emotion_curve: emotionCurve,
      pacing_curve: pacingCurve,
      density_curve: densityCurve,
      coherence_links: coherenceLinks
    };
  }

  /**
   * 生成情绪曲线
   */
  generateEmotionCurve(chapterType, startEmotion) {
    const curves = {
      setup: { start: startEmotion, peak: startEmotion + 0.2, end: startEmotion + 0.1 },
      conflict: { start: startEmotion, peak: startEmotion + 0.3, end: startEmotion + 0.2 },
      climax: { start: startEmotion, peak: Math.min(0.9, startEmotion + 0.4), end: startEmotion + 0.1 },
      resolution: { start: startEmotion, peak: startEmotion + 0.1, end: Math.max(0.3, startEmotion - 0.2) }
    };

    const curve = curves[chapterType] || curves.conflict;

    return {
      start: Math.max(0, Math.min(1, curve.start)),
      peak: Math.max(0, Math.min(1, curve.peak)),
      end: Math.max(0, Math.min(1, curve.end)),
      points: [
        { position: 0.0, emotion: curve.start, type: 'start' },
        { position: 0.5, emotion: curve.peak, type: 'peak' },
        { position: 1.0, emotion: curve.end, type: 'end' }
      ]
    };
  }

  /**
   * 生成节奏曲线
   */
  generatePacingCurve(chapterType, previousPacing) {
    const pacingMap = {
      slow: 0,
      medium: 1,
      fast: 2
    };

    const pacingOrder = ['slow', 'medium', 'fast'];
    const prevIndex = pacingMap[previousPacing] || 1;

    let overall = 'medium';
    if (chapterType === 'climax' || chapterType === 'conflict') {
      overall = 'fast';
    } else if (chapterType === 'resolution') {
      overall = 'slow';
    }

    // 确保节奏有变化
    const variations = [
      { position: 0.0, pacing: previousPacing },
      { position: 0.4, pacing: overall },
      { position: 0.8, pacing: overall === 'fast' ? 'medium' : 'slow' }
    ];

    return {
      overall,
      variations
    };
  }

  /**
   * 生成密度曲线
   */
  generateDensityCurve(chapterType) {
    let overall = 'medium';
    if (chapterType === 'climax') {
      overall = 'high';
    } else if (chapterType === 'resolution') {
      overall = 'low';
    }

    return {
      overall,
      variations: [
        { position: 0.0, density: 'low' },
        { position: 0.5, density: overall },
        { position: 1.0, density: 'medium' }
      ]
    };
  }

  /**
   * 生成场景结构
   */
  generateScenes(chapterType) {
    const sceneTemplates = {
      setup: [
        { type: 'setup', purpose: '建立场景', pacing: 'medium', emotion: 'neutral', word_count: 300 },
        { type: 'setup', purpose: '引入冲突', pacing: 'medium', emotion: 'tension', word_count: 400 }
      ],
      conflict: [
        { type: 'conflict', purpose: '冲突开始', pacing: 'fast', emotion: 'tension', word_count: 400 },
        { type: 'conflict', purpose: '冲突升级', pacing: 'fast', emotion: 'excitement', word_count: 500 },
        { type: 'conflict', purpose: '冲突高潮', pacing: 'fast', emotion: 'excitement', word_count: 400 }
      ],
      climax: [
        { type: 'climax', purpose: '高潮前奏', pacing: 'fast', emotion: 'tension', word_count: 400 },
        { type: 'climax', purpose: '高潮爆发', pacing: 'fast', emotion: 'excitement', word_count: 600 },
        { type: 'climax', purpose: '高潮结束', pacing: 'medium', emotion: 'relief', word_count: 300 }
      ],
      resolution: [
        { type: 'resolution', purpose: '解决冲突', pacing: 'slow', emotion: 'relief', word_count: 400 },
        { type: 'resolution', purpose: '总结收尾', pacing: 'slow', emotion: 'calm', word_count: 300 }
      ]
    };

    const scenes = sceneTemplates[chapterType] || sceneTemplates.conflict;
    
    return scenes.map((scene, index) => ({
      id: `scene_${index + 1}`,
      ...scene,
      density: 'medium',
      position: index / scenes.length
    }));
  }

  /**
   * 生成情节节点
   */
  generatePlotBeats(chapterType) {
    const beatTemplates = {
      setup: [
        { beat: 'inciting_incident', description: '引入事件', position: 0.3 }
      ],
      conflict: [
        { beat: 'rising_action', description: '冲突升级', position: 0.4 },
        { beat: 'confrontation', description: '对抗', position: 0.7 }
      ],
      climax: [
        { beat: 'climax', description: '高潮', position: 0.5 }
      ],
      resolution: [
        { beat: 'resolution', description: '解决', position: 0.6 }
      ]
    };

    return beatTemplates[chapterType] || beatTemplates.conflict;
  }

  /**
   * 设计连贯性连接点
   */
  designCoherenceLinks(previousState, targetChapter) {
    const connectionPoints = [];
    
    if (previousState.cliffhanger) {
      connectionPoints.push(`回应上一章的悬念：${previousState.cliffhanger}`);
    }
    
    if (previousState.ending_events && previousState.ending_events.length > 0) {
      connectionPoints.push(`延续上一章的事件：${previousState.ending_events[0]}`);
    }

    return {
      previous_chapter: {
        connection_points: connectionPoints
      },
      next_chapter: {
        setup_points: [
          '设置新的悬念',
          '埋下新的伏笔'
        ]
      }
    };
  }

  /**
   * 确保连贯性连接点
   */
  ensureCoherenceLinks(plan, previousState) {
    if (!plan.coherence_links) {
      return this.designCoherenceLinks(previousState, plan.chapterNumber);
    }

    // 补充缺失的连接点
    if (!plan.coherence_links.previous_chapter?.connection_points) {
      plan.coherence_links.previous_chapter = {
        connection_points: this.designCoherenceLinks(previousState, plan.chapterNumber).previous_chapter.connection_points
      };
    }

    return plan.coherence_links;
  }

  /**
   * 构建规划提示词
   */
  buildPlanningPrompt(targetChapter, previousState, chapterType, userRequest, context) {
    let prompt = `# 规划第 ${targetChapter} 章\n\n`;

    prompt += `# 用户需求\n${userRequest?.userRequest || '续写新章节'}\n\n`;

    prompt += `# 前章状态\n`;
    prompt += `- 结尾情绪：${previousState.ending_emotion.toFixed(2)}\n`;
    prompt += `- 结尾节奏：${previousState.ending_pacing}\n`;
    prompt += `- 结尾密度：${previousState.ending_density}\n`;
    if (previousState.cliffhanger) {
      prompt += `- 悬念：${previousState.cliffhanger}\n`;
    }
    prompt += `- 趋势：${previousState.trend}\n\n`;

    prompt += `# 章节类型\n${chapterType}\n\n`;

    if (context.characters && context.characters.length > 0) {
      prompt += `# 主要角色\n`;
      for (const char of context.characters.slice(0, 3)) {
        prompt += `- ${char.name}: ${char.role || '角色'}\n`;
      }
      prompt += '\n';
    }

    prompt += `# 任务\n请规划第 ${targetChapter} 章的整体结构、情绪曲线、节奏曲线和连贯性连接点。\n`;
    prompt += `确保与前章自然衔接，情绪曲线从前章结尾（${previousState.ending_emotion.toFixed(2)}）开始。\n`;
    prompt += `返回纯 JSON 格式。`;

    return prompt;
  }

  /**
   * 解析规划结果
   */
  parsePlanningResult(response) {
    const { safeParseJSON } = require('../../../utils/jsonParser');
    
    try {
      const result = safeParseJSON(response, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });

      // 验证必需字段
      if (!result.chapter_structure) {
        throw new Error('缺少 chapter_structure');
      }
      if (!result.emotion_curve) {
        throw new Error('缺少 emotion_curve');
      }
      if (!result.pacing_curve) {
        throw new Error('缺少 pacing_curve');
      }

      return result;
    } catch (e) {
      console.error('解析规划结果失败:', e.message);
      throw new Error('解析规划结果失败');
    }
  }

  /**
   * 从记忆系统提取当前状态（新增）
   */
  async extractCurrentStates() {
    if (!this.memoryManager) {
      return null;
    }

    try {
      const characters = this.memoryManager.character.getAllCharacters();
      const plot = this.memoryManager.plot.getData();
      const foreshadows = this.memoryManager.foreshadow.getData();

      return {
        characters: characters.map(char => ({
          name: char.name,
          role: char.role,
          state: char.current_state,
          state_history: char.state_history ? char.state_history.slice(-3) : [] // 最近3条历史
        })),
        plot: {
          current_stage: plot.main_plotline?.current_stage,
          pending_goals: plot.main_plotline?.pending_goals || []
        },
        foreshadows: {
          pending: foreshadows.foreshadows?.filter(f => f.status === 'pending') || []
        }
      };
    } catch (error) {
      console.error('提取当前状态失败:', error);
      return null;
    }
  }

  /**
   * 基于状态调整场景（新增）
   */
  adjustScenesBasedOnStates(scenes, currentStates) {
    if (!currentStates || !scenes) {
      return scenes;
    }

    // 如果有待解决的伏笔，在场景中考虑
    if (currentStates.foreshadows && currentStates.foreshadows.pending.length > 0) {
      // 可以在场景中添加伏笔揭示的机会
      for (let i = 0; i < scenes.length; i++) {
        if (i === Math.floor(scenes.length / 2)) {
          // 在中间场景添加伏笔相关的内容
          scenes[i].purpose = scenes[i].purpose + '（可考虑揭示伏笔）';
        }
      }
    }

    // 如果有待完成的目标，在场景中考虑
    if (currentStates.plot && currentStates.plot.pending_goals.length > 0) {
      const goal = currentStates.plot.pending_goals[0];
      if (scenes.length > 0) {
        scenes[0].purpose = `推进目标：${goal} - ${scenes[0].purpose}`;
      }
    }

    return scenes;
  }
}

module.exports = ChapterPlanner;

