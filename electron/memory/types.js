/**
 * Novel Agent Memory System - Type Definitions
 * 小说 Agent 记忆系统 - 类型定义
 */

/**
 * 世界观记忆结构
 */
const WorldMemorySchema = {
  version: '1.0',
  last_updated: '',
  world_rules: {
    cultivation_system: {
      levels: [],
      constraints: {}
    },
    magic_system: {},
    tech_level: '',
    geography: {}
  }
};

/**
 * 人物记忆结构
 */
const CharacterMemorySchema = {
  version: '1.0',
  last_updated: '',
  characters: {
    // 角色ID: {
    //   id: string,
    //   name: string,
    //   role: 'protagonist' | 'antagonist' | 'supporting',
    //   personality: {
    //     traits: [],
    //     forbidden_traits: []
    //   },
    //   current_state: {
    //     level: string,
    //     location: string,
    //     injuries: [],
    //     possessions: [],
    //     skills: []
    //   },
    //   relationships: {},
    //   history: []
    // }
  }
};

/**
 * 剧情记忆结构
 */
const PlotMemorySchema = {
  version: '1.0',
  last_updated: '',
  main_plotline: {
    title: '',
    current_stage: '',
    stages: [],
    completed_events: [],
    pending_goals: []
  },
  timeline: []
};

/**
 * 伏笔记忆结构
 */
const ForeshadowMemorySchema = {
  version: '1.0',
  last_updated: '',
  foreshadows: [
    // {
    //   id: string,
    //   title: string,
    //   introduced_at: { chapter: number, paragraph: string },
    //   content: string,
    //   hints: [],
    //   status: 'pending' | 'revealed' | 'resolved',
    //   trigger_condition: string,
    //   expected_reveal: string,
    //   importance: 'minor' | 'major' | 'critical'
    // }
  ]
};

/**
 * Agent 执行状态
 */
const AgentStates = {
  IDLE: 'idle',
  LOAD_CONTEXT: 'load_context',
  PLAN_INTENT: 'plan_intent',
  WRITE_DRAFT: 'write_draft',
  CHECK_CONSISTENCY: 'check_consistency',
  REWRITE: 'rewrite',
  UPDATE_MEMORY: 'update_memory',
  DONE: 'done',
  ERROR: 'error'
};

/**
 * Intent (写作意图) 结构
 */
const IntentSchema = {
  goal: '',
  narrative_role: [],
  tone: '',
  viewpoint: '',
  constraints: {
    forbidden: [],
    required: []
  },
  reference_memory: {
    world_rules: [],
    characters: [],
    plot_context: []
  }
};

/**
 * 一致性检查结果结构
 */
const ConsistencyResultSchema = {
  status: 'pass' | 'fail',
  overall_score: 0,
  errors: [
    // {
    //   type: 'world_rule' | 'power_level' | 'character' | 'timeline' | 'pov' | 'logic',
    //   severity: 'low' | 'medium' | 'high',
    //   location: string,
    //   message: string,
    //   rule_id: string,
    //   suggestion: string
    // }
  ],
  warnings: []
};

module.exports = {
  WorldMemorySchema,
  CharacterMemorySchema,
  PlotMemorySchema,
  ForeshadowMemorySchema,
  AgentStates,
  IntentSchema,
  ConsistencyResultSchema
};

