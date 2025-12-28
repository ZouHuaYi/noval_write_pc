<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @mousedown.self="onClose"
  >
    <div class="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-[900px] max-h-[85vh] flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h2 class="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
          </svg>
          使用说明
        </h2>
        <button
          class="text-slate-400 hover:text-slate-200 transition-colors"
          @click="onClose"
          title="关闭"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="w-8 h-8 border-4 border-slate-600 border-t-emerald-500 rounded-full animate-spin"></div>
          <span class="ml-3 text-slate-400">加载中...</span>
        </div>
        <div v-else-if="error" class="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{{ error }}</span>
        </div>
        <div v-else class="prose prose-invert prose-slate max-w-none">
          <div v-html="renderedContent" class="user-guide-content"></div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-700">
        <button
          class="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
          @click="onClose"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const loading = ref(true);
const error = ref('');
const renderedContent = ref('');

// 简单的 Markdown 转 HTML 函数
const markdownToHtml = (markdown: string): string => {
  let html = markdown;
  
  // 标题
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // 粗体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 代码块
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // 列表
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>');
  
  // 段落
  html = html.split('\n\n').map(para => {
    if (para.trim() && !para.match(/^<[h|u|o|l|p]/)) {
      return `<p>${para.trim()}</p>`;
    }
    return para;
  }).join('\n');
  
  // 换行
  html = html.replace(/\n/g, '<br>');
  
  // 水平线
  html = html.replace(/^---$/gim, '<hr>');
  
  return html;
};

const loadGuide = async () => {
  if (!props.visible) return;
  
  loading.value = true;
  error.value = '';
  
  try {
    // 使用 electron API 读取使用说明文档
    if (!window.api?.guide?.read) {
      throw new Error('API 不可用，请重启应用');
    }
    
    const result = await window.api.guide.read();
    if (!result.success) {
      throw new Error(result.error || '无法读取使用说明文档');
    }
    
    renderedContent.value = markdownToHtml(result.content || '');
  } catch (err: any) {
    console.error('加载使用说明失败:', err);
    error.value = err.message || '加载使用说明失败，请检查文档文件是否存在';
  } finally {
    loading.value = false;
  }
};

const onClose = () => {
  emit('close');
};

watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadGuide();
  }
});

onMounted(() => {
  if (props.visible) {
    loadGuide();
  }
});
</script>

<style scoped>
.user-guide-content {
  color: #e2e8f0;
  line-height: 1.7;
}

.user-guide-content :deep(h1) {
  color: #f1f5f9;
  font-size: 2em;
  font-weight: 700;
  margin-top: 0;
  margin-bottom: 0.5em;
  border-bottom: 2px solid #475569;
  padding-bottom: 0.3em;
}

.user-guide-content :deep(h2) {
  color: #f1f5f9;
  font-size: 1.5em;
  font-weight: 600;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  border-bottom: 1px solid #475569;
  padding-bottom: 0.3em;
}

.user-guide-content :deep(h3) {
  color: #cbd5e1;
  font-size: 1.25em;
  font-weight: 600;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
}

.user-guide-content :deep(h4) {
  color: #cbd5e1;
  font-size: 1.1em;
  font-weight: 600;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.user-guide-content :deep(p) {
  margin-bottom: 1em;
  color: #cbd5e1;
}

.user-guide-content :deep(ul),
.user-guide-content :deep(ol) {
  margin-bottom: 1em;
  padding-left: 1.5em;
  color: #cbd5e1;
}

.user-guide-content :deep(li) {
  margin-bottom: 0.5em;
}

.user-guide-content :deep(code) {
  background-color: #1e293b;
  color: #10b981;
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-size: 0.9em;
  font-family: 'Courier New', monospace;
}

.user-guide-content :deep(pre) {
  background-color: #0f172a;
  color: #e2e8f0;
  padding: 1em;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1em;
  border: 1px solid #334155;
}

.user-guide-content :deep(pre code) {
  background-color: transparent;
  color: inherit;
  padding: 0;
}

.user-guide-content :deep(blockquote) {
  border-left: 4px solid #10b981;
  padding-left: 1em;
  margin-left: 0;
  margin-bottom: 1em;
  color: #94a3b8;
  font-style: italic;
}

.user-guide-content :deep(strong) {
  color: #f1f5f9;
  font-weight: 600;
}

.user-guide-content :deep(em) {
  color: #cbd5e1;
  font-style: italic;
}

.user-guide-content :deep(a) {
  color: #10b981;
  text-decoration: underline;
}

.user-guide-content :deep(a:hover) {
  color: #34d399;
}

.user-guide-content :deep(hr) {
  border: none;
  border-top: 1px solid #475569;
  margin: 2em 0;
}
</style>

