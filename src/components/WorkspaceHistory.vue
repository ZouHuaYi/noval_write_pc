<template>
  <div class="workspace-history">
    <!-- 触发按钮 -->
    <button
      class="px-2 py-0.5 rounded border border-slate-600 hover:bg-slate-800 text-xs flex items-center gap-1"
      @click="toggleDropdown"
      title="历史工作区"
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>历史工作区</span>
      <svg class="w-3 h-3" :class="{ 'rotate-180': showDropdown }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- 下拉菜单 -->
    <div
      v-if="showDropdown"
      class="absolute left-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded shadow-lg z-50 min-w-[300px] max-w-[500px] max-h-[400px] overflow-auto"
      @mousedown.stop
    >
      <div v-if="isLoading" class="p-4 text-center text-slate-400 text-xs">
        加载中...
      </div>
      <div v-else-if="history.length === 0" class="p-4 text-center text-slate-500 text-xs">
        暂无历史工作区
      </div>
      <div v-else>
        <div
          v-for="item in history"
          :key="item.id"
          class="flex items-center justify-between px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
        >
          <button
            class="flex-1 text-left min-w-0"
            @click="openWorkspace(item)"
          >
            <div class="text-xs font-medium text-slate-200 truncate">
              {{ item.name }}
            </div>
            <div class="text-[10px] text-slate-500 truncate mt-0.5">
              {{ item.path }}
            </div>
            <div class="text-[10px] text-slate-600 mt-0.5">
              {{ formatDate(item.last_opened) }}
            </div>
          </button>
          <button
            class="ml-2 p-1 hover:bg-slate-700 rounded text-red-400 hover:text-red-300"
            title="删除此历史记录"
            @click.stop="deleteWorkspace(item)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

interface WorkspaceHistoryItem {
  id: number;
  path: string;
  name: string;
  last_opened: string;
  created_at: string;
}

const emit = defineEmits<{
  (e: 'open-workspace', data: { rootDir: string; rootName: string; files: any[] }): void;
}>();

const showDropdown = ref(false);
const isLoading = ref(false);
const history = ref<WorkspaceHistoryItem[]>([]);

const toggleDropdown = async () => {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) {
    await loadHistory();
  }
};

const loadHistory = async () => {
  if (!window.api?.workspace?.getHistory) return;
  
  isLoading.value = true;
  try {
    const result = await window.api.workspace.getHistory();
    if (result.success && result.history) {
      history.value = result.history;
    }
  } catch (error: any) {
    console.error('加载历史工作区失败:', error);
  } finally {
    isLoading.value = false;
  }
};

const openWorkspace = async (item: WorkspaceHistoryItem) => {
  if (!window.api?.workspace?.openHistory) return;
  
  try {
    const result = await window.api.workspace.openHistory(item.path);
    if (result.success && result.data) {
      emit('open-workspace', result.data);
      showDropdown.value = false;
    } else {
      alert(`打开工作区失败：${result.error || '未知错误'}`);
    }
  } catch (error: any) {
    console.error('打开工作区失败:', error);
    alert(`打开工作区失败：${error.message}`);
  }
};

const deleteWorkspace = async (item: WorkspaceHistoryItem) => {
  if (!window.api?.workspace?.deleteHistory) return;
  
  if (!confirm(`确定要删除历史记录"${item.name}"吗？`)) {
    return;
  }
  
  try {
    const result = await window.api.workspace.deleteHistory(item.id);
    if (result.success) {
      history.value = history.value.filter(h => h.id !== item.id);
    } else {
      alert(`删除失败：${result.error || '未知错误'}`);
    }
  } catch (error: any) {
    console.error('删除历史记录失败:', error);
    alert(`删除失败：${error.message}`);
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return date.toLocaleDateString('zh-CN');
  } else if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else {
    return '刚刚';
  }
};

const hideDropdown = () => {
  showDropdown.value = false;
};

onMounted(() => {
  window.addEventListener('mousedown', hideDropdown);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', hideDropdown);
});
</script>

<style scoped>
.workspace-history {
  position: relative;
}

.rotate-180 {
  transform: rotate(180deg);
  transition: transform 0.2s;
}
</style>

