/**
 * Agent Orchestrator - Agent 状态机调度器
 * 负责协调各个模块，管理状态转换
 */

const MemoryManager = require('../memory');
const RuleEngine = require('../rules/ruleEngine');
const IntentPlanner = require('./intentPlanner');
const ConsistencyChecker = require('./consistencyChecker');
const RewriteAgent = require('./rewriter');
const MemoryUpdater = require('./memoryUpdater');
const { AgentStates } = require('../memory/types');

class AgentOrchestrator {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.state = AgentStates.IDLE;
    this.memory = null;
    this.ruleEngine = null;
    this.intentPlanner = null;
    this.consistencyChecker = null;
    this.rewriter = null;
    this.memoryUpdater = null;
    this.currentTask = null;
    this.executionLog = [];
    this.initialized = false;
  }

  /**
   * 初始化 Agent
   */
  async initialize() {
    try {
      console.log('🚀 初始化 Novel Agent Orchestrator...');

      // 初始化记忆系统
      this.memory = new MemoryManager(this.workspaceRoot);
      await this.memory.initialize();

      // 初始化规则引擎
      this.ruleEngine = new RuleEngine(this.workspaceRoot);
      await this.ruleEngine.loadRules();

      // 初始化各个 Agent 模块
      this.intentPlanner = new IntentPlanner();
      this.consistencyChecker = new ConsistencyChecker(this.ruleEngine);
      this.rewriter = new RewriteAgent();
      this.memoryUpdater = new MemoryUpdater(this.memory);

      this.initialized = true;
      this.setState(AgentStates.IDLE);
      this.log('Agent initialized', { success: true });

      console.log('✅ Agent 初始化完成（含记忆、规则、意图、校验、重写、更新器）');
      return { success: true };

    } catch (error) {
      console.error('❌ Agent 初始化失败:', error);
      this.setState(AgentStates.ERROR);
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行 Agent 任务
   * @param {Object} request - 用户请求
   * @param {Function} llmCaller - LLM 调用函数
   */
  async execute(request, llmCaller) {
    if (!this.initialized) {
      throw new Error('Agent 未初始化，请先调用 initialize()');
    }

    this.currentTask = {
      id: `task_${Date.now()}`,
      request: request.userRequest,
      startedAt: new Date().toISOString(),
      status: 'running'
    };

    this.log('Task started', { taskId: this.currentTask.id, request: request.userRequest });

    try {
      // 状态 1: 加载上下文
      this.setState(AgentStates.LOAD_CONTEXT);
      const context = await this.loadContext(request);
      this.log('Context loaded', { contextSize: JSON.stringify(context).length });

      // 状态 2: 规划意图
      this.setState(AgentStates.PLAN_INTENT);
      const intent = await this.planIntent(request, context, llmCaller);
      this.log('Intent planned', { intent });

      // 状态 3: 生成初稿
      this.setState(AgentStates.WRITE_DRAFT);
      const draft = await this.writeDraft(intent, context, llmCaller);
      this.log('Draft generated', { draftLength: draft.text?.length || 0 });

      // 状态 4: 一致性校验
      this.setState(AgentStates.CHECK_CONSISTENCY);
      let checkResult = await this.checkConsistency(draft.text, intent, context, llmCaller);
      this.log('Consistency checked', { status: checkResult.status });

      let finalText = draft.text;
      let rewriteCount = 0;
      const maxRewrites = 2; // 最多重写 2 次

      // 如果校验失败，进入重写循环
      while (checkResult.status === 'fail' && rewriteCount < maxRewrites) {
        this.setState(AgentStates.REWRITE);
        rewriteCount++;
        this.log('Rewriting', { attempt: rewriteCount, errors: checkResult.errors.length });

        const rewritten = await this.rewrite(finalText, intent, checkResult.errors, context, llmCaller);
        finalText = rewritten.text;

        // 重新校验
        this.setState(AgentStates.CHECK_CONSISTENCY);
        checkResult = await this.checkConsistency(finalText, intent, context, llmCaller);
        this.log('Re-checked after rewrite', { status: checkResult.status });

        if (checkResult.status === 'pass') {
          break;
        }
      }

      // 状态 5: 更新记忆
      if (checkResult.status === 'pass') {
        this.setState(AgentStates.UPDATE_MEMORY);
        await this.updateMemory(finalText, request, context, llmCaller);
        this.log('Memory updated');
      }

      // 状态 6: 完成
      this.setState(AgentStates.DONE);
      this.currentTask.status = 'completed';
      this.currentTask.completedAt = new Date().toISOString();

      return {
        success: true,
        text: finalText,
        intent,
        checkResult,
        rewriteCount,
        executionLog: this.executionLog.slice(-10) // 返回最后 10 条日志
      };

    } catch (error) {
      console.error('❌ Agent 执行失败:', error);
      this.setState(AgentStates.ERROR);
      this.currentTask.status = 'failed';
      this.currentTask.error = error.message;
      this.log('Task failed', { error: error.message });

      return {
        success: false,
        error: error.message,
        executionLog: this.executionLog.slice(-10)
      };
    }
  }

  /**
   * 状态 1: 加载上下文
   */
  async loadContext(request) {
    const context = await this.memory.loadContext(request.userRequest);
    
    // 添加向量检索结果（如果可用）
    if (request.vectorResults) {
      context.vectorResults = request.vectorResults;
    }

    return context;
  }

  /**
   * 状态 2: 规划意图
   */
  async planIntent(request, context, llmCaller) {
    return await this.intentPlanner.plan(request.userRequest, context, llmCaller);
  }

  /**
   * 状态 3: 生成初稿
   */
  async writeDraft(intent, context, llmCaller) {
    console.log('📝 开始生成初稿...');

    const systemPrompt = `你是一个专业的小说写作助手，负责根据写作意图生成高质量的小说文本。

# 核心任务
根据提供的写作意图（Intent）和上下文信息，生成符合要求的小说文本。

# 写作要求
1. **严格遵守意图约束**：必须遵守 intent.constraints 中的所有禁止和必需项
2. **符合世界观**：所有内容必须符合提供的世界观规则
3. **人物性格一致**：人物言行必须符合其性格设定
4. **保持风格统一**：遵循 intent.writing_guidelines 中的风格要求
5. **情节连贯**：基于当前剧情状态，合理推进情节

# 输出要求
- 直接输出小说文本，不要添加任何解释、说明或标记
- 文本应该完整、连贯，符合小说写作规范
- 长度根据需求确定，通常 500-2000 字
- 保持段落结构，使用适当的换行`;

    const userPrompt = `# 写作意图
${JSON.stringify(intent, null, 2)}

# 上下文信息
${JSON.stringify({
  world_rules: context.world_rules || [],
  characters: context.characters || [],
  plot_context: context.plot_context || [],
  current_chapter: context.current_chapter || '未知章节'
}, null, 2)}

# 任务
请根据上述意图和上下文，生成符合要求的小说文本。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.7, // 写作需要一定的创造性
        maxTokens: 4096,
        topP: 0.95
      });

      // 处理返回值：createLLMCaller 返回 { success: true, response: "文本" } 或 { success: false, error: "错误" }
      let text = '';
      if (typeof result === 'string') {
        // 直接是字符串（虽然不应该发生，但兼容处理）
        text = result.trim();
      } else if (result && typeof result === 'object') {
        if (result.success === false) {
          // 调用失败
          throw new Error(result.error || 'LLM 调用失败');
        } else if (result.success === true && result.response) {
          // 调用成功，response 应该是字符串
          if (typeof result.response === 'string') {
            text = result.response.trim();
          } else {
            // 如果 response 不是字符串，尝试提取
            text = String(result.response).trim();
          }
        } else {
          // 未知格式，尝试提取文本
          text = String(result.response || result.text || result.content || result).trim();
        }
      } else {
        throw new Error('LLM 返回格式不正确: ' + typeof result);
      }

      if (!text) {
        throw new Error('生成的文本为空');
      }

      console.log(`✅ 初稿生成完成，长度: ${text.length} 字符`);

      return {
        text,
        generatedAt: new Date().toISOString(),
        intent,
        context
      };
    } catch (error) {
      console.error('❌ 生成初稿失败:', error);
      throw new Error(`生成初稿失败: ${error.message}`);
    }
  }

  /**
   * 状态 4: 一致性校验
   */
  async checkConsistency(text, intent, context, llmCaller) {
    return await this.consistencyChecker.check(text, intent, context, llmCaller);
  }

  /**
   * 状态 5: 约束式重写
   */
  async rewrite(originalText, intent, errors, context, llmCaller) {
    return await this.rewriter.rewrite(originalText, intent, errors, context, llmCaller);
  }

  /**
   * 状态 6: 更新记忆
   */
  async updateMemory(text, request, context, llmCaller) {
    const result = await this.memoryUpdater.update(text, request, context, llmCaller);
    this.log('Memory updated', result);
    return result;
  }

  /**
   * 设置状态
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.log('State changed', { from: oldState, to: newState });
    console.log(`🔄 Agent 状态: ${oldState} → ${newState}`);
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.state;
  }

  /**
   * 获取当前任务
   */
  getCurrentTask() {
    return this.currentTask;
  }

  /**
   * 记录日志
   */
  log(action, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      state: this.state,
      action,
      data
    };

    this.executionLog.push(logEntry);

    // 限制日志大小
    if (this.executionLog.length > 100) {
      this.executionLog = this.executionLog.slice(-50);
    }
  }

  /**
   * 获取执行日志
   */
  getExecutionLog(count = 10) {
    return this.executionLog.slice(-count);
  }

  /**
   * 清空日志
   */
  clearLog() {
    this.executionLog = [];
  }

  /**
   * 暂停执行
   */
  pause() {
    // TODO: 实现暂停逻辑
    this.log('Paused');
  }

  /**
   * 恢复执行
   */
  resume() {
    // TODO: 实现恢复逻辑
    this.log('Resumed');
  }

  /**
   * 取消执行
   */
  cancel() {
    if (this.currentTask) {
      this.currentTask.status = 'cancelled';
      this.setState(AgentStates.IDLE);
      this.log('Task cancelled');
    }
  }
}

module.exports = AgentOrchestrator;

