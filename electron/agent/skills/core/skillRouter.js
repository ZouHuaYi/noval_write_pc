/**
 * Skill Router - Skill 路由器（极简版）
 * 只负责意图粗分类，不决定 Skill 序列
 */

const logger = require('../../../utils/logger');

class SkillRouter {
  constructor() {
    // Router 不再需要 skillDefinitions
  }

  /**
   * 路由：分析意图并返回任务类型
   * @param {Object} request - 用户请求
   * @param {Object} context - 当前上下文（可选）
   * @returns {Object} 路由结果 { intent, hasSelection, request, context }
   */
  route(request, context = {}) {
    const intent = this.analyzeIntent(request);
    const hasSelection = !!(request.selectedText || context.selectedText);

    logger.logAgent('Router 路由完成', { 
      intent,
      hasSelection
    });

    return {
      intent,                 // CREATE / CONTINUE / REWRITE / CHECK / PLAN
      hasSelection,
      request,
      context
    };
  }

  /**
   * 分析用户意图（粗分类）
   */
  analyzeIntent(request) {
    const text = (request.userRequest || '').toLowerCase();
    
    if (/续写|继续|下一章|接着/.test(text)) return 'CONTINUE';
    if (/重写|改写|修改|优化/.test(text)) return 'REWRITE';
    if (/检查|校验|一致性|连贯性/.test(text)) return 'CHECK';
    if (/规划|计划|大纲/.test(text)) return 'PLAN';
    
    // 默认：创建新章节
    return 'CREATE';
  }
}

module.exports = SkillRouter;

