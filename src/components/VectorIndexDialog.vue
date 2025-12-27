<template>
  <div
    v-if="visible"
    class="fixed inset-0 flex items-center justify-center z-50 bg-black/60"
    @mousedown="onBackdropClick"
  >
    <div
      class="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full mx-4"
      @mousedown.stop
    >
      <!-- 标题 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <h3 class="text-lg font-semibold text-slate-100">向量索引管理</h3>
        <button
          class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
          @click="$emit('close')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 内容 -->
      <div class="p-6 space-y-4">
        <div class="text-sm text-slate-300">
          <p class="mb-2">向量索引可以让您的工作区内容具备语义搜索能力。</p>
          <p class="text-slate-500 text-xs">
            系统会自动读取工作区内所有 .txt 文件，分块后调用 Embedding API 生成向量并存储到本地数据库。
          </p>
        </div>

        <!-- 状态显示 -->
        <div v-if="isIndexing" class="bg-slate-800 rounded-lg p-4 space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-300">正在构建索引...</span>
            <span class="text-slate-400">{{ progress.current }} / {{ progress.total }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-2">
            <div
              class="bg-emerald-600 h-2 rounded-full transition-all duration-300"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>
          <div v-if="progress.file" class="text-xs text-slate-500">
            当前文件: {{ progress.file }}
          </div>
        </div>

        <!-- 结果显示 -->
        <div v-if="result" class="bg-slate-800 rounded-lg p-4">
          <div v-if="result.success" class="text-sm">
            <div class="text-emerald-400 font-medium mb-2">✓ 索引构建完成</div>
            <div class="text-slate-400 text-xs space-y-1">
              <div>成功索引: {{ result.indexed }} / {{ result.total }} 个文件</div>
              <div v-if="result.errors && result.errors.length > 0" class="text-amber-400 mt-2">
                部分文件处理失败:
                <ul class="list-disc list-inside ml-2 mt-1">
                  <li v-for="(error, index) in result.errors.slice(0, 5)" :key="index">{{ error }}</li>
                  <li v-if="result.errors.length > 5">... 还有 {{ result.errors.length - 5 }} 个错误</li>
                </ul>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-red-400">
            ✗ 索引构建失败: {{ result.error }}
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
        <button
          class="px-4 py-2 text-sm rounded border border-slate-600 hover:bg-slate-800 text-slate-300"
          :disabled="isIndexing"
          @click="clearIndex"
        >
          清空索引
        </button>
        <button
          class="px-4 py-2 text-sm rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isIndexing || !hasWorkspace"
          @click="buildIndex"
        >
          {{ isIndexing ? '构建中...' : '构建索引' }}
        </button>
        <button
          class="px-4 py-2 text-sm rounded border border-slate-600 hover:bg-slate-800 text-slate-300"
          @click="$emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

interface Props {
  visible: boolean;
  workspaceRoot: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isIndexing = ref(false);
const progress = ref({ current: 0, total: 0, file: '' });
const result = ref<any>(null);
let progressCleanup: (() => void) | null = null;

const hasWorkspace = computed(() => !!props.workspaceRoot);

const progressPercent = computed(() => {
  if (progress.value.total === 0) return 0;
  return Math.round((progress.value.current / progress.value.total) * 100);
});

const buildIndex = async () => {
  if (!props.workspaceRoot || !window.api?.vector?.buildIndex) {
    return;
  }

  isIndexing.value = true;
  progress.value = { current: 0, total: 0, file: '' };
  result.value = null;

  // 监听进度更新
  if (window.api.vector.onIndexProgress) {
    progressCleanup = window.api.vector.onIndexProgress((data: any) => {
      progress.value = data;
    });
  }

  try {
    const res = await window.api.vector.buildIndex(props.workspaceRoot, null); // null表示使用默认embedding模型
    result.value = res;
  } catch (error: any) {
    result.value = {
      success: false,
      error: error.message || '未知错误'
    };
  } finally {
    isIndexing.value = false;
    if (progressCleanup) {
      progressCleanup();
      progressCleanup = null;
    }
  }
};

const clearIndex = async () => {
  if (!window.api?.vector?.clear) return;

  if (!confirm('确定要清空所有向量索引吗？此操作不可恢复。')) {
    return;
  }

  try {
    const res = await window.api.vector.clear();
    if (res.success) {
      result.value = {
        success: true,
        message: '索引已清空',
        indexed: 0,
        total: 0
      };
    } else {
      alert(`清空失败：${res.error}`);
    }
  } catch (error: any) {
    alert(`清空失败：${error.message}`);
  }
};

const onBackdropClick = () => {
  if (!isIndexing.value) {
    emit('close');
  }
};

watch(() => props.visible, (newVal) => {
  if (!newVal) {
    // 对话框关闭时重置状态
    setTimeout(() => {
      result.value = null;
      progress.value = { current: 0, total: 0, file: '' };
    }, 300);
  }
});

onBeforeUnmount(() => {
  if (progressCleanup) {
    progressCleanup();
  }
});
</script>

