/**
 * Write Skills - 写作相关 Skills
 * 产出正文内容
 */

class WriteSkills {
  constructor(workspaceRoot, dependencies = {}) {
    this.workspaceRoot = workspaceRoot;
    this.memory = dependencies.memory;
    this.rewriter = dependencies.rewriter;
    this.llmCaller = dependencies.llmCaller;
  }

  /**
   * write_chapter - 生成章节内容
   */
  async writeChapter(input, options = {}) {
    const { outline, style, constraints, context = {}, chapterPlan = null } = input;
    
    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      throw new Error('LLM caller not available');
    }

    // 构建写作意图（兼容现有 orchestrator 的格式）
    const intent = {
      goal: constraints.goal || '生成章节内容',
      constraints: constraints,
      writing_guidelines: style || {}
    };

    // 构建上下文（兼容现有格式）
    const fullContext = {
      world_rules: context.worldRules || this.memory?.world?.getRules() || {},
      characters: context.characters || this.memory?.character?.getMainCharacters() || [],
      plot_context: context.plotState || {},
      text_context: context.text_context || {}
    };

    // 构建系统提示词
    let systemPrompt = `你是一个专业的小说写作助手，负责根据写作意图生成高质量的小说文本。

# 核心任务
根据提供的写作意图（Intent）和上下文信息，生成符合要求的小说文本。`;

    if (chapterPlan && chapterPlan.success) {
      systemPrompt += `

# 章节规划要求（重要）
你必须严格按照章节规划生成文本：
1. **场景结构**：按照规划的场景结构组织文本
2. **情绪曲线**：文本的情绪变化必须符合规划的情绪曲线
3. **节奏控制**：文本的节奏必须符合规划的节奏曲线
4. **密度控制**：信息密度必须符合规划的密度曲线`;
    }

    systemPrompt += `

# 写作要求
1. **严格遵守意图约束**：必须遵守 intent.constraints 中的所有禁止和必需项
2. **符合世界观**：所有内容必须符合提供的世界观规则
3. **人物性格一致**：人物言行必须符合其性格设定
4. **保持风格统一**：遵循 intent.writing_guidelines 中的风格要求

# 输出要求（必须严格遵守）
1. **章节标题**：必须以"第X章 标题"的格式开始
2. **直接输出**：直接输出小说文本，不要添加任何标记、说明、解释或注释
3. **文本长度**：必须达到 1000-3000 字，确保内容充实
4. **段落结构**：使用适当的换行，保持段落清晰`;

    // 构建用户提示词
    let userPrompt = '';

    // 设定文件
    if (fullContext.text_context?.settings && fullContext.text_context.settings.length > 0) {
      userPrompt += `# 基础设定（重要：请严格遵守这些设定）\n`;
      for (const setting of fullContext.text_context.settings) {
        userPrompt += `\n## ${setting.file}\n`;
        const maxLength = 5000;
        const content = setting.content.length > maxLength 
          ? setting.content.substring(0, maxLength) + '\n\n[设定文件内容较长，已截断]' 
          : setting.content;
        userPrompt += `${content}\n`;
      }
      userPrompt += '\n⚠️ 以上设定是必须严格遵守的规则。\n\n';
    }

    userPrompt += `# 写作意图
${JSON.stringify(intent, null, 2)}

# 上下文信息
${JSON.stringify({
  world_rules: fullContext.world_rules,
  characters: fullContext.characters,
  plot_context: fullContext.plot_context
}, null, 2)}`;

    // 如果有关节规划，添加章节规划信息
    if (chapterPlan && chapterPlan.success) {
      userPrompt += `

# 章节规划（必须严格遵守）
${JSON.stringify({
  chapter_structure: chapterPlan.chapter_structure,
  emotion_curve: chapterPlan.emotion_curve,
  pacing_curve: chapterPlan.pacing_curve,
  density_curve: chapterPlan.density_curve
}, null, 2)}`;
    }

    userPrompt += `

# 任务
请根据上述意图和上下文${chapterPlan && chapterPlan.success ? '，严格按照章节规划' : ''}，生成符合要求的小说文本。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.5,
        maxTokens: 2000,
        topP: 0.9
      });

      // 处理返回值
      let text = '';
      if (typeof result === 'string') {
        text = result.trim();
      } else if (result && typeof result === 'object') {
        if (result.success === false) {
          throw new Error(result.error || 'LLM 调用失败');
        } else if (result.success === true && result.response) {
          text = typeof result.response === 'string' 
            ? result.response.trim() 
            : String(result.response).trim();
        } else {
          text = String(result.response || result.text || result.content || result).trim();
        }
      } else {
        throw new Error('LLM 返回格式不正确');
      }

      if (!text) {
        throw new Error('生成的文本为空');
      }

      return {
        content: text
      };
    } catch (error) {
      console.error('生成章节失败:', error);
      throw new Error(`生成章节失败: ${error.message}`);
    }
  }

  /**
   * rewrite_selected_text - 重写选中文本
   */
  async rewriteSelectedText(input, options = {}) {
    const { text, rewriteGoal, context = {}, intent = null } = input;
    
    if (!text) {
      throw new Error('Text is required for rewrite');
    }

    if (!this.rewriter) {
      throw new Error('Rewriter not available');
    }

    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      throw new Error('LLM caller not available');
    }

    // 构建重写意图
    const rewriteIntent = intent || {
      goal: rewriteGoal || '优化文本',
      constraints: {}
    };

    // 构建上下文
    const fullContext = {
      world_rules: context.worldRules || this.memory?.world?.getRules() || {},
      characters: context.characters || this.memory?.character?.getMainCharacters() || [],
      text_context: context.text_context || {}
    };

    // 调用重写器（使用空错误列表，因为这是主动重写，不是修复错误）
    const result = await this.rewriter.rewrite(
      text,
      rewriteIntent,
      [], // 无错误列表
      fullContext,
      llmCaller
    );

    return {
      rewrittenText: result.text || text,
      changes: result.changes || [],
      explanation: result.explanation || '重写完成'
    };
  }

  /**
   * rewrite_with_plan - 根据整改方案重写内容
   */
  async rewriteWithPlan(input, options = {}) {
    const { content, rewritePlan, context = {}, intent = {} } = input;
    
    if (!content) {
      throw new Error('Content is required for rewrite');
    }

    if (!rewritePlan) {
      throw new Error('Rewrite plan is required');
    }

    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      throw new Error('LLM caller not available');
    }

    // 构建系统提示词
    const systemPrompt = `你是一个专业的小说修改助手。根据整改方案，对给定的文本进行修改。

# 核心任务
根据整改方案，修改文本中的问题，确保：
1. 修正所有检查发现的问题
2. 保持文本的流畅性和连贯性
3. 不改变文本的核心内容和意图
4. 保持原有的写作风格

# 输出要求
1. **直接输出修改后的文本**，不要添加任何标记、说明或注释
2. 保持章节标题格式（如果有）
3. 保持段落结构清晰
4. 确保修改后的文本符合所有要求`;

    // 构建用户提示词
    let userPrompt = `# 原始文本

${content}

# 整改方案

${rewritePlan}

# 上下文信息（供参考）

${JSON.stringify({
  world_rules: context.worldRules || {},
  characters: context.characters || [],
  plot_context: context.plotState || {}
}, null, 2)}

请根据整改方案修改原始文本。直接输出修改后的完整文本，不要添加任何说明。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 4000
      });

      // 提取文本内容
      let rewrittenContent = '';
      if (typeof result === 'string') {
        rewrittenContent = result;
      } else if (result.success && result.response) {
        rewrittenContent = result.response;
      } else {
        throw new Error('Invalid LLM response');
      }

      // 清理文本（移除可能的标记）
      rewrittenContent = rewrittenContent
        .replace(/```markdown\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/^第\d+章\s*/m, '')
        .trim();

      // 如果原始内容有章节标题，保留它
      const chapterTitleMatch = content.match(/^第\d+章[^\n]*/);
      if (chapterTitleMatch && !rewrittenContent.startsWith('第')) {
        rewrittenContent = chapterTitleMatch[0] + '\n\n' + rewrittenContent;
      }

      return {
        rewrittenContent,
        changes: [{
          type: 'rewrite',
          description: '根据整改方案进行了全面修改'
        }]
      };
    } catch (error) {
      console.error('重写失败:', error);
      throw new Error(`Rewrite failed: ${error.message}`);
    }
  }

  /**
   * rewrite_chapter (合并版) - 合并了 rewrite_with_plan, rewrite_selected_text
   */
  async rewriteChapterMerged(input, options = {}) {
    const { content, rewritePlan, chapterIntent, context, selectedText } = input;
    
    const llmCaller = options.llmCaller || this.llmCaller;
    if (!llmCaller) {
      throw new Error('LLM caller not available');
    }

    // 如果有选中文本，优先重写选中部分
    if (selectedText && selectedText.trim()) {
      const rewriteResult = await this.rewriteSelectedText({
        text: selectedText,
        rewriteGoal: rewritePlan || '优化文本',
        context,
        intent: chapterIntent
      }, options);
      
      // 替换原内容中的选中文本
      const newContent = content.replace(selectedText, rewriteResult.rewrittenText);
      return {
        content: newContent,
        changes: rewriteResult.changes || []
      };
    }

    // 否则使用 rewrite_with_plan（如果有 rewritePlan）
    if (rewritePlan && rewritePlan.trim()) {
      const rewriteResult = await this.rewriteWithPlan({
        content,
        rewritePlan,
        context,
        intent: chapterIntent
      }, options);
      
      return {
        content: rewriteResult.rewrittenContent || content,
        changes: rewriteResult.changes || []
      };
    }

    // 如果没有 rewritePlan，直接返回原内容
    return {
      content,
      changes: []
    };
  }
}

module.exports = WriteSkills;

