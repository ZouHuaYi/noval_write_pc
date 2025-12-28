/**
 * useNovelAgent - Novel Agent 执行管理 Composable
 * 管理 Novel Agent 的任务执行、状态跟踪和日志
 */

import { computed, ref } from 'vue';

declare global {
  interface Window {
    api?: any;
  }
}

interface AgentRequest {
  userRequest: string;
  vectorResults?: any[];
}

interface AgentResult {
  success: boolean;
  text?: string;
  intent?: any;
  checkResult?: any;
  coherenceResult?: any;
  pacingAnalysis?: any;
  emotionAnalysis?: any;
  densityAnalysis?: any;
  pacingComparison?: any;
  emotionComparison?: any;
  densityComparison?: any;
  chapterPlan?: any;
  rewriteCount?: number;
  executionTime?: number;
  statistics?: any;
  report?: any;
  executionLog?: any[];
  error?: string;
}

interface AgentTask {
  id: string;
  request: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  completedAt?: string;
  error?: string;
}

type AgentState = 'idle' | 'load_context' | 'plan_intent' | 'write_draft' | 'check_coherence' | 'check_consistency' | 'rewrite' | 'update_memory' | 'done' | 'error';

export function useNovelAgent() {
  const agentState = ref<AgentState>('idle');
  const currentTask = ref<AgentTask | null>(null);
  const executionLog = ref<any[]>([]);
  const isExecuting = ref(false);
  const error = ref<string>('');
  const initialized = ref(false);
  const isInitializing = ref(false);
  const initializationProgress = ref<string>('');
  const lastResult = ref<AgentResult | null>(null);

  // 初始化 Novel Agent
  const initAgent = async (workspaceRoot: string) => {
    if (!window.api?.novelAgent) {
      error.value = 'Novel Agent API 不可用';
      return { success: false, error: error.value };
    }

    error.value = '';
    isInitializing.value = true;
    initializationProgress.value = '正在初始化 Agent...';

    try {
      const result = await window.api.novelAgent.init(workspaceRoot);
      
      if (result.success) {
        initialized.value = true;
        agentState.value = 'idle';
        initializationProgress.value = '初始化完成';
      } else {
        error.value = result.error || '初始化失败';
        initializationProgress.value = '初始化失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '初始化 Novel Agent 失败';
      initializationProgress.value = '初始化失败';
      return { success: false, error: error.value };
    } finally {
      // 延迟一下再设置为 false，让用户看到完成状态
      setTimeout(() => {
        isInitializing.value = false;
      }, 500);
    }
  };

  // 执行 Agent 任务
  const executeTask = async (request: AgentRequest) => {
    if (!window.api?.novelAgent) {
      error.value = 'Novel Agent API 不可用';
      return { success: false, error: error.value };
    }

    if (!initialized.value) {
      error.value = 'Agent 未初始化';
      return { success: false, error: error.value };
    }

    isExecuting.value = true;
    error.value = '';
    lastResult.value = null;

    try {
      const result = await window.api.novelAgent.execute(request);
      
      if (result.success) {
        lastResult.value = result;
        agentState.value = 'done';
        
        // 获取最新的任务信息
        await getCurrentTask();
        await getLog(10);
      } else {
        error.value = result.error || '执行失败';
        agentState.value = 'error';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '执行 Agent 任务失败';
      agentState.value = 'error';
      return { success: false, error: error.value };
    } finally {
      isExecuting.value = false;
    }
  };

  // 获取 Agent 状态
  const getState = async () => {
    if (!window.api?.novelAgent) {
      return null;
    }

    try {
      const result = await window.api.novelAgent.getState();
      
      if (result.success) {
        agentState.value = result.state;
      }

      return result;
    } catch (err: any) {
      console.error('获取 Agent 状态失败:', err);
      return null;
    }
  };

  // 获取执行日志
  const getLog = async (count: number = 10) => {
    if (!window.api?.novelAgent) {
      return [];
    }

    try {
      const result = await window.api.novelAgent.getLog(count);
      
      if (result.success) {
        executionLog.value = result.log || [];
      }

      return executionLog.value;
    } catch (err: any) {
      console.error('获取执行日志失败:', err);
      return [];
    }
  };

  // 取消当前任务
  const cancelTask = async () => {
    if (!window.api?.novelAgent) {
      error.value = 'Novel Agent API 不可用';
      return { success: false, error: error.value };
    }

    try {
      const result = await window.api.novelAgent.cancel();
      
      if (result.success) {
        isExecuting.value = false;
        agentState.value = 'idle';
        currentTask.value = null;
      } else {
        error.value = result.error || '取消失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '取消任务失败';
      return { success: false, error: error.value };
    }
  };

  // 获取当前任务
  const getCurrentTask = async () => {
    if (!window.api?.novelAgent) {
      return null;
    }

    try {
      const result = await window.api.novelAgent.getCurrentTask();
      
      if (result.success) {
        currentTask.value = result.task;
      }

      return result;
    } catch (err: any) {
      console.error('获取当前任务失败:', err);
      return null;
    }
  };

  // Computed
  const canExecute = computed(() => initialized.value && !isExecuting.value);
  const stateDisplay = computed(() => {
    const stateMap: Record<AgentState, string> = {
      idle: '空闲',
      load_context: '加载上下文',
      plan_intent: '规划意图',
      write_draft: '生成初稿',
      check_coherence: '连贯性检查',
      check_consistency: '一致性校验',
      rewrite: '重写',
      update_memory: '更新记忆',
      done: '完成',
      error: '错误'
    };
    return stateMap[agentState.value] || agentState.value;
  });

  const hasResult = computed(() => lastResult.value !== null);
  
  const resultSummary = computed(() => {
    if (!lastResult.value) return null;
    
    return {
      hasText: !!lastResult.value.text,
      textLength: lastResult.value.text?.length || 0,
      rewriteCount: lastResult.value.rewriteCount || 0,
      executionTime: lastResult.value.executionTime || 0,
      checkStatus: lastResult.value.checkResult?.status || 'unknown',
      checkScore: lastResult.value.checkResult?.overall_score || 0,
      errorCount: lastResult.value.checkResult?.errors?.length || 0,
      coherenceScore: lastResult.value.coherenceResult?.overall_score || null,
      coherenceStatus: lastResult.value.coherenceResult?.overall_coherence || null,
      pacingMatch: lastResult.value.pacingComparison?.score || null,
      emotionMatch: lastResult.value.emotionComparison?.score || null,
      densityMatch: lastResult.value.densityComparison?.score || null,
      chapterPlan: lastResult.value.chapterPlan,
      report: lastResult.value.report
    };
  });

  return {
    // State
    agentState,
    currentTask,
    executionLog,
    isExecuting,
    error,
    initialized,
    isInitializing,
    initializationProgress,
    lastResult,

    // Computed
    canExecute,
    stateDisplay,
    hasResult,
    resultSummary,

    // Methods
    initAgent,
    executeTask,
    getState,
    getLog,
    cancelTask,
    getCurrentTask
  };
}

