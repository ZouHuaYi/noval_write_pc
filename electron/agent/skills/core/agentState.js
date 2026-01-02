/**
 * AgentState - Agent 状态管理
 * 统一的"共享记忆板"，所有 Skill 的输入输出都通过这里
 */

class AgentState {
  constructor() {
    // 上下文数据
    this.worldRules = null;
    this.characters = null;
    this.plotState = null;
    this.foreshadows = null;

    // 章节数据
    this.scanResult = null;
    this.previousAnalyses = null;
    this.targetChapter = null;

    // 规划数据
    this.outline = null;
    this.chapterPlan = null;
    this.intent = null;

    // 内容数据
    this.chapterDraft = null;
    this.finalContent = null;
    this.rewrittenContent = null;

    // 检查结果
    this.checkResults = {
      character: null,
      world: null,
      coherence: null,
      overall: null
    };

    // 重写相关
    this.rewritePlan = null;
    this.rewritePriority = null;

    // 其他
    this.memoryUpdated = false;
  }

  /**
   * 更新状态（从 Skill 输出映射）
   */
  updateFromSkillOutput(skillName, skillOutput) {
    if (!skillOutput) return;

    switch (skillName) {
      case 'load_story_context':
        this.worldRules = skillOutput.worldRules;
        this.characters = skillOutput.characters;
        this.plotState = skillOutput.plotState;
        this.foreshadows = skillOutput.foreshadows;
        break;

      case 'scan_chapters':
        this.scanResult = skillOutput;
        if (skillOutput.latestChapter) {
          this.targetChapter = skillOutput.latestChapter + 1;
        }
        break;

      case 'analyze_previous_chapters':
        this.previousAnalyses = skillOutput.analyses || [];
        break;

      case 'load_chapter_content':
        this.chapterDraft = skillOutput.content;
        this.targetChapter = skillOutput.chapter;
        break;

      case 'plan_chapter_outline':
        this.outline = skillOutput.outline;
        this.chapterPlan = skillOutput;
        break;

      case 'plan_intent':
        this.intent = skillOutput;
        break;

      case 'write_chapter':
        this.chapterDraft = skillOutput.content;
        break;

      case 'rewrite_selected_text':
        this.rewrittenContent = skillOutput.rewrittenText;
        break;

      case 'rewrite_with_plan':
        this.rewrittenContent = skillOutput.rewrittenContent;
        break;

      case 'check_character_consistency':
        this.checkResults.character = skillOutput;
        break;

      case 'check_world_rule_violation':
        this.checkResults.world = skillOutput;
        break;

      case 'check_coherence':
        this.checkResults.coherence = skillOutput;
        break;

      case 'check_all':
        this.checkResults.overall = skillOutput;
        break;

      case 'generate_rewrite_plan':
        this.rewritePlan = skillOutput.rewritePlan;
        this.rewritePriority = skillOutput.priority;
        break;

      case 'update_memory':
        this.memoryUpdated = skillOutput.success || false;
        break;

      case 'finalize_chapter':
        this.finalContent = skillOutput.finalContent;
        break;
    }
  }

  /**
   * 构建 Skill 输入（从 State 提取）
   */
  buildSkillInput(skillName, request = {}) {
    const baseInput = {
      novelId: request.workspaceRoot || request.novelId,
      chapterId: this.targetChapter || request.targetChapter,
      chapterNumber: this.targetChapter || request.targetChapter
    };

    switch (skillName) {
      case 'load_story_context':
        return {
          novelId: baseInput.novelId,
          include: ['world', 'characters', 'plot', 'foreshadows']
        };

      case 'load_chapter_content':
        return {
          chapterId: baseInput.chapterId || request.targetFile
        };

      case 'scan_chapters':
        return {};

      case 'analyze_previous_chapters':
        return {
          targetChapter: this.targetChapter || baseInput.chapterNumber || 1,
          recentCount: request.recentCount || 3
        };

      case 'plan_chapter_outline':
        return {
          chapterGoal: request.userRequest || '续写新章节',
          contextSummary: this.buildContextSummary(),
          targetChapter: this.targetChapter || baseInput.chapterNumber || 1,
          previousAnalyses: this.previousAnalyses || []
        };

      case 'plan_intent':
        return {
          userRequest: request.userRequest || '',
          context: this.buildContextForIntent(),
          chapterPlan: this.chapterPlan
        };

      case 'write_chapter':
        return {
          outline: this.outline || [],
          style: this.intent?.writing_guidelines || {},
          constraints: this.intent?.constraints || {},
          context: this.buildContextForIntent(),
          chapterPlan: this.chapterPlan
        };

      case 'rewrite_selected_text':
        return {
          text: request.selectedText || this.chapterDraft || '',
          rewriteGoal: request.userRequest || '优化文本',
          context: this.buildContextForIntent(),
          intent: this.intent
        };

      case 'check_character_consistency':
        return {
          content: this.getContent(),
          characters: this.characters || [],
          context: this.buildContextForIntent()
        };

      case 'check_world_rule_violation':
        return {
          content: this.getContent(),
          worldRules: this.worldRules || {},
          context: this.buildContextForIntent()
        };

      case 'check_coherence':
        return {
          content: this.getContent(),
          previousAnalyses: this.previousAnalyses || [],
          chapterPlan: this.chapterPlan
        };

      case 'check_all':
        return {
          content: this.getContent(),
          characters: this.characters || [],
          worldRules: this.worldRules || {},
          context: this.buildContextForIntent()
        };

      case 'generate_rewrite_plan':
        return {
          content: this.getContent(),
          checkResult: this.checkResults.overall || {},
          context: this.buildContextForIntent()
        };

      case 'rewrite_with_plan':
        return {
          content: this.getContent(),
          rewritePlan: this.rewritePlan || '',
          context: this.buildContextForIntent(),
          intent: this.intent || {}
        };

      case 'save_chapter':
        return {
          chapterId: baseInput.chapterId || baseInput.chapterNumber,
          content: this.getContent(),
          filePath: request.targetFile
        };

      case 'update_memory':
        return {
          content: this.getContent(),
          request: request,
          context: this.buildContextForIntent(),
          replaceChapter: request.replaceChapter
        };

      case 'finalize_chapter':
        return {
          content: this.getContent(),
          checks: this.checkResults.overall || {},
          chapterNumber: this.targetChapter || baseInput.chapterNumber
        };

      default:
        return baseInput;
    }
  }

  /**
   * 获取当前内容（统一的内容获取逻辑）
   */
  getContent() {
    return this.finalContent || 
           this.rewrittenContent || 
           this.chapterDraft || 
           '';
  }

  /**
   * 构建上下文摘要（用于规划）
   */
  buildContextSummary() {
    const parts = [];
    if (this.previousAnalyses && this.previousAnalyses.length > 0) {
      parts.push(`已分析 ${this.previousAnalyses.length} 章`);
    }
    if (this.worldRules) parts.push('已加载世界观');
    if (this.characters && this.characters.length > 0) {
      parts.push(`已加载 ${this.characters.length} 个角色`);
    }
    return parts.join('；') || '无上下文';
  }

  /**
   * 构建完整上下文（用于 Skill 输入）
   */
  buildContextForIntent() {
    return {
      worldRules: this.worldRules,
      characters: this.characters,
      plotState: this.plotState,
      foreshadows: this.foreshadows,
      previousAnalyses: this.previousAnalyses,
      scanResult: this.scanResult,
      targetChapter: this.targetChapter
    };
  }

  /**
   * 判断是否达到终止状态
   */
  isTerminalState() {
    // 如果已有最终内容且已保存，认为任务完成
    if (this.finalContent && this.memoryUpdated) {
      return true;
    }
    return false;
  }

  /**
   * 克隆状态（用于序列化和恢复）
   */
  clone() {
    const cloned = new AgentState();
    // 使用 JSON 序列化/反序列化来深度克隆
    const serialized = JSON.parse(JSON.stringify(this));
    Object.assign(cloned, serialized);
    return cloned;
  }

  /**
   * 从序列化数据恢复状态
   */
  static fromSerialized(data) {
    const state = new AgentState();
    if (data) {
      Object.assign(state, data);
    }
    return state;
  }
}

module.exports = AgentState;

