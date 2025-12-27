<template>
  <aside class="w-56 border-r border-slate-800 bg-slate-950/60 flex flex-col text-sm">
    <!-- 顶部：工作区名称 + 操作按钮 -->
    <div class="h-9 flex items-center justify-between px-3 border-b border-slate-800">
      <div class="font-semibold text-slate-200 text-xs uppercase truncate flex-1">
        {{ rootName }}
      </div>
      <div class="flex items-center gap-1">
        <button
          class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
          title="新建文件（需要先打开文件夹）"
          @click="handleNewFile"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
        <button
          class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
          title="新建文件夹（需要先打开文件夹）"
          @click="handleNewFolder"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </button>
        <button
          class="p-1 hover:bg-slate-700 rounded text-emerald-600 hover:text-emerald-500 hover:bg-slate-700"
          title="向量索引（语义搜索）"
          @click="$emit('open-vector-index')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </button>
        <button
          class="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
          title="刷新文件树"
          @click="$emit('refresh')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 文件树 -->
    <div class="flex-1 overflow-auto p-1">
      <TreeNodeItem
        v-for="node in tree"
        :key="node.id"
        :node="node"
        :current-file-id="currentFileId"
        :depth="0"
        @toggle="onToggle"
        @open-file="$emit('open-file', $event)"
        @new-file="onNewFileInFolder"
        @new-folder="onNewFolderInFolder"
        @rename="onRename"
        @delete="onDelete"
        @move="onMove"
      />
      <div v-if="tree.length === 0" class="text-xs text-slate-500 p-3">
        还没有文件，点击顶部「新建」或「刷新」试试。
      </div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.show"
      class="fixed bg-slate-900 border border-slate-700 rounded shadow-lg text-xs z-50 min-w-[140px]"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @mousedown.stop
    >
      <!-- 文件夹菜单 -->
      <template v-if="contextMenu.node?.type === 'folder'">
        <button
          class="block w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2"
          @click="handleNewFileInFolder"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          新建文件
        </button>
        <button
          class="block w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2"
          @click="handleNewFolderInFolder"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          新建文件夹
        </button>
        <div class="border-t border-slate-700 my-1"></div>
      </template>

      <!-- 通用菜单 -->
      <button
        class="block w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center gap-2"
        @click="handleRename"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        重命名
      </button>
      <button
        class="block w-full text-left px-3 py-1.5 hover:bg-slate-700 text-red-400 flex items-center gap-2"
        @click="handleDelete"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        删除
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { TreeNode } from '../utils/fileTree';
import TreeNodeItem from './TreeNodeItem.vue';

defineProps<{
  tree: TreeNode[];
  currentFileId: string | null;
  rootName: string;
}>();

const emit = defineEmits<{
  (e: 'open-file', id: string): void;
  (e: 'new-file'): void;
  (e: 'new-folder'): void;
  (e: 'refresh'): void;
  (e: 'open-vector-index'): void;
  (e: 'toggle-folder', id: string): void;
  (e: 'rename-file', payload: { id: string; newName: string }): void;
  (e: 'delete-file', id: string): void;
  (e: 'request-rename', payload: { node: TreeNode }): void;
  (e: 'request-delete', payload: { node: TreeNode }): void;
  (e: 'request-new-file', payload: { parentNode: TreeNode }): void;
  (e: 'request-new-folder', payload: { parentNode: TreeNode }): void;
  (e: 'request-move', payload: { sourceNode: TreeNode; targetNode: TreeNode }): void;
}>();

const contextMenu = reactive<{
  show: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
}>({
  show: false,
  x: 0,
  y: 0,
  node: null
});

const handleNewFile = () => {
  console.log('FileSidebar: 新建文件按钮被点击');
  emit('new-file');
};

const handleNewFolder = () => {
  console.log('FileSidebar: 新建文件夹按钮被点击');
  emit('new-folder');
};

const onToggle = (id: string) => {
  emit('toggle-folder', id);
};

const onNewFileInFolder = (payload: { node: TreeNode; x: number; y: number }) => {
  contextMenu.show = true;
  contextMenu.x = payload.x;
  contextMenu.y = payload.y;
  contextMenu.node = payload.node;
};

const onNewFolderInFolder = (payload: { node: TreeNode; x: number; y: number }) => {
  // 由于右键菜单会统一处理，这里只需要保存状态
};

const onRename = (payload: { node: TreeNode; x: number; y: number }) => {
  contextMenu.show = true;
  contextMenu.x = payload.x;
  contextMenu.y = payload.y;
  contextMenu.node = payload.node;
};

const onDelete = (payload: { node: TreeNode; x: number; y: number }) => {
  contextMenu.show = true;
  contextMenu.x = payload.x;
  contextMenu.y = payload.y;
  contextMenu.node = payload.node;
};

const onMove = (payload: { sourceNode: TreeNode; targetNode: TreeNode }) => {
  emit('request-move', payload);
};

const handleNewFileInFolder = () => {
  if (!contextMenu.node || contextMenu.node.type !== 'folder') return;
  emit('request-new-file', { parentNode: contextMenu.node });
  contextMenu.show = false;
};

const handleNewFolderInFolder = () => {
  if (!contextMenu.node || contextMenu.node.type !== 'folder') return;
  emit('request-new-folder', { parentNode: contextMenu.node });
  contextMenu.show = false;
};

const handleRename = () => {
  if (!contextMenu.node) return;
  // 发出重命名请求事件，由父组件处理对话框
  emit('request-rename', { node: contextMenu.node });
  contextMenu.show = false;
};

const handleDelete = () => {
  if (!contextMenu.node) return;
  // 发出删除确认请求事件，由父组件处理对话框
  emit('request-delete', { node: contextMenu.node });
  contextMenu.show = false;
};

const hideContextMenu = () => {
  contextMenu.show = false;
};

onMounted(() => {
  window.addEventListener('mousedown', hideContextMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', hideContextMenu);
});
</script>
