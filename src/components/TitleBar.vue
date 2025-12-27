<template>
  <div
    class="h-8 flex items-center justify-between px-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-700/50 select-none"
    style="-webkit-app-region: drag"
  >
    <!-- 左侧：应用标题 -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
        </svg>
        <span class="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
          小说创作助手
        </span>
      </div>
      <span class="text-[10px] text-slate-500 px-2 py-0.5 rounded bg-slate-800/50">
        AI 赋能写作
      </span>
    </div>

    <!-- 右侧：窗口控制按钮 -->
    <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
      <button
        class="w-8 h-6 flex items-center justify-center hover:bg-slate-800/70 transition-colors rounded"
        @click="onMinimize"
        title="最小化"
      >
        <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
        </svg>
      </button>
      <button
        class="w-8 h-6 flex items-center justify-center hover:bg-slate-800/70 transition-colors rounded"
        @click="onMaximize"
        :title="isMaximized ? '还原' : '最大化'"
      >
        <svg v-if="!isMaximized" class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
        </svg>
        <svg v-else class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"></path>
        </svg>
      </button>
      <button
        class="w-8 h-6 flex items-center justify-center hover:bg-red-600/80 transition-colors rounded"
        @click="onClose"
        title="关闭"
      >
        <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const isMaximized = ref(false);

const onMinimize = async () => {
  if (window.api?.window) {
    await window.api.window.minimize();
  }
};

const onMaximize = async () => {
  if (window.api?.window) {
    await window.api.window.maximize();
    isMaximized.value = await window.api.window.isMaximized();
  }
};

const onClose = async () => {
  if (window.api?.window) {
    await window.api.window.close();
  }
};

onMounted(async () => {
  if (window.api?.window) {
    isMaximized.value = await window.api.window.isMaximized();
  }
});
</script>

