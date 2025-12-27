<template>
  <div class="agent-log">
    <!-- 头部 -->
    <div class="log-header">
      <h3 class="text-lg font-semibold text-slate-200">📋 Agent 执行日志</h3>
      <div class="flex items-center gap-2">
        <span v-if="agent.agentState.value !== 'idle'" class="status-badge">
          {{ agent.stateDisplay.value }}
        </span>
        <button
          @click="handleRefresh"
          :disabled="agent.isExecuting.value"
          class="btn-icon"
          title="刷新"
        >
          <span>🔄</span>
        </button>
        <button
          @click="handleClear"
          :disabled="agent.isExecuting.value"
          class="btn-icon"
          title="清空日志"
        >
          <span>🗑️</span>
        </button>
      </div>
    </div>

    <!-- 当前任务信息 -->
    <div v-if="agent.currentTask.value" class="current-task">
      <div class="task-header">
        <span class="task-icon">🎯</span>
        <span class="task-title">当前任务</span>
        <span :class="['task-status', agent.currentTask.value.status]">
          {{ getStatusLabel(agent.currentTask.value.status) }}
        </span>
      </div>
      <div class="task-content">
        <p class="task-request">{{ agent.currentTask.value.request }}</p>
        <div class="task-meta">
          <span class="meta-item">
            ⏰ {{ formatTime(agent.currentTask.value.startedAt) }}
          </span>
          <span v-if="agent.currentTask.value.completedAt" class="meta-item">
            ✅ {{ formatTime(agent.currentTask.value.completedAt) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 最后结果摘要 -->
    <div v-if="agent.hasResult.value && agent.resultSummary.value" class="result-summary">
      <h4 class="summary-title">✨ 执行结果</h4>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">文本长度</span>
          <span class="summary-value">{{ agent.resultSummary.value.textLength }} 字</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">重写次数</span>
          <span class="summary-value">{{ agent.resultSummary.value.rewriteCount }} 次</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">校验状态</span>
          <span :class="['summary-value', getCheckStatusClass(agent.resultSummary.value.checkStatus)]">
            {{ agent.resultSummary.value.checkStatus === 'pass' ? '✅ 通过' : '❌ 未通过' }}
          </span>
        </div>
        <div class="summary-item">
          <span class="summary-label">校验评分</span>
          <span class="summary-value">{{ agent.resultSummary.value.checkScore }}/100</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">发现问题</span>
          <span class="summary-value">{{ agent.resultSummary.value.errorCount }} 个</span>
        </div>
      </div>
    </div>

    <!-- 执行日志 -->
    <div class="log-content">
      <div v-if="agent.executionLog.value.length === 0" class="empty-state">
        <span>📭</span>
        <p>暂无执行日志</p>
      </div>

      <div v-else class="log-list">
        <div
          v-for="(log, index) in agent.executionLog.value"
          :key="index"
          class="log-entry"
        >
          <div class="log-timestamp">
            {{ formatTimestamp(log.timestamp) }}
          </div>
          <div class="log-main">
            <div class="log-action">
              <span :class="['state-badge', log.state]">
                {{ getStateLabel(log.state) }}
              </span>
              <span class="action-text">{{ log.action }}</span>
            </div>
            <div v-if="log.data && Object.keys(log.data).length > 0" class="log-data">
              <button
                @click="toggleLogData(index)"
                class="toggle-btn"
              >
                {{ expandedLogs.has(index) ? '收起' : '展开' }} 详情
              </button>
              <pre v-if="expandedLogs.has(index)" class="data-content">{{ formatData(log.data) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
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
.agent-log {
  @apply flex flex-col h-full bg-slate-800 rounded-lg overflow-hidden;
}

.log-header {
  @apply flex items-center justify-between p-4 border-b border-slate-700;
}

.status-badge {
  @apply px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full;
}

.btn-icon {
  @apply w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 
         transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.current-task {
  @apply p-4 border-b border-slate-700 bg-slate-900/50;
}

.task-header {
  @apply flex items-center gap-2 mb-2;
}

.task-icon {
  @apply text-lg;
}

.task-title {
  @apply text-sm font-semibold text-slate-200;
}

.task-status {
  @apply ml-auto px-2 py-1 text-xs rounded;
}

.task-status.running {
  @apply bg-blue-500/20 text-blue-400;
}

.task-status.completed {
  @apply bg-emerald-500/20 text-emerald-400;
}

.task-status.failed {
  @apply bg-red-500/20 text-red-400;
}

.task-content {
  @apply flex flex-col gap-2;
}

.task-request {
  @apply text-sm text-slate-300;
}

.task-meta {
  @apply flex gap-4 text-xs text-slate-400;
}

.meta-item {
  @apply flex items-center gap-1;
}

.result-summary {
  @apply p-4 border-b border-slate-700 bg-emerald-500/5;
}

.summary-title {
  @apply text-sm font-semibold text-slate-200 mb-3;
}

.summary-grid {
  @apply grid grid-cols-2 md:grid-cols-5 gap-3;
}

.summary-item {
  @apply flex flex-col;
}

.summary-label {
  @apply text-xs text-slate-400 mb-1;
}

.summary-value {
  @apply text-sm font-semibold text-slate-200;
}

.log-content {
  @apply flex-1 overflow-auto p-4;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-12 text-slate-400 gap-2;
}

.log-list {
  @apply flex flex-col gap-2;
}

.log-entry {
  @apply flex gap-3 p-3 bg-slate-900 rounded-lg text-sm;
}

.log-timestamp {
  @apply text-xs text-slate-500 font-mono shrink-0 w-20;
}

.log-main {
  @apply flex-1 flex flex-col gap-2;
}

.log-action {
  @apply flex items-center gap-2;
}

.state-badge {
  @apply px-2 py-0.5 text-xs rounded shrink-0;
}

.state-badge.idle {
  @apply bg-slate-700 text-slate-300;
}

.state-badge.load_context,
.state-badge.plan_intent,
.state-badge.write_draft {
  @apply bg-blue-500/20 text-blue-400;
}

.state-badge.check_consistency {
  @apply bg-yellow-500/20 text-yellow-400;
}

.state-badge.rewrite {
  @apply bg-orange-500/20 text-orange-400;
}

.state-badge.update_memory {
  @apply bg-purple-500/20 text-purple-400;
}

.state-badge.done {
  @apply bg-emerald-500/20 text-emerald-400;
}

.state-badge.error {
  @apply bg-red-500/20 text-red-400;
}

.action-text {
  @apply text-slate-300;
}

.log-data {
  @apply flex flex-col gap-2;
}

.toggle-btn {
  @apply text-xs text-emerald-400 hover:text-emerald-300 transition-colors;
}

.data-content {
  @apply text-xs bg-slate-950 text-slate-400 p-2 rounded overflow-x-auto font-mono;
}
</style>

