<template>
  <div class="rule-editor">
    <!-- 头部 -->
    <div class="editor-header">
      <h3 class="text-lg font-semibold text-slate-200">⚙️ 一致性规则</h3>
      <div class="flex items-center gap-2">
        <button
          @click="handleReload"
          :disabled="rules.isLoading.value"
          class="btn-icon"
          title="重新加载规则"
        >
          <span>🔄</span>
        </button>
        <button
          @click="showHelp = !showHelp"
          class="btn-icon"
          title="帮助"
        >
          <span>❓</span>
        </button>
      </div>
    </div>

    <!-- 帮助信息 -->
    <div v-if="showHelp" class="help-section">
      <div class="help-header">
        <span>💡 规则说明</span>
        <button @click="showHelp = false" class="close-btn">✕</button>
      </div>
      <div class="help-content">
        <p>一致性规则用于自动检查文本中的常见问题。</p>
        <ul class="help-list">
          <li><strong>world_rule:</strong> 世界观规则违反</li>
          <li><strong>power_level:</strong> 能力超限</li>
          <li><strong>character:</strong> 人物性格不一致</li>
          <li><strong>timeline:</strong> 时间线混乱</li>
          <li><strong>pov:</strong> 视角混乱</li>
          <li><strong>logic:</strong> 逻辑矛盾</li>
        </ul>
        <p class="help-note">
          💡 提示：自定义规则请编辑 <code>rules/consistency-rules.json</code> 文件
        </p>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="rules.isLoading.value" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误信息 -->
    <div v-if="rules.error.value" class="error-message">
      <span>⚠️</span>
      <span>{{ rules.error.value }}</span>
    </div>

    <!-- 规则统计 -->
    <div v-if="rules.stats.value" class="stats-section">
      <div class="stat-card">
        <div class="stat-value">{{ rules.ruleCount.value }}</div>
        <div class="stat-label">总规则数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ rules.enabledRules.value.length }}</div>
        <div class="stat-label">已启用</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ rules.criticalRules.value.length }}</div>
        <div class="stat-label">严重规则</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ rules.highRules.value.length }}</div>
        <div class="stat-label">重要规则</div>
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="filter-section">
      <div class="filter-tabs">
        <button
          @click="filterType = 'all'"
          :class="['filter-tab', { active: filterType === 'all' }]"
        >
          全部 ({{ rules.ruleCount.value }})
        </button>
        <button
          v-for="(count, type) in typeGroups"
          :key="type"
          @click="filterType = type"
          :class="['filter-tab', { active: filterType === type }]"
        >
          {{ getTypeLabel(type) }} ({{ count }})
        </button>
      </div>
    </div>

    <!-- 规则列表 -->
    <div class="rules-list">
      <div v-if="filteredRules.length === 0" class="empty-state">
        暂无规则
      </div>

      <div
        v-for="rule in filteredRules"
        :key="rule.id"
        class="rule-card"
      >
        <div class="rule-header">
          <div class="rule-title-group">
            <h4 class="rule-name">{{ rule.name }}</h4>
            <span :class="['type-badge', rule.type]">
              {{ getTypeLabel(rule.type) }}
            </span>
            <span :class="['severity-badge', rule.severity]">
              {{ getSeverityLabel(rule.severity) }}
            </span>
          </div>
          <div class="rule-status">
            <span v-if="rule.enabled" class="status-enabled">✅ 已启用</span>
            <span v-else class="status-disabled">⏸️ 已禁用</span>
          </div>
        </div>

        <p class="rule-description">{{ rule.description }}</p>

        <div class="rule-details">
          <div class="detail-section">
            <span class="detail-label">错误信息：</span>
            <p class="detail-text">{{ rule.error_message }}</p>
          </div>
          <div class="detail-section">
            <span class="detail-label">建议修改：</span>
            <p class="detail-text">{{ rule.suggestion }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRules } from '../composables/useRules';

const rules = useRules();
const showHelp = ref(false);
const filterType = ref('all');

const typeGroups = computed(() => {
  if (!rules.stats.value) return {};
  return rules.stats.value.by_type || {};
});

const filteredRules = computed(() => {
  if (filterType.value === 'all') {
    return rules.rules.value;
  }
  return rules.rulesByType.value[filterType.value] || [];
});

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    world_rule: '世界观',
    power_level: '能力限制',
    character: '人物',
    timeline: '时间线',
    pov: '视角',
    logic: '逻辑',
    format: '格式'
  };
  return labels[type] || type;
};

const getSeverityLabel = (severity: string) => {
  const labels: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '严重'
  };
  return labels[severity] || severity;
};

const handleReload = async () => {
  await rules.reloadRules();
};

onMounted(async () => {
  await rules.getAllRules();
  await rules.getStats();
});
</script>

<style scoped>
.rule-editor {
  @apply flex flex-col h-full bg-slate-800 rounded-lg overflow-hidden;
}

.editor-header {
  @apply flex items-center justify-between p-4 border-b border-slate-700;
}

.btn-icon {
  @apply w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 
         transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.help-section {
  @apply border-b border-slate-700 bg-blue-500/5;
}

.help-header {
  @apply flex items-center justify-between p-4 pb-2;
  @apply text-sm font-semibold text-blue-400;
}

.close-btn {
  @apply w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 
         text-slate-400 hover:text-slate-200 transition-colors;
}

.help-content {
  @apply px-4 pb-4 text-sm text-slate-300;
}

.help-list {
  @apply my-3 ml-4 flex flex-col gap-1 list-disc list-inside;
}

.help-note {
  @apply mt-3 text-xs text-slate-400;
}

.help-note code {
  @apply px-1.5 py-0.5 bg-slate-900 rounded text-emerald-400 font-mono;
}

.loading-state {
  @apply flex flex-col items-center justify-center py-12 gap-3 text-slate-400;
}

.loading-spinner {
  @apply w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin;
}

.error-message {
  @apply flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 
         rounded text-red-400 text-sm;
}

.stats-section {
  @apply grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-slate-700;
}

.stat-card {
  @apply flex flex-col items-center p-3 bg-slate-900 rounded-lg;
}

.stat-value {
  @apply text-2xl font-bold text-emerald-400;
}

.stat-label {
  @apply text-xs text-slate-400 mt-1;
}

.filter-section {
  @apply border-b border-slate-700 p-4;
}

.filter-tabs {
  @apply flex gap-2 flex-wrap;
}

.filter-tab {
  @apply px-3 py-1.5 text-sm rounded bg-slate-900 text-slate-400 
         hover:text-slate-200 transition-colors;
}

.filter-tab.active {
  @apply bg-emerald-500 text-white;
}

.rules-list {
  @apply flex-1 overflow-auto p-4 flex flex-col gap-3;
}

.empty-state {
  @apply flex items-center justify-center py-12 text-slate-400;
}

.rule-card {
  @apply p-4 bg-slate-900 rounded-lg border border-slate-700;
}

.rule-header {
  @apply flex items-start justify-between mb-3;
}

.rule-title-group {
  @apply flex flex-wrap items-center gap-2;
}

.rule-name {
  @apply text-base font-semibold text-slate-200;
}

.type-badge {
  @apply px-2 py-0.5 text-xs rounded;
}

.type-badge.world_rule {
  @apply bg-purple-500/20 text-purple-400;
}

.type-badge.power_level {
  @apply bg-red-500/20 text-red-400;
}

.type-badge.character {
  @apply bg-blue-500/20 text-blue-400;
}

.type-badge.timeline {
  @apply bg-orange-500/20 text-orange-400;
}

.type-badge.pov {
  @apply bg-pink-500/20 text-pink-400;
}

.type-badge.logic {
  @apply bg-yellow-500/20 text-yellow-400;
}

.type-badge.format {
  @apply bg-slate-500/20 text-slate-400;
}

.severity-badge {
  @apply px-2 py-0.5 text-xs rounded font-medium;
}

.severity-badge.critical {
  @apply bg-red-500 text-white;
}

.severity-badge.high {
  @apply bg-orange-500 text-white;
}

.severity-badge.medium {
  @apply bg-yellow-500 text-slate-900;
}

.severity-badge.low {
  @apply bg-blue-500 text-white;
}

.rule-status {
  @apply shrink-0;
}

.status-enabled {
  @apply text-xs text-emerald-400;
}

.status-disabled {
  @apply text-xs text-slate-500;
}

.rule-description {
  @apply text-sm text-slate-300 mb-3;
}

.rule-details {
  @apply flex flex-col gap-2 pt-3 border-t border-slate-700;
}

.detail-section {
  @apply flex flex-col gap-1;
}

.detail-label {
  @apply text-xs text-slate-400 font-medium;
}

.detail-text {
  @apply text-sm text-slate-300;
}
</style>

