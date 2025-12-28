<template>
  <div class="flex flex-col h-full bg-slate-800 rounded-lg overflow-hidden">
    <!-- 头部 -->
    <div class="flex items-center justify-between p-4 border-b border-slate-700">
      <h3 class="text-lg font-semibold text-slate-200">⚙️ 一致性规则</h3>
      <div class="flex items-center gap-2">
        <button
          @click="handleReload"
          :disabled="rules.isLoading.value"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="重新加载规则"
        >
          <span>🔄</span>
        </button>
        <button
          @click="showHelp = !showHelp"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="帮助"
        >
          <span>❓</span>
        </button>
      </div>
    </div>

    <!-- 帮助信息 -->
    <div v-if="showHelp" class="border-b border-slate-700 bg-blue-500/5">
      <div class="flex items-center justify-between p-4 pb-2 text-sm font-semibold text-blue-400">
        <span>💡 规则说明</span>
        <button @click="showHelp = false" class="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors">✕</button>
      </div>
      <div class="px-4 pb-4 text-sm text-slate-300">
        <p>一致性规则用于自动检查文本中的常见问题。</p>
        <ul class="my-3 ml-4 flex flex-col gap-1 list-disc list-inside">
          <li><strong>world_rule:</strong> 世界观规则违反</li>
          <li><strong>power_level:</strong> 能力超限</li>
          <li><strong>character:</strong> 人物性格不一致</li>
          <li><strong>timeline:</strong> 时间线混乱</li>
          <li><strong>pov:</strong> 视角混乱</li>
          <li><strong>logic:</strong> 逻辑矛盾</li>
        </ul>
        <p class="mt-3 text-xs text-slate-400">
          💡 提示：自定义规则请编辑 <code class="px-1.5 py-0.5 bg-slate-900 rounded text-emerald-400 font-mono">rules/consistency-rules.json</code> 文件
        </p>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="rules.isLoading.value" class="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
      <div class="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误信息 -->
    <div v-if="rules.error.value" class="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
      <span>⚠️</span>
      <span>{{ rules.error.value }}</span>
    </div>

    <!-- 规则统计 -->
    <div v-if="rules.stats.value" class="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-slate-700">
      <div class="flex flex-col items-center p-3 bg-slate-900 rounded-lg">
        <div class="text-2xl font-bold text-emerald-400">{{ rules.ruleCount.value }}</div>
        <div class="text-xs text-slate-400 mt-1">总规则数</div>
      </div>
      <div class="flex flex-col items-center p-3 bg-slate-900 rounded-lg">
        <div class="text-2xl font-bold text-emerald-400">{{ rules.enabledRules.value.length }}</div>
        <div class="text-xs text-slate-400 mt-1">已启用</div>
      </div>
      <div class="flex flex-col items-center p-3 bg-slate-900 rounded-lg">
        <div class="text-2xl font-bold text-emerald-400">{{ rules.criticalRules.value.length }}</div>
        <div class="text-xs text-slate-400 mt-1">严重规则</div>
      </div>
      <div class="flex flex-col items-center p-3 bg-slate-900 rounded-lg">
        <div class="text-2xl font-bold text-emerald-400">{{ rules.highRules.value.length }}</div>
        <div class="text-xs text-slate-400 mt-1">重要规则</div>
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="border-b border-slate-700 p-4">
      <div class="flex gap-2 flex-wrap">
        <button
          @click="filterType = 'all'"
          :class="['px-3 py-1.5 text-sm rounded bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors', { 'bg-emerald-500 text-white': filterType === 'all' }]"
        >
          全部 ({{ rules.ruleCount.value }})
        </button>
        <button
          v-for="(count, type) in typeGroups"
          :key="type"
          @click="filterType = type"
          :class="['px-3 py-1.5 text-sm rounded bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors', { 'bg-emerald-500 text-white': filterType === type }]"
        >
          {{ getTypeLabel(type) }} ({{ count }})
        </button>
      </div>
    </div>

    <!-- 规则列表 -->
    <div class="flex-1 overflow-auto p-4 flex flex-col gap-3">
      <div v-if="filteredRules.length === 0" class="flex items-center justify-center py-12 text-slate-400">
        暂无规则
      </div>

      <div
        v-for="rule in filteredRules"
        :key="rule.id"
        class="p-4 bg-slate-900 rounded-lg border border-slate-700"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="text-base font-semibold text-slate-200">{{ rule.name }}</h4>
            <span :class="['px-2 py-0.5 text-xs rounded', getTypeBadgeClass(rule.type)]">
              {{ getTypeLabel(rule.type) }}
            </span>
            <span :class="['px-2 py-0.5 text-xs rounded font-medium', getSeverityBadgeClass(rule.severity)]">
              {{ getSeverityLabel(rule.severity) }}
            </span>
          </div>
          <div class="shrink-0">
            <span v-if="rule.enabled" class="text-xs text-emerald-400">✅ 已启用</span>
            <span v-else class="text-xs text-slate-500">⏸️ 已禁用</span>
          </div>
        </div>

        <p class="text-sm text-slate-300 mb-3">{{ rule.description }}</p>

        <div class="flex flex-col gap-2 pt-3 border-t border-slate-700">
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-400 font-medium">错误信息：</span>
            <p class="text-sm text-slate-300">{{ rule.error_message }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs text-slate-400 font-medium">建议修改：</span>
            <p class="text-sm text-slate-300">{{ rule.suggestion }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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

const getTypeBadgeClass = (type: string) => {
  const classes: Record<string, string> = {
    world_rule: 'bg-purple-500/20 text-purple-400',
    power_level: 'bg-red-500/20 text-red-400',
    character: 'bg-blue-500/20 text-blue-400',
    timeline: 'bg-orange-500/20 text-orange-400',
    pov: 'bg-pink-500/20 text-pink-400',
    logic: 'bg-yellow-500/20 text-yellow-400',
    format: 'bg-slate-500/20 text-slate-400'
  };
  return classes[type] || 'bg-slate-500/20 text-slate-400';
};

const getSeverityBadgeClass = (severity: string) => {
  const classes: Record<string, string> = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-slate-900',
    low: 'bg-blue-500 text-white'
  };
  return classes[severity] || 'bg-slate-500 text-white';
};

const handleReload = async () => {
  await rules.reloadRules();
};

onMounted(async () => {
  await rules.getAllRules();
  await rules.getStats();
  await handleReload();
});
</script>

<style scoped>
</style>

