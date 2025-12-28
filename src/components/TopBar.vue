<template>
  <header
    class="h-10 flex items-center justify-between px-4 border-b border-slate-700/50 bg-gradient-to-r from-slate-900/90 to-slate-800/90"
  >
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 text-xs">
        <button
          class="px-3 py-1 rounded-md border border-teal-600/30 bg-teal-900/20 text-teal-400 hover:bg-teal-900/40 transition-all flex items-center gap-1.5"
          @click="$emit('open-folder')"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
          </svg>
          打开工作区
        </button>
        <WorkspaceHistory @open-workspace="onOpenWorkspace" />
      </div>
    </div>

    <div class="flex items-center gap-3">
      <div class="text-[11px] text-slate-400 flex items-center gap-2">
        <span class="flex items-center gap-1">
          <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          AI 优化文本
        </span>
        <span class="text-slate-600">|</span>
        <span class="flex items-center gap-1">
          <svg class="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
          </svg>
          智能续写
        </span>
        <span class="text-slate-600">|</span>
        <span class="flex items-center gap-1">
          <svg class="w-3 h-3 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
          </svg>
          一致性校验
        </span>
      </div>
      <button
        class="px-2.5 py-1 rounded-md border border-orange-600/30 bg-orange-900/20 text-orange-400 hover:bg-orange-900/40 transition-all text-xs flex items-center gap-1.5"
        title="批量校验多个文件"
        @click="$emit('batch-check')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        批量校验
      </button>
      <button
        class="px-2.5 py-1 rounded-md border border-purple-600/30 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40 transition-all text-xs flex items-center gap-1.5"
        title="查看校验历史"
        @click="$emit('view-history')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        历史
      </button>
      <button
        class="p-1.5 rounded-md border border-slate-600/50 hover:bg-slate-800/70 text-slate-300 hover:text-slate-100 transition-all"
        title="设置 LLM 模型"
        @click="$emit('open-settings')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import WorkspaceHistory from './WorkspaceHistory.vue';

const emit = defineEmits<{
  (e: 'open-local-file'): void;
  (e: 'open-folder'): void;
  (e: 'open-settings'): void;
  (e: 'open-workspace', data: { rootDir: string; rootName: string; files: any[] }): void;
  (e: 'check-consistency'): void;
  (e: 'batch-check'): void;
  (e: 'view-history'): void;
}>();

const onOpenWorkspace = (data: { rootDir: string; rootName: string; files: any[] }) => {
  emit('open-workspace', data);
};
</script>


