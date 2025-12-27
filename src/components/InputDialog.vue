<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @mousedown.self="onCancel"
  >
    <div class="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-96 p-5">
      <h3 class="text-lg font-semibold text-slate-100 mb-3">{{ title }}</h3>
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
        :placeholder="placeholder"
        @keyup.enter="onConfirm"
        @keyup.esc="onCancel"
      />
      <div class="flex justify-end gap-2">
        <button
          class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
          @click="onCancel"
        >
          取消
        </button>
        <button
          class="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
          @click="onConfirm"
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
}>();

const emit = defineEmits<{
  (e: 'confirm', value: string): void;
  (e: 'cancel'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref('');

watch(
  () => props.visible,
  (val) => {
    if (val) {
      inputValue.value = props.defaultValue || '';
      nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
      });
    }
  }
);

const onConfirm = () => {
  emit('confirm', inputValue.value);
};

const onCancel = () => {
  emit('cancel');
};
</script>

