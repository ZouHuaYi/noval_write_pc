<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="bg-slate-900 border border-purple-600/30 rounded-lg shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-900/20 to-indigo-900/20">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h2 class="text-xl font-bold text-slate-100">校验历史记录</h2>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="results.length > 0"
            class="px-3 py-1.5 rounded text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30"
            @click="handleClearAll"
          >
            清空全部
          </button>
          <button
            class="p-1 rounded hover:bg-slate-800 transition-colors"
            @click="$emit('close')"
          >
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-auto px-6 py-4">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3">
            <svg class="w-10 h-10 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-slate-400 text-sm">加载中...</p>
          </div>
        </div>

        <div v-else-if="results.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-500">
          <svg class="w-16 h-16 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <p class="text-sm">暂无校验记录</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="item in results"
            :key="item.id"
            class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:border-purple-600/30 transition-colors"
          >
            <!-- 记录头部 -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs text-slate-500">
                    {{ formatDate(item.created_at) }}
                  </span>
                  <span v-if="item.file_path" class="text-xs text-purple-400">
                    {{ getFileName(item.file_path) }}
                  </span>
                </div>
                <div class="text-sm text-slate-300 line-clamp-2">
                  {{ item.checked_text }}
                </div>
              </div>
              <button
                class="ml-3 p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
                title="删除记录"
                @click="handleDelete(item.id)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>

            <!-- 折叠/展开的结果 -->
            <div v-if="!expandedItems[item.id]" class="flex items-center justify-between">
              <span class="text-xs text-slate-500">点击展开查看详细结果</span>
              <button
                class="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                @click="toggleExpand(item.id)"
              >
                <span>展开</span>
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
            </div>

            <div v-else>
              <div class="border-t border-slate-700/50 mt-3 pt-3">
                <div class="text-sm text-slate-200 whitespace-pre-wrap max-h-[300px] overflow-auto">
                  {{ item.result }}
                </div>
              </div>
              <button
                class="mt-2 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                @click="toggleExpand(item.id)"
              >
                <span>收起</span>
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  workspacePath?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const results = ref<any[]>([]);
const loading = ref(false);
const expandedItems = reactive<Record<number, boolean>>({});

// 加载校验历史
const loadResults = async () => {
  if (!window.api?.consistency) return;
  
  loading.value = true;
  try {
    let result;
    if (props.workspacePath) {
      result = await window.api.consistency.getByWorkspace(props.workspacePath);
    } else {
      result = await window.api.consistency.getAll();
    }
    
    if (result.success && result.results) {
      results.value = result.results;
    }
  } catch (err) {
    console.error('加载校验历史失败:', err);
  } finally {
    loading.value = false;
  }
};

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 获取文件名
const getFileName = (filePath: string) => {
  if (!filePath) return '';
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1];
};

// 切换展开/收起
const toggleExpand = (id: number) => {
  expandedItems[id] = !expandedItems[id];
};

// 删除单条记录
const handleDelete = async (id: number) => {
  if (!window.api?.consistency) return;
  
  if (!confirm('确定要删除这条校验记录吗？')) return;
  
  const result = await window.api.consistency.delete(id);
  if (result.success) {
    await loadResults();
  }
};

// 清空全部记录
const handleClearAll = async () => {
  if (!window.api?.consistency) return;
  
  if (!confirm('确定要清空所有校验记录吗？此操作不可恢复！')) return;
  
  const result = await window.api.consistency.clear();
  if (result.success) {
    await loadResults();
  }
};

onMounted(() => {
  if (props.visible) {
    loadResults();
  }
});

// 监听 visible 变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadResults();
  }
});

// 暴露刷新方法
defineExpose({
  refresh: loadResults
});
</script>

<style scoped>
/* 自定义滚动条 */
.overflow-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.7);
}

/* 文本截断 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

