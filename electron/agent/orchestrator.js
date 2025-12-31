/**
 * Agent Orchestrator - Agent 状态机调度器
 * 负责协调各个模块，管理状态转换
 */

const MemoryManager = require('../memory');
const RuleEngine = require('../rules/ruleEngine'); // 保留旧规则引擎作为兼容
const DSLRuleEngine = require('../rules/dslRuleEngine'); // 新的 DSL 规则引擎
const IntentAnalyzer = require('./intentAnalyzer'); // 意图分析器（新增）
const IntentPlanner = require('./intentPlanner');
const ConsistencyChecker = require('./consistencyChecker');
const RewriteAgent = require('./rewriter');
const MemoryUpdater = require('./memoryUpdater');
const FileScanner = require('./fileScanner'); // 文件扫描器
const ChapterAnalyzer = require('./chapterAnalyzer'); // 章节分析器
const ChapterPlanner = require('./chapterPlanner'); // 章节规划器
const ChapterFileManager = require('../memory/chapterFileManager'); // 章节文件管理器
const CoherenceChecker = require('./coherenceChecker'); // 连贯性检查器
const PacingController = require('./pacingController'); // 节奏控制器
const EmotionCurveManager = require('./emotionCurveManager'); // 情绪曲线管理器
const DensityController = require('./densityController'); // 密度控制器
const SceneStructurePlanner = require('./sceneStructurePlanner'); // 场景结构规划器
const ContextLoader = require('./contextLoader'); // 智能上下文加载器（新增）
const ErrorHandler = require('./utils/errorHandler'); // 错误处理工具
const PerformanceOptimizer = require('./utils/performanceOptimizer'); // 性能优化工具
const ReportGenerator = require('./utils/reportGenerator'); // 报告生成器
const { AgentStates } = require('../memory/types');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

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
      console.log('🚀 初始化 Novel Agent Orchestrator...');

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

    const startTime = Date.now();
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
          return await this.executeInternal(request, llmCaller, startTime);
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

      this.log('Task failed', errorInfo);
      throw errorInfo;
    }
  }

  /**
   * 内部执行方法（实际执行逻辑）
   * 新流程：先分析意图，然后根据意图执行不同的流程
   */
  async executeInternal(request, llmCaller, startTime) {
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
      const { settings } = require('../database');
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

# 输出要求
- 必须有章节标题
- 直接输出小说文本，不要添加任何解释、说明或标记
- 文本应该完整、连贯，符合小说写作规范
- 长度根据需求确定，通常 1000-3000 字
- 保持段落结构，使用适当的换行`;

    // 构建用户提示词
    let userPrompt = '';

    // 设定文件（优先显示，特别是前面几章）
    if (context.text_context && context.text_context.settings && context.text_context.settings.length > 0) {
      userPrompt += `# 基础设定（重要：请严格遵守这些设定）\n`;
      for (const setting of context.text_context.settings) {
        userPrompt += `\n## ${setting.file}\n`;
        const maxLength = 2000;
        const content = setting.content.length > maxLength 
          ? setting.content.substring(0, maxLength) + '...' 
          : setting.content;
        userPrompt += `${content}\n`;
      }
      userPrompt += '\n';
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

