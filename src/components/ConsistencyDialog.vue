<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="bg-slate-900 border border-rose-600/30 rounded-lg shadow-2xl w-[800px] max-h-[80vh] flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-rose-900/20 to-pink-900/20">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
          </svg>
          <h2 class="text-xl font-bold text-slate-100">一致性校验报告</h2>
        </div>
        <button
          class="p-1 rounded hover:bg-slate-800 transition-colors"
          @click="$emit('close')"
        >
          <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-auto px-6 py-4">
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <div class="flex flex-col items-center gap-3">
            <svg class="w-10 h-10 animate-spin text-rose-400" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-slate-400 text-sm">正在分析内容一致性...</p>
          </div>
        </div>

        <div v-else class="prose prose-invert prose-sm max-w-none">
          <div class="whitespace-pre-wrap text-slate-200 leading-relaxed" v-html="formattedResult"></div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 bg-slate-950/50">
        <button
          v-if="hasSelection && !isLoading"
          class="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white transition-colors text-sm font-medium flex items-center gap-2"
          @click="handleFix"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>调用 LLM 修正</span>
        </button>
        <button
          class="px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-800 text-slate-300 transition-colors text-sm"
          @click="$emit('close')"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  visible: boolean;
  result: string;
  isLoading?: boolean;
  hasSelection?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'fix'): void;
}>();

// 处理修正按钮点击
const handleFix = () => {
  // 二次确认
  if (confirm('确定要根据校验结果调用 LLM 修正选中的内容吗？')) {
    emit('fix');
  }
};

// 格式化结果，将 Markdown 格式转换为 HTML
const formattedResult = computed(() => {
  if (!props.result) return '';
  
  let html = props.result;
  
  // 转换标题
  html = html.replace(/^## (.*?)$/gm, '<h3 class="text-lg font-bold text-rose-400 mt-4 mb-2">$1</h3>');
  html = html.replace(/^### (.*?)$/gm, '<h4 class="text-base font-semibold text-pink-400 mt-3 mb-2">$1</h4>');
  
  // 转换【】标记
  html = html.replace(/【(.*?)】/g, '<strong class="text-emerald-400">【$1】</strong>');
  
  // 转换列表
  html = html.replace(/^(\d+)\. (.*?)$/gm, '<div class="ml-4 my-2"><span class="text-rose-400 font-bold">$1.</span> $2</div>');
  html = html.replace(/^- (.*?)$/gm, '<div class="ml-4 my-1">• $2</div>');
  
  // 转换粗体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-400">$1</strong>');
  
  // 转换换行
  html = html.replace(/\n\n/g, '<br><br>');
  
  return html;
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
</style>

