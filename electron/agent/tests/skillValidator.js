/**
 * Skill Validator - Skill 验证器
 * 验证 Skill 的输入输出契约、状态契约一致性
 */

const skillDefinitions = require('../skills/definitions/skillDefinitions.json');
const { STATE_CONTRACTS } = require('../skills/core/stateContracts');
const logger = require('../../utils/logger');

class SkillValidator {
  constructor() {
    this.definitions = skillDefinitions.skills;
    this.contracts = STATE_CONTRACTS;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * 验证所有 Skill
   */
  validateAll() {
    this.errors = [];
    this.warnings = [];

    for (const skillDef of this.definitions) {
      this.validateSkill(skillDef);
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        total: this.definitions.length,
        errors: this.errors.length,
        warnings: this.warnings.length
      }
    };
  }

  /**
   * 验证单个 Skill
   */
  validateSkill(skillDef) {
    const { name } = skillDef;

    // 1. 检查是否有状态契约
    if (!this.contracts[name]) {
      this.warnings.push({
        skill: name,
        type: 'missing_contract',
        message: `Skill ${name} 没有定义状态契约`
      });
      return;
    }

    const contract = this.contracts[name];

    // 2. 验证 producesState 与 outputSchema 一致
    this.validateProducesState(skillDef, contract);

    // 3. 验证 requiresState 与 inputSchema 一致
    this.validateRequiresState(skillDef, contract);

    // 4. 验证 producesState 不为空
    if (!contract.producesState || contract.producesState.length === 0) {
      this.errors.push({
        skill: name,
        type: 'empty_produces',
        message: `Skill ${name} 的 producesState 为空，必须至少产生一个状态`
      });
    }

    // 5. 验证状态键格式（支持嵌套，如 checkResults.overall）
    this.validateStateKeyFormat(contract);
  }

  /**
   * 验证 producesState 与 outputSchema 一致
   */
  validateProducesState(skillDef, contract) {
    const { name, outputSchema } = skillDef;
    const outputProperties = outputSchema?.properties || {};

    for (const stateKey of contract.producesState) {
      const keys = stateKey.split('.');
      const rootKey = keys[0];

      // 检查根键是否在 outputSchema 中
      if (!outputProperties[rootKey]) {
        this.warnings.push({
          skill: name,
          type: 'produces_mismatch',
          message: `Skill ${name} 的 producesState "${stateKey}" 在 outputSchema 中找不到对应字段 "${rootKey}"`
        });
      }
    }
  }

  /**
   * 验证 requiresState 与 inputSchema 一致
   */
  validateRequiresState(skillDef, contract) {
    const { name, inputSchema } = skillDef;
    const inputProperties = inputSchema?.properties || {};
    const requiredFields = inputSchema?.required || [];

    // 检查 requiresState 是否合理
    // 注意：requiresState 可能来自 AgentState，不一定直接对应 inputSchema
    // 这里只做基本检查
    for (const stateKey of contract.requiresState) {
      const keys = stateKey.split('.');
      const rootKey = keys[0];

      // 如果 requiresState 是基础状态（如 worldRules, characters），不需要在 inputSchema 中
      const basicStates = ['worldRules', 'characters', 'plotState', 'foreshadows', 
                          'scanResult', 'previousAnalyses', 'outline', 'chapterPlan', 
                          'intent', 'chapterDraft', 'finalContent', 'rewrittenContent',
                          'checkResults', 'rewritePlan', 'targetChapter'];
      
      if (!basicStates.includes(rootKey) && !inputProperties[rootKey]) {
        this.warnings.push({
          skill: name,
          type: 'requires_mismatch',
          message: `Skill ${name} 的 requiresState "${stateKey}" 可能无法从 AgentState 获取`
        });
      }
    }
  }

  /**
   * 验证状态键格式
   */
  validateStateKeyFormat(contract) {
    const allStates = [...contract.requiresState, ...contract.producesState];
    
    for (const stateKey of allStates) {
      // 状态键应该是字符串，可以包含点号（嵌套）
      if (typeof stateKey !== 'string') {
        this.errors.push({
          skill: contract.skill || 'unknown',
          type: 'invalid_state_key',
          message: `状态键必须是字符串，但得到: ${typeof stateKey}`
        });
      }

      // 检查格式：字母、数字、点号、下划线
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(stateKey)) {
        this.errors.push({
          skill: contract.skill || 'unknown',
          type: 'invalid_state_key_format',
          message: `状态键格式无效: ${stateKey}，应使用字母、数字、点号、下划线`
        });
      }
    }
  }

  /**
   * 验证状态依赖循环
   * 允许某些合理的业务循环（如重写迭代循环）
   */
  validateDependencyCycles() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    // 定义允许的循环模式（正常的业务逻辑循环）
    const ALLOWED_CYCLES = [
      // 重写迭代循环：检查 -> 生成重写计划 -> 重写 -> 再次检查
      // 这是正常的迭代改进流程，应该允许
      ['check_chapter', 'generate_rewrite_plan', 'rewrite_chapter'],
      ['generate_rewrite_plan', 'rewrite_chapter', 'check_chapter'],
      ['rewrite_chapter', 'check_chapter', 'generate_rewrite_plan']
    ];

    const isAllowedCycle = (cycle) => {
      // 检查循环是否匹配允许的模式（顺序无关）
      const cycleSet = new Set(cycle);
      return ALLOWED_CYCLES.some(allowed => {
        const allowedSet = new Set(allowed);
        // 如果循环包含所有允许的 Skill，则认为是允许的
        return allowed.every(skill => cycleSet.has(skill)) && 
               cycle.every(skill => allowedSet.has(skill));
      });
    };

    const checkCycle = (skillName, path = []) => {
      if (recursionStack.has(skillName)) {
        const cycle = [...path, skillName];
        // 只记录不允许的循环
        if (!isAllowedCycle(cycle)) {
          cycles.push(cycle);
        }
        return;
      }

      if (visited.has(skillName)) {
        return;
      }

      visited.add(skillName);
      recursionStack.add(skillName);

      const contract = this.contracts[skillName];
      if (!contract) return;

      // 检查依赖
      for (const required of contract.requiresState) {
        // 找到能产生该状态的 Skill
        const producers = Object.entries(this.contracts)
          .filter(([name, c]) => c.producesState.includes(required))
          .map(([name]) => name);

        for (const producer of producers) {
          if (producer !== skillName) {
            checkCycle(producer, [...path, skillName]);
          }
        }
      }

      recursionStack.delete(skillName);
    };

    for (const skillName of Object.keys(this.contracts)) {
      if (!visited.has(skillName)) {
        checkCycle(skillName);
      }
    }

    if (cycles.length > 0) {
      this.errors.push({
        type: 'dependency_cycle',
        message: `发现状态依赖循环: ${cycles.map(c => c.join(' -> ')).join('; ')}`
      });
    }

    return cycles;
  }

  /**
   * 验证所有目标状态可达
   */
  validateGoalReachability(goalStates) {
    const unreachable = [];

    for (const goal of goalStates) {
      const producers = Object.entries(this.contracts)
        .filter(([name, contract]) => contract.producesState.includes(goal))
        .map(([name]) => name);

      if (producers.length === 0) {
        unreachable.push({
          goal,
          message: `目标状态 "${goal}" 没有 Skill 能产生`
        });
      }
    }

    if (unreachable.length > 0) {
      this.errors.push({
        type: 'unreachable_goal',
        message: `以下目标状态不可达: ${unreachable.map(u => u.goal).join(', ')}`
      });
    }

    return unreachable;
  }

  /**
   * 生成验证报告
   */
  generateReport() {
    const result = this.validateAll();
    this.validateDependencyCycles();
    
    const { GOAL_STATES } = require('../skills/core/stateContracts');
    for (const goals of Object.values(GOAL_STATES)) {
      this.validateGoalReachability(goals);
    }

    return {
      ...result,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

module.exports = SkillValidator;

