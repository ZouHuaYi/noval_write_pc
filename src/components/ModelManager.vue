<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-slate-200">已配置的模型</h3>
      <button
        class="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1"
        @click="$emit('add')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        添加模型
      </button>
    </div>

    <div v-if="models.length === 0" class="text-center py-8 text-slate-500 text-sm">
      还没有配置模型，点击上方按钮添加
    </div>

    <div
      v-for="model in models"
      :key="model.id"
      class="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <h4 class="text-sm font-medium text-slate-100">{{ model.name }}</h4>
            <span v-if="model.is_default" class="px-2 py-0.5 text-xs rounded bg-emerald-600/20 text-emerald-400 border border-emerald-600/30">
              默认
            </span>
          </div>
          <div class="space-y-1 text-xs text-slate-400">
            <div><span class="text-slate-500">模型：</span>{{ model.model }}</div>
            <div><span class="text-slate-500">API 地址：</span>{{ model.base_url }}</div>
            <div><span class="text-slate-500">API Key：</span>{{ maskApiKey(model.api_key) }}</div>
            <div v-if="modelType === 'llm' && (model.max_tokens || model.temperature)">
              <span class="text-slate-500">参数：</span>
              <span v-if="model.max_tokens">Max Tokens={{ model.max_tokens }}</span>
              <span v-if="model.temperature">, Temperature={{ model.temperature }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 ml-4">
          <button
            v-if="!model.is_default"
            class="px-2 py-1 text-xs rounded border border-slate-600 hover:bg-slate-700 text-slate-300"
            @click="$emit('set-default', model.id)"
          >
            设为默认
          </button>
          <button
            class="px-2 py-1 text-xs rounded border border-slate-600 hover:bg-slate-700 text-slate-300"
            @click="$emit('edit', model)"
          >
            编辑
          </button>
          <button
            class="px-2 py-1 text-xs rounded border border-red-600/50 hover:bg-red-600/20 text-red-400"
            @click="$emit('delete', model.id)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Model {
  id: number;
  name: string;
  api_key: string;
  base_url: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
  is_default: number;
}

defineProps<{
  models: Model[];
  modelType: 'llm' | 'embedding';
}>();

defineEmits<{
  (e: 'add'): void;
  (e: 'edit', model: Model): void;
  (e: 'delete', id: number): void;
  (e: 'set-default', id: number): void;
}>();

const maskApiKey = (key: string) => {
  if (!key || key.length < 8) return '***';
  return key.substring(0, 7) + '...' + key.substring(key.length - 4);
};
</script>

