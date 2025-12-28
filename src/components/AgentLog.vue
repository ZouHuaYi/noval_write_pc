<template>
  <div class="flex flex-col h-full bg-slate-800 rounded-lg overflow-hidden">
    <!-- 头部 -->
    <div class="flex items-center justify-between p-4 border-b border-slate-700">
      <h3 class="text-lg font-semibold text-slate-200">📋 Agent 执行日志</h3>
      <div class="flex items-center gap-2">
        <span v-if="agent.agentState.value !== 'idle'" class="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
          {{ agent.stateDisplay.value }}
        </span>
        <button
          @click="handleRefresh"
          :disabled="agent.isExecuting.value"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="刷新"
        >
          <span>🔄</span>
        </button>
        <button
          @click="handleClear"
          :disabled="agent.isExecuting.value"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="清空日志"
        >
          <span>🗑️</span>
        </button>
      </div>
    </div>

    <!-- 当前任务信息 -->
    <div v-if="agent.currentTask.value" class="p-4 border-b border-slate-700 bg-slate-900/50">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-lg">🎯</span>
        <span class="text-sm font-semibold text-slate-200">当前任务</span>
        <span :class="['ml-auto px-2 py-1 text-xs rounded', agent.currentTask.value.status === 'running' ? 'bg-blue-500/20 text-blue-400' : agent.currentTask.value.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : agent.currentTask.value.status === 'failed' ? 'bg-red-500/20 text-red-400' : '']">
          {{ getStatusLabel(agent.currentTask.value.status) }}
        </span>
      </div>
      <div class="flex flex-col gap-2">
        <p class="text-sm text-slate-300">{{ agent.currentTask.value.request }}</p>
        <div class="flex gap-4 text-xs text-slate-400">
          <span class="flex items-center gap-1">
            ⏰ {{ formatTime(agent.currentTask.value.startedAt) }}
          </span>
          <span v-if="agent.currentTask.value.completedAt" class="flex items-center gap-1">
            ✅ {{ formatTime(agent.currentTask.value.completedAt) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 最后结果摘要 -->
    <div v-if="agent.hasResult.value && agent.resultSummary.value" class="p-4 border-b border-slate-700 bg-emerald-500/5">
      <h4 class="text-sm font-semibold text-slate-200 mb-3">✨ 执行结果</h4>
      
      <!-- 基础信息 -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="flex flex-col">
          <span class="text-xs text-slate-400 mb-1">文本长度</span>
          <span class="text-sm font-semibold text-slate-200">{{ agent.resultSummary.value.textLength }} 字</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-slate-400 mb-1">执行时间</span>
          <span class="text-sm font-semibold text-slate-200">{{ formatExecutionTime(agent.resultSummary.value.executionTime) }}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-slate-400 mb-1">重写次数</span>
          <span class="text-sm font-semibold text-slate-200">{{ agent.resultSummary.value.rewriteCount }} 次</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-slate-400 mb-1">校验状态</span>
          <span :class="['text-sm font-semibold', getCheckStatusClass(agent.resultSummary.value.checkStatus)]">
            {{ agent.resultSummary.value.checkStatus === 'pass' ? '✅ 通过' : '❌ 未通过' }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-slate-400 mb-1">校验评分</span>
          <span class="text-sm font-semibold text-slate-200">{{ agent.resultSummary.value.checkScore }}/100</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-slate-400 mb-1">发现问题</span>
          <span class="text-sm font-semibold text-slate-200">{{ agent.resultSummary.value.errorCount }} 个</span>
        </div>
      </div>

      <!-- 连贯性检查结果 -->
      <div v-if="agent.resultSummary.value.coherenceScore !== null" class="mt-4 pt-4 border-t border-slate-700">
        <h5 class="text-xs font-semibold text-slate-300 mb-2">🔗 连贯性检查</h5>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-400">总体评分</span>
            <span :class="['text-sm font-semibold', getCoherenceClass(agent.resultSummary.value.coherenceScore)]">
              {{ agent.resultSummary.value.coherenceScore.toFixed(1) }}/100
            </span>
            <span class="text-xs text-slate-500">
              {{ getCoherenceStatusLabel(agent.resultSummary.value.coherenceStatus) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 曲线分析结果 -->
      <div v-if="agent.resultSummary.value.pacingMatch !== null || agent.resultSummary.value.emotionMatch !== null" class="mt-4 pt-4 border-t border-slate-700">
        <h5 class="text-xs font-semibold text-slate-300 mb-2">📊 曲线分析</h5>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div v-if="agent.resultSummary.value.pacingMatch !== null" class="flex flex-col gap-1">
            <span class="text-xs text-slate-400">节奏匹配度</span>
            <span :class="['text-sm font-semibold', getMatchClass(agent.resultSummary.value.pacingMatch)]">
              {{ agent.resultSummary.value.pacingMatch.toFixed(1) }}%
            </span>
          </div>
          <div v-if="agent.resultSummary.value.emotionMatch !== null" class="flex flex-col gap-1">
            <span class="text-xs text-slate-400">情绪匹配度</span>
            <span :class="['text-sm font-semibold', getMatchClass(agent.resultSummary.value.emotionMatch)]">
              {{ agent.resultSummary.value.emotionMatch.toFixed(1) }}%
            </span>
          </div>
          <div v-if="agent.resultSummary.value.densityMatch !== null" class="flex flex-col gap-1">
            <span class="text-xs text-slate-400">密度匹配度</span>
            <span :class="['text-sm font-semibold', getMatchClass(agent.resultSummary.value.densityMatch)]">
              {{ agent.resultSummary.value.densityMatch.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- 章节规划信息 -->
      <div v-if="agent.resultSummary.value.chapterPlan" class="mt-4 pt-4 border-t border-slate-700">
        <h5 class="text-xs font-semibold text-slate-300 mb-2">📋 章节规划</h5>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="text-slate-400">章节类型：</span>
          <span class="text-slate-200 font-semibold">{{ agent.resultSummary.value.chapterPlan.chapter_structure?.type || '未知' }}</span>
          <span class="text-slate-400">场景数量：</span>
          <span class="text-slate-200 font-semibold">{{ agent.resultSummary.value.chapterPlan.chapter_structure?.total_scenes || 0 }} 个</span>
        </div>
      </div>
    </div>

    <!-- 执行日志 -->
    <div class="flex-1 overflow-auto p-4">
      <div v-if="agent.executionLog.value.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
        <span>📭</span>
        <p>暂无执行日志</p>
      </div>

      <div v-else class="flex flex-col gap-2">
        <div
          v-for="(log, index) in agent.executionLog.value"
          :key="index"
          class="flex gap-3 p-3 bg-slate-900 rounded-lg text-sm"
        >
          <div class="text-xs text-slate-500 font-mono shrink-0 w-20">
            {{ formatTimestamp(log.timestamp) }}
          </div>
          <div class="flex-1 flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span :class="['px-2 py-0.5 text-xs rounded shrink-0', getStateBadgeClass(log.state)]">
                {{ getStateLabel(log.state) }}
              </span>
              <span class="text-slate-300">{{ log.action }}</span>
            </div>
            <div v-if="log.data && Object.keys(log.data).length > 0" class="flex flex-col gap-2">
              <button
                @click="toggleLogData(index)"
                class="text-xs text-left text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {{ expandedLogs.has(index) ? '收起' : '展开' }} 详情
              </button>
              <pre v-if="expandedLogs.has(index)" class="text-xs bg-slate-950 text-slate-400 p-2 rounded overflow-x-auto font-mono">{{ formatData(log.data) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useNovelAgent } from '../composables/useNovelAgent';

const agent = useNovelAgent();
const expandedLogs = ref(new Set<number>());
let refreshInterval: number | null = null;

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    running: '🏃 运行中',
    completed: '✅ 已完成',
    failed: '❌ 失败',
    cancelled: '🚫 已取消'
  };
  return labels[status] || status;
};

const getStateLabel = (state: string) => {
  const labels: Record<string, string> = {
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
  return labels[state] || state;
};

const getCheckStatusClass = (status: string) => {
  return status === 'pass' ? 'text-emerald-400' : 'text-red-400';
};

const getStateBadgeClass = (state: string) => {
  const classes: Record<string, string> = {
    idle: 'bg-slate-700 text-slate-300',
    load_context: 'bg-blue-500/20 text-blue-400',
    plan_intent: 'bg-blue-500/20 text-blue-400',
    write_draft: 'bg-blue-500/20 text-blue-400',
    check_coherence: 'bg-teal-500/20 text-teal-400',
    check_consistency: 'bg-yellow-500/20 text-yellow-400',
    rewrite: 'bg-orange-500/20 text-orange-400',
    update_memory: 'bg-purple-500/20 text-purple-400',
    done: 'bg-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/20 text-red-400'
  };
  return classes[state] || 'bg-slate-700 text-slate-300';
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatData = (data: any) => {
  return JSON.stringify(data, null, 2);
};

const formatExecutionTime = (ms: number) => {
  if (!ms) return '0s';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const getCoherenceClass = (score: number) => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

const getCoherenceStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    good: '✅ 良好',
    fair: '⚠️ 一般',
    poor: '❌ 较差'
  };
  return labels[status] || status;
};

const getMatchClass = (score: number) => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

const toggleLogData = (index: number) => {
  if (expandedLogs.value.has(index)) {
    expandedLogs.value.delete(index);
  } else {
    expandedLogs.value.add(index);
  }
};

const handleRefresh = async () => {
  await agent.getLog(20);
  await agent.getCurrentTask();
};

const handleClear = () => {
  expandedLogs.value.clear();
  // 注意：这里只是清空前端显示，后端日志仍然保留
  agent.executionLog.value = [];
};

onMounted(() => {
  if (agent.initialized.value) {
    handleRefresh();
    
    // 每5秒自动刷新一次
    refreshInterval = window.setInterval(handleRefresh, 5000);
  }
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
</style>

