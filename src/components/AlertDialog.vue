<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @mousedown.self="onClose"
  >
    <div class="bg-slate-800 rounded-lg shadow-xl border border-slate-700 w-96 p-5">
      <h3 class="text-lg font-semibold text-slate-100 mb-3">{{ title }}</h3>
      <p class="text-slate-300 mb-4">{{ message }}</p>
      <div class="flex justify-end gap-2">
        <button
          v-if="showCancel"
          class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
          @click="onCancel"
        >
          取消
        </button>
        <button
          class="px-4 py-2 rounded"
          :class="confirmClass"
          @click="onConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    visible: boolean;
    title?: string;
    message: string;
    showCancel?: boolean;
    confirmText?: string;
    type?: 'info' | 'warning' | 'danger';
  }>(),
  {
    title: '提示',
    showCancel: false,
    confirmText: '确定',
    type: 'info'
  }
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

const confirmClass = computed(() => {
  switch (props.type) {
    case 'danger':
      return 'bg-red-600 hover:bg-red-500 text-white';
    case 'warning':
      return 'bg-amber-600 hover:bg-amber-500 text-white';
    default:
      return 'bg-emerald-600 hover:bg-emerald-500 text-white';
  }
});

const onConfirm = () => {
  emit('confirm');
  emit('close');
};

const onCancel = () => {
  emit('cancel');
  emit('close');
};

const onClose = () => {
  emit('close');
};
</script>

<script lang="ts">
import { computed } from 'vue';
export default {
  name: 'AlertDialog'
};
</script>

