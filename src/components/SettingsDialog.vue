<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @mousedown.self="onClose"
  >
    <div class="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-[800px] max-h-[80vh] flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h2 class="text-lg font-semibold text-slate-100">设置</h2>
        <button
          class="text-slate-400 hover:text-slate-200"
          @click="onClose"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 标签页 -->
      <div class="flex border-b border-slate-700">
        <button
          class="px-6 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'llm' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'"
          @click="activeTab = 'llm'"
        >
          LLM 模型
        </button>
        <button
          class="px-6 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'embedding' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'"
          @click="activeTab = 'embedding'"
        >
          Embedding 模型
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-y-auto p-5">
        <!-- LLM 模型配置 -->
        <div v-if="activeTab === 'llm'">
          <ModelManager
            :models="llmModels"
            model-type="llm"
            @add="startAddLLMModel"
            @edit="startEditLLMModel"
            @delete="deleteLLMModel"
            @set-default="setLLMDefault"
          />

          <!-- 添加/编辑LLM模型表单 -->
          <div
            v-if="showLLMForm"
            class="mt-4 bg-slate-900/80 border border-emerald-600/30 rounded-lg p-4 space-y-3"
          >
            <h4 class="text-sm font-medium text-slate-100 mb-3">{{ editingLLM ? '编辑 LLM 模型' : '添加 LLM 模型' }}</h4>
            
            <div>
              <label class="block text-xs text-slate-400 mb-1">模型名称</label>
              <input
                v-model="llmForm.name"
                type="text"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例如：GPT-4"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">API 地址</label>
              <input
                v-model="llmForm.baseUrl"
                type="text"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例如：https://api.openai.com/v1"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">API Key</label>
              <input
                v-model="llmForm.apiKey"
                type="password"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">模型标识</label>
              <input
                v-model="llmForm.model"
                type="text"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例如：gpt-4"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-400 mb-1">Max Tokens</label>
                <input
                  v-model.number="llmForm.maxTokens"
                  type="number"
                  min="1"
                  max="100000"
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="2000"
                />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Temperature</label>
                <input
                  v-model.number="llmForm.temperature"
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.7"
                />
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input
                v-model="llmForm.isDefault"
                type="checkbox"
                id="llm-is-default"
                class="rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
              />
              <label for="llm-is-default" class="text-sm text-slate-300">设为默认模型</label>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                class="px-4 py-2 text-sm rounded border border-slate-600 hover:bg-slate-700 text-slate-300"
                @click="cancelLLMForm"
              >
                取消
              </button>
              <button
                class="px-4 py-2 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                @click="saveLLMModel"
              >
                {{ editingLLM ? '保存' : '添加' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Embedding 模型配置 -->
        <div v-if="activeTab === 'embedding'">
          <ModelManager
            :models="embeddingModels"
            model-type="embedding"
            @add="startAddEmbeddingModel"
            @edit="startEditEmbeddingModel"
            @delete="deleteEmbeddingModel"
            @set-default="setEmbeddingDefault"
          />

          <!-- 添加/编辑Embedding模型表单 -->
          <div
            v-if="showEmbeddingForm"
            class="mt-4 bg-slate-900/80 border border-emerald-600/30 rounded-lg p-4 space-y-3"
          >
            <h4 class="text-sm font-medium text-slate-100 mb-3">{{ editingEmbedding ? '编辑 Embedding 模型' : '添加 Embedding 模型' }}</h4>
            
            <div>
              <label class="block text-xs text-slate-400 mb-1">模型名称</label>
              <input
                v-model="embeddingForm.name"
                type="text"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例如：text-embedding-ada-002"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">API 地址</label>
              <input
                v-model="embeddingForm.baseUrl"
                type="text"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例如：https://api.openai.com/v1"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">API Key</label>
              <input
                v-model="embeddingForm.apiKey"
                type="password"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="sk-..."
              />
            </div>

            <div>
              <label class="block text-xs text-slate-400 mb-1">模型标识</label>
              <input
                v-model="embeddingForm.model"
                type="text"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="例如：text-embedding-ada-002"
              />
            </div>

            <div class="flex items-center gap-2">
              <input
                v-model="embeddingForm.isDefault"
                type="checkbox"
                id="embedding-is-default"
                class="rounded border-slate-600 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
              />
              <label for="embedding-is-default" class="text-sm text-slate-300">设为默认模型</label>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                class="px-4 py-2 text-sm rounded border border-slate-600 hover:bg-slate-700 text-slate-300"
                @click="cancelEmbeddingForm"
              >
                取消
              </button>
              <button
                class="px-4 py-2 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                @click="saveEmbeddingModel"
              >
                {{ editingEmbedding ? '保存' : '添加' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import ModelManager from './ModelManager.vue';

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

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const activeTab = ref('llm');
const llmModels = ref<Model[]>([]);
const embeddingModels = ref<Model[]>([]);

// LLM 表单
const showLLMForm = ref(false);
const editingLLM = ref<Model | null>(null);
const llmForm = reactive({
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  maxTokens: 2000,
  temperature: 0.7,
  isDefault: false
});

// Embedding 表单
const showEmbeddingForm = ref(false);
const editingEmbedding = ref<Model | null>(null);
const embeddingForm = reactive({
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  isDefault: false
});

const onClose = () => {
  emit('close');
};

// LLM 模型管理
const loadLLMModels = async () => {
  if (!window.api?.llm) return;
  const result = await window.api.llm.getAll();
  if (result.success) {
    llmModels.value = result.models || [];
  }
};

const startAddLLMModel = () => {
  editingLLM.value = null;
  llmForm.name = '';
  llmForm.baseUrl = 'https://api.openai.com/v1';
  llmForm.apiKey = '';
  llmForm.model = 'gpt-3.5-turbo';
  llmForm.maxTokens = 2000;
  llmForm.temperature = 0.7;
  llmForm.isDefault = llmModels.value.length === 0;
  showLLMForm.value = true;
};

const startEditLLMModel = (model: Model) => {
  editingLLM.value = model;
  llmForm.name = model.name;
  llmForm.baseUrl = model.base_url;
  llmForm.apiKey = model.api_key;
  llmForm.model = model.model;
  llmForm.maxTokens = model.max_tokens || 2000;
  llmForm.temperature = model.temperature || 0.7;
  llmForm.isDefault = model.is_default === 1;
  showLLMForm.value = true;
};

const cancelLLMForm = () => {
  showLLMForm.value = false;
  editingLLM.value = null;
};

const saveLLMModel = async () => {
  if (!window.api?.llm) return;
  
  if (!llmForm.name || !llmForm.baseUrl || !llmForm.apiKey || !llmForm.model) {
    alert('请填写所有必填字段');
    return;
  }
  
  const data = {
    name: llmForm.name,
    baseUrl: llmForm.baseUrl,
    apiKey: llmForm.apiKey,
    model: llmForm.model,
    maxTokens: llmForm.maxTokens,
    temperature: llmForm.temperature,
    isDefault: llmForm.isDefault
  };
  
  let result;
  if (editingLLM.value) {
    result = await window.api.llm.update(editingLLM.value.id, data);
  } else {
    result = await window.api.llm.add(data);
  }
  
  if (result.success) {
    await loadLLMModels();
    cancelLLMForm();
  } else {
    alert('保存失败：' + result.error);
  }
};

const deleteLLMModel = async (id: number) => {
  if (!window.api?.llm) return;
  
  if (!confirm('确定要删除这个模型配置吗？')) return;
  
  const result = await window.api.llm.delete(id);
  if (result.success) {
    await loadLLMModels();
  } else {
    alert('删除失败：' + result.error);
  }
};

const setLLMDefault = async (id: number) => {
  if (!window.api?.llm) return;
  
  const result = await window.api.llm.setDefault(id);
  if (result.success) {
    await loadLLMModels();
  } else {
    alert('设置失败：' + result.error);
  }
};

// Embedding 模型管理
const loadEmbeddingModels = async () => {
  if (!window.api?.embedding) return;
  const result = await window.api.embedding.getAll();
  if (result.success) {
    embeddingModels.value = result.models || [];
  }
};

const startAddEmbeddingModel = () => {
  editingEmbedding.value = null;
  embeddingForm.name = '';
  embeddingForm.baseUrl = 'https://api.openai.com/v1';
  embeddingForm.apiKey = '';
  embeddingForm.model = 'text-embedding-ada-002';
  embeddingForm.isDefault = embeddingModels.value.length === 0;
  showEmbeddingForm.value = true;
};

const startEditEmbeddingModel = (model: Model) => {
  editingEmbedding.value = model;
  embeddingForm.name = model.name;
  embeddingForm.baseUrl = model.base_url;
  embeddingForm.apiKey = model.api_key;
  embeddingForm.model = model.model;
  embeddingForm.isDefault = model.is_default === 1;
  showEmbeddingForm.value = true;
};

const cancelEmbeddingForm = () => {
  showEmbeddingForm.value = false;
  editingEmbedding.value = null;
};

const saveEmbeddingModel = async () => {
  if (!window.api?.embedding) return;
  
  if (!embeddingForm.name || !embeddingForm.baseUrl || !embeddingForm.apiKey || !embeddingForm.model) {
    alert('请填写所有必填字段');
    return;
  }
  
  const data = {
    name: embeddingForm.name,
    baseUrl: embeddingForm.baseUrl,
    apiKey: embeddingForm.apiKey,
    model: embeddingForm.model,
    isDefault: embeddingForm.isDefault
  };
  
  let result;
  if (editingEmbedding.value) {
    result = await window.api.embedding.update(editingEmbedding.value.id, data);
  } else {
    result = await window.api.embedding.add(data);
  }
  
  if (result.success) {
    await loadEmbeddingModels();
    cancelEmbeddingForm();
  } else {
    alert('保存失败：' + result.error);
  }
};

const deleteEmbeddingModel = async (id: number) => {
  if (!window.api?.embedding) return;
  
  if (!confirm('确定要删除这个模型配置吗？')) return;
  
  const result = await window.api.embedding.delete(id);
  if (result.success) {
    await loadEmbeddingModels();
  } else {
    alert('删除失败：' + result.error);
  }
};

const setEmbeddingDefault = async (id: number) => {
  if (!window.api?.embedding) return;
  
  const result = await window.api.embedding.setDefault(id);
  if (result.success) {
    await loadEmbeddingModels();
  } else {
    alert('设置失败：' + result.error);
  }
};

onMounted(() => {
  if (props.visible) {
    loadLLMModels();
    loadEmbeddingModels();
  }
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadLLMModels();
    loadEmbeddingModels();
  }
});

watch(activeTab, (newTab) => {
  // 切换标签时关闭表单
  showLLMForm.value = false;
  showEmbeddingForm.value = false;
});
</script>

