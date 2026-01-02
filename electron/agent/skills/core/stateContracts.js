/**
 * State Contracts - 状态契约定义
 * 定义每个 Skill 的 requiresState（需要的状态）和 producesState（产生的状态）
 */

const STATE_CONTRACTS = {
  load_story_context: {
    requiresState: [],
    producesState: ['worldRules', 'characters', 'plotState', 'foreshadows']
  },
  scan_chapters: {
    requiresState: [],
    producesState: ['scanResult']
  },
  analyze_previous_chapters: {
    requiresState: ['scanResult'],
    producesState: ['previousAnalyses']
  },
  load_chapter_content: {
    requiresState: [],
    producesState: ['chapterDraft', 'targetChapter']
  },
  plan_chapter_outline: {
    requiresState: ['worldRules', 'characters', 'previousAnalyses'],
    producesState: ['outline', 'chapterPlan']
  },
  plan_intent: {
    requiresState: ['chapterPlan'],
    producesState: ['intent']
  },
  write_chapter: {
    requiresState: ['outline', 'intent', 'worldRules', 'characters'],
    producesState: ['chapterDraft']
  },
  rewrite_selected_text: {
    requiresState: ['worldRules', 'characters'],
    producesState: ['rewrittenContent']
  },
  check_character_consistency: {
    requiresState: ['chapterDraft', 'characters'],
    producesState: ['checkResults.character']
  },
  check_world_rule_violation: {
    requiresState: ['chapterDraft', 'worldRules'],
    producesState: ['checkResults.world']
  },
  check_coherence: {
    requiresState: ['chapterDraft', 'previousAnalyses'],
    producesState: ['checkResults.coherence']
  },
  check_all: {
    requiresState: ['chapterDraft', 'characters', 'worldRules'],
    producesState: ['checkResults.overall']
  },
  generate_rewrite_plan: {
    requiresState: ['chapterDraft', 'checkResults.overall'],
    producesState: ['rewritePlan']
  },
  rewrite_with_plan: {
    requiresState: ['chapterDraft', 'rewritePlan', 'intent'],
    producesState: ['rewrittenContent']
  },
  finalize_chapter: {
    requiresState: ['chapterDraft', 'checkResults.overall'],
    producesState: ['finalContent']
  },
  save_chapter: {
    requiresState: ['finalContent', 'targetChapter'],
    producesState: ['saved']
  },
  update_memory: {
    requiresState: ['finalContent'],
    producesState: ['memoryUpdated']
  }
};

/**
 * Goal State 映射（Intent → 目标状态）
 */
const GOAL_STATES = {
  CREATE: ['finalContent'],
  CONTINUE: ['finalContent'],
  REWRITE: ['finalContent'],
  CHECK: ['checkResults.overall'],
  PLAN: ['outline']
};

module.exports = {
  STATE_CONTRACTS,
  GOAL_STATES
};

