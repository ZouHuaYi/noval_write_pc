/**
 * Planner Validator - Planner 验证器
 * 验证 Planner 的规划逻辑、状态转换正确性
 */

const { STATE_CONTRACTS, GOAL_STATES } = require('../skills/core/stateContracts');
const AgentState = require('../skills/core/agentState');
const PlannerAgent = require('../skills/core/plannerAgent');
const logger = require('../../utils/logger');

class PlannerValidator {
  constructor() {
    this.planner = new PlannerAgent();
    this.errors = [];
    this.warnings = [];
  }

  /**
   * 验证 Planner 能否为所有 Intent 生成有效规划
   */
  async validateAllIntents(mockLLMCaller) {
    this.errors = [];
    this.warnings = [];

    const intents = Object.keys(GOAL_STATES);
    const results = {};

    for (const intent of intents) {
      try {
        const result = await this.validateIntent(intent, mockLLMCaller);
        results[intent] = result;
      } catch (error) {
        this.errors.push({
          intent,
          type: 'validation_error',
          message: error.message
        });
        results[intent] = { valid: false, error: error.message };
      }
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      results
    };
  }

  /**
   * 验证单个 Intent 的规划
   */
  async validateIntent(intent, mockLLMCaller) {
    const goalStates = GOAL_STATES[intent];
    const initialState = new AgentState();

    // 模拟规划
    const plan = await this.planner.plan({
      intent,
      state: initialState,
      request: { userRequest: `测试 ${intent} 意图` }
    }, mockLLMCaller || this.createMockLLMCaller());

    // 验证规划结果
    const validation = this.validatePlan(plan, goalStates, initialState);

    return {
      valid: validation.valid,
      plan,
      goalStates,
      validation
    };
  }

  /**
   * 验证规划结果
   */
  validatePlan(plan, goalStates, initialState) {
    const issues = [];

    if (!plan || !Array.isArray(plan.steps)) {
      issues.push({
        type: 'invalid_plan_format',
        message: '规划结果格式无效'
      });
      return { valid: false, issues };
    }

    // 检查每个步骤
    for (const step of plan.steps) {
      // 1. 检查 Skill 是否存在
      if (!STATE_CONTRACTS[step.skill]) {
        issues.push({
          type: 'unknown_skill',
          step: step.skill,
          message: `未知的 Skill: ${step.skill}`
        });
        continue;
      }

      const contract = STATE_CONTRACTS[step.skill];

      // 2. 检查 requiresState 是否满足
      const missingRequires = contract.requiresState.filter(req => {
        return !this.hasState(initialState, req);
      });

      if (missingRequires.length > 0) {
        issues.push({
          type: 'missing_requires',
          step: step.skill,
          message: `Skill ${step.skill} 的 requiresState 不满足: ${missingRequires.join(', ')}`
        });
      }

      // 3. 检查 producesState 是否与目标相关
      const relevantProduces = contract.producesState.filter(prod => {
        return goalStates.some(goal => {
          // 检查是否直接匹配或有助于达成目标
          return prod === goal || this.isStateRelevant(prod, goal);
        });
      });

      if (relevantProduces.length === 0 && plan.steps.length > 1) {
        issues.push({
          type: 'irrelevant_produces',
          step: step.skill,
          message: `Skill ${step.skill} 产生的状态与目标无关`
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 检查状态是否与目标相关
   */
  isStateRelevant(state, goal) {
    // 简单检查：如果状态是目标的依赖，则认为相关
    // 这里可以扩展更复杂的逻辑
    return false; // 简化实现
  }

  /**
   * 验证状态转换路径
   */
  async validateStateTransitionPath(intent, mockLLMCaller) {
    const goalStates = GOAL_STATES[intent];
    const state = new AgentState();
    const path = [];
    const maxSteps = 20;

    for (let i = 0; i < maxSteps; i++) {
      // 检查目标是否已满足
      if (this.isGoalSatisfied(goalStates, state)) {
        return {
          valid: true,
          path,
          steps: i,
          message: '成功到达目标状态'
        };
      }

      // 规划下一步
      const plan = await this.planner.plan({
        intent,
        state,
        request: { userRequest: `测试路径 ${i}` }
      }, mockLLMCaller || this.createMockLLMCaller());

      if (!plan.steps || plan.steps.length === 0) {
        return {
          valid: false,
          path,
          steps: i,
          message: '规划返回空步骤，无法到达目标'
        };
      }

      // 模拟执行第一步（更新状态）
      const step = plan.steps[0];
      const contract = STATE_CONTRACTS[step.skill];
      
      if (!contract) {
        return {
          valid: false,
          path,
          steps: i,
          message: `未知的 Skill: ${step.skill}`
        };
      }

      // 模拟状态更新
      this.simulateStateUpdate(state, step.skill, contract);
      path.push({
        step: i + 1,
        skill: step.skill,
        produces: contract.producesState,
        state: this.serializeState(state)
      });
    }

    return {
      valid: false,
      path,
      steps: maxSteps,
      message: '达到最大步数，可能陷入循环或无法到达目标'
    };
  }

  /**
   * 模拟状态更新
   */
  simulateStateUpdate(state, skillName, contract) {
    // 根据 producesState 更新状态
    for (const produces of contract.producesState) {
      const keys = produces.split('.');
      let current = state;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      const lastKey = keys[keys.length - 1];
      // 设置一个模拟值
      current[lastKey] = `simulated_${skillName}_${Date.now()}`;
    }
  }

  /**
   * 序列化状态（用于日志）
   */
  serializeState(state) {
    const keys = [];
    if (state.worldRules) keys.push('worldRules');
    if (state.characters) keys.push('characters');
    if (state.outline) keys.push('outline');
    if (state.chapterDraft) keys.push('chapterDraft');
    if (state.finalContent) keys.push('finalContent');
    return keys.join(', ');
  }

  /**
   * 创建模拟 LLM 调用器
   */
  createMockLLMCaller() {
    return async (prompt) => {
      // 返回一个简单的规划结果
      return {
        response: JSON.stringify({
          steps: [
            {
              skill: 'load_story_context',
              produces: 'worldRules',
              reason: '模拟规划：加载上下文'
            }
          ]
        })
      };
    };
  }

  /**
   * 验证 Planner 不会产生循环
   */
  async validateNoCycles(intent, mockLLMCaller) {
    const state = new AgentState();
    const executedSkills = new Set();
    const stateHistory = [];
    const maxSteps = 50;

    for (let i = 0; i < maxSteps; i++) {
      const stateSnapshot = JSON.stringify(state);
      
      // 检查状态是否重复（可能陷入循环）
      if (stateHistory.includes(stateSnapshot)) {
        return {
          valid: false,
          message: `在第 ${i} 步检测到状态循环`,
          executedSkills: Array.from(executedSkills),
          stateHistory: stateHistory.length
        };
      }

      stateHistory.push(stateSnapshot);

      const plan = await this.planner.plan({
        intent,
        state,
        request: { userRequest: '测试循环检测' }
      }, mockLLMCaller || this.createMockLLMCaller());

      if (!plan.steps || plan.steps.length === 0) {
        break;
      }

      const step = plan.steps[0];
      executedSkills.add(step.skill);

      // 检查 Skill 执行次数
      if (executedSkills.has(step.skill)) {
        const count = Array.from(executedSkills).filter(s => s === step.skill).length;
        if (count > 3) {
          return {
            valid: false,
            message: `Skill ${step.skill} 执行次数超过限制`,
            executedSkills: Array.from(executedSkills)
          };
        }
      }

      // 模拟状态更新
      const contract = STATE_CONTRACTS[step.skill];
      if (contract) {
        this.simulateStateUpdate(state, step.skill, contract);
      }
    }

    return {
      valid: true,
      message: '未检测到循环',
      executedSkills: Array.from(executedSkills),
      steps: stateHistory.length
    };
  }

  /**
   * 检查状态是否存在（辅助方法）
   */
  hasState(state, stateKey) {
    const keys = stateKey.split('.');
    let current = state;
    
    for (const key of keys) {
      if (current == null || current[key] == null) {
        return false;
      }
      current = current[key];
    }
    
    if (typeof current === 'string' && current.trim() === '') return false;
    if (Array.isArray(current) && current.length === 0) return false;
    if (typeof current === 'object' && Object.keys(current).length === 0) return false;
    
    return true;
  }

  /**
   * 检查目标是否已满足（辅助方法）
   */
  isGoalSatisfied(goalStates, state) {
    return goalStates.every(goal => this.hasState(state, goal));
  }
}

module.exports = PlannerValidator;

