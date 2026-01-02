/**
 * Agent Orchestrator - Agent 状态机调度器
 * 负责协调各个模块，管理状态转换
 */

const MemoryManager = require('../memory');
const RuleEngine = require('../rules/ruleEngine'); // 保留旧规则引擎作为兼容
const DSLRuleEngine = require('../rules/dslRuleEngine'); // 新的 DSL 规则引擎
const IntentAnalyzer = require('./modules/analysis/intentAnalyzer'); // 意图分析器
const IntentPlanner = require('./modules/planning/intentPlanner');
const ConsistencyChecker = require('./modules/checking/consistencyChecker');
const RewriteAgent = require('./modules/writing/rewriter');
const MemoryUpdater = require('./modules/context/memoryUpdater');
const FileScanner = require('./modules/context/fileScanner'); // 文件扫描器
const ChapterAnalyzer = require('./modules/analysis/chapterAnalyzer'); // 章节分析器
const ChapterPlanner = require('./modules/planning/chapterPlanner'); // 章节规划器
const ChapterFileManager = require('../memory/managers/chapterFileManager'); // 章节文件管理器
const CoherenceChecker = require('./modules/checking/coherenceChecker'); // 连贯性检查器
const PacingController = require('./modules/control/pacingController'); // 节奏控制器
const EmotionCurveManager = require('./modules/control/emotionCurveManager'); // 情绪曲线管理器
const DensityController = require('./modules/control/densityController'); // 密度控制器
const SceneStructurePlanner = require('./modules/planning/sceneStructurePlanner'); // 场景结构规划器
const ContextLoader = require('./modules/context/contextLoader'); // 智能上下文加载器
const ErrorHandler = require('./utils/errorHandler'); // 错误处理工具
const PerformanceOptimizer = require('./utils/performanceOptimizer'); // 性能优化工具
const ReportGenerator = require('./utils/reportGenerator'); // 报告生成器
const SkillExecutor = require('./skills/core/skillExecutor'); // Skill 执行器
const SkillRouter = require('./skills/core/skillRouter'); // Skill 路由器
const { AgentStates } = require('../memory/types');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const logger = require('../utils/logger');

class AgentOrchestrator {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.state = AgentStates.IDLE;
    this.memory = null;
    this.ruleEngine = null; // 旧规则引擎（兼容）
    this.dslRuleEngine = null; // 新的 DSL 规则引擎
    this.intentAnalyzer = null; // 意图分析器（新增）
    this.intentPlanner = null;
    this.consistencyChecker = null;
    this.rewriter = null;
    this.memoryUpdater = null;
    this.fileScanner = null; // 文件扫描器
    this.chapterAnalyzer = null; // 章节分析器
    this.chapterPlanner = null; // 章节规划器
    this.chapterFileManager = null; // 章节文件管理器
    this.coherenceChecker = null; // 连贯性检查器
    this.pacingController = null; // 节奏控制器
    this.emotionCurveManager = null; // 情绪曲线管理器
    this.densityController = null; // 密度控制器
    this.sceneStructurePlanner = null; // 场景结构规划器
    this.contextLoader = null; // 智能上下文加载器（新增）
    this.skillExecutor = null; // Skill 执行器（新增）
    this.skillRouter = null; // Skill 路由器（新增）
    this.currentTask = null;
    this.executionLog = [];
    this.initialized = false;
    this.performanceOptimizer = new PerformanceOptimizer(); // 性能优化器
    this.reportGenerator = new ReportGenerator(); // 报告生成器
    this.statistics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0
    };
  }

  /**
   * 初始化 Agent
   */
  async initialize() {
    try {
      logger.logAgent('Agent 初始化开始', { workspaceRoot: this.workspaceRoot });

      // 初始化记忆系统
      this.memory = new MemoryManager(this.workspaceRoot);
      await this.memory.initialize();

      // 初始化规则引擎（兼容）
      this.ruleEngine = new RuleEngine(this.workspaceRoot);
      await this.ruleEngine.loadRules();

      // 初始化 DSL 规则引擎
      this.dslRuleEngine = new DSLRuleEngine(this.workspaceRoot);
      const appPath = app.getAppPath();
      const defaultRulesPath = path.join(appPath, 'rules/default-dsl-rules.json');
      const customRulesPath = path.join(this.workspaceRoot, 'rules/dsl-rules.json');
      await this.dslRuleEngine.loadRules(defaultRulesPath, customRulesPath);

      // 初始化文件系统组件
      this.fileScanner = new FileScanner(this.workspaceRoot);
      this.chapterFileManager = new ChapterFileManager(this.workspaceRoot);
      await this.chapterFileManager.initialize();

      // 初始化各个 Agent 模块
      this.intentAnalyzer = new IntentAnalyzer(); // 意图分析器（新增）
      this.intentPlanner = new IntentPlanner();
      this.chapterAnalyzer = new ChapterAnalyzer(this.memory);
      this.chapterPlanner = new ChapterPlanner(this.memory);
      this.coherenceChecker = new CoherenceChecker(this.dslRuleEngine, this.memory);
      this.pacingController = new PacingController();
      this.emotionCurveManager = new EmotionCurveManager();
      this.densityController = new DensityController();
      this.sceneStructurePlanner = new SceneStructurePlanner();
      this.consistencyChecker = new ConsistencyChecker(this.dslRuleEngine); // 使用 DSL 规则引擎
      this.rewriter = new RewriteAgent();
      this.memoryUpdater = new MemoryUpdater(this.memory, this.workspaceRoot); // 传入 workspaceRoot
      this.contextLoader = new ContextLoader(this.workspaceRoot, this.fileScanner, this.chapterFileManager, this.memory); // 智能上下文加载器（传入 memory 用于获取设定文件）

      // 初始化 Skill 系统（新增）
      this.skillRouter = new SkillRouter();
      this.skillExecutor = new SkillExecutor(this.workspaceRoot, {
        memory: this.memory,
        contextLoader: this.contextLoader,
        chapterFileManager: this.chapterFileManager,
        chapterPlanner: this.chapterPlanner,
        rewriter: this.rewriter,
        consistencyChecker: this.consistencyChecker,
        intentPlanner: this.intentPlanner,
        chapterAnalyzer: this.chapterAnalyzer,
        coherenceChecker: this.coherenceChecker,
        pacingController: this.pacingController,
        emotionCurveManager: this.emotionCurveManager,
        densityController: this.densityController,
        memoryUpdater: this.memoryUpdater,
        fileScanner: this.fileScanner,
        performanceOptimizer: this.performanceOptimizer
      });

      this.initialized = true;
      this.setState(AgentStates.IDLE);
      this.log('Agent initialized', { success: true });

      logger.logAgent('Agent 初始化完成', { 
        memory: !!this.memory,
        rules: !!this.ruleEngine,
        dslRules: !!this.dslRuleEngine,
        intentAnalyzer: !!this.intentAnalyzer,
        consistencyChecker: !!this.consistencyChecker,
        rewriter: !!this.rewriter,
        memoryUpdater: !!this.memoryUpdater
      });
      return { success: true };

    } catch (error) {
      logger.logAgent('Agent 初始化失败', { error: error.message }, 'ERROR');
      this.setState(AgentStates.ERROR);
      return { success: false, error: error.message };
    }
  }

  /**
   * 执行 Agent 任务（使用 Skill 架构）
   * @param {Object} request - 用户请求
   * @param {Function} llmCaller - LLM 调用函数
   * @param {boolean} useSkills - 是否使用 Skill 架构（默认 true）
   */
  async execute(request, llmCaller, useSkills = true) {
    // 如果启用 Skill 架构，使用新的执行流程
    if (useSkills && this.skillExecutor && this.skillRouter) {
      return await this.executeWithSkills(request, llmCaller);
    }
    
    // 否则使用原有流程（向后兼容）
    return await this.executeLegacy(request, llmCaller);
  }

  /**
   * 使用 Skill 架构执行任务（新增）
   * @param {Object} request - 用户请求
   * @param {Function} llmCaller - LLM 调用函数
   */
  async executeWithSkills(request, llmCaller) {
    if (!this.initialized) {
      throw new Error('Agent 未初始化，请先调用 initialize()');
    }

    const startTime = Date.now();
    this.statistics.totalTasks++;

    this.currentTask = {
      id: `task_${Date.now()}`,
      request: request.userRequest,
      startedAt: new Date().toISOString(),
      status: 'running',
      steps: []
    };

    this.log('Task started (Skill mode)', { taskId: this.currentTask.id, request: request.userRequest });

    try {
      // 步骤 1: 分析意图并路由 Skill
      this.setState(AgentStates.LOAD_CONTEXT);
      this.addStep('route_skills', '路由 Skill 序列');
      
      const routeResult = this.skillRouter.route(request, {
        workspaceRoot: this.workspaceRoot,
        targetChapter: request.targetChapter,
        targetFile: request.targetFile
      });

      this.log('Skills routed', { 
        intentType: routeResult.intentType,
        skillCount: routeResult.skills.length 
      });

      // 步骤 2: 执行 Skill 序列
      const skillResults = [];
      const executionContext = {
        workspaceRoot: this.workspaceRoot,
        targetChapter: request.targetChapter,
        targetFile: request.targetFile,
        userRequest: request.userRequest
      };

      // 保存当前执行状态（用于分阶段执行）
      this.pendingExecution = {
        routeResult,
        skillResults: [],
        executionContext,
        currentSkillIndex: 0,
        llmCaller
      };

      for (let i = 0; i < routeResult.skills.length; i++) {
        const skillPlan = routeResult.skills[i];
        this.pendingExecution.currentSkillIndex = i;
        
        this.addStep(`execute_${skillPlan.name}`, `执行 ${skillPlan.name}`);
        
        // 检查条件（如果有）
        if (skillPlan.condition && !this.evaluateCondition(skillPlan.condition, executionContext)) {
          this.log(`跳过 Skill: ${skillPlan.name} (条件不满足)`);
          continue;
        }

        // 动态补充输入参数（从执行上下文中获取）
        const finalInput = this.enrichSkillInput(skillPlan.name, skillPlan.input, executionContext);

        const result = await this.skillExecutor.execute(
          skillPlan.name,
          finalInput,
          { llmCaller, context: executionContext }
        );

        skillResults.push(result);
        this.pendingExecution.skillResults = skillResults;

        // 如果 Skill 失败且是关键步骤，中断执行
        if (!result.success && this.isCriticalSkill(skillPlan.name)) {
          throw new Error(`关键 Skill 执行失败: ${skillPlan.name} - ${result.error}`);
        }

        // 更新执行上下文（将 Skill 结果传递给下一个 Skill）
        // 只有在成功时才更新上下文
        if (result.success && result.result) {
          this.updateExecutionContext(executionContext, skillPlan.name, result.result);
        }

        // 特殊处理：plan_chapter_outline 需要用户确认
        if (skillPlan.name === 'plan_chapter_outline' && result.result?.requiresUserConfirmation) {
          this.log('等待用户确认大纲', { outline: result.result.outline });
          this.setState(AgentStates.WAITING_USER_CONFIRMATION);
          
          // 返回中间结果，等待用户确认
          return {
            success: true,
            requiresUserConfirmation: true,
            confirmationType: 'outline',
            outline: result.result.outline,
            scenes: result.result.scenes,
            executionContext: this.sanitizeForIPC(executionContext),
            skillResults: this.sanitizeSkillResults(skillResults),
            pendingExecution: this.sanitizePendingExecution(this.pendingExecution)
          };
        }

        // 新流程：check_all -> generate_rewrite_plan -> rewrite_with_plan
        // 旧的重写循环逻辑已移除，由新流程统一处理
      }

      // 步骤 3: 汇总结果
      const finalResult = this.aggregateSkillResults(skillResults, routeResult);

      const executionTime = Date.now() - startTime;
      this.statistics.successfulTasks++;
      this.updateStatistics(executionTime);

      this.currentTask.status = 'completed';
      this.currentTask.completedAt = new Date().toISOString();
      this.currentTask.executionTime = executionTime;
      this.setState(AgentStates.DONE);

      this.log('Task completed (Skill mode)', { 
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        skillCount: skillResults.length
      });

      return {
        success: true,
        ...finalResult,
        executionTime,
        skillResults: this.sanitizeSkillResults(skillResults),
        statistics: this.getTaskStatistics()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.statistics.failedTasks++;
      this.updateStatistics(executionTime);

      this.currentTask.status = 'failed';
      this.currentTask.error = error.message;
      this.currentTask.executionTime = executionTime;
      this.setState(AgentStates.ERROR);

      this.log('Task failed (Skill mode)', { error: error.message });
      throw error;
    }
  }

  /**
   * 继续执行（用户确认大纲后）
   * @param {Object} options - 选项
   * @param {string} options.userModifiedOutline - 用户修改后的大纲（可选）
   * @param {Function} llmCaller - LLM 调用函数
   */
  async continueExecution(options = {}, llmCaller) {
    if (!this.pendingExecution) {
      throw new Error('没有待执行的流程');
    }

    const { userModifiedOutline } = options;
    const { routeResult, skillResults, executionContext, currentSkillIndex } = this.pendingExecution;

    // 如果用户修改了大纲，更新执行上下文
    if (userModifiedOutline) {
      executionContext.userModifiedOutline = userModifiedOutline;
    }

    // 从上次中断的地方继续执行
    const startTime = Date.now();
    this.setState(AgentStates.PLAN_INTENT);

    try {
      for (let i = currentSkillIndex + 1; i < routeResult.skills.length; i++) {
        const skillPlan = routeResult.skills[i];
        this.pendingExecution.currentSkillIndex = i;
        
        this.addStep(`execute_${skillPlan.name}`, `执行 ${skillPlan.name}`);

        // 检查条件
        if (skillPlan.condition && !this.evaluateCondition(skillPlan.condition, executionContext)) {
          this.log(`跳过 Skill: ${skillPlan.name} (条件不满足)`);
          continue;
        }

        // 动态补充输入参数
        const finalInput = this.enrichSkillInput(skillPlan.name, skillPlan.input, executionContext);

        const result = await this.skillExecutor.execute(
          skillPlan.name,
          finalInput,
          { llmCaller, context: executionContext }
        );

        skillResults.push(result);
        this.pendingExecution.skillResults = skillResults;

        // 如果 Skill 失败且是关键步骤，中断执行
        if (!result.success && this.isCriticalSkill(skillPlan.name)) {
          throw new Error(`关键 Skill 执行失败: ${skillPlan.name} - ${result.error}`);
        }

        // 更新执行上下文
        if (result.success && result.result) {
          this.updateExecutionContext(executionContext, skillPlan.name, result.result);
        }
      }

      // 汇总结果
      const finalResult = this.aggregateSkillResults(skillResults, routeResult);

      const executionTime = Date.now() - startTime;
      this.statistics.successfulTasks++;
      this.updateStatistics(executionTime);

      this.currentTask.status = 'completed';
      this.currentTask.completedAt = new Date().toISOString();
      this.currentTask.executionTime = executionTime;
      this.setState(AgentStates.DONE);

      // 清除待执行状态
      this.pendingExecution = null;

      this.log('Task completed (continued)', { 
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        skillCount: skillResults.length
      });

      return {
        success: true,
        ...finalResult,
        executionTime,
        skillResults: this.sanitizeSkillResults(skillResults),
        statistics: this.getTaskStatistics()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.statistics.failedTasks++;
      this.updateStatistics(executionTime);

      this.currentTask.status = 'failed';
      this.currentTask.error = error.message;
      this.currentTask.executionTime = executionTime;
      this.setState(AgentStates.ERROR);

      // 清除待执行状态
      this.pendingExecution = null;

      this.log('Task failed (continued)', { error: error.message });
      throw error;
    }
  }

  /**
   * 应用更改并更新记忆
   * @param {Object} options - 选项
   * @param {Function} llmCaller - LLM 调用函数
   */
  async applyChangesAndUpdateMemory(options = {}, llmCaller) {
    if (!this.memory) {
      throw new Error('Memory manager not available');
    }

    const { content, chapterNumber } = options;

    if (!content) {
      throw new Error('Content is required');
    }

    if (!chapterNumber) {
      throw new Error('Chapter number is required');
    }

    try {
      // 1. 最终化章节（结算 ChapterExtract）
      const finalizeResult = await this.memory.finalizeChapter(chapterNumber);
      
      if (!finalizeResult.success) {
        throw new Error(finalizeResult.error || 'Finalize chapter failed');
      }

      // 2. 更新记忆系统
      const memoryUpdater = new MemoryUpdater(this.memory, this.workspaceRoot);
      const context = await this.memory.loadContext('');
      
      const updateResult = await memoryUpdater.update(
        content,
        { userRequest: '应用更改并更新记忆' },
        context,
        llmCaller
      );

      this.log('Memory updated', { success: updateResult.success });

      return {
        success: true,
        finalizeResult,
        updateResult
      };

    } catch (error) {
      this.log('Apply changes failed', { error: error.message }, 'ERROR');
      throw error;
    }
  }

  /**
   * 判断是否是关键 Skill
   */
  isCriticalSkill(skillName) {
    const criticalSkills = ['write_chapter', 'save_chapter'];
    return criticalSkills.includes(skillName);
  }

  /**
   * 丰富 Skill 输入参数（从执行上下文中动态获取）
   */
  enrichSkillInput(skillName, input, executionContext) {
    const enriched = { ...input };
    
    switch (skillName) {
      case 'analyze_previous_chapters':
        // 如果 targetChapter 不存在，从执行上下文中获取
        if (!enriched.targetChapter) {
          if (executionContext.targetChapter) {
            enriched.targetChapter = executionContext.targetChapter;
          } else if (executionContext.scanResult) {
            // 从扫描结果中获取
            if (executionContext.scanResult.latestChapter) {
              enriched.targetChapter = executionContext.scanResult.latestChapter + 1;
            } else if (executionContext.scanResult.totalChapters > 0) {
              enriched.targetChapter = executionContext.scanResult.totalChapters + 1;
            }
          }
          // 如果仍然没有，使用默认值 1
          if (!enriched.targetChapter || enriched.targetChapter < 1) {
            enriched.targetChapter = 1;
          }
        }
        break;
      
      case 'plan_chapter_outline':
        // 确保 chapterGoal 存在
        if (!enriched.chapterGoal) {
          enriched.chapterGoal = executionContext.userRequest || '续写新章节';
        }
        // 确保 targetChapter 存在
        if (!enriched.targetChapter) {
          if (executionContext.targetChapter) {
            enriched.targetChapter = executionContext.targetChapter;
          } else if (executionContext.scanResult) {
            if (executionContext.scanResult.latestChapter) {
              enriched.targetChapter = executionContext.scanResult.latestChapter + 1;
            } else if (executionContext.scanResult.totalChapters > 0) {
              enriched.targetChapter = executionContext.scanResult.totalChapters + 1;
            }
          }
          if (!enriched.targetChapter || enriched.targetChapter < 1) {
            enriched.targetChapter = 1;
          }
        }
        // 确保 previousAnalyses 存在
        if (!enriched.previousAnalyses) {
          enriched.previousAnalyses = executionContext.previousAnalyses || [];
        }
        break;
      
      case 'save_chapter':
        // 如果 chapterId 不存在，尝试从多个来源获取
        if (!enriched.chapterId) {
          // 1. 从执行上下文中获取
          if (executionContext.targetChapter) {
            enriched.chapterId = executionContext.targetChapter;
          }
          // 2. 从 filePath 中提取章节号
          else if (enriched.filePath) {
            const match = enriched.filePath.match(/第(\d+)章|chapter[_\s]?(\d+)|(\d+)\.(md|txt)/);
            if (match) {
              enriched.chapterId = parseInt(match[1] || match[2] || match[3]);
            }
          }
          // 3. 从 scanResult 中获取
          else if (executionContext.scanResult) {
            if (executionContext.scanResult.latestChapter) {
              enriched.chapterId = executionContext.scanResult.latestChapter + 1;
            } else if (executionContext.scanResult.totalChapters > 0) {
              enriched.chapterId = executionContext.scanResult.totalChapters + 1;
            }
          }
        }
        
        // 确保 content 存在（从执行上下文中获取）
        if (!enriched.content && executionContext.content) {
          enriched.content = executionContext.content;
        }
        // 如果还是没有，尝试从 finalContent 获取
        if (!enriched.content && executionContext.finalContent) {
          enriched.content = executionContext.finalContent;
        }
        // 如果还是没有，尝试从 rewrittenContent 获取
        if (!enriched.content && executionContext.rewrittenContent) {
          enriched.content = executionContext.rewrittenContent;
        }
        break;
      
      case 'check_all':
      case 'generate_rewrite_plan':
      case 'rewrite_with_plan':
        // 确保 content 存在（从执行上下文中获取）
        if (!enriched.content) {
          if (executionContext.content) {
            enriched.content = executionContext.content;
          } else if (executionContext.finalContent) {
            enriched.content = executionContext.finalContent;
          } else if (executionContext.rewrittenContent) {
            enriched.content = executionContext.rewrittenContent;
          }
        }
        
        // 对于 generate_rewrite_plan，确保 checkResult 存在
        if (skillName === 'generate_rewrite_plan' && !enriched.checkResult) {
          enriched.checkResult = executionContext.checkResult || {};
        }
        
        // 对于 rewrite_with_plan，确保 rewritePlan 存在
        if (skillName === 'rewrite_with_plan' && !enriched.rewritePlan) {
          enriched.rewritePlan = executionContext.rewritePlan || '';
        }
        break;
    }
    
    return enriched;
  }

  /**
   * 更新执行上下文
   */
  updateExecutionContext(context, skillName, result) {
    switch (skillName) {
      case 'load_story_context':
        context.worldRules = result.worldRules;
        context.characters = result.characters;
        context.plotState = result.plotState;
        context.foreshadows = result.foreshadows;
        break;
      
      case 'scan_chapters':
        context.scanResult = result;
        break;
      
      case 'analyze_previous_chapters':
        // 安全地获取 analyses，如果 result 不存在或没有 analyses，使用空数组
        if (result && result.analyses) {
          context.previousAnalyses = result.analyses;
        } else {
          context.previousAnalyses = [];
        }
        break;
      
      case 'load_chapter_content':
        context.existingContent = result.content;
        context.chapter = result.chapter;
        break;
      
      case 'plan_chapter':
        context.outline = result.outline;
        context.chapterPlan = result;
        break;
      
      case 'plan_chapter_outline':
        context.outline = result.outline;
        context.scenes = result.scenes;
        context.chapterPlan = result;
        break;
      
      case 'plan_intent':
        context.intent = result;
        context.constraints = result.constraints;
        context.style = result.writing_guidelines;
        break;
      
      case 'write_chapter':
        context.content = result.content;
        break;
      
      case 'rewrite_selected_text':
        context.content = result.rewrittenText;
        break;
      
      case 'rewrite_with_plan':
        context.content = result.rewrittenContent;
        context.rewriteChanges = result.changes;
        break;
      
      case 'check_all':
        context.checkResult = result;
        break;
      
      case 'generate_rewrite_plan':
        context.rewritePlan = result.rewritePlan;
        context.rewritePriority = result.priority;
        context.estimatedChanges = result.estimatedChanges;
        break;
      
      case 'check_coherence':
        context.coherenceResult = result;
        break;
      
      case 'analyze_curves':
        context.pacingAnalysis = result.pacingAnalysis;
        context.emotionAnalysis = result.emotionAnalysis;
        context.densityAnalysis = result.densityAnalysis;
        context.pacingComparison = result.pacingComparison;
        context.emotionComparison = result.emotionComparison;
        context.densityComparison = result.densityComparison;
        break;
      
      case 'check_character_consistency':
      case 'check_world_rule_violation':
        if (!context.checkResult) {
          context.checkResult = { errors: [], warnings: [] };
        }
        if (result.violations) {
          context.checkResult.errors.push(...result.violations);
        }
        break;
      
      // 注意：check_all 已在上面处理
      
      case 'update_memory':
        context.memoryUpdated = result.success;
        break;
      
      case 'finalize_chapter':
        context.finalContent = result.finalContent;
        break;
    }
  }

  /**
   * 评估条件（用于条件执行）
   */
  evaluateCondition(condition, context) {
    // 简单的条件评估，可以根据需要扩展
    if (typeof condition === 'function') {
      return condition(context);
    }
    return true;
  }

  /**
   * 清理对象以便 IPC 传输（移除不可序列化的内容）
   */
  sanitizeForIPC(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForIPC(item));
    }

    const sanitized = {};
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      
      const value = obj[key];
      
      // 跳过函数
      if (typeof value === 'function') {
        continue;
      }
      
      // 跳过循环引用（简单检测）
      if (value === obj) {
        continue;
      }
      
      // 递归清理嵌套对象
      if (typeof value === 'object' && value !== null) {
        // 跳过特殊对象类型
        if (value instanceof Error) {
          sanitized[key] = { message: value.message, stack: value.stack };
        } else if (value instanceof Date) {
          sanitized[key] = value.toISOString();
        } else if (value instanceof RegExp) {
          sanitized[key] = value.toString();
        } else {
          sanitized[key] = this.sanitizeForIPC(value);
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 清理 Skill 结果以便 IPC 传输
   */
  sanitizeSkillResults(skillResults) {
    if (!Array.isArray(skillResults)) {
      return [];
    }
    
    return skillResults.map(result => ({
      skill: result.skill || result.skillName,
      success: result.success,
      error: result.error,
      duration: result.duration,
      result: this.sanitizeForIPC(result.result),
      // 移除其他不可序列化的字段
    }));
  }

  /**
   * 清理待执行状态以便 IPC 传输
   */
  sanitizePendingExecution(pendingExecution) {
    if (!pendingExecution) {
      return null;
    }
    
    return {
      currentSkillIndex: pendingExecution.currentSkillIndex,
      routeResult: {
        intentType: pendingExecution.routeResult?.intentType,
        skills: pendingExecution.routeResult?.skills?.map(skill => ({
          name: skill.name,
          input: this.sanitizeForIPC(skill.input),
          condition: null // 条件通常是函数，不能序列化
        })) || [],
        pattern: pendingExecution.routeResult?.pattern || []
      },
      skillResults: this.sanitizeSkillResults(pendingExecution.skillResults || []),
      executionContext: this.sanitizeForIPC(pendingExecution.executionContext)
      // 移除 llmCaller（函数不能序列化）
    };
  }

  /**
   * 汇总检查结果
   */
  aggregateCheckResults(skillResults) {
    const checkResults = skillResults.filter(r => 
      r.skill && (r.skill.includes('check_') || r.skill === 'check_coherence') && r.success
    );
    
    if (checkResults.length === 0) {
      return null;
    }

    const allErrors = [];
    let hasFatal = false;
    let coherenceScore = 100;

    for (const checkResult of checkResults) {
      if (checkResult.result) {
        if (checkResult.result.violations) {
          allErrors.push(...checkResult.result.violations);
        }
        if (checkResult.result.overall_score !== undefined) {
          coherenceScore = Math.min(coherenceScore, checkResult.result.overall_score);
        }
      }
    }

    // 检查致命错误
    if (this.dslRuleEngine) {
      hasFatal = this.dslRuleEngine.hasFatalError(allErrors);
    }

    return {
      status: (allErrors.length === 0 && coherenceScore >= 60) ? 'pass' : 'fail',
      errors: allErrors,
      overall_score: coherenceScore,
      hasFatal
    };
  }

  /**
   * 汇总 Skill 结果
   */
  aggregateSkillResults(skillResults, routeResult) {
    const result = {
      text: '',
      intent: null,
      checkResult: null,
      coherenceResult: null,
      pacingAnalysis: null,
      emotionAnalysis: null,
      densityAnalysis: null,
      pacingComparison: null,
      emotionComparison: null,
      densityComparison: null,
      chapterPlan: null,
      rewriteCount: 0,
      executionLog: this.executionLog.slice(-10)
    };

    // 提取最终文本（按优先级：rewrite_with_plan > write_chapter > rewrite_selected_text）
    for (const skillResult of [...skillResults].reverse()) {
      if (skillResult.success && skillResult.result) {
        // 优先使用 rewrite_with_plan 的结果
        if (skillResult.skill === 'rewrite_with_plan' && skillResult.result.rewrittenContent) {
          result.text = skillResult.result.rewrittenContent;
          break;
        }
        // 其次使用 write_chapter 的结果
        if (skillResult.skill === 'write_chapter' && skillResult.result.content) {
          result.text = skillResult.result.content;
          break;
        }
        // 最后使用 rewrite_selected_text 的结果
        if (skillResult.skill === 'rewrite_selected_text' && skillResult.result.rewrittenText) {
          result.text = skillResult.result.rewrittenText;
          break;
        }
        // 兼容其他可能的字段名
        if (skillResult.result.content) {
          result.text = skillResult.result.content;
          break;
        } else if (skillResult.result.rewrittenText) {
          result.text = skillResult.result.rewrittenText;
          break;
        } else if (skillResult.result.rewrittenContent) {
          result.text = skillResult.result.rewrittenContent;
          break;
        }
      }
    }

    // 提取各种结果
    for (const skillResult of skillResults) {
      if (!skillResult.success || !skillResult.result) continue;

      switch (skillResult.skill) {
        case 'plan_intent':
          result.intent = skillResult.result;
          break;
        
        case 'plan_chapter':
          result.chapterPlan = skillResult.result;
          break;
        
        case 'check_coherence':
          result.coherenceResult = skillResult.result;
          break;
        
        case 'analyze_curves':
          result.pacingAnalysis = skillResult.result.pacingAnalysis;
          result.emotionAnalysis = skillResult.result.emotionAnalysis;
          result.densityAnalysis = skillResult.result.densityAnalysis;
          result.pacingComparison = skillResult.result.pacingComparison;
          result.emotionComparison = skillResult.result.emotionComparison;
          result.densityComparison = skillResult.result.densityComparison;
          break;
        
        case 'check_character_consistency':
        case 'check_world_rule_violation':
          if (!result.checkResult) {
            result.checkResult = { errors: [], warnings: [] };
          }
          if (skillResult.result.violations) {
            result.checkResult.errors.push(...skillResult.result.violations);
          }
          break;
        
        case 'check_all':
          // check_all 返回完整的检查结果
          result.checkResult = skillResult.result;
          break;
        
        case 'plan_chapter_outline':
          result.chapterPlan = skillResult.result;
          break;
      }
    }

    // 汇总检查结果状态
    if (result.checkResult) {
      result.checkResult.status = result.checkResult.errors.length === 0 ? 'pass' : 'fail';
    }

    // 提取重写次数
    const rewriteResults = skillResults.filter(r => r.skill === 'rewrite_selected_text');
    result.rewriteCount = rewriteResults.length;

    return result;
  }

  /**
   * 原有执行流程（向后兼容）
   * @deprecated 此方法已废弃，请使用 executeWithSkills 方法（Skill 架构）
   * 保留此方法仅用于向后兼容和测试
   * @param {Object} request - 用户请求
   * @param {Function} llmCaller - LLM 调用函数
   */
  async executeLegacy(request, llmCaller) {
    if (!this.initialized) {
      throw new Error('Agent 未初始化，请先调用 initialize()');
    }

    const startTime = Date.now();
    this.statistics.totalTasks++;

    this.currentTask = {
      id: `task_${Date.now()}`,
      request: request.userRequest,
      startedAt: new Date().toISOString(),
      status: 'running',
      steps: []
    };

    this.log('Task started (Legacy mode)', { taskId: this.currentTask.id, request: request.userRequest });

    try {
      // 使用错误处理包装执行
      return await ErrorHandler.withRetry(
        async () => {
          return await this._executeLegacyInternal(request, llmCaller, startTime);
        },
        {
          maxRetries: 2,
          retryDelay: 1000,
          shouldRetry: (error) => ErrorHandler.isRecoverable(error),
          onRetry: (attempt, error) => {
            this.log('Retrying task', { attempt, error: error.message });
          }
        }
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.statistics.failedTasks++;
      this.updateStatistics(executionTime);

      const errorInfo = ErrorHandler.handleError(error, {
        taskId: this.currentTask.id,
        request: request.userRequest
      });

      this.currentTask.status = 'failed';
      this.currentTask.error = errorInfo;
      this.currentTask.executionTime = executionTime;

      this.log('Task failed (Legacy mode)', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * 内部执行方法（原有实现，保持不变）
   */
  async executeInternal(request, llmCaller, startTime) {
    if (!this.initialized) {
      throw new Error('Agent 未初始化，请先调用 initialize()');
    }

    // 如果没有传入 startTime，使用当前时间
    const actualStartTime = startTime || Date.now();
    this.statistics.totalTasks++;

    this.currentTask = {
      id: `task_${Date.now()}`,
      request: request.userRequest,
      startedAt: new Date().toISOString(),
      status: 'running',
      steps: []
    };

    this.log('Task started', { taskId: this.currentTask.id, request: request.userRequest });

    try {
      // 使用错误处理包装执行
      return await ErrorHandler.withRetry(
        async () => {
          return await this._executeLegacyInternal(request, llmCaller, actualStartTime);
        },
        {
          maxRetries: 2,
          retryDelay: 1000,
          shouldRetry: (error) => ErrorHandler.isRecoverable(error),
          onRetry: (attempt, error) => {
            this.log('Retrying task', { attempt, error: error.message });
          }
        }
      );
    } catch (error) {
      const executionTime = Date.now() - actualStartTime;
      this.statistics.failedTasks++;
      this.updateStatistics(executionTime);

      const errorInfo = ErrorHandler.handleError(error, {
        taskId: this.currentTask.id,
        request: request.userRequest
      });

      this.currentTask.status = 'failed';
      this.currentTask.error = errorInfo;
      this.currentTask.executionTime = executionTime;

      this.log('Task failed', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * 内部执行方法（实际执行逻辑）
   * @deprecated 此方法已废弃，请使用 executeWithSkills 方法（Skill 架构）
   * 保留此方法仅用于向后兼容
   * 新流程：先分析意图，然后根据意图执行不同的流程
   * @private
   */
  async _executeLegacyInternal(request, llmCaller, startTime) {
      // ========== 阶段 0: 分析用户意图（新增） ==========
      this.setState(AgentStates.LOAD_CONTEXT);
      this.addStep('analyze_intent', '分析用户意图');
      
      const analyzedIntent = await ErrorHandler.withRetry(
        () => this.intentAnalyzer.analyze(request.userRequest, request.targetFile, llmCaller),
        {
          maxRetries: 2,
          shouldRetry: (error) => error.type === 'llm_error'
        }
      );
      
      this.log('Intent analyzed', { 
        intent_type: analyzedIntent.intent_type,
        target_chapter: analyzedIntent.target_chapter,
        target_file: analyzedIntent.target_file
      });

      // 根据意图类型执行不同的流程
      if (analyzedIntent.intent_type === 'CHECK') {
        return await this.executeCheckFlow(analyzedIntent, request, llmCaller, startTime);
      } else if (analyzedIntent.intent_type === 'REWRITE') {
        return await this.executeRewriteFlow(analyzedIntent, request, llmCaller, startTime);
      } else {
        // CONTINUE 或 CREATE 使用原有流程
        return await this.executeContinueFlow(analyzedIntent, request, llmCaller, startTime);
      }
  }

  /**
   * 执行校验流程（CHECK）
   */
  async executeCheckFlow(analyzedIntent, request, llmCaller, startTime) {
      this.log('Executing CHECK flow');
      
      // 状态 1: 智能加载上下文
      this.setState(AgentStates.LOAD_CONTEXT);
      const memoryContext = await this.memory.loadContext(request.userRequest);
      const context = await this.contextLoader.loadSmartContext({
        intentType: 'CHECK',
        targetChapter: analyzedIntent.target_chapter,
        targetFile: analyzedIntent.target_file,
        userRequest: request.userRequest,
        memoryContext
      });
      
      // 读取目标文件
      let existingContent = '';
      if (analyzedIntent.target_file) {
        const filePath = this.resolveFilePath(analyzedIntent.target_file);
        try {
          existingContent = await fs.readFile(filePath, 'utf-8');
          this.log('Target file read', { filePath, contentLength: existingContent.length });
        } catch (error) {
          throw new Error(`无法读取目标文件: ${analyzedIntent.target_file}`);
        }
      } else if (analyzedIntent.target_chapter) {
        // 从章节文件管理器获取文件路径
        const chapterFile = await this.chapterFileManager.getChapterFile(analyzedIntent.target_chapter);
        if (chapterFile) {
          existingContent = await fs.readFile(chapterFile.path, 'utf-8');
          this.log('Chapter file read', { chapter: analyzedIntent.target_chapter });
        }
      }

      if (!existingContent) {
        throw new Error('未找到目标文件内容');
      }

      // 状态 2: 执行一致性校验（使用智能上下文）
      this.setState(AgentStates.CHECK_CONSISTENCY);
      this.addStep('check_consistency', '执行一致性校验');
      
      // 创建临时 intent（用于校验）
      const tempIntent = {
        goal: '校验文本一致性',
        constraints: analyzedIntent.requirements || {}
      };
      
      // 构建上下文提示词
      const contextPrompt = this.contextLoader.buildContextPrompt(context, 'CHECK');
      
      // 增强上下文，包含文本上下文信息
      const enhancedContext = {
        ...context,
        contextPrompt: this.contextLoader.buildContextPrompt(context, 'CHECK') // 用于校验时的提示词
      };
      
      const checkResult = await this.checkConsistency(existingContent, tempIntent, enhancedContext, llmCaller);
      
      const executionTime = Date.now() - startTime;
      this.statistics.successfulTasks++;
      this.updateStatistics(executionTime);

      return {
        success: true,
        text: existingContent, // 返回原文本
        intent: tempIntent,
        checkResult,
        intent_analysis: analyzedIntent,
        executionTime,
        statistics: this.getTaskStatistics()
      };
  }

  /**
   * 执行重写流程（REWRITE）
   */
  async executeRewriteFlow(analyzedIntent, request, llmCaller, startTime) {
      this.log('Executing REWRITE flow');
      
      // 状态 1: 智能加载上下文
      this.setState(AgentStates.LOAD_CONTEXT);
      const memoryContext = await this.memory.loadContext(request.userRequest);
      const context = await this.contextLoader.loadSmartContext({
        intentType: 'REWRITE',
        targetChapter: analyzedIntent.target_chapter,
        targetFile: analyzedIntent.target_file,
        userRequest: request.userRequest,
        memoryContext
      });
      
      // 读取目标文件
      let existingContent = '';
      let targetFilePath = null;
      
      if (analyzedIntent.target_file) {
        targetFilePath = this.resolveFilePath(analyzedIntent.target_file);
        try {
          existingContent = await fs.readFile(targetFilePath, 'utf-8');
          this.log('Target file read for rewrite', { filePath: targetFilePath, contentLength: existingContent.length });
        } catch (error) {
          throw new Error(`无法读取目标文件: ${analyzedIntent.target_file}`);
        }
      } else if (analyzedIntent.target_chapter) {
        const chapterFile = await this.chapterFileManager.getChapterFile(analyzedIntent.target_chapter);
        if (chapterFile) {
          targetFilePath = chapterFile.path;
          existingContent = await fs.readFile(targetFilePath, 'utf-8');
          this.log('Chapter file read for rewrite', { chapter: analyzedIntent.target_chapter });
        }
      }

      if (!existingContent) {
        throw new Error('未找到目标文件内容，无法执行重写');
      }

      // 状态 2: 规划意图（基于智能上下文和用户需求）
      this.setState(AgentStates.PLAN_INTENT);
      this.addStep('plan_intent', '规划重写意图');
      
      // 构建上下文提示词
      const contextPrompt = this.contextLoader.buildContextPrompt(context, 'REWRITE');
      
      // 增强用户请求，包含智能上下文信息
      const enhancedRequest = {
        ...request,
        userRequest: `${request.userRequest}\n\n${contextPrompt}`
      };
      
      const intent = await this.planIntent(enhancedRequest, context, llmCaller);
      intent.is_rewrite = true;
      intent.original_content = existingContent;
      intent.target_file_path = targetFilePath;
      
      this.log('Intent planned for rewrite', { intent });

      // 状态 3: 生成重写版本
      this.setState(AgentStates.WRITE_DRAFT);
      this.addStep('write_draft', '生成重写版本');
      
      const draft = await ErrorHandler.withTimeout(
        this.writeDraft(intent, context, llmCaller, null, existingContent),
        6000000,
        '生成重写版本超时'
      );
      
      this.log('Rewrite draft generated', { draftLength: draft.text?.length || 0 });

      // 状态 4: 一致性校验（使用智能上下文）
      this.setState(AgentStates.CHECK_CONSISTENCY);
      this.addStep('check_consistency', '校验重写版本');
      
      // 增强上下文，包含文本上下文信息
      const enhancedContext = {
        ...context,
        contextPrompt: this.contextLoader.buildContextPrompt(context, 'REWRITE')
      };
      
      let checkResult = await this.checkConsistency(draft.text, intent, enhancedContext, llmCaller);
      let finalText = draft.text;
      let rewriteCount = 0;
      const maxRewrites = 2;

      // 如果校验失败，进入重写循环
      while (checkResult.status === 'fail' && rewriteCount < maxRewrites) {
        rewriteCount++;
        this.log('Rewriting', { attempt: rewriteCount, errors: checkResult.errors.length });

        const rewritten = await this.rewrite(finalText, intent, checkResult.errors, enhancedContext, llmCaller);
        finalText = rewritten.text;

        checkResult = await this.checkConsistency(finalText, intent, enhancedContext, llmCaller);
        this.log('Re-checked after rewrite', { status: checkResult.status });

        const stillHasFatal = this.dslRuleEngine.hasFatalError(checkResult.errors || []);
        if (checkResult.status === 'pass' && !stillHasFatal) {
          break;
        }
      }

      // 状态 5: 更新记忆（重写模式需要清理旧记忆）
      if (analyzedIntent.target_chapter) {
        this.addStep('update_memory', '更新记忆（清理旧记忆）');
        
        // 标记需要清理的章节
        const memoryUpdateResult = await this.memoryUpdater.update(finalText, {
          ...request,
          userRequest: request.userRequest,
          replace_chapter: analyzedIntent.target_chapter // 标记需要替换的章节
        }, context, llmCaller);
        
        // 如果记忆更新失败，记录但不影响整体流程
        if (!memoryUpdateResult.success) {
          console.warn('记忆更新失败（不影响重写结果）:', memoryUpdateResult.error);
        }
        
        // 自动结算机制（如果启用）
        await this.autoFinalizeChapterIfEnabled(analyzedIntent.target_chapter);
      }

      const executionTime = Date.now() - startTime;
      this.statistics.successfulTasks++;
      this.updateStatistics(executionTime);

      return {
        success: true,
        text: finalText,
        intent,
        checkResult,
        intent_analysis: analyzedIntent,
        rewriteCount,
        executionTime,
        statistics: this.getTaskStatistics(),
        target_file_path: targetFilePath
      };
  }

  /**
   * 执行续写/创建流程（CONTINUE/CREATE）
   */
  async executeContinueFlow(analyzedIntent, request, llmCaller, startTime) {
      this.log('Executing CONTINUE/CREATE flow');
      
      // 状态 1: 智能加载上下文
      this.setState(AgentStates.LOAD_CONTEXT);
      const memoryContext = await this.memory.loadContext(request.userRequest);
      const context = await this.contextLoader.loadSmartContext({
        intentType: analyzedIntent.intent_type,
        targetChapter: analyzedIntent.target_chapter,
        targetFile: analyzedIntent.target_file,
        userRequest: request.userRequest,
        memoryContext
      });
      this.log('Context loaded', { contextSize: JSON.stringify(context).length });

      // 状态 1.5: 扫描章节文件
      this.setState(AgentStates.LOAD_CONTEXT);
      const scanResult = await this.scanChapters();
      this.log('Chapters scanned', { totalChapters: scanResult.totalChapters, latestChapter: scanResult.latestChapter });

      // 状态 1.6: 分析已有章节（续写模式）
      let previousAnalyses = [];
      let chapterPlan = null;
      const targetChapter = analyzedIntent.target_chapter || this.extractChapterNumber(request.userRequest);
      
      if (targetChapter && targetChapter > 1) {
        this.setState(AgentStates.LOAD_CONTEXT);
        
        // 使用缓存优化
        const analysisCacheKey = this.performanceOptimizer.generateCacheKey(
          'chapter_analysis',
          targetChapter,
          scanResult.latestChapter
        );
        
        let cachedAnalyses = this.performanceOptimizer.getCached(analysisCacheKey);
        if (!cachedAnalyses) {
          previousAnalyses = await ErrorHandler.withRetry(
            () => this.analyzePreviousChapters(targetChapter, llmCaller),
            {
              maxRetries: 2,
              shouldRetry: (error) => error.type === 'llm_error' || error.type === 'network_error'
            }
          );
          this.performanceOptimizer.cacheResult(analysisCacheKey, previousAnalyses);
        } else {
          previousAnalyses = cachedAnalyses;
          this.log('Using cached chapter analyses', { count: previousAnalyses.length });
        }
        
        this.log('Previous chapters analyzed', { count: previousAnalyses.length });

        // 状态 1.7: 规划章节（新增）
        this.setState(AgentStates.PLAN_INTENT);
        chapterPlan = await ErrorHandler.withRetry(
          () => this.planChapter(targetChapter, previousAnalyses, request, context, llmCaller),
          {
            maxRetries: 2,
            shouldRetry: (error) => error.type === 'llm_error'
          }
        );
        this.log('Chapter planned', { chapterType: chapterPlan?.chapter_structure?.type });
      }

      // 状态 2: 规划意图（基于章节规划）
      this.setState(AgentStates.PLAN_INTENT);
      const intent = await this.planIntent(request, context, llmCaller, chapterPlan);
      this.log('Intent planned', { intent });

      // 状态 3: 生成初稿（支持章节规划控制）
      this.setState(AgentStates.WRITE_DRAFT);
      this.addStep('write_draft', '生成初稿');
      const draft = await ErrorHandler.withTimeout(
        this.writeDraft(intent, context, llmCaller, chapterPlan),
        6000000, // 10 分钟超时
        '生成初稿超时'
      );
      this.log('Draft generated', { draftLength: draft.text?.length || 0 });

      // 状态 4: 连贯性检查（新增）
      this.setState(AgentStates.CHECK_CONSISTENCY);
      this.addStep('check_coherence', '连贯性检查');
      let coherenceResult = await ErrorHandler.withTimeout(
        this.checkCoherence(draft.text, previousAnalyses, chapterPlan, llmCaller),
        6000000, // 10 分钟超时
        '连贯性检查超时'
      );
      this.log('Coherence checked', { 
        overall: coherenceResult.overall_coherence,
        score: coherenceResult.overall_score 
      });

      // 状态 4.5: 节奏、情绪、密度分析（新增，并行处理）
      this.addStep('curve_analysis', '曲线分析');
      const [pacingAnalysis, emotionAnalysis, densityAnalysis] = await this.performanceOptimizer.parallel([
        () => this.pacingController.analyzePacing(draft.text),
        () => this.emotionCurveManager.analyzeEmotionCurve(draft.text),
        () => this.densityController.analyzeDensity(draft.text)
      ], {
        maxConcurrency: 3,
        onProgress: (current, total) => {
          this.log('Curve analysis progress', { current, total });
        }
      });

      // 与目标曲线对比
      let pacingComparison = null;
      let emotionComparison = null;
      let densityComparison = null;

      if (chapterPlan && chapterPlan.success) {
        if (chapterPlan.pacing_curve) {
          pacingComparison = this.pacingController.compareWithTarget(
            pacingAnalysis,
            chapterPlan.pacing_curve
          );
        }
        if (chapterPlan.emotion_curve) {
          emotionComparison = this.emotionCurveManager.compareWithTarget(
            emotionAnalysis,
            chapterPlan.emotion_curve
          );
        }
        if (chapterPlan.density_curve) {
          densityComparison = this.densityController.compareWithTarget(
            densityAnalysis,
            chapterPlan.density_curve
          );
        }
      }

      this.log('Curve analysis completed', {
        pacing: pacingAnalysis.overall,
        emotion: emotionAnalysis?.end ? emotionAnalysis.end.toFixed(2) : 'N/A',
        density: densityAnalysis.overall
      });

      // 状态 5: 一致性校验（4层架构 + 状态机校验）
      this.setState(AgentStates.CHECK_CONSISTENCY);
      this.addStep('check_consistency', '一致性校验');
      let checkResult = await ErrorHandler.withTimeout(
        this.checkConsistency(draft.text, intent, context, llmCaller),
        6000000, // 10 分钟超时
        '一致性校验超时'
      );
      this.log('Consistency checked', { status: checkResult.status });

      // 合并连贯性检查结果到一致性检查结果
      if (coherenceResult.success && coherenceResult.overall_coherence !== 'good') {
        // 如果有连贯性问题，添加到错误列表
        if (!checkResult.errors) {
          checkResult.errors = [];
        }
        
        // 添加连贯性问题
        if (coherenceResult.plot_coherence.issues.length > 0) {
          checkResult.errors.push(...coherenceResult.plot_coherence.issues.map(issue => ({
            type: 'coherence',
            severity: issue.severity,
            message: `情节连贯性：${issue.message}`,
            suggestion: issue.suggestion
          })));
        }
        
        if (coherenceResult.emotion_coherence.issues.length > 0) {
          checkResult.errors.push(...coherenceResult.emotion_coherence.issues.map(issue => ({
            type: 'coherence',
            severity: issue.severity,
            message: `情绪连贯性：${issue.message}`,
            suggestion: issue.suggestion
          })));
        }

        // 如果连贯性分数太低，标记为失败
        if (coherenceResult.overall_score < 60) {
          checkResult.status = 'fail';
        }
      }

      // 状态机校验：检查是否有致命错误
      const hasFatalError = this.dslRuleEngine.hasFatalError(checkResult.errors || []);
      if (hasFatalError) {
        this.log('Fatal error detected', { errorCount: checkResult.errors?.length || 0 });
        // 致命错误必须修正，不能进入 UPDATE_MEMORY
      }

      let finalText = draft.text;
      let rewriteCount = 0;
      const maxRewrites = 2; // 最多重写 2 次

      // 如果校验失败，进入重写循环
      while (checkResult.status === 'fail' && rewriteCount < maxRewrites) {
        this.setState(AgentStates.REWRITE);
        rewriteCount++;
        this.log('Rewriting', { attempt: rewriteCount, errors: checkResult.errors.length });

        // 使用定向修复（基于规则 ID）
        const rewritten = await this.rewrite(finalText, intent, checkResult.errors, context, llmCaller);
        finalText = rewritten.text;

        // 重新校验
        this.setState(AgentStates.CHECK_CONSISTENCY);
        checkResult = await this.checkConsistency(finalText, intent, context, llmCaller);
        this.log('Re-checked after rewrite', { status: checkResult.status });

        // 状态机校验：如果仍有致命错误，继续重写
        const stillHasFatal = this.dslRuleEngine.hasFatalError(checkResult.errors || []);
        if (checkResult.status === 'pass' && !stillHasFatal) {
          break;
        }
      }

      // 状态 5: 更新记忆（已移除自动更新）
      // 现在记忆更新将在用户应用变更后执行，而不是在执行完成后自动执行
      // 这样可以确保只有用户确认应用变更后，才更新记忆系统
      this.log('Memory update deferred', { 
        note: '记忆更新将在用户应用变更后执行'
      });

      // 状态 6: 完成
      const executionTime = Date.now() - startTime;
      this.statistics.successfulTasks++;
      this.updateStatistics(executionTime);

      this.setState(AgentStates.DONE);
      this.currentTask.status = 'completed';
      this.currentTask.completedAt = new Date().toISOString();
      this.currentTask.executionTime = executionTime;

      const result = {
        success: true,
        text: finalText,
        intent,
        checkResult,
        coherenceResult,
        pacingAnalysis,
        emotionAnalysis,
        densityAnalysis,
        pacingComparison,
        emotionComparison,
        densityComparison,
        chapterPlan,
        rewriteCount,
        executionTime,
        statistics: this.getTaskStatistics(),
        executionLog: this.executionLog.slice(-10), // 返回最后 10 条日志
        report: this.reportGenerator.generateExecutionReport(this.currentTask, {
          success: true,
          text: finalText,
          checkResult,
          coherenceResult,
          pacingAnalysis,
          emotionAnalysis,
          densityAnalysis,
          pacingComparison,
          emotionComparison,
          densityComparison,
          chapterPlan,
          rewriteCount,
          executionTime
        })
      };

      this.log('Task completed', { 
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        rewriteCount,
        finalStatus: checkResult.status
      });

      // 生成可读报告（用于日志）
      const readableReport = this.reportGenerator.generateReadableReport(result.report);
      console.log(readableReport);

      // 自动结算机制（如果启用）
      if (analyzedIntent.target_chapter) {
        await this.autoFinalizeChapterIfEnabled(analyzedIntent.target_chapter);
      }

      return result;
  }

  /**
   * 自动结算章节（如果启用）
   * @param {number} chapterNumber - 章节号
   */
  async autoFinalizeChapterIfEnabled(chapterNumber) {
    try {
      // 检查设置：是否启用自动结算
      const { settings } = require('../core/database');
      const autoFinalize = settings.get('autoFinalizeChapter');
      
      // 默认不启用，需要用户手动配置
      if (autoFinalize !== 'true' && autoFinalize !== true) {
        return;
      }
      
      if (!chapterNumber || !this.memory || !this.memory.initialized) {
        return;
      }
      
      console.log(`🔄 自动结算第${chapterNumber}章（已启用自动结算）...`);
      
      // 检查是否有 ChapterExtract
      const extract = this.memory.readExtract(chapterNumber);
      if (!extract) {
        console.log(`ℹ️ 第${chapterNumber}章没有 ChapterExtract，跳过自动结算`);
        return;
      }
      
      // 执行结算
      const result = await this.memory.finalizeChapter(chapterNumber);
      if (result.success) {
        console.log(`✅ 第${chapterNumber}章自动结算完成`);
        this.log('Auto-finalized chapter', { chapter: chapterNumber });
      } else {
        console.warn(`⚠️ 第${chapterNumber}章自动结算失败:`, result.error);
      }
    } catch (error) {
      // 自动结算失败不影响主流程
      console.warn('自动结算失败（不影响主流程）:', error.message);
    }
  }

  /**
   * 更新统计信息
   */
  updateStatistics(executionTime) {
    this.statistics.totalExecutionTime += executionTime;
    const completedTasks = this.statistics.successfulTasks + this.statistics.failedTasks;
    if (completedTasks > 0) {
      this.statistics.averageExecutionTime = 
        this.statistics.totalExecutionTime / completedTasks;
    }
  }

  /**
   * 获取任务统计
   */
  getTaskStatistics() {
    return {
      ...this.statistics,
      successRate: this.statistics.totalTasks > 0
        ? (this.statistics.successfulTasks / this.statistics.totalTasks * 100).toFixed(2) + '%'
        : '0%'
    };
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
   * 扫描章节文件
   */
  async scanChapters() {
    try {
      const result = await this.fileScanner.scanChapterFiles();
      
      // 更新章节文件管理器
      if (result.success) {
        await this.chapterFileManager.updateMapping(result.chapterMapping);
      }

      return result;
    } catch (error) {
      console.error('扫描章节文件失败:', error);
      return {
        success: false,
        totalChapters: 0,
        latestChapter: 0,
        chapterMapping: {}
      };
    }
  }

  /**
   * 分析已有章节（续写模式）
   */
  async analyzePreviousChapters(targetChapter, llmCaller) {
    try {
      // 获取最近 N 章（默认 3 章）
      const recentCount = 3;
      const startChapter = Math.max(1, targetChapter - recentCount);
      const chapterNumbers = [];
      
      for (let i = startChapter; i < targetChapter; i++) {
        if (this.fileScanner.hasChapter(i)) {
          chapterNumbers.push(i);
        }
      }

      if (chapterNumbers.length === 0) {
        return [];
      }

      console.log(`📊 分析前 ${chapterNumbers.length} 章：第${chapterNumbers.join('、')}章`);

      // 并行处理：先检查缓存，再分析需要更新的章节
      const analysisTasks = chapterNumbers.map(chapterNum => async () => {
        // 检查是否需要更新
        const needsUpdate = await this.chapterFileManager.needsAnalysisUpdate(chapterNum);
        
        if (!needsUpdate) {
          // 使用缓存
          const cached = await this.chapterFileManager.loadAnalysis(chapterNum);
          if (cached) {
            return cached;
          }
        }

        // 重新分析
        const content = await this.fileScanner.readChapterContent(chapterNum);
        if (content) {
          const analysis = await this.chapterAnalyzer.analyzeChapter(chapterNum, content, llmCaller);
          if (analysis.success) {
            // 保存分析结果
            await this.chapterFileManager.saveAnalysis(chapterNum, analysis);
            return analysis;
          }
        }
        return null;
      });

      // 并行执行（限制并发数）
      const analyses = await this.performanceOptimizer.parallel(analysisTasks, {
        maxConcurrency: 2, // 限制并发，避免过多 LLM 调用
        onProgress: (current, total) => {
          this.log('Chapter analysis progress', { current, total });
        }
      });

      // 过滤 null 并排序
      return analyses.filter(a => a !== null).sort((a, b) => a.chapterNumber - b.chapterNumber);
    } catch (error) {
      console.error('分析已有章节失败:', error);
      return [];
    }
  }

  /**
   * 规划章节
   */
  async planChapter(targetChapter, previousAnalyses, request, context, llmCaller) {
    try {
      const plan = await this.chapterPlanner.planChapterForContinuation(
        targetChapter,
        previousAnalyses,
        request,
        context,
        llmCaller
      );

      if (plan.success) {
        // 保存章节规划
        await this.chapterFileManager.saveAnalysis(targetChapter, {
          ...plan,
          isPlan: true // 标记为规划，不是分析
        });
      }

      return plan;
    } catch (error) {
      console.error('规划章节失败:', error);
      return null;
    }
  }

  /**
   * 从用户请求中提取章节编号
   */
  extractChapterNumber(userRequest) {
    if (!userRequest) return null;

    // 匹配 "第X章" 或 "第X-Y章"
    const match = userRequest.match(/第\s*(\d+)(?:[-到]\s*(\d+))?\s*章/);
    if (match) {
      return parseInt(match[1]);
    }

    // 匹配 "续写第X章"
    const continueMatch = userRequest.match(/续写.*?第\s*(\d+)\s*章/);
    if (continueMatch) {
      return parseInt(continueMatch[1]);
    }

    return null;
  }

  /**
   * 状态 2: 规划意图（支持章节规划）
   */
  async planIntent(request, context, llmCaller, chapterPlan = null) {
    // 如果有章节规划，传递给 Intent Planner
    const intent = await this.intentPlanner.plan(request.userRequest, context, llmCaller);
    
    // 如果有关节规划，增强 Intent
    if (chapterPlan && chapterPlan.success) {
      intent.chapter_plan = chapterPlan;
      // 根据章节规划调整意图
      if (chapterPlan.emotion_curve) {
        intent.tone = this.formatEmotionTone(chapterPlan.emotion_curve);
      }
      if (chapterPlan.pacing_curve) {
        intent.writing_guidelines = intent.writing_guidelines || {};
        intent.writing_guidelines.pace = chapterPlan.pacing_curve.overall;
      }
    }

    return intent;
  }

  /**
   * 格式化情绪基调
   */
  formatEmotionTone(emotionCurve) {
    const start = emotionCurve.start || 0.5;
    const peak = emotionCurve.peak || 0.5;
    const end = emotionCurve.end || 0.5;

    const emotions = [];
    if (start < 0.4) emotions.push('平静');
    else if (start < 0.6) emotions.push('紧张');
    else if (start < 0.8) emotions.push('兴奋');
    else emotions.push('激昂');

    if (peak > start + 0.2) {
      emotions.push('→ 爆发');
    }

    if (end < peak - 0.2) {
      emotions.push('→ 平静');
    }

    return emotions.join(' ');
  }

  /**
   * 添加执行步骤
   */
  addStep(name, description) {
    if (this.currentTask && this.currentTask.steps) {
      this.currentTask.steps.push({
        name,
        description,
        timestamp: new Date().toISOString(),
        state: this.state
      });
    }
  }

  /**
   * 解析文件路径
   */
  resolveFilePath(fileName) {
    if (!fileName) return null;
    
    // 如果是绝对路径，直接返回
    if (path.isAbsolute(fileName)) {
      return fileName;
    }
    
    // 如果是相对路径，基于工作区根目录
    return path.join(this.workspaceRoot, fileName);
  }

  /**
   * 状态 3: 生成初稿（支持章节规划控制和重写模式）
   * @param {Object} intent - 写作意图
   * @param {Object} context - 上下文
   * @param {Function} llmCaller - LLM 调用函数
   * @param {Object} chapterPlan - 章节规划（可选）
   * @param {string} existingContent - 现有内容（重写模式时提供）
   */
  async writeDraft(intent, context, llmCaller, chapterPlan = null, existingContent = null) {
    const isRewrite = !!existingContent || intent.is_rewrite;
    console.log(`📝 开始${isRewrite ? '重写' : '生成初稿'}...`);

    // 构建系统提示词（根据是否有章节规划调整）
    let systemPrompt = `你是一个专业的小说写作助手，负责根据写作意图${isRewrite ? '重写' : '生成'}高质量的小说文本。

# 核心任务
根据提供的写作意图（Intent）和上下文信息，${isRewrite ? '重写现有文本' : '生成符合要求的小说文本'}。`;

    if (chapterPlan && chapterPlan.success) {
      systemPrompt += `

# 章节规划要求（重要）
你必须严格按照章节规划生成文本：
1. **场景结构**：按照规划的场景结构（opening/development/climax/resolution）组织文本
2. **情绪曲线**：文本的情绪变化必须符合规划的情绪曲线
3. **节奏控制**：文本的节奏必须符合规划的节奏曲线
4. **密度控制**：信息密度必须符合规划的密度曲线
5. **情节节点**：必须在指定位置包含规划的情节节点`;
    }

    // 如果是重写模式，添加重写要求
    if (isRewrite) {
      systemPrompt += `

# 重写要求（重要）
1. **保留核心内容**：保留原文本的核心情节和重要信息
2. **按需求修改**：根据用户需求，只修改需要改进的部分
3. **保持结构**：尽量保持原文本的整体结构和段落组织
4. **风格一致**：保持与原文本相同的写作风格和叙事风格
5. **自然过渡**：修改后的文本应该自然流畅，看不出修改痕迹`;
    }

    systemPrompt += `

# 写作要求
1. **严格遵守意图约束**：必须遵守 intent.constraints 中的所有禁止和必需项
2. **符合世界观**：所有内容必须符合提供的世界观规则
3. **人物性格一致**：人物言行必须符合其性格设定
4. **保持风格统一**：遵循 intent.writing_guidelines 中的风格要求
5. **情节连贯**：基于当前剧情状态，合理推进情节

# 输出要求（必须严格遵守）
1. **章节标题**：必须以"第X章 标题"的格式开始，例如"第3章 突破"
2. **直接输出**：直接输出小说文本，不要添加任何标记、说明、解释或注释
3. **文本长度**：必须达到 1000-3000 字，确保内容充实
4. **段落结构**：使用适当的换行，保持段落清晰，每段 3-5 句
5. **风格一致**：必须与提供的上下文风格保持一致
6. **完整性**：文本应该完整、连贯，符合小说写作规范

# 输出格式示例
第3章 突破

张明盘膝而坐，体内的灵力缓缓运转。他感受着雷种在丹田中跳动的节奏，每一次跳动都带来微弱的能量波动...

（继续正文，不要有任何说明文字）

⚠️ 重要提醒：
- 不要输出 JSON 格式
- 不要输出 Markdown 格式
- 不要添加任何解释或说明
- 直接输出纯文本小说内容`;

    // 构建用户提示词
    let userPrompt = '';

    // 设定文件（优先显示，特别是前面几章，完整加载不截断）
    if (context.text_context && context.text_context.settings && context.text_context.settings.length > 0) {
      userPrompt += `# 基础设定（重要：请严格遵守这些设定）\n`;
      for (const setting of context.text_context.settings) {
        userPrompt += `\n## ${setting.file}\n`;
        // 完整加载设定文件，不截断（但限制单个文件最大 5000 字，避免过长）
        const maxLength = 5000;
        const content = setting.content.length > maxLength 
          ? setting.content.substring(0, maxLength) + '\n\n[设定文件内容较长，已截断，请参考关键信息]' 
          : setting.content;
        userPrompt += `${content}\n`;
      }
      userPrompt += '\n⚠️ 以上设定是必须严格遵守的规则，任何违反设定的内容都是错误的。\n\n';
    }

    userPrompt += `# 写作意图
${JSON.stringify(intent, null, 2)}

# 上下文信息
${JSON.stringify({
  world_rules: context.world_rules || [],
  characters: context.characters || [],
  plot_context: context.plot_context || [],
  current_chapter: context.current_chapter || '未知章节'
}, null, 2)}`;

    // 如果是重写模式，添加现有内容
    if (isRewrite && existingContent) {
      userPrompt += `\n\n# 现有内容（需要重写）
${existingContent.substring(0, 5000)}${existingContent.length > 5000 ? '...' : ''}

请基于以上现有内容，根据写作意图进行重写。保留核心情节，只修改需要改进的部分。`;
    }

    // 如果有关节规划，添加章节规划信息
    if (chapterPlan && chapterPlan.success) {
      userPrompt += `

# 章节规划（必须严格遵守）
${JSON.stringify({
  chapter_structure: chapterPlan.chapter_structure,
  emotion_curve: chapterPlan.emotion_curve,
  pacing_curve: chapterPlan.pacing_curve,
  density_curve: chapterPlan.density_curve,
  coherence_links: chapterPlan.coherence_links
}, null, 2)}

## 章节规划说明
- **场景结构**：必须按照 ${chapterPlan.chapter_structure?.scenes?.length || 0} 个场景的结构组织文本
- **情绪曲线**：开头情绪 ${chapterPlan.emotion_curve?.start?.toFixed(2) || 0.5}，高潮 ${chapterPlan.emotion_curve?.peak?.toFixed(2) || 0.5}，结尾 ${chapterPlan.emotion_curve?.end?.toFixed(2) || 0.5}
- **节奏控制**：整体节奏 ${chapterPlan.pacing_curve?.overall || 'medium'}
- **密度控制**：整体密度 ${chapterPlan.density_curve?.overall || 'medium'}
- **连贯性**：${chapterPlan.coherence_links?.previous_chapter?.connection_points?.join('；') || '无特殊要求'}`;
    }

    userPrompt += `

# 任务
请根据上述意图和上下文${chapterPlan && chapterPlan.success ? '，严格按照章节规划' : ''}，生成符合要求的小说文本。`;

    try {
      const result = await llmCaller({
        systemPrompt,
        userPrompt,
        temperature: 0.5, // 降低到 0.5，提高稳定性和准确性（从 0.7 降低）
        maxTokens: 2000,
        topP: 0.9 // 降低到 0.9，进一步控制输出质量（从 0.95 降低）
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
        context,
        chapterPlan: chapterPlan || null
      };
    } catch (error) {
      console.error('❌ 生成初稿失败:', error);
      throw new Error(`生成初稿失败: ${error.message}`);
    }
  }

  /**
   * 状态 4: 连贯性检查
   */
  async checkCoherence(text, previousAnalyses, chapterPlan, llmCaller) {
    return await this.coherenceChecker.checkCoherence(
      text,
      previousAnalyses,
      chapterPlan,
      llmCaller
    );
  }

  /**
   * 状态 5: 一致性校验
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
   * 记录日志（使用统一的日志管理器）
   */
  log(action, data = {}) {
    // 使用统一的日志管理器
    logger.logAgent(action, data, this.state);

    // 同时保留在内存中（用于前端显示）
    const logEntry = {
      timestamp: new Date().toISOString(),
      state: this.state,
      action,
      data: logger.sanitizeData(data) // 使用日志管理器的清理方法
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

