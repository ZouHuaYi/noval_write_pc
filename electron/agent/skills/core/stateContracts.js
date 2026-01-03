/**
 * State Contracts - 状态契约定义（精简版）
 * 只保留 8 个核心 Skill（用于 Planner 自动规划），提升 Planner 效率
 * 
 * 注意：update_story_memory 不在 STATE_CONTRACTS 中
 * - 它是用户确认后的手动操作，不应该由 Planner 自动规划
 * - 它仍然存在于 skillDefinitions.json 中，可以通过 SkillExecutor 手动调用
 * - 这样可以避免状态依赖循环，因为 Planner 不会考虑它
 */

const STATE_CONTRACTS = {
  // ========== Context (1 个) ==========
  
  load_story_context: {
    requiresState: [],
    producesState: ['worldRules', 'characters', 'plotState', 'foreshadows']
  },

  // ========== Planning / Cognitive (2 个) ==========
  
  plan_chapter: {
    requiresState: ['worldRules', 'characters', 'plotState'],
    producesState: ['outline', 'chapterIntent', 'previousAnalyses']
  },

  generate_rewrite_plan: {
    requiresState: ['checkResults'],
    producesState: ['rewritePlan']
  },

  // ========== Writing (2 个) ==========
  
  write_chapter: {
    requiresState: ['outline', 'chapterIntent', 'worldRules', 'characters'],
    producesState: ['chapters.draft']
  },

  rewrite_chapter: {
    requiresState: ['chapters.draft', 'rewritePlan'],
    producesState: ['chapters.draft'] // 更新草稿
  },

  // ========== Check / Validation (2 个) ==========
  
  check_chapter: {
    requiresState: ['chapters.draft', 'characters', 'worldRules'],
    producesState: ['checkResults']
  },

  finalize_chapter: {
    requiresState: ['chapters.draft', 'checkResults'],
    producesState: ['chapters.final']
  },

  // ========== Utility (1 个) ==========
  
  scan_chapters: {
    requiresState: [],
    producesState: ['scanResult', 'targetChapter']
  }
};

/**
 * Goal State 映射（Intent → 目标状态）
 */
const GOAL_STATES = {
  CREATE: ['chapters.final'],
  CONTINUE: ['chapters.final'],
  REWRITE: ['chapters.final'],
  CHECK: ['checkResults'],
  PLAN: ['outline']
};

module.exports = {
  STATE_CONTRACTS,
  GOAL_STATES
};
