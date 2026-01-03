/**
 * AgentState - Agent 状态管理（精简版）
 * 统一的"共享记忆板"，适配 9 个核心 Skill
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
    this.targetChapter = null;

    // 规划数据
    this.outline = null;
    this.chapterIntent = null; // 合并了原来的 intent
    this.previousAnalyses = null;

    // 内容数据（使用嵌套结构）
    this.chapters = {
      draft: null,
      final: null
    };

    // 检查结果
    this.checkResults = null; // 统一为一个对象

    // 重写相关
    this.rewritePlan = null;

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
        // 即使数据为空，也更新状态（表示已加载）
        // 这样可以避免 hasState 认为状态未加载而重复执行
        this.worldRules = skillOutput.worldRules !== undefined ? skillOutput.worldRules : null;
        this.characters = skillOutput.characters !== undefined ? skillOutput.characters : null;
        this.plotState = skillOutput.plotState !== undefined ? skillOutput.plotState : null;
        this.foreshadows = skillOutput.foreshadows !== undefined ? skillOutput.foreshadows : null;
        break;

      case 'scan_chapters':
        this.scanResult = skillOutput;
        if (skillOutput.latestChapter) {
          this.targetChapter = skillOutput.latestChapter + 1;
        }
        break;

      case 'plan_chapter':
        // 合并了 plan_intent, plan_chapter_outline, analyze_previous_chapters
        this.outline = skillOutput.outline;
        this.chapterIntent = skillOutput.chapterIntent;
        this.previousAnalyses = skillOutput.previousAnalyses || [];
        break;

      case 'write_chapter':
        this.chapters.draft = skillOutput.content;
        break;

      case 'rewrite_chapter':
        // 合并了 rewrite_with_plan, rewrite_selected_text
        this.chapters.draft = skillOutput.content;
        break;

      case 'check_chapter':
        // 合并了所有检查 Skill
        this.checkResults = {
          overallStatus: skillOutput.overallStatus,
          characterIssues: skillOutput.characterIssues || [],
          worldRuleIssues: skillOutput.worldRuleIssues || [],
          coherenceIssues: skillOutput.coherenceIssues || [],
          summary: skillOutput.summary
        };
        break;

      case 'generate_rewrite_plan':
        this.rewritePlan = skillOutput.rewritePlan;
        break;

      case 'finalize_chapter':
        this.chapters.final = skillOutput.finalContent;
        break;

      case 'update_story_memory':
        // 合并了 update_memory
        // 注意：update_story_memory 只更新 memoryUpdated 状态
        // worldRules/characters/plotState 的更新是副作用，不影响 Planner 规划
        this.memoryUpdated = skillOutput.success || false;
        // 不更新 worldRules/characters/plotState，因为这些是副作用，不应该影响后续规划
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

      case 'scan_chapters':
        return {};

      case 'plan_chapter':
        // 确保 targetChapter 有值，如果没有则从 userRequest 中提取
        let targetChapter = this.targetChapter || baseInput.chapterNumber;
        if (!targetChapter && request.userRequest) {
          // 从 userRequest 中提取章节号
          const match = request.userRequest.match(/第\s*(\d+)(?:[-到]\s*(\d+))?\s*章/);
          if (match) {
            targetChapter = parseInt(match[1]);
          }
        }
        
        return {
          targetChapter: targetChapter || 1, // 如果还是没有，使用默认值 1
          userRequest: request.userRequest || '续写新章节',
          worldRules: this.worldRules || {},
          characters: this.characters || [],
          plotState: this.plotState || {},
          recentCount: request.recentCount || 3
        };

      case 'write_chapter':
        return {
          outline: this.outline || '',
          chapterIntent: this.chapterIntent || {},
          worldRules: this.worldRules || {},
          characters: this.characters || [],
          plotState: this.plotState || {},
          previousAnalyses: this.previousAnalyses || [],
          rewritePlan: this.rewritePlan || null,
          context: {
            worldRules: this.worldRules || {},
            characters: this.characters || [],
            plotState: this.plotState || {},
            text_context: {} // 如果需要，可以从其他地方获取
          }
        };

      case 'check_chapter':
        return {
          content: this.chapters.draft || '',
          characters: this.characters || [],
          worldRules: this.worldRules || {},
          previousAnalyses: this.previousAnalyses || [],
          context: this.buildContextForIntent()
        };

      case 'generate_rewrite_plan':
        return {
          content: this.chapters.draft || '',
          checkResults: this.checkResults || {},
          context: this.buildContextForIntent()
        };

      case 'rewrite_chapter':
        return {
          content: this.chapters.draft || '',
          rewritePlan: this.rewritePlan || '',
          chapterIntent: this.chapterIntent || {},
          context: this.buildContextForIntent(),
          selectedText: request.selectedText || null
        };

      case 'finalize_chapter':
        return {
          content: this.chapters.draft || '',
          checkResults: this.checkResults || {},
          chapterNumber: this.targetChapter || baseInput.chapterNumber
        };

      case 'update_story_memory':
        return {
          content: this.chapters.final || '',
          request: request,
          context: this.buildContextForIntent(),
          replaceChapter: request.replaceChapter
        };

      default:
        return baseInput;
    }
  }

  /**
   * 获取当前内容（统一的内容获取逻辑）
   */
  getContent() {
    return this.chapters.final || 
           this.chapters.draft || 
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
    if (this.chapters.final && this.memoryUpdated) {
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
