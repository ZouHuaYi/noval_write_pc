/**
 * Skill Router - Skill 路由器
 * 根据用户意图和上下文，智能选择正确的 Skill 序列
 */

const skillDefinitions = require('../definitions/skillDefinitions.json');
const logger = require('../../../utils/logger');

class SkillRouter {
  constructor() {
    this.definitions = skillDefinitions.skills;
    this.executionPatterns = this.buildExecutionPatterns();
  }

  /**
   * 构建执行模式（常见的 Skill 执行链）
   */
  buildExecutionPatterns() {
    return {
      // 续写/创建章节的新流程（重构版）
      CONTINUE_OR_CREATE: [
        'load_story_context',
        'scan_chapters',
        'analyze_previous_chapters',
        'plan_chapter_outline',  // 新：大纲规划（需要用户确认）
        // 用户确认后继续
        'plan_intent',
        'write_chapter',
        'check_all',  // 新：整合所有检查
        'generate_rewrite_plan',  // 新：生成整改方案
        'rewrite_with_plan',  // 新：根据整改方案重写
        'save_chapter'
        // 注意：finalize_chapter 和 update_memory 在用户确认应用后执行
      ],
      
      // 重写章节的流程（支持重写循环）
      REWRITE: [
        'load_story_context',
        'load_chapter_content',
        'plan_intent',
        'rewrite_selected_text',
        'check_character_consistency',
        'check_world_rule_violation',
        'update_memory', // 重写模式需要更新记忆
        'save_chapter'
      ],
      
      // 校验章节的流程
      CHECK: [
        'load_story_context',
        'load_chapter_content',
        'check_character_consistency',
        'check_world_rule_violation'
      ],
      
      // 仅规划章节
      PLAN_ONLY: [
        'load_story_context',
        'plan_chapter'
      ],
      
      // 仅重写选中文本
      REWRITE_TEXT: [
        'load_story_context',
        'rewrite_selected_text'
      ]
    };
  }

  /**
   * 根据意图类型选择执行模式
   * @param {string} intentType - 意图类型 (CONTINUE/CREATE/REWRITE/CHECK)
   * @param {Object} context - 上下文信息
   * @returns {Array} Skill 序列
   */
  selectExecutionPattern(intentType, context = {}) {
    const patterns = this.executionPatterns;
    
    switch (intentType) {
      case 'CONTINUE':
      case 'CREATE':
        return patterns.CONTINUE_OR_CREATE;
      
      case 'REWRITE':
        // 如果是重写选中文本，使用简化流程
        if (context.isSelectedText) {
          return patterns.REWRITE_TEXT;
        }
        return patterns.REWRITE;
      
      case 'CHECK':
        return patterns.CHECK;
      
      case 'PLAN':
        return patterns.PLAN_ONLY;
      
      default:
        logger.logAgent('未知意图类型，使用默认流程', { intentType }, 'WARN');
        return patterns.CONTINUE_OR_CREATE;
    }
  }

  /**
   * 智能路由：根据用户请求选择 Skill 序列
   * @param {Object} request - 用户请求
   * @param {Object} context - 当前上下文
   * @returns {Array<Object>} Skill 执行计划 [{ name, input, condition }]
   */
  route(request, context = {}) {
    const intentType = this.analyzeIntent(request);
    const pattern = this.selectExecutionPattern(intentType, context);
    
    // 构建 Skill 执行计划
    const plan = pattern.map(skillName => {
      const skillDef = this.definitions.find(s => s.name === skillName);
      if (!skillDef) {
        logger.logAgent(`Skill 定义未找到: ${skillName}`, {}, 'WARN');
        return null;
      }
      
      return {
        name: skillName,
        input: this.buildSkillInput(skillName, request, context),
        condition: null // 可以添加条件判断
      };
    }).filter(item => item !== null);
    
    logger.logAgent('Skill 路由完成', { 
      intentType,
      pattern: pattern.length,
      plan: plan.length 
    });
    
    return {
      intentType,
      skills: plan,
      pattern
    };
  }

  /**
   * 分析用户意图
   */
  analyzeIntent(request) {
    const userRequest = (request.userRequest || '').toLowerCase();
    
    // 关键词匹配
    if (userRequest.includes('续写') || userRequest.includes('继续') || 
        userRequest.includes('下一章') || userRequest.includes('接着')) {
      return 'CONTINUE';
    }
    
    if (userRequest.includes('重写') || userRequest.includes('改写') || 
        userRequest.includes('修改') || userRequest.includes('优化')) {
      return 'REWRITE';
    }
    
    if (userRequest.includes('校验') || userRequest.includes('检查') || 
        userRequest.includes('一致性') || userRequest.includes('连贯性')) {
      return 'CHECK';
    }
    
    if (userRequest.includes('规划') || userRequest.includes('计划')) {
      return 'PLAN';
    }
    
    // 默认：创建新章节
    return 'CREATE';
  }

  /**
   * 为每个 Skill 构建输入参数
   */
  buildSkillInput(skillName, request, context) {
    const baseInput = {
      novelId: context.workspaceRoot || context.novelId,
      chapterId: context.targetChapter || request.targetChapter,
      chapterNumber: context.targetChapter || request.targetChapter
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
          targetChapter: baseInput.chapterNumber,
          recentCount: 3
        };
      
      case 'plan_chapter':
        return {
          chapterGoal: request.userRequest || '续写新章节',
          contextSummary: context.summary || '',
          targetChapter: baseInput.chapterNumber,
          previousAnalyses: context.previousAnalyses || []
        };
      
      case 'plan_intent':
        return {
          userRequest: request.userRequest || '',
          context: context,
          chapterPlan: context.chapterPlan
        };
      
      case 'write_chapter':
        return {
          outline: context.outline || [],
          style: context.style || {},
          constraints: context.constraints || {},
          context: context,
          chapterPlan: context.chapterPlan
        };
      
      case 'rewrite_selected_text':
        return {
          text: request.selectedText || context.existingContent || '',
          rewriteGoal: request.userRequest || '优化文本',
          context: context,
          intent: context.intent
        };
      
      case 'check_character_consistency':
        return {
          content: context.content || request.content || '',
          characters: context.characters || [],
          context: context
        };
      
      case 'check_world_rule_violation':
        return {
          content: context.content || request.content || '',
          worldRules: context.worldRules || {},
          context: context
        };
      
      case 'check_coherence':
        return {
          content: context.content || request.content || '',
          previousAnalyses: context.previousAnalyses || [],
          chapterPlan: context.chapterPlan
        };
      
      case 'analyze_curves':
        return {
          content: context.content || request.content || '',
          chapterPlan: context.chapterPlan
        };
      
      case 'update_memory':
        return {
          content: context.content || context.finalContent || '',
          request: request,
          context: context,
          replaceChapter: request.replaceChapter || context.replaceChapter
        };
      
      case 'save_chapter':
        return {
          chapterId: baseInput.chapterId,
          content: context.finalContent || context.content || '',
          filePath: request.targetFile
        };
      
      case 'finalize_chapter':
        return {
          content: context.content || '',
          checks: context.checkResult || {},
          chapterNumber: baseInput.chapterNumber
        };
      
      default:
        return baseInput;
    }
  }

  /**
   * 验证 Skill 序列的依赖关系
   */
  validateSkillSequence(skills) {
    const executed = new Set();
    const issues = [];
    
    for (const skill of skills) {
      const skillDef = this.definitions.find(s => s.name === skill.name);
      if (!skillDef) {
        issues.push(`未找到 Skill 定义: ${skill.name}`);
        continue;
      }
      
      // 检查依赖（简化版，可以根据实际需求扩展）
      // 例如：write_chapter 需要 plan_chapter 的输出
      if (skill.name === 'write_chapter' && !executed.has('plan_chapter')) {
        issues.push(`write_chapter 需要 plan_chapter 先执行`);
      }
      
      executed.add(skill.name);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = SkillRouter;

