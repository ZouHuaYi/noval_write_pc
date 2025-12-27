<template>
  <div class="flex flex-col h-full bg-slate-950/90 border-l border-slate-800">
    <!-- 顶部标题栏 -->
    <div class="px-4 py-3 border-b border-slate-800 bg-gradient-to-r from-emerald-900/20 to-transparent">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
          </svg>
          <h2 class="text-sm font-semibold text-slate-200">AI Agent</h2>
        </div>
        <button
          v-if="agentMessages.length > 0"
          class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          @click="$emit('clearHistory')"
        >
          清空历史
        </button>
      </div>
      <p class="text-[10px] text-slate-500 mt-1">智能写作助手 - 理解小说，精确修改文本</p>
    </div>

    <!-- 消息列表 -->
    <div ref="messageListRef" class="flex-1 overflow-auto px-3 py-2 space-y-2">
      <!-- 欢迎提示 -->
      <div v-if="agentMessages.length === 0 && !isLoading" class="text-[11px] text-slate-400 space-y-3 p-3">
        <div class="flex items-start gap-2">
          <svg class="w-5 h-5 text-emerald-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <div>
            <p class="font-semibold text-emerald-400 mb-1">AI Agent 智能写作助手</p>
          </div>
        </div>
        <div class="space-y-2 pl-7">
          <p class="text-slate-300">✨ <strong>功能特点：</strong></p>
          <ul class="space-y-1 text-slate-500">
            <li>• 理解小说结构、章节和人物设定</li>
            <li>• 精确定位和修改文本段落</li>
            <li>• 显示文本 diff 预览，确认后应用</li>
            <li>• 支持跨章节批量修改</li>
          </ul>
        </div>
        <div class="space-y-1.5 pl-7">
          <p class="text-slate-300">💡 <strong>使用示例：</strong></p>
          <p class="text-slate-500">• "修正第5章中主角的性格描写，使其更符合人物设定"</p>
          <p class="text-slate-500">• "优化第3章第2段的对话，让语言更自然流畅"</p>
          <p class="text-slate-500">• "增强第8章开头的场景描写，增加环境氛围感"</p>
          <p class="text-slate-500">• "在第001-002章.txt文件中续写第1章、第2章的内容"</p>
        </div>
      </div>

      <!-- 消息列表 -->
      <div
        v-for="msg in agentMessages"
        :key="msg.id"
        class="rounded px-3 py-2 text-xs"
        :class="{
          'bg-slate-800 text-slate-100': msg.role === 'user',
          'bg-emerald-900/20 text-slate-200 border border-emerald-600/30': msg.role === 'assistant',
          'bg-rose-900/20 text-rose-300 border border-rose-600/30': msg.role === 'system'
        }"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-[10px] text-slate-500">
            {{ msg.role === 'user' ? '我' : msg.role === 'assistant' ? 'Agent' : '系统' }}
          </span>
          <span class="text-[10px] text-slate-600">
            {{ new Date(msg.timestamp).toLocaleTimeString() }}
          </span>
        </div>
        <div class="whitespace-pre-wrap">{{ msg.content }}</div>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading" class="rounded px-3 py-2 bg-emerald-900/20 border border-emerald-600/30">
        <div class="flex items-center gap-2 text-slate-400">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-[11px]">Agent 正在分析...</span>
        </div>
      </div>
    </div>

    <!-- 当前任务状态 -->
    <div v-if="currentTask" class="border-t border-slate-800 p-3 bg-slate-900/50">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[11px] text-slate-400">
          当前任务状态：
          <span class="text-emerald-400 font-semibold">
            {{ currentTask.status === 'planning' ? '制定计划中' : '执行中' }}
          </span>
        </div>
        <button
          class="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
          @click="$emit('applyAllChanges')"
        >
          应用全部变更
        </button>
      </div>
      
      <!-- 变更列表 -->
      <div class="space-y-1 max-h-32 overflow-auto">
        <div
          v-for="(change, index) in currentTask.changes"
          :key="change.id"
          class="flex items-center justify-between text-[10px] px-2 py-1 rounded"
          :class="{
            'bg-slate-800 text-slate-300': change.status === 'pending',
            'bg-emerald-900/30 text-emerald-400': change.status === 'applied',
            'bg-rose-900/30 text-rose-400': change.status === 'rejected'
          }"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <span class="font-mono text-[9px] text-slate-500">{{ index + 1 }}</span>
            <span class="truncate">{{ change.fileName }}</span>
            <span class="text-slate-600">|</span>
            <span class="text-slate-500">{{ change.action }}</span>
          </div>
          <button
            v-if="change.status === 'pending'"
            class="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-emerald-600 hover:bg-emerald-500 text-white"
            @click="$emit('showDiff', change)"
          >
            查看
          </button>
          <span v-else-if="change.status === 'applied'" class="ml-2 text-[9px]">✓ 已应用</span>
          <span v-else class="ml-2 text-[9px]">✗ 已拒绝</span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="border-t border-slate-800 p-3 space-y-2">
      <textarea
        v-model="localInput"
        :disabled="isLoading"
        rows="3"
        class="w-full resize-none rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        placeholder="描述你想要做的修改，例如：修正人物性格、增加情节伏笔、优化对话描写等..."
        @keydown.ctrl.enter="handleSend"
      ></textarea>
      <div class="flex items-center justify-between">
        <div class="text-[10px] text-slate-500">
          💡 提示：描述要具体明确
        </div>
        <button
          class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!localInput.trim() || isLoading"
          @click="handleSend"
        >
          {{ isLoading ? '分析中...' : '发送 (Ctrl+Enter)' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { AgentMessage, AgentTask, FileChange } from '../composables/useAgent';

const props = defineProps<{
  agentMessages: AgentMessage[];
  agentInput: string;
  isLoading: boolean;
  currentTask: AgentTask | null;
}>();

const emit = defineEmits<{
  (e: 'update:agentInput', value: string): void;
  (e: 'send'): void;
  (e: 'clearHistory'): void;
  (e: 'showDiff', change: FileChange): void;
  (e: 'applyAllChanges'): void;
}>();

const localInput = ref(props.agentInput);
const messageListRef = ref<HTMLElement | null>(null);

watch(() => props.agentInput, (newVal) => {
  localInput.value = newVal;
});

watch(localInput, (newVal) => {
  emit('update:agentInput', newVal);
});

const handleSend = () => {
  if (!localInput.value.trim() || props.isLoading) return;
  emit('send');
};

// 自动滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
};

watch(() => props.agentMessages, scrollToBottom, { deep: true });
watch(() => props.isLoading, (newVal) => {
  if (newVal) {
    scrollToBottom();
  }
});
</script>

