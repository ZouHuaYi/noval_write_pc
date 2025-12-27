<template>
  <div class="memory-viewer">
    <!-- 头部 -->
    <div class="viewer-header">
      <h3 class="text-lg font-semibold text-slate-200">📚 记忆系统</h3>
      <div class="flex gap-2">
        <button
          @click="handleIntelligentExtract"
          :disabled="!memory.initialized.value || isExtracting"
          class="btn-icon text-emerald-400"
          title="智能提取文件内容"
        >
          <span>🧠</span>
        </button>
        <button
          @click="handleRefresh"
          :disabled="memory.isLoading.value"
          class="btn-icon"
          title="刷新"
        >
          <span>🔄</span>
        </button>
        <button
          @click="handleExport"
          :disabled="!memory.initialized.value"
          class="btn-icon"
          title="导出记忆"
        >
          <span>💾</span>
        </button>
        <button
          @click="showResetConfirm = true"
          :disabled="!memory.initialized.value"
          class="btn-icon text-red-400"
          title="重置记忆"
        >
          <span>🔄</span>
        </button>
      </div>
    </div>

    <!-- 提取进度 -->
    <div v-if="extractProgress" class="extract-progress">
      <div class="progress-header">
        <span class="progress-message">{{ extractProgress.message }}</span>
        <span class="progress-percentage">{{ extractProgress.percentage }}%</span>
      </div>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: extractProgress.percentage + '%' }"
        ></div>
      </div>
      <div class="progress-details">
        <span>处理中: {{ extractProgress.current }}/{{ extractProgress.total }}</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="memory.isLoading.value" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误信息 -->
    <div v-if="memory.error.value" class="error-message">
      <span>⚠️</span>
      <span>{{ memory.error.value }}</span>
    </div>

    <!-- 未初始化状态 -->
    <div v-if="!memory.initialized.value && !memory.isLoading.value" class="empty-state">
      <p>记忆系统未初始化</p>
      <p class="text-sm text-slate-400 mt-2">打开工作区后会自动初始化</p>
      <button
        v-if="props.workspaceRoot"
        @click="handleManualInit"
        class="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm transition-colors"
      >
        🔄 手动初始化
      </button>
      <p v-else class="text-xs text-slate-500 mt-2">请先打开工作区</p>
    </div>

    <!-- 记忆摘要 -->
    <div v-if="memory.hasMemory.value" class="memory-content">
      <!-- 总览卡片 -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="card-icon">🌍</div>
          <div class="card-content">
            <div class="card-title">世界观</div>
            <div class="card-value">
              {{ memory.memorySummary.value?.world.custom_rules_count || 0 }} 条规则
            </div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon">👥</div>
          <div class="card-content">
            <div class="card-title">人物</div>
            <div class="card-value">
              {{ memory.characterCount.value }} 个角色
            </div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon">📖</div>
          <div class="card-content">
            <div class="card-title">剧情</div>
            <div class="card-value">
              {{ memory.memorySummary.value?.plot.completed_events_count || 0 }} 个事件
            </div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon">🎯</div>
          <div class="card-content">
            <div class="card-title">伏笔</div>
            <div class="card-value">
              {{ memory.foreshadowCount.value }} 个伏笔
            </div>
          </div>
        </div>
      </div>

      <!-- 标签页 -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
        >
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>

      <!-- 标签页内容 -->
      <div class="tab-content">
        <!-- 角色列表 -->
        <div v-if="activeTab === 'characters'" class="characters-list">
          <div v-if="memory.characters.value.length === 0" class="empty-state">
            暂无角色记录
          </div>
          <div
            v-for="char in memory.characters.value"
            :key="char.id"
            class="character-card"
          >
            <div class="character-header">
              <h4 class="character-name">{{ char.name }}</h4>
              <span :class="['role-badge', char.role]">
                {{ getRoleLabel(char.role) }}
              </span>
            </div>
            <div class="character-details">
              <div v-if="char.personality?.traits?.length" class="detail-item">
                <span class="detail-label">性格：</span>
                <span class="detail-value">{{ char.personality.traits.join('、') }}</span>
              </div>
              <div v-if="char.current_state?.level" class="detail-item">
                <span class="detail-label">境界：</span>
                <span class="detail-value">{{ char.current_state.level }}</span>
              </div>
              <div v-if="char.current_state?.location" class="detail-item">
                <span class="detail-label">位置：</span>
                <span class="detail-value">{{ char.current_state.location }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 伏笔列表 -->
        <div v-if="activeTab === 'foreshadows'" class="foreshadows-list">
          <div v-if="memory.foreshadows.value.length === 0" class="empty-state">
            暂无伏笔记录
          </div>
          <div
            v-for="foreshadow in memory.foreshadows.value"
            :key="foreshadow.id"
            class="foreshadow-card"
          >
            <div class="foreshadow-header">
              <h4 class="foreshadow-title">{{ foreshadow.title }}</h4>
              <span :class="['importance-badge', foreshadow.importance]">
                {{ getImportanceLabel(foreshadow.importance) }}
              </span>
            </div>
            <p class="foreshadow-content">{{ foreshadow.content }}</p>
            <div v-if="foreshadow.introduced_at" class="foreshadow-meta">
              引入位置：第 {{ foreshadow.introduced_at.chapter }} 章
            </div>
          </div>
        </div>

        <!-- 剧情信息 -->
        <div v-if="activeTab === 'plot'" class="plot-info">
          <div v-if="memory.memorySummary.value?.plot.current_stage" class="info-item">
            <span class="info-label">当前阶段：</span>
            <span class="info-value">{{ memory.memorySummary.value.plot.current_stage }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">已完成事件：</span>
            <span class="info-value">{{ memory.memorySummary.value?.plot.completed_events_count || 0 }} 个</span>
          </div>
          <div class="info-item">
            <span class="info-label">待完成目标：</span>
            <span class="info-value">{{ memory.memorySummary.value?.plot.pending_goals_count || 0 }} 个</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 重置确认对话框 -->
    <div v-if="showResetConfirm" class="modal-overlay" @click="showResetConfirm = false">
      <div class="modal-content" @click.stop>
        <h3 class="modal-title">⚠️ 确认重置</h3>
        <p class="modal-message">确定要重置所有记忆吗？此操作不可撤销！</p>
        <div class="modal-actions">
          <button @click="showResetConfirm = false" class="btn-secondary">
            取消
          </button>
          <button @click="handleReset" class="btn-danger">
            确定重置
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMemory } from '../composables/useMemory';
import { useNovelAgent } from '../composables/useNovelAgent';

const props = defineProps<{
  workspaceRoot?: string | null;
}>();

const memory = useMemory();
const novelAgent = useNovelAgent();
const activeTab = ref('characters');
const showResetConfirm = ref(false);
const isExtracting = ref(false);
const extractProgress = ref<any>(null);

const tabs = [
  { id: 'characters', label: '角色', icon: '👥' },
  { id: 'foreshadows', label: '伏笔', icon: '🎯' },
  { id: 'plot', label: '剧情', icon: '📖' }
];

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    protagonist: '主角',
    antagonist: '反派',
    supporting: '配角'
  };
  return labels[role] || role;
};

const getImportanceLabel = (importance: string) => {
  const labels: Record<string, string> = {
    minor: '次要',
    normal: '普通',
    major: '重要',
    critical: '关键'
  };
  return labels[importance] || importance;
};

const handleRefresh = async () => {
  await memory.getSummary();
  await memory.getAllCharacters();
  await memory.getPendingForeshadows();
};

const handleExport = async () => {
  const result = await memory.exportMemory();
  if (result?.success) {
    const dataStr = JSON.stringify(result.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

const handleReset = async () => {
  await memory.resetMemory();
  showResetConfirm.value = false;
  handleRefresh();
};

const handleManualInit = async () => {
  if (!props.workspaceRoot) {
    console.warn('⚠️ 工作区路径为空');
    return;
  }

  console.log('🔄 手动初始化记忆系统...');
  console.log('工作区路径:', props.workspaceRoot);
  
  try {
    const result = await memory.initMemory(props.workspaceRoot);
    if (result?.success) {
      await memory.getAllCharacters();
      await memory.getPendingForeshadows();
      await memory.getSummary();
      await novelAgent.initAgent(props.workspaceRoot);
      console.log('✅ 手动初始化成功');
    } else {
      console.error('❌ 初始化失败:', result?.error);
    }
  } catch (err: any) {
    console.error('❌ 初始化过程出错:', err);
  }
};

const handleIntelligentExtract = async () => {
  if (!props.workspaceRoot || !memory.initialized.value) {
    console.warn('⚠️ 工作区或记忆系统未初始化');
    return;
  }

  isExtracting.value = true;
  extractProgress.value = { current: 0, total: 100, percentage: 0, message: '准备提取...' };

  try {
    // 设置进度监听
    const unsubscribe = window.api?.memory?.onExtractProgress?.((progress: any) => {
      extractProgress.value = progress;
    });

    // 执行提取（分批处理，每批5个，处理全部）
    const result = await window.api?.memory?.extract({
      chapterBatchSize: 5,
      maxChapters: 0 // 0 表示处理全部
    });

    if (result?.success) {
      console.log('✅ 智能提取完成', result);
      // 刷新记忆数据
      await memory.getSummary();
      await memory.getAllCharacters();
      await memory.getPendingForeshadows();
      
      // 延迟隐藏进度条
      setTimeout(() => {
        extractProgress.value = null;
      }, 2000);
    } else {
      console.error('❌ 智能提取失败:', result?.error);
      extractProgress.value = null;
    }

    // 清理监听
    if (unsubscribe) {
      unsubscribe();
    }
  } catch (err: any) {
    console.error('❌ 智能提取过程出错:', err);
    extractProgress.value = null;
  } finally {
    isExtracting.value = false;
  }
};

onMounted(() => {
  if (memory.initialized.value) {
    handleRefresh();
  }
});
</script>

<style scoped>
.memory-viewer {
  @apply flex flex-col h-full bg-slate-800 rounded-lg;
}

.viewer-header {
  @apply flex items-center justify-between p-4 border-b border-slate-700;
}

.btn-icon {
  @apply w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 
         transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
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

.empty-state {
  @apply flex flex-col items-center justify-center py-12 text-slate-400;
}

.memory-content {
  @apply flex-1 flex flex-col overflow-hidden;
}

.summary-cards {
  @apply grid grid-cols-2 md:grid-cols-4 gap-3 p-4;
}

.summary-card {
  @apply flex items-center gap-3 p-3 bg-slate-900 rounded-lg;
}

.card-icon {
  @apply text-2xl;
}

.card-content {
  @apply flex flex-col;
}

.card-title {
  @apply text-xs text-slate-400;
}

.card-value {
  @apply text-sm font-semibold text-slate-200;
}

.tabs {
  @apply flex gap-2 px-4 border-b border-slate-700;
}

.tab {
  @apply px-4 py-2 text-sm text-slate-400 hover:text-slate-200 
         transition-colors relative;
}

.tab.active {
  @apply text-emerald-400;
}

.tab.active::after {
  @apply content-[''] absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500;
}

.tab-content {
  @apply flex-1 overflow-auto p-4;
}

.characters-list,
.foreshadows-list {
  @apply flex flex-col gap-3;
}

.character-card,
.foreshadow-card {
  @apply p-4 bg-slate-900 rounded-lg border border-slate-700;
}

.character-header,
.foreshadow-header {
  @apply flex items-center justify-between mb-3;
}

.character-name,
.foreshadow-title {
  @apply text-base font-semibold text-slate-200;
}

.role-badge {
  @apply px-2 py-1 text-xs rounded;
}

.role-badge.protagonist {
  @apply bg-emerald-500/20 text-emerald-400;
}

.role-badge.antagonist {
  @apply bg-red-500/20 text-red-400;
}

.role-badge.supporting {
  @apply bg-blue-500/20 text-blue-400;
}

.importance-badge {
  @apply px-2 py-1 text-xs rounded;
}

.importance-badge.critical {
  @apply bg-red-500/20 text-red-400;
}

.importance-badge.major {
  @apply bg-orange-500/20 text-orange-400;
}

.importance-badge.normal {
  @apply bg-blue-500/20 text-blue-400;
}

.importance-badge.minor {
  @apply bg-slate-500/20 text-slate-400;
}

.character-details {
  @apply flex flex-col gap-2;
}

.detail-item {
  @apply text-sm;
}

.detail-label {
  @apply text-slate-400;
}

.detail-value {
  @apply text-slate-200;
}

.foreshadow-content {
  @apply text-sm text-slate-300 mb-2;
}

.foreshadow-meta {
  @apply text-xs text-slate-400;
}

.plot-info {
  @apply flex flex-col gap-3;
}

.info-item {
  @apply flex items-center gap-2 text-sm;
}

.info-label {
  @apply text-slate-400;
}

.info-value {
  @apply text-slate-200 font-medium;
}

.modal-overlay {
  @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4;
}

.modal-title {
  @apply text-lg font-semibold text-slate-200 mb-3;
}

.modal-message {
  @apply text-sm text-slate-300 mb-6;
}

.modal-actions {
  @apply flex gap-3 justify-end;
}

.btn-secondary {
  @apply px-4 py-2 text-sm bg-slate-700 text-slate-200 rounded 
         hover:bg-slate-600 transition-colors;
}

.btn-danger {
  @apply px-4 py-2 text-sm bg-red-500 text-white rounded 
         hover:bg-red-600 transition-colors;
}

.extract-progress {
  @apply p-4 border-b border-slate-700 bg-slate-900/50;
}

.progress-header {
  @apply flex items-center justify-between mb-2;
}

.progress-message {
  @apply text-sm text-slate-300;
}

.progress-percentage {
  @apply text-sm font-semibold text-emerald-400;
}

.progress-bar {
  @apply w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2;
}

.progress-fill {
  @apply h-full bg-emerald-500 transition-all duration-300;
}

.progress-details {
  @apply text-xs text-slate-400;
}
</style>

