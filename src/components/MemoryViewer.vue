<template>
  <div class="flex flex-col h-full bg-slate-800 rounded-lg">
    <!-- 头部 -->
    <div class="flex items-center justify-between p-4 border-b border-slate-700">
      <h3 class="text-lg font-semibold text-slate-200">📚 记忆系统</h3>
      <div class="flex gap-2">
        <button
          @click="handleIntelligentExtract(false)"
          :disabled="!memory.initialized.value || isExtracting"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-emerald-400"
          title="智能提取文件内容（增量）"
        >
          <span>🧠</span>
        </button>
        <button
          @click="handleIntelligentExtract(true)"
          :disabled="!memory.initialized.value || isExtracting"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-amber-400"
          title="强制重新扫描所有文件"
        >
          <span>🔄</span>
        </button>
        <button
          @click="handleRefresh"
          :disabled="memory.isLoading.value"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="刷新"
        >
          <span>🔄</span>
        </button>
        <button
          @click="handleExport"
          :disabled="!memory.initialized.value"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="导出记忆"
        >
          <span>💾</span>
        </button>
        <button
          @click="showResetConfirm = true"
          :disabled="!memory.initialized.value"
          class="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-red-400"
          title="重置记忆"
        >
          <span>🔄</span>
        </button>
      </div>
    </div>

    <!-- 提取进度 -->
    <div v-if="extractProgress" class="p-4 border-b border-slate-700 bg-slate-900/50">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm text-slate-300">{{ extractProgress.message }}</span>
        <span class="text-sm font-semibold text-emerald-400">{{ extractProgress.percentage }}%</span>
      </div>
      <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
        <div 
          class="h-full bg-emerald-500 transition-all duration-300" 
          :style="{ width: extractProgress.percentage + '%' }"
        ></div>
      </div>
      <div class="text-xs text-slate-400">
        <span>处理中: {{ extractProgress.current }}/{{ extractProgress.total }}</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="memory.isLoading.value" class="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
      <div class="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误信息 -->
    <div v-if="memory.error.value" class="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
      <span>⚠️</span>
      <span>{{ memory.error.value }}</span>
    </div>

    <!-- 未初始化状态 -->
    <div v-if="!memory.initialized.value && !memory.isLoading.value" class="flex flex-col items-center justify-center py-12 text-slate-400">
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
    <div v-if="memory.hasMemory.value" class="flex-1 flex flex-col overflow-hidden">
      <!-- 总览卡片 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <div class="flex flex-col items-center gap-3 p-3 bg-slate-900 rounded-lg">
          <div class="text-2xl">🌍</div>
          <div class="flex flex-col">
            <div class="text-xs text-slate-400">世界观</div>
            <div class="text-sm font-semibold text-slate-200">
              {{ memory.memorySummary.value?.world.custom_rules_count || 0 }}
            </div>
          </div>
        </div>

        <div class="flex flex-col items-center gap-3 p-3 bg-slate-900 rounded-lg">
          <div class="text-2xl">👥</div>
          <div class="flex flex-col">
            <div class="text-xs text-slate-400">人物</div>
            <div class="text-sm font-semibold text-slate-200">
              {{ memory.characterCount.value }}
            </div>
          </div>
        </div>

        <div class="flex flex-col items-center gap-3 p-3 bg-slate-900 rounded-lg">
          <div class="text-2xl">📖</div>
          <div class="flex flex-col">
            <div class="text-xs text-slate-400">剧情</div>
            <div class="text-sm font-semibold text-slate-200">
              {{ memory.memorySummary.value?.plot.completed_events_count || 0 }}
            </div>
          </div>
        </div>

        <div class="flex flex-col items-center gap-3 p-3 bg-slate-900 rounded-lg">
          <div class="text-2xl">🎯</div>
          <div class="flex flex-col">
            <div class="text-xs text-slate-400">伏笔</div>
            <div class="text-sm font-semibold text-slate-200">
              {{ memory.foreshadowCount.value }}
            </div>
          </div>
        </div>
      </div>

      <!-- 标签页 -->
      <div class="flex gap-2 px-4 border-b border-slate-700">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors relative', { 'text-emerald-400': activeTab === tab.id }]"
        >
          {{ tab.icon }} {{ tab.label }}
          <span v-if="activeTab === tab.id" class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"></span>
        </button>
      </div>

      <!-- 标签页内容 -->
      <div class="flex-1 overflow-auto p-4">
        <!-- 角色列表 -->
        <div v-if="activeTab === 'characters'" class="flex flex-col gap-3">
          <div v-if="memory.characters.value.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-400">
            暂无角色记录
          </div>
          <div
            v-for="char in memory.characters.value"
            :key="char.id"
            class="p-4 bg-slate-900 rounded-lg border border-slate-700"
          >
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-base font-semibold text-slate-200">{{ char.name }}</h4>
              <span :class="['px-2 py-1 text-xs rounded', getRoleBadgeClass(char.role)]">
                {{ getRoleLabel(char.role) }}
              </span>
            </div>
            <div class="flex flex-col gap-2">
              <div v-if="char.personality?.traits?.length" class="text-sm">
                <span class="text-slate-400">性格：</span>
                <span class="text-slate-200">{{ char.personality.traits.join('、') }}</span>
              </div>
              <div v-if="char.current_state?.level" class="text-sm">
                <span class="text-slate-400">境界：</span>
                <span class="text-slate-200">{{ char.current_state.level }}</span>
              </div>
              <div v-if="char.current_state?.location" class="text-sm">
                <span class="text-slate-400">位置：</span>
                <span class="text-slate-200">{{ char.current_state.location }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 伏笔列表 -->
        <div v-if="activeTab === 'foreshadows'" class="flex flex-col gap-3">
          <div v-if="memory.foreshadows.value.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-400">
            暂无伏笔记录
          </div>
          <div
            v-for="foreshadow in memory.foreshadows.value"
            :key="foreshadow.id"
            class="p-4 bg-slate-900 rounded-lg border border-slate-700"
          >
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-base font-semibold text-slate-200">{{ foreshadow.title }}</h4>
              <span :class="['px-2 py-1 text-xs rounded', getImportanceBadgeClass(foreshadow.importance)]">
                {{ getImportanceLabel(foreshadow.importance) }}
              </span>
            </div>
            <p class="text-sm text-slate-300 mb-2">{{ foreshadow.content }}</p>
            <div v-if="foreshadow.introduced_at" class="text-xs text-slate-400">
              引入位置：第 {{ foreshadow.introduced_at.chapter }} 章
            </div>
          </div>
        </div>

        <!-- 剧情信息 -->
        <div v-if="activeTab === 'plot'" class="flex flex-col gap-3">
          <div v-if="memory.memorySummary.value?.plot.current_stage" class="flex items-center gap-2 text-sm">
            <span class="text-slate-400">当前阶段：</span>
            <span class="text-slate-200 font-medium">{{ memory.memorySummary.value.plot.current_stage }}</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-slate-400">已完成事件：</span>
            <span class="text-slate-200 font-medium">{{ memory.memorySummary.value?.plot.completed_events_count || 0 }} 个</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-slate-400">待完成目标：</span>
            <span class="text-slate-200 font-medium">{{ memory.memorySummary.value?.plot.pending_goals_count || 0 }} 个</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 重置确认对话框 -->
    <div v-if="showResetConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showResetConfirm = false">
      <div class="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
        <h3 class="text-lg font-semibold text-slate-200 mb-3">⚠️ 确认重置</h3>
        <p class="text-sm text-slate-300 mb-6">确定要重置所有记忆吗？此操作不可撤销！</p>
        <div class="flex gap-3 justify-end">
          <button @click="showResetConfirm = false" class="px-4 py-2 text-sm bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors">
            取消
          </button>
          <button @click="handleReset" class="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
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

const getRoleBadgeClass = (role: string) => {
  const classes: Record<string, string> = {
    protagonist: 'bg-emerald-500/20 text-emerald-400',
    antagonist: 'bg-red-500/20 text-red-400',
    supporting: 'bg-blue-500/20 text-blue-400'
  };
  return classes[role] || 'bg-slate-500/20 text-slate-400';
};

const getImportanceBadgeClass = (importance: string) => {
  const classes: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400',
    major: 'bg-orange-500/20 text-orange-400',
    normal: 'bg-blue-500/20 text-blue-400',
    minor: 'bg-slate-500/20 text-slate-400'
  };
  return classes[importance] || 'bg-slate-500/20 text-slate-400';
};

const handleRefresh = async () => {
  // 如果未初始化，先尝试初始化
  if (!memory.initialized.value && props.workspaceRoot) {
    console.log('🔄 记忆系统未初始化，尝试初始化...');
    const initResult = await memory.initMemory(props.workspaceRoot);
    if (!initResult?.success) {
      console.error('❌ 初始化失败:', initResult?.error);
      return;
    }
  }

  // 如果已初始化，刷新数据
  if (memory.initialized.value) {
    await memory.getSummary();
    await memory.getAllCharacters();
    await memory.getPendingForeshadows();
  }
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
  const result = await memory.resetMemory(props.workspaceRoot || undefined);
  showResetConfirm.value = false;
  
  if (result?.success) {
    // 如果重置成功，等待重新初始化完成后再刷新
    setTimeout(() => {
      handleRefresh();
    }, 1000);
  } else {
    handleRefresh();
  }
};

const handleManualInit = async () => {
  if (!props.workspaceRoot) {
    console.warn('⚠️ 工作区路径为空');
    return;
  }

  console.log('🔄 手动初始化记忆系统...');
  console.log('工作区路径:', props.workspaceRoot);
  
  try {
    // 重置加载状态
    memory.isLoading.value = true;
    memory.error.value = '';

    const result = await memory.initMemory(props.workspaceRoot);
    if (result?.success) {
      // 初始化成功后，加载数据
      await memory.getSummary();
      await memory.getAllCharacters();
      await memory.getPendingForeshadows();
      
      // 同时初始化 Novel Agent
      try {
        await novelAgent.initAgent(props.workspaceRoot);
      } catch (err) {
        console.warn('⚠️ Novel Agent 初始化失败:', err);
      }
      
      console.log('✅ 手动初始化成功');
    } else {
      console.error('❌ 初始化失败:', result?.error);
      memory.error.value = result?.error || '初始化失败';
    }
  } catch (err: any) {
    console.error('❌ 初始化过程出错:', err);
    memory.error.value = err.message || '初始化过程出错';
  } finally {
    memory.isLoading.value = false;
  }
};

const handleIntelligentExtract = async (forceRescan: boolean = false) => {
  if (!props.workspaceRoot) {
    console.warn('⚠️ 工作区路径为空');
    return;
  }

  // 如果未初始化，先尝试初始化
  if (!memory.initialized.value) {
    console.log('🔄 记忆系统未初始化，尝试初始化...');
    const initResult = await memory.initMemory(props.workspaceRoot);
    if (!initResult?.success) {
      console.error('❌ 初始化失败:', initResult?.error);
      isExtracting.value = false;
      extractProgress.value = null;
      return;
    }
  }

  isExtracting.value = true;
  extractProgress.value = { current: 0, total: 100, percentage: 0, message: forceRescan ? '强制重新扫描...' : '准备提取...' };

  try {
    // 设置进度监听
    const unsubscribe = window.api?.memory?.onExtractProgress?.((progress: any) => {
      extractProgress.value = progress;
    });

    // 执行提取（分批处理，每批5个，处理全部）
    const result = await window.api?.memory?.extract({
      chapterBatchSize: 5,
      maxChapters: 0, // 0 表示处理全部
      forceRescan: forceRescan // 强制重新扫描
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
  handleRefresh();
});
</script>

<style scoped>
</style>

