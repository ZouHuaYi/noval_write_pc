<template>
  <div
    v-if="visible && change"
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    @mousedown.self="$emit('close')"
  >
    <div class="bg-slate-900 rounded-lg border border-slate-700 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
      <!-- 头部 -->
      <div class="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-slate-200">文本变更预览</h3>
          <p class="text-[10px] text-slate-500 mt-0.5">
            {{ change.filePath }} 
            <span class="text-slate-600">|</span>
            {{ change.action === 'create' ? '新建' : change.action === 'modify' ? '修改' : '删除' }}
          </p>
        </div>
        <button
          class="text-slate-400 hover:text-slate-200"
          @click="$emit('close')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 描述 -->
      <div v-if="change.description" class="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
        <p class="text-xs text-slate-300">
          <span class="text-slate-500">变更说明：</span>
          {{ change.description }}
        </p>
      </div>

      <!-- Diff 内容 -->
      <div class="flex-1 overflow-auto p-4">
        <!-- 创建新文件 -->
        <div v-if="change.action === 'create'" class="space-y-2">
          <div class="text-xs text-emerald-400 mb-2">+ 新建文件/章节</div>
          <div class="text-xs bg-slate-950 p-3 rounded border border-slate-700 overflow-auto max-h-[500px] whitespace-pre-wrap">{{ change.newContent }}</div>
        </div>

        <!-- 修改文件 -->
        <div v-else-if="change.action === 'modify'" class="space-y-2">
          <div class="text-xs text-slate-400 mb-2">
            行 {{ change.lineStart }}-{{ change.lineEnd }}
          </div>
          
          <!-- 并排对比 -->
          <div class="grid grid-cols-2 gap-2">
            <!-- 原文本 -->
            <div class="border border-rose-600/30 rounded overflow-hidden">
              <div class="px-2 py-1 bg-rose-900/20 border-b border-rose-600/30">
                <span class="text-[10px] text-rose-400">原文本</span>
              </div>
              <div class="text-xs bg-slate-950 p-2 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">{{ change.oldContent || '' }}</div>
            </div>

            <!-- 修改后 -->
            <div class="border border-emerald-600/30 rounded overflow-hidden">
              <div class="px-2 py-1 bg-emerald-900/20 border-b border-emerald-600/30">
                <span class="text-[10px] text-emerald-400">修改后</span>
              </div>
              <div class="text-xs bg-slate-950 p-2 overflow-auto max-h-96 whitespace-pre-wrap leading-relaxed">{{ change.newContent || '' }}</div>
            </div>
          </div>

          <!-- 统一 Diff 视图 -->
          <div class="mt-4">
            <div class="text-xs text-slate-400 mb-2">对比视图（红色=删除，绿色=新增）</div>
            <div class="border border-slate-700 rounded overflow-hidden">
              <pre class="text-xs bg-slate-950 p-2 overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed"><code v-html="formattedDiff"></code></pre>
            </div>
          </div>
        </div>

        <!-- 删除文件 -->
        <div v-else-if="change.action === 'delete'" class="space-y-2">
          <div class="text-xs text-rose-400 mb-2">- 删除文件</div>
          <div class="p-3 bg-rose-900/20 border border-rose-600/30 rounded text-xs text-rose-300">
            ⚠️ 此操作将删除文件，无法撤销
          </div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs text-white"
            @click="$emit('reject', change)"
          >
            拒绝变更
          </button>
          <button
            class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-200"
            @click="$emit('close')"
          >
            取消
          </button>
        </div>
        <button
          class="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold"
          @click="$emit('apply', change)"
        >
          应用变更
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FileChange } from '../composables/useAgent';

const props = defineProps<{
  visible: boolean;
  change: FileChange | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply', change: FileChange): void;
  (e: 'reject', change: FileChange): void;
}>();

// 格式化 Diff 显示（带颜色）
const formattedDiff = computed(() => {
  if (!props.change || !props.change.oldContent || !props.change.newContent) {
    return '';
  }

  const oldLines = props.change.oldContent.split('\n');
  const newLines = props.change.newContent.split('\n');
  const diffLines: string[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine !== newLine) {
      if (oldLine !== undefined) {
        diffLines.push(`<span class="text-rose-400">- ${escapeHtml(oldLine)}</span>`);
      }
      if (newLine !== undefined) {
        diffLines.push(`<span class="text-emerald-400">+ ${escapeHtml(newLine)}</span>`);
      }
    } else if (oldLine !== undefined) {
      diffLines.push(`<span class="text-slate-500">  ${escapeHtml(oldLine)}</span>`);
    }
  }

  return diffLines.join('\n');
});

// HTML 转义
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};
</script>

