/**
 * Planner Agent - 规划代理（Backward Planning 版本）
 * 基于状态契约的自动规划算法
 */

const skillDefinitions = require('../definitions/skillDefinitions.json');
const { STATE_CONTRACTS, GOAL_STATES } = require('./stateContracts');
const logger = require('../../../utils/logger');

class PlannerAgent {
  constructor() {
    this.definitions = skillDefinitions.skills;
    // 排除 update_story_memory，因为它是用户确认后的手动操作，不应该由 Planner 自动规划
    this.availableSkills = this.definitions
      .map(s => s.name)
      .filter(name => name !== 'update_story_memory');
    this.skillExecutionCounts = new Map(); // 跟踪每个 Skill 的执行次数
    this.maxExecutionsPerSkill = 3; // 每个 Skill 最多执行 3 次
  }

  /**
   * 规划下一步 Skill 序列（Backward Planning）
   * @param {Object} input - 规划输入
   * @param {string} input.intent - 意图类型 (CREATE/CONTINUE/REWRITE/CHECK/PLAN)
   * @param {Object} input.state - 当前 AgentState
   * @param {Object} input.request - 用户请求
   * @param {Function} llmCaller - LLM 调用函数
   * @returns {Promise<Object>} 规划结果 { steps: [{ skill, produces, reason }] }
   */
  async plan(input, llmCaller) {
    const { intent, state, request } = input;

    try {
      // 1. 获取目标状态
      const goalStates = GOAL_STATES[intent] || GOAL_STATES.CREATE;
      
      // 2. 检查目标是否已满足
      if (this.isGoalSatisfied(goalStates, state)) {
        logger.logAgent('目标状态已满足，无需规划', { intent, goalStates });
        return { steps: [] };
      }

      // 3. 使用 LLM 作为状态搜索引擎
      const plan = await this.planWithLLM(goalStates, state, intent, request, llmCaller);
      
      // 4. 验证并优化规划
      const validatedPlan = this.validateAndOptimizePlan(plan, state, goalStates);

      logger.logAgent('Planner 规划完成', {
        intent,
        goalStates,
        stepCount: validatedPlan.steps.length,
        steps: validatedPlan.steps.map(s => ({ skill: s.skill, produces: s.produces }))
      });

      return validatedPlan;

    } catch (error) {
      logger.logAgent('Planner 规划失败，使用规则规划', { error: error.message }, 'WARN');
      // 如果 LLM 规划失败，使用基于规则的 Backward Planning
      return this.planWithRules(GOAL_STATES[intent] || GOAL_STATES.CREATE, state, intent, request);
    }
  }

  /**
   * 使用 LLM 进行状态搜索规划
   */
  async planWithLLM(goalStates, state, intent, request, llmCaller) {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(goalStates, state, intent, request);

    const result = await llmCaller({
      systemPrompt,
      userPrompt,
      temperature: 0.2, // 更低温度，提高搜索准确性
      maxTokens: 800
    });

    // 解析 LLM 返回结果
    let plan;
    try {
      if (typeof result === 'string') {
        const jsonMatch = result.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                         result.match(/(\{[\s\S]*\})/);
        plan = JSON.parse(jsonMatch ? jsonMatch[1] : result);
      } else if (result && result.response) {
        const response = result.response;
        if (typeof response === 'string') {
          const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                           response.match(/(\{[\s\S]*\})/);
          plan = JSON.parse(jsonMatch ? jsonMatch[1] : response);
        } else {
          plan = response;
        }
      } else {
        plan = result;
      }
    } catch (parseError) {
      logger.logAgent('Planner JSON 解析失败', { error: parseError.message }, 'WARN');
      throw parseError;
    }

    return plan;
  }

  /**
   * 构建系统提示词（状态搜索引擎）
   */
  buildSystemPrompt() {
    // 构建 Skill 契约列表
    const skillContracts = Object.entries(STATE_CONTRACTS).map(([name, contract]) => {
      const def = this.definitions.find(s => s.name === name);
      return `- ${name}:
  requires: [${contract.requiresState.join(', ') || '无'}]
  produces: [${contract.producesState.join(', ')}]
  description: ${def?.description || '无描述'}`;
    }).join('\n\n');

    return `你是一个 Planner Agent（状态搜索引擎）。
你的任务是：根据目标 state 和当前 state，选择 Skill 来补齐缺失的 state。

RULES:
1. **不要关心 Skill 的执行顺序历史**
2. **每次只规划"当前最短路径"（1-2 步）**
3. **必须满足 Skill.requiresState 才能选择该 Skill**
4. **优先选择 producesState 精确匹配目标的 Skill**
5. **如果 requiresState 不满足，先规划满足 requiresState 的 Skill**
6. **禁止选择已执行超过 3 次的 Skill（除非状态发生变化）**
7. **如果目标已满足，返回空数组**

AVAILABLE SKILLS:
${skillContracts}

OUTPUT (JSON ONLY):
{
  "steps": [
    { 
      "skill": "skill_name", 
      "produces": "state_key", 
      "reason": "为什么选择这个 skill（必须说明它产生什么状态）" 
    }
  ]
}`;
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(goalStates, state, intent, request) {
    const currentState = this.serializeState(state);
    const missingStates = this.getMissingStates(goalStates, state);
    
    return `# 目标状态（必须达到）
${goalStates.map(s => `- ${s}`).join('\n')}

# 当前状态
${currentState}

# 缺失的状态
${missingStates.length > 0 ? missingStates.map(s => `- ${s}`).join('\n') : '无（目标已满足）'}

# 意图
${intent}

# 用户请求
${request.userRequest || ''}
${request.selectedText ? `\n选中文本: ${request.selectedText.substring(0, 100)}...` : ''}

# 任务
请规划下一步要执行的 Skill，以补齐缺失的状态。只规划 1-2 步，不要规划整个流程。`;
  }

  /**
   * 序列化状态（用于 LLM 理解）
   */
  serializeState(state) {
    const parts = [];
    
    if (state.worldRules) parts.push('✓ worldRules');
    if (state.characters && state.characters.length > 0) {
      parts.push(`✓ characters (${state.characters.length})`);
    }
    if (state.scanResult) parts.push('✓ scanResult');
    if (state.previousAnalyses && state.previousAnalyses.length > 0) {
      parts.push(`✓ previousAnalyses (${state.previousAnalyses.length})`);
    }
    if (state.outline) parts.push('✓ outline');
    if (state.chapterPlan) parts.push('✓ chapterPlan');
    if (state.intent) parts.push('✓ intent');
    if (state.chapterDraft) parts.push('✓ chapterDraft');
    if (state.finalContent) parts.push('✓ finalContent');
    if (state.rewrittenContent) parts.push('✓ rewrittenContent');
    if (state.checkResults?.character) parts.push('✓ checkResults.character');
    if (state.checkResults?.world) parts.push('✓ checkResults.world');
    if (state.checkResults?.coherence) parts.push('✓ checkResults.coherence');
    if (state.checkResults?.overall) parts.push('✓ checkResults.overall');
    if (state.rewritePlan) parts.push('✓ rewritePlan');
    if (state.memoryUpdated) parts.push('✓ memoryUpdated');
    if (state.targetChapter) parts.push(`✓ targetChapter (${state.targetChapter})`);

    if (parts.length === 0) {
      return '状态：空（需要加载上下文）';
    }

    return parts.join('\n');
  }

  /**
   * 获取缺失的状态
   */
  getMissingStates(goalStates, state) {
    return goalStates.filter(goal => !this.hasState(state, goal));
  }

  /**
   * 检查状态是否存在
   */
  hasState(state, stateKey) {
    // 支持嵌套状态键，如 "checkResults.overall"
    const keys = stateKey.split('.');
    let current = state;
    
    for (const key of keys) {
      if (current == null || current[key] == null) {
        return false;
      }
      current = current[key];
    }
    
    // 检查值是否有效（不是空字符串、空数组、空对象）
    if (typeof current === 'string' && current.trim() === '') return false;
    if (Array.isArray(current) && current.length === 0) return false;
    if (typeof current === 'object' && Object.keys(current).length === 0) return false;
    
    return true;
  }

  /**
   * 检查目标是否已满足
   */
  isGoalSatisfied(goalStates, state) {
    return goalStates.every(goal => this.hasState(state, goal));
  }

  /**
   * 验证并优化规划
   */
  validateAndOptimizePlan(plan, state, goalStates) {
    if (!plan || !Array.isArray(plan.steps)) {
      return { steps: [] };
    }

    const validatedSteps = [];
    
    for (const step of plan.steps) {
      if (!step.skill) continue;
      
      // 1. 检查 Skill 是否存在
      if (!this.availableSkills.includes(step.skill)) {
        logger.logAgent(`Planner 返回了无效的 Skill: ${step.skill}`, {}, 'WARN');
        continue;
      }

      // 2. 检查 Skill 是否超过最大执行次数
      const executionCount = this.skillExecutionCounts.get(step.skill) || 0;
      if (executionCount >= this.maxExecutionsPerSkill) {
        logger.logAgent(`Skill ${step.skill} 已达到最大执行次数，跳过`, {}, 'WARN');
        continue;
      }

      // 3. 检查 Skill 的 requiresState 是否满足
      const contract = STATE_CONTRACTS[step.skill];
      if (!contract) {
        logger.logAgent(`Skill ${step.skill} 没有状态契约，跳过`, {}, 'WARN');
        continue;
      }

      const missingRequires = contract.requiresState.filter(req => !this.hasState(state, req));
      if (missingRequires.length > 0) {
        logger.logAgent(`Skill ${step.skill} 的 requiresState 不满足: ${missingRequires.join(', ')}`, {}, 'WARN');
        // 不直接跳过，而是先规划满足 requiresState 的 Skill
        // 这里简化处理：如果缺少关键依赖，先规划依赖
        const dependencyPlan = this.planDependencies(missingRequires, state);
        validatedSteps.push(...dependencyPlan);
        continue;
      }

      // 4. 检查 Skill 是否会产生新状态（避免重复执行）
      const produces = contract.producesState;
      const alreadyProduced = produces.every(prod => this.hasState(state, prod));
      if (alreadyProduced && executionCount > 0) {
        logger.logAgent(`Skill ${step.skill} 已产生所需状态，跳过重复执行`, {}, 'WARN');
        continue;
      }

      // 5. 验证通过
      validatedSteps.push({
        skill: step.skill,
        produces: step.produces || produces[0] || 'unknown',
        reason: step.reason || `产生状态: ${produces.join(', ')}`
      });
    }

    return { steps: validatedSteps };
  }

  /**
   * 规划依赖（满足 requiresState）
   */
  planDependencies(missingRequires, state) {
    const steps = [];
    
    for (const required of missingRequires) {
      // 找到能产生该状态的 Skill
      const producers = Object.entries(STATE_CONTRACTS)
        .filter(([name, contract]) => contract.producesState.includes(required))
        .map(([name]) => name);

      if (producers.length > 0) {
        // 选择第一个可用的（可以优化为选择 requiresState 最少的）
        const skill = producers[0];
        const contract = STATE_CONTRACTS[skill];
        
        // 检查该 Skill 的依赖是否满足
        const skillMissingRequires = contract.requiresState.filter(req => !this.hasState(state, req));
        if (skillMissingRequires.length === 0) {
          steps.push({
            skill,
            produces: required,
            reason: `满足依赖: ${required}`
          });
        }
      }
    }

    return steps;
  }

  /**
   * 基于规则的规划（LLM 失败时的后备）
   */
  planWithRules(goalStates, state, intent, request) {
    const steps = [];
    const missingStates = this.getMissingStates(goalStates, state);

    if (missingStates.length === 0) {
      return { steps: [] };
    }

    // 对每个缺失的状态，找到能产生它的 Skill
    for (const missing of missingStates) {
      const producers = Object.entries(STATE_CONTRACTS)
        .filter(([name, contract]) => contract.producesState.includes(missing))
        .map(([name, contract]) => ({ name, contract }));

      if (producers.length > 0) {
        // 选择 requiresState 最少的 Skill
        const best = producers.reduce((best, current) => {
          const bestMissing = best.contract.requiresState.filter(r => !this.hasState(state, r)).length;
          const currentMissing = current.contract.requiresState.filter(r => !this.hasState(state, r)).length;
          return currentMissing < bestMissing ? current : best;
        });

        // 检查依赖是否满足
        const missingRequires = best.contract.requiresState.filter(r => !this.hasState(state, r));
        if (missingRequires.length === 0) {
          steps.push({
            skill: best.name,
            produces: missing,
            reason: `规则规划: 产生 ${missing}`
          });
        } else {
          // 递归规划依赖
          const depSteps = this.planDependencies(missingRequires, state);
          steps.push(...depSteps);
          steps.push({
            skill: best.name,
            produces: missing,
            reason: `规则规划: 产生 ${missing}`
          });
        }
      }
    }

    return { steps: steps.slice(0, 2) }; // 限制为最多 2 步
  }

  /**
   * 记录 Skill 执行（用于跟踪执行次数）
   */
  recordSkillExecution(skillName) {
    const count = (this.skillExecutionCounts.get(skillName) || 0) + 1;
    this.skillExecutionCounts.set(skillName, count);
  }

  /**
   * 重置执行计数（新任务开始时）
   */
  resetExecutionCounts() {
    this.skillExecutionCounts.clear();
  }

  /**
   * 检查状态是否发生变化（用于避免无限循环）
   */
  hasStateChanged(oldState, newState, stateKey) {
    const oldValue = this.getStateValue(oldState, stateKey);
    const newValue = this.getStateValue(newState, stateKey);
    
    if (oldValue === undefined && newValue !== undefined) return true;
    if (oldValue !== undefined && newValue === undefined) return true;
    
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  }

  /**
   * 获取状态值
   */
  getStateValue(state, stateKey) {
    const keys = stateKey.split('.');
    let current = state;
    
    for (const key of keys) {
      if (current == null) return undefined;
      current = current[key];
    }
    
    return current;
  }
}

module.exports = PlannerAgent;
