<template>
  <div class="h-full min-h-0 bg-slate-950/70 flex flex-col">
    <!-- 顶部工具栏 -->
    <div class="border-b border-slate-800 p-2 space-y-2">
      <!-- 提示文件状态 -->
      <div v-if="hasPromptFile" class="flex items-center gap-2 px-2 py-1 bg-emerald-900/20 border border-emerald-600/30 rounded text-[10px]">
        <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-emerald-400">已加载提示文件</span>
      </div>
      <div v-else class="flex items-center gap-2 px-2 py-1 bg-amber-900/20 border border-amber-600/30 rounded text-[10px]">
        <svg class="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <span class="text-amber-400">未加载提示文件</span>
      </div>
      
      <!-- 模型选择器 -->
      <div class="flex items-center gap-2">
        <label class="text-[10px] text-slate-400 w-12">模型：</label>
        <select
          v-model="selectedModelId"
          class="flex-1 px-2 py-1 text-[11px] bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          @change="$emit('update:selectedModel', selectedModelId)"
        >
          <option v-if="models.length === 0" value="">未配置模型</option>
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.name }} ({{ model.model }})
          </option>
        </select>
      </div>

      <!-- 模式切换 -->
      <div class="flex items-center gap-2">
        <label class="text-[10px] text-slate-400 w-12">模式：</label>
        <div class="flex gap-1 flex-1">
          <button
            class="flex-1 px-2 py-1 rounded border border-slate-700 text-[10px]"
            :class="mode === 'file' ? 'bg-slate-700 text-slate-50' : 'text-slate-300'"
            @click="$emit('update:mode', 'file')"
          >
            当前文件
          </button>
          <button
            class="flex-1 px-2 py-1 rounded border border-slate-700 text-[10px]"
            :class="mode === 'selection' ? 'bg-slate-700 text-slate-50' : 'text-slate-300'"
            @click="$emit('update:mode', 'selection')"
          >
            选中文本
          </button>
        </div>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="messageListRef" class="flex-1 min-h-0 overflow-auto px-3 py-2 space-y-2 text-xs">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="rounded px-2 py-1.5 relative group"
        :class="
          msg.role === 'user'
            ? 'bg-slate-800 text-slate-100'
            : 'bg-slate-900 text-slate-200 border border-slate-700'
        "
      >
        <!-- 消息头部：角色 + 操作按钮 -->
        <div class="flex items-center justify-between mb-0.5">
          <div class="text-[10px] text-slate-500">
            {{ msg.role === 'user' ? '我' : 'AI 助手' }}
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <!-- 复制按钮 -->
            <button
              class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
              title="复制内容"
              @click="copyMessage(msg.content)"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </button>
            <!-- 删除按钮 -->
            <button
              class="p-1 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400"
              title="删除消息"
              @click="deleteMessage(msg.id)"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
            <!-- 折叠/展开按钮 (仅AI回复) -->
            <button
              v-if="msg.role === 'assistant'"
              class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
              :title="collapsedMessages[msg.id] ? '展开' : '收起'"
              @click="toggleCollapse(msg.id)"
            >
              <svg v-if="collapsedMessages[msg.id]" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
              </svg>
            </button>
          </div>
        </div>
        <!-- 消息内容 -->
        <div 
          v-if="msg.role === 'user' || !collapsedMessages[msg.id]"
          class="whitespace-pre-wrap break-words"
        >{{ msg.content }}</div>
        <div 
          v-else
          class="text-slate-500 text-[10px] italic"
        >已收起...</div>
      </div>

      <!-- 加载中状态 -->
      <div v-if="isLoading" class="rounded px-2 py-1.5 bg-slate-900 border border-slate-700">
        <div class="flex items-center gap-2 text-slate-400">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-[11px]">正在思考...</span>
        </div>
      </div>

      <div v-if="messages.length === 0 && !isLoading" class="text-[11px] text-slate-500 space-y-3 p-3">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-emerald-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          <div>
            <p class="font-semibold text-emerald-400 mb-1">AI 智能写作助手</p>
            <p class="text-slate-400">专为小说创作优化的 AI 对话系统</p>
          </div>
        </div>
        <div class="space-y-1.5 pl-6">
          <p>📝 <strong>使用方法：</strong></p>
          <p>• 在设置中配置 LLM 模型</p>
          <p>• 选择基于当前文件或选中文本</p>
          <p>• 向 AI 提问或请求续写、优化</p>
          <p>• AI 回复可插入或替换编辑器内容</p>
        </div>
        <div class="border-t border-slate-700/50 pt-2 mt-2">
          <p class="text-[10px] text-slate-600">💡 右键选中文本可快速优化内容</p>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="border-t border-slate-800 p-2 space-y-2 text-xs">
      <textarea
        :value="modelValue"
        :disabled="isLoading"
        rows="3"
        class="w-full resize-none rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        placeholder="在这里提问，比如：帮我续写这一段，保持人物性格和世界观设定不变。"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown.ctrl.enter="handleSend"
      ></textarea>

      <div class="flex items-center justify-between gap-2">
        <div class="flex gap-2 text-[11px] text-slate-500">
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              class="h-3 w-3"
              :checked="insertMode === 'append'"
              :disabled="isLoading"
              @change="$emit('update:insertMode', 'append')"
            />
            <span>插入</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              class="h-3 w-3"
              :checked="insertMode === 'replace'"
              :disabled="isLoading"
              @change="$emit('update:insertMode', 'replace')"
            />
            <span>替换</span>
          </label>
        </div>

        <button
          class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!modelValue || isLoading || models.length === 0"
          @click="handleSend"
        >
          {{ isLoading ? '思考中...' : '发送 (Ctrl+Enter)' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

interface LLMModel {
  id: number;
  name: string;
  model: string;
}

const props = defineProps<{
  messages: ChatMessage[];
  mode: 'file' | 'selection';
  insertMode: 'append' | 'replace';
  modelValue: string;
  isLoading?: boolean;
  selectedModel?: number | null;
  hasPromptFile?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:mode', value: 'file' | 'selection'): void;
  (e: 'update:insertMode', value: 'append' | 'replace'): void;
  (e: 'update:selectedModel', value: number | null): void;
  (e: 'send'): void;
  (e: 'deleteMessage', id: number): void;
}>();

const models = ref<LLMModel[]>([]);
const selectedModelId = ref<number | null>(null);
const messageListRef = ref<HTMLElement | null>(null);
// 折叠状态：默认AI回复都是收起的
const collapsedMessages = reactive<Record<number, boolean>>({});

const loadModels = async () => {
  if (!window.api?.llm) return;
  
  const result = await window.api.llm.getAll();
  if (result.success && result.models) {
    models.value = result.models.map((m: any) => ({
      id: m.id,
      name: m.name,
      model: m.model
    }));
    
    // 如果有默认模型，选中它
    const defaultModel = result.models.find((m: any) => m.is_default === 1);
    if (defaultModel) {
      selectedModelId.value = defaultModel.id;
      emit('update:selectedModel', defaultModel.id);
    } else if (models.value.length > 0) {
      selectedModelId.value = models.value[0].id;
      emit('update:selectedModel', models.value[0].id);
    }
  }
};

const handleSend = () => {
  if (!props.modelValue || props.isLoading || models.value.length === 0) return;
  emit('send');
};

// 复制消息内容
const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    // 可以添加一个提示
    console.log('已复制到剪贴板');
  } catch (err) {
    console.error('复制失败:', err);
  }
};

// 删除消息
const deleteMessage = (id: number) => {
  emit('deleteMessage', id);
};

// 切换消息折叠状态
const toggleCollapse = (id: number) => {
  collapsedMessages[id] = !collapsedMessages[id];
};

// 自动滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
};

watch(() => props.messages, (newMessages) => {
  // 新增的AI消息默认收起
  newMessages.forEach(msg => {
    if (msg.role === 'assistant' && !(msg.id in collapsedMessages)) {
      collapsedMessages[msg.id] = true; // 默认收起
    }
  });
  scrollToBottom();
}, { deep: true });

watch(() => props.isLoading, (newVal) => {
  if (newVal) {
    scrollToBottom();
  }
});

onMounted(() => {
  loadModels();
});

// 暴露刷新模型列表的方法
defineExpose({
  refreshModels: loadModels
});
</script>
