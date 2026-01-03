/**
 * Skill Executor - Skill 执行器
 * 统一的 Skill 执行接口，负责调用具体的 Skill 实现
 */

const skillDefinitions = require('../definitions/skillDefinitions.json');
const ContextSkills = require('../impl/contextSkills');
const CognitiveSkills = require('../impl/cognitiveSkills');
const WriteSkills = require('../impl/writeSkills');
const CheckSkills = require('../impl/checkSkills');
const ActionSkills = require('../impl/actionSkills');
const logger = require('../../../utils/logger');

class SkillExecutor {
  constructor(workspaceRoot, dependencies = {}) {
    this.workspaceRoot = workspaceRoot;
    this.definitions = skillDefinitions.skills;
    this.skillMap = new Map();
    
    // 初始化各个 Skill 实现
    this.contextSkills = new ContextSkills(workspaceRoot, dependencies);
    this.cognitiveSkills = new CognitiveSkills(workspaceRoot, dependencies);
    this.writeSkills = new WriteSkills(workspaceRoot, dependencies);
    this.checkSkills = new CheckSkills(workspaceRoot, dependencies);
    this.actionSkills = new ActionSkills(workspaceRoot, dependencies);
    
    // 保存依赖（用于新 Skill）
    this.dependencies = dependencies;
    
    // 构建 Skill 映射
    this.buildSkillMap();
  }

  /**
   * 构建 Skill 映射（精简版：9 个核心 Skill）
   */
  buildSkillMap() {
    // Context Skills (2 个)
    this.skillMap.set('load_story_context', this.contextSkills.loadStoryContext.bind(this.contextSkills));
    this.skillMap.set('scan_chapters', this.contextSkills.scanChapters.bind(this.contextSkills));
    
    // Cognitive Skills (2 个)
    // plan_chapter 合并了 plan_intent, plan_chapter_outline, analyze_previous_chapters
    this.skillMap.set('plan_chapter', this.cognitiveSkills.planChapterMerged.bind(this.cognitiveSkills));
    this.skillMap.set('generate_rewrite_plan', this.cognitiveSkills.generateRewritePlan.bind(this.cognitiveSkills));
    
    // Write Skills (2 个)
    this.skillMap.set('write_chapter', this.writeSkills.writeChapter.bind(this.writeSkills));
    // rewrite_chapter 合并了 rewrite_with_plan, rewrite_selected_text
    this.skillMap.set('rewrite_chapter', this.writeSkills.rewriteChapterMerged.bind(this.writeSkills));
    
    // Check Skills (2 个)
    // check_chapter 合并了 check_character_consistency, check_world_rule_violation, check_coherence, check_all
    this.skillMap.set('check_chapter', this.checkSkills.checkChapterMerged.bind(this.checkSkills));
    this.skillMap.set('finalize_chapter', this.actionSkills.finalizeChapter.bind(this.actionSkills));
    
    // Action Skills (1 个)
    // update_story_memory 合并了 update_memory
    this.skillMap.set('update_story_memory', this.actionSkills.updateStoryMemoryMerged.bind(this.actionSkills));
  }

  /**
   * 获取 Skill 定义
   */
  getSkillDefinition(skillName) {
    return this.definitions.find(s => s.name === skillName);
  }

  /**
   * 验证输入参数
   */
  validateInput(skillName, input) {
    const definition = this.getSkillDefinition(skillName);
    if (!definition) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const schema = definition.inputSchema;
    const required = schema.required || [];
    
    // 检查必需参数
    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        throw new Error(`Missing required parameter: ${field}`);
      }
    }

    return true;
  }

  /**
   * 执行 Skill
   * @param {string} skillName - Skill 名称
   * @param {Object} input - 输入参数
   * @param {Object} options - 执行选项（如 llmCaller）
   * @returns {Promise<Object>} Skill 执行结果
   */
  async execute(skillName, input, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.logAgent(`执行 Skill: ${skillName}`, { input: this.sanitizeInput(input) });
      
      // 验证输入
      this.validateInput(skillName, input);
      
      // 获取 Skill 实现
      const skillImpl = this.skillMap.get(skillName);
      if (!skillImpl) {
        throw new Error(`Skill implementation not found: ${skillName}`);
      }
      
      // 执行 Skill
      const result = await skillImpl(input, options);
      
      const duration = Date.now() - startTime;
      logger.logAgent(`Skill 执行完成: ${skillName}`, { 
        duration: `${duration}ms`,
        success: true 
      });
      
      return {
        success: true,
        skill: skillName,
        result,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logAgent(`Skill 执行失败: ${skillName}`, { 
        error: error.message,
        duration: `${duration}ms`,
        success: false 
      }, 'ERROR');
      
      return {
        success: false,
        skill: skillName,
        error: error.message,
        duration
      };
    }
  }

  /**
   * 批量执行 Skills
   */
  async executeBatch(skills, options = {}) {
    const results = [];
    
    for (const { name, input } of skills) {
      const result = await this.execute(name, input, options);
      results.push(result);
      
      // 如果某个 Skill 失败且是关键步骤，可以中断
      if (!result.success && options.stopOnError) {
        break;
      }
    }
    
    return results;
  }

  /**
   * 清理输入数据（用于日志）
   */
  sanitizeInput(input) {
    const sanitized = { ...input };
    
    // 如果内容太长，截断
    if (sanitized.content && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.substring(0, 200) + '...';
    }
    if (sanitized.text && sanitized.text.length > 200) {
      sanitized.text = sanitized.text.substring(0, 200) + '...';
    }
    
    return sanitized;
  }

  /**
   * 列出所有可用的 Skills
   */
  listSkills() {
    return this.definitions.map(skill => ({
      name: skill.name,
      category: skill.category,
      description: skill.description
    }));
  }

  /**
   * 根据类别获取 Skills
   */
  getSkillsByCategory(category) {
    return this.definitions
      .filter(skill => skill.category === category)
      .map(skill => ({
        name: skill.name,
        description: skill.description
      }));
  }
}

module.exports = SkillExecutor;

