<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @mousedown.self="handleCancel"
  >
    <div class="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-[90vw] max-w-4xl max-h-[90vh] flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <h2 class="text-xl font-semibold text-slate-100">📋 章节大纲确认</h2>
        <button
          class="text-slate-400 hover:text-slate-200 transition-colors"
          @click="handleCancel"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- 大纲内容 -->
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-slate-200 mb-3">章节大纲</h3>
          <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <div 
              v-if="!isEditing"
              class="prose prose-invert max-w-none text-slate-300 whitespace-pre-wrap"
              v-html="formatMarkdown(outline)"
            ></div>
            <textarea
              v-else
              v-model="editedOutline"
              class="w-full h-64 bg-slate-900 text-slate-200 rounded p-3 border border-slate-600 focus:border-emerald-500 focus:outline-none resize-none font-mono text-sm"
              placeholder="请输入大纲内容..."
            ></textarea>
          </div>
          <button
            v-if="!isEditing"
            @click="startEdit"
            class="mt-2 px-3 py-1.5 text-sm bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors"
          >
            ✏️ 编辑大纲
          </button>
          <div v-else class="mt-2 flex gap-2">
            <button
              @click="saveEdit"
              class="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors"
            >
              💾 保存
            </button>
            <button
              @click="cancelEdit"
              class="px-3 py-1.5 text-sm bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors"
            >
              取消
            </button>
          </div>
        </div>

        <!-- 场景列表 -->
        <div v-if="scenes && scenes.length > 0" class="mb-6">
          <h3 class="text-lg font-semibold text-slate-200 mb-3">场景列表</h3>
          <div class="space-y-3">
            <div
              v-for="(scene, index) in scenes"
              :key="index"
              class="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h4 class="text-slate-200 font-medium mb-1">
                    {{ scene.title || `场景 ${index + 1}` }}
                  </h4>
                  <p v-if="scene.description" class="text-sm text-slate-400 mb-2">
                    {{ scene.description }}
                  </p>
                  <p v-if="scene.purpose" class="text-xs text-slate-500">
                    目的：{{ scene.purpose }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 提示信息 -->
        <div class="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
          <p class="text-sm text-blue-300">
            💡 提示：您可以编辑大纲内容，确认后将根据大纲生成章节内容。
          </p>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
        <button
          @click="handleCancel"
          class="px-4 py-2 text-sm bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors"
        >
          取消
        </button>
        <button
          @click="handleConfirm"
          :disabled="isLoading"
          class="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? '执行中...' : '确认并继续' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  outline: string;
  scenes?: any[];
}>();

const emit = defineEmits<{
  (e: 'confirm', modifiedOutline?: string): void;
  (e: 'cancel'): void;
}>();

const isEditing = ref(false);
const editedOutline = ref('');
const isLoading = ref(false);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    editedOutline.value = props.outline;
    isEditing.value = false;
  }
});

const startEdit = () => {
  isEditing.value = true;
  editedOutline.value = props.outline;
};

const saveEdit = () => {
  isEditing.value = false;
};

const cancelEdit = () => {
  isEditing.value = false;
  editedOutline.value = props.outline;
};

const formatMarkdown = (text: string) => {
  if (!text) return '';
  // 简单的 Markdown 格式化
  return text
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-slate-200 mb-2">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold text-slate-200 mb-2 mt-4">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-medium text-slate-200 mb-1 mt-3">$1</h3>')
    .replace(/^\* (.*$)/gim, '<li class="ml-4 text-slate-300">$1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 text-slate-300">$1</li>')
    .replace(/\n/g, '<br>');
};

const handleConfirm = () => {
  isLoading.value = true;
  const modifiedOutline = isEditing.value && editedOutline.value !== props.outline 
    ? editedOutline.value 
    : undefined;
  emit('confirm', modifiedOutline);
  // 注意：isLoading 会在父组件处理完成后重置
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<style scoped>
.prose {
  color: inherit;
}
.prose h1, .prose h2, .prose h3 {
  color: inherit;
}
.prose li {
  list-style: disc;
  margin-left: 1.5rem;
}
</style>

