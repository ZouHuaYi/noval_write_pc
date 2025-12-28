/**
 * DSL Rule Engine - DSL 规则引擎
 * 支持可执行的规则 DSL，实现"像编译器一样判定小说是否合法"
 * 
 * 规则类型：
 * - WORLD: 世界观规则（永远强制）
 * - CHARACTER: 人物规则
 * - HISTORY: 历史一致性规则
 * - INTENT: Intent 契约规则
 * - ARC: Arc 推进规则
 * 
 * 规则级别：
 * - FATAL: 致命错误，必须修正
 * - ERROR: 错误，需要修正
 * - WARN: 警告，记录但允许
 */

class DSLRuleEngine {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.rules = {
      WORLD: [],
      CHARACTER: [],
      HISTORY: [],
      INTENT: [],
      ARC: []
    };
    this.loaded = false;
  }

  /**
   * 加载规则（从 JSON 文件）
   */
  async loadRules(defaultRulesPath, customRulesPath) {
    const fs = require('fs').promises;
    
    try {
      console.log('📋 加载 DSL 规则...');

      // 加载默认规则
      let defaultRules = { rules: [] };
      try {
        const content = await fs.readFile(defaultRulesPath, 'utf-8');
        defaultRules = JSON.parse(content);
      } catch (e) {
        console.warn('⚠️ 默认规则加载失败，使用空规则');
      }

      // 加载自定义规则
      let customRules = { rules: [] };
      try {
        const content = await fs.readFile(customRulesPath, 'utf-8');
        customRules = JSON.parse(content);
      } catch (e) {
        console.log('📝 未找到自定义规则');
      }

      // 合并规则
      const allRules = [
        ...(defaultRules.rules || []),
        ...(customRules.rules || [])
      ];

      // 按类型分类
      this.rules = {
        WORLD: [],
        CHARACTER: [],
        HISTORY: [],
        INTENT: [],
        ARC: []
      };

      for (const rule of allRules) {
        if (rule.enabled === false) continue;
        
        const scope = rule.scope || rule.type?.toUpperCase();
        if (this.rules[scope]) {
          this.rules[scope].push(rule);
        }
      }

      this.loaded = true;
      const total = Object.values(this.rules).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`✅ 已加载 ${total} 条 DSL 规则`);
      console.log(`   - WORLD: ${this.rules.WORLD.length}`);
      console.log(`   - CHARACTER: ${this.rules.CHARACTER.length}`);
      console.log(`   - HISTORY: ${this.rules.HISTORY.length}`);
      console.log(`   - INTENT: ${this.rules.INTENT.length}`);
      console.log(`   - ARC: ${this.rules.ARC.length}`);

      return { success: true, count: total };
    } catch (error) {
      console.error('❌ 加载 DSL 规则失败:', error);
      this.loaded = true;
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行规则检查（Dry Run，不写回记忆）
   * @param {Object} params - 检查参数
   * @param {string} params.text - 待检查的文本
   * @param {Object} params.intent - 写作意图
   * @param {Object} params.context - 记忆上下文
   * @param {Object} params.events - 抽取的事件（临时）
   * @param {Object} params.stateTransitions - 状态迁移（临时）
   */
  async checkRules(params) {
    if (!this.loaded) {
      throw new Error('规则引擎未加载');
    }

    const { text, intent, context, events = [], stateTransitions = [] } = params;
    const violations = [];

    // 1. 世界观规则检查
    for (const rule of this.rules.WORLD) {
      const violation = await this.evaluateWorldRule(rule, text, context, events);
      if (violation) {
        violations.push(violation);
      }
    }

    // 2. 人物规则检查
    for (const rule of this.rules.CHARACTER) {
      const violation = await this.evaluateCharacterRule(rule, text, context, stateTransitions);
      if (violation) {
        violations.push(violation);
      }
    }

    // 3. 历史一致性规则检查
    for (const rule of this.rules.HISTORY) {
      const violation = await this.evaluateHistoryRule(rule, events, context);
      if (violation) {
        violations.push(violation);
      }
    }

    // 4. Intent 契约规则检查
    for (const rule of this.rules.INTENT) {
      const violation = await this.evaluateIntentRule(rule, text, intent);
      if (violation) {
        violations.push(violation);
      }
    }

    // 5. Arc 推进规则检查
    for (const rule of this.rules.ARC) {
      const violation = await this.evaluateArcRule(rule, text, context, events);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * 评估世界观规则
   */
  async evaluateWorldRule(rule, text, context, events) {
    try {
      const assert = rule.assert;
      
      // 检查事件类型
      if (typeof assert === 'string') {
        // 简单断言，如 "event.type != TIME_REVERSE"
        if (assert.includes('event.type !=')) {
          const forbiddenType = assert.split('!=')[1].trim();
          for (const event of events) {
            if (event.type === forbiddenType) {
              return {
                rule_id: rule.id,
                rule_name: rule.name || rule.id,
                type: 'world_rule',
                level: rule.level || 'FATAL',
                scope: 'WORLD',
                message: rule.message || `违反世界观规则: ${rule.id}`,
                suggestion: rule.suggestion || '请修正违反世界观的内容',
                matched_condition: assert
              };
            }
          }
        }
      }

      // 检查文本中的关键词
      if (rule.forbid_keywords) {
        for (const keyword of rule.forbid_keywords) {
          if (text.includes(keyword)) {
            return {
              rule_id: rule.id,
              rule_name: rule.name || rule.id,
              type: 'world_rule',
              level: rule.level || 'FATAL',
              scope: 'WORLD',
              message: rule.message || `文本包含禁止的关键词: ${keyword}`,
              suggestion: rule.suggestion || '请移除或替换禁止的关键词',
              matched_condition: `forbid_keywords: ${keyword}`
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`评估世界观规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估人物规则（增强版：支持状态机验证）
   */
  async evaluateCharacterRule(rule, text, context, stateTransitions) {
    try {
      const assert = rule.assert;

      // 检查状态迁移（如：禁止 Dead -> Alive）
      if (assert?.forbid?.character?.state_transition) {
        const forbiddenTransition = assert.forbid.character.state_transition;
        const [fromState, toState] = forbiddenTransition.split(' -> ').map(s => s.trim());
        
        for (const transition of stateTransitions) {
          if (transition.type === 'character') {
            // 增强：支持模糊匹配（如 "Dead" 匹配 "Dead"、"死亡" 等）
            const fromMatch = this.matchState(transition.from, fromState);
            const toMatch = this.matchState(transition.to, toState);
            
            if (fromMatch && toMatch) {
              // 额外验证：检查状态迁移是否合法
              const validation = this.validateStateTransition(transition, context);
              if (!validation.valid) {
                return {
                  rule_id: rule.id,
                  rule_name: rule.name || rule.id,
                  type: 'STATE_RULE',
                  level: rule.level || 'ERROR',
                  scope: 'CHARACTER',
                  message: rule.message || `禁止的状态迁移: ${forbiddenTransition}`,
                  suggestion: rule.suggestion || validation.suggestion || '请修正状态迁移',
                  matched_condition: `state_transition: ${forbiddenTransition}`,
                  validation_error: validation.reason
                };
              }

              return {
                rule_id: rule.id,
                rule_name: rule.name || rule.id,
                type: 'STATE_RULE',
                level: rule.level || 'ERROR',
                scope: 'CHARACTER',
                message: rule.message || `禁止的状态迁移: ${forbiddenTransition}`,
                suggestion: rule.suggestion || '请修正状态迁移',
                matched_condition: `state_transition: ${forbiddenTransition}`
              };
            }
          }
        }
      }

      // 检查性格一致性（if-then 规则）
      if (assert?.if && assert?.then) {
        // 需要结合 LLM 或更复杂的逻辑判断
        // 这里简化处理，实际应该检查文本中的情感/行为
        const ifCondition = assert.if;
        const thenCondition = assert.then;
        
        // 如果检测到 if 条件，检查 then 条件是否违反
        if (ifCondition.includes('character.traits.contains')) {
          const trait = ifCondition.match(/'([^']+)'/)?.[1];
          if (trait && context.characters) {
            for (const char of context.characters) {
              if (char.personality?.traits?.includes(trait)) {
                // 检查文本是否违反 then 条件
                if (thenCondition.includes('text.emotion !=')) {
                  const forbiddenEmotion = thenCondition.match(/'([^']+)'/)?.[1];
                  if (forbiddenEmotion && text.includes(forbiddenEmotion)) {
                    return {
                      rule_id: rule.id,
                      rule_name: rule.name || rule.id,
                      type: 'character',
                      level: rule.level || 'ERROR',
                      scope: 'CHARACTER',
                      message: rule.message || `角色 ${char.name} 具有 "${trait}" 特质，但文本中出现了 "${forbiddenEmotion}"`,
                      suggestion: rule.suggestion || '请调整文本以符合角色性格',
                      matched_condition: `trait: ${trait}, emotion: ${forbiddenEmotion}`
                    };
                  }
                }
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`评估人物规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估历史一致性规则
   */
  async evaluateHistoryRule(rule, events, context) {
    try {
      const assert = rule.assert;

      // 检查事件是否与历史矛盾
      if (typeof assert === 'string' && assert.includes('must_not_contradict')) {
        // 简化处理：检查是否有重复或矛盾的事件
        const eventTypes = new Set();
        for (const event of events) {
          if (eventTypes.has(event.type)) {
            // 发现重复事件类型，可能是矛盾
            return {
              rule_id: rule.id,
              rule_name: rule.name || rule.id,
              type: 'history',
              level: rule.level || 'FATAL',
              scope: 'HISTORY',
              message: rule.message || '事件与历史记录矛盾',
              suggestion: rule.suggestion || '请检查事件是否与已有历史冲突',
              matched_condition: `contradict: ${event.type}`
            };
          }
          eventTypes.add(event.type);
        }
      }

      return null;
    } catch (error) {
      console.error(`评估历史规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估 Intent 契约规则
   */
  async evaluateIntentRule(rule, text, intent) {
    try {
      if (!intent) return null;

      const assert = rule.assert;

      // 检查必须实现的目标
      if (assert?.must_fulfill) {
        for (const requirement of assert.must_fulfill) {
          if (requirement === 'intent.goal') {
            // 检查文本是否实现了 intent.goal
            // 简化处理：检查文本是否包含目标关键词
            const goal = intent.goal || '';
            if (goal && text.length < 100) {
              // 文本太短，可能未实现目标
              return {
                rule_id: rule.id,
                rule_name: rule.name || rule.id,
                type: 'intent',
                level: rule.level || 'FATAL',
                scope: 'INTENT',
                message: rule.message || `文本可能未实现写作目标: ${goal}`,
                suggestion: rule.suggestion || '请确保文本实现了写作意图中的目标',
                matched_condition: 'must_fulfill: intent.goal'
              };
            }
          }
        }
      }

      // 检查禁止违反的约束
      if (assert?.must_not_violate) {
        for (const constraint of assert.must_not_violate) {
          if (constraint === 'intent.constraints') {
            const forbidden = intent.constraints?.forbidden || [];
            for (const item of forbidden) {
              if (text.includes(item)) {
                return {
                  rule_id: rule.id,
                  rule_name: rule.name || rule.id,
                  type: 'intent',
                  level: rule.level || 'FATAL',
                  scope: 'INTENT',
                  message: rule.message || `文本违反了意图约束: ${item}`,
                  suggestion: rule.suggestion || '请移除违反约束的内容',
                  matched_condition: `violate: ${item}`
                };
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`评估 Intent 规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 评估 Arc 推进规则
   */
  async evaluateArcRule(rule, text, context, events) {
    try {
      const assert = rule.assert;

      // 检查 Arc 阶段是否变化或加强
      if (assert?.['arc.phase'] === 'must_change_or_intensify') {
        // 简化处理：检查是否有新事件或情节推进
        if (events.length === 0 && text.length < 200) {
          // 没有事件且文本较短，可能是水文
          return {
            rule_id: rule.id,
            rule_name: rule.name || rule.id,
            type: 'arc',
            level: rule.level || 'ERROR',
            scope: 'ARC',
            message: rule.message || 'Arc 阶段未推进，可能为水文',
            suggestion: rule.suggestion || '请增加情节推进或事件',
            matched_condition: 'arc.phase: must_change_or_intensify'
          };
        }
      }

      return null;
    } catch (error) {
      console.error(`评估 Arc 规则失败: ${rule.id}`, error);
      return null;
    }
  }

  /**
   * 检查是否有致命错误
   */
  hasFatalError(violations) {
    return violations.some(v => v.level === 'FATAL');
  }

  /**
   * 检查是否有错误
   */
  hasError(violations) {
    return violations.some(v => v.level === 'FATAL' || v.level === 'ERROR');
  }

  /**
   * 获取规则统计
   */
  getStatistics() {
    return {
      total: Object.values(this.rules).reduce((sum, arr) => sum + arr.length, 0),
      by_scope: {
        WORLD: this.rules.WORLD.length,
        CHARACTER: this.rules.CHARACTER.length,
        HISTORY: this.rules.HISTORY.length,
        INTENT: this.rules.INTENT.length,
        ARC: this.rules.ARC.length
      }
    };
  }

  /**
   * 验证状态迁移（增强版：状态机验证）
   * @param {Object} transition - 状态迁移 { type, entity, from, to }
   * @param {Object} context - 上下文
   */
  validateStateTransition(transition, context) {
    const { type, entity, from, to } = transition;

    if (type === 'character') {
      // 获取角色信息
      const char = context.characters?.find(c => c.name === entity);
      if (!char) {
        return { 
          valid: true, // 角色不存在时，不阻止（可能是在创建新角色）
          reason: '角色不存在'
        };
      }

      // 检查状态迁移是否合法
      const validTransitions = this.getValidStateTransitions(char, from);
      if (validTransitions.length > 0 && !validTransitions.includes(to)) {
        return { 
          valid: false, 
          reason: `不允许的状态迁移: ${from} -> ${to}`,
          suggestion: `合法的状态迁移: ${validTransitions.join(', ')}`,
          validOptions: validTransitions
        };
      }

      // 检查状态迁移条件
      const conditions = this.getStateTransitionConditions(char, from, to);
      if (conditions.length > 0) {
        const unmetConditions = conditions.filter(c => !this.checkCondition(c, context));
        if (unmetConditions.length > 0) {
          return { 
            valid: false, 
            reason: '状态迁移条件不满足',
            suggestion: `需要满足的条件: ${unmetConditions.map(c => c.description || c).join(', ')}`,
            requiredConditions: unmetConditions
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 获取合法的状态迁移
   */
  getValidStateTransitions(character, fromState) {
    // 定义状态机：合法的状态迁移
    const stateMachine = {
      // 生命状态
      'Alive': ['Injured', 'Dead', 'Unconscious', 'Alive'], // 可以保持 Alive
      'Injured': ['Alive', 'Dead', 'Unconscious', 'Injured'], // 可以保持 Injured
      'Unconscious': ['Alive', 'Injured', 'Dead', 'Unconscious'], // 可以保持 Unconscious
      'Dead': [], // 死亡是终态，不允许迁移
      
      // 境界状态（简化：只检查倒退）
      // 这里需要根据实际的境界体系来定义
    };

    // 检查是否是生命状态
    const lifeStates = ['Alive', 'Injured', 'Dead', 'Unconscious', 'Alive', '死亡', '受伤', '昏迷'];
    const isLifeState = lifeStates.some(s => fromState.includes(s) || s.includes(fromState));

    if (isLifeState) {
      // 标准化状态名称
      let normalizedFrom = fromState;
      if (fromState.includes('死亡') || fromState === 'Dead') {
        normalizedFrom = 'Dead';
      } else if (fromState.includes('受伤') || fromState === 'Injured') {
        normalizedFrom = 'Injured';
      } else if (fromState.includes('昏迷') || fromState === 'Unconscious') {
        normalizedFrom = 'Unconscious';
      } else {
        normalizedFrom = 'Alive';
      }

      return stateMachine[normalizedFrom] || [];
    }

    // 对于其他状态（如境界），允许所有迁移（由其他规则检查）
    return [];
  }

  /**
   * 获取状态迁移条件
   */
  getStateTransitionConditions(character, fromState, toState) {
    const conditions = [];

    // 死亡 -> 其他状态：需要特殊条件（如：复活法术、时间倒流等）
    if ((fromState.includes('死亡') || fromState === 'Dead') && 
        !(toState.includes('死亡') || toState === 'Dead')) {
      conditions.push({
        type: 'special_condition',
        description: '需要复活条件（如：复活法术、时间倒流、假死等）',
        check: (context) => {
          // 检查是否有复活相关的事件
          const events = context.events || [];
          return events.some(e => 
            e.type === 'REVIVAL' || 
            e.type === 'TIME_REVERSE' ||
            e.description?.includes('复活') ||
            e.description?.includes('重生')
          );
        }
      });
    }

    // 境界提升：需要修炼条件
    if (this.isLevelUp(fromState, toState)) {
      conditions.push({
        type: 'cultivation_condition',
        description: '需要修炼或突破条件',
        check: (context) => {
          const events = context.events || [];
          return events.some(e => 
            e.type === 'LEVEL_UP' || 
            e.type === 'BREAKTHROUGH' ||
            e.description?.includes('突破') ||
            e.description?.includes('修炼')
          );
        }
      });
    }

    return conditions;
  }

  /**
   * 检查条件
   */
  checkCondition(condition, context) {
    if (typeof condition.check === 'function') {
      return condition.check(context);
    }
    return true; // 默认通过
  }

  /**
   * 判断是否是境界提升
   */
  isLevelUp(fromLevel, toLevel) {
    const levelOrder = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'];
    
    const fromIndex = levelOrder.findIndex(l => fromLevel.includes(l));
    const toIndex = levelOrder.findIndex(l => toLevel.includes(l));
    
    return fromIndex >= 0 && toIndex >= 0 && toIndex > fromIndex;
  }

  /**
   * 匹配状态（支持模糊匹配）
   */
  matchState(actualState, targetState) {
    if (!actualState || !targetState) return false;
    
    // 完全匹配
    if (actualState === targetState) return true;
    
    // 包含匹配
    if (actualState.includes(targetState) || targetState.includes(actualState)) return true;
    
    // 同义词匹配
    const synonyms = {
      'Dead': ['死亡', '死', '已死'],
      'Alive': ['活着', '生存', '存活'],
      'Injured': ['受伤', '伤势', '负伤'],
      'Unconscious': ['昏迷', '失去意识', '不省人事']
    };

    for (const [key, values] of Object.entries(synonyms)) {
      if ((actualState === key || values.includes(actualState)) &&
          (targetState === key || values.includes(targetState))) {
        return true;
      }
    }

    return false;
  }
}

module.exports = DSLRuleEngine;

