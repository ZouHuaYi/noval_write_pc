<template>
  <div>
    <div
      class="flex items-center px-2 py-0.5 rounded cursor-pointer text-xs hover:bg-slate-800 transition-colors"
      :class="{
        'bg-slate-700 text-slate-50': node.type === 'file' && node.id === currentFileId,
        'text-slate-300': node.type === 'file' && node.id !== currentFileId,
        'text-slate-200 font-medium': node.type === 'folder',
        'bg-emerald-900/30 border border-emerald-500': isDragOver
      }"
      :style="{ paddingLeft: depth * 12 + 8 + 'px' }"
      :draggable="true"
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      @dragstart="handleDragStart"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
      @dragend="handleDragEnd"
    >
      <!-- 文件夹展开/折叠图标 -->
      <span v-if="node.type === 'folder'" class="mr-1 text-slate-400" @click.stop="emit('toggle', node.id)">
        <svg v-if="node.expanded" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        <svg v-else class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
      </span>

      <!-- 图标 -->
      <span class="mr-1.5">
        <!-- 文件夹图标 -->
        <svg v-if="node.type === 'folder'" class="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <!-- 文件图标 -->
        <svg v-else class="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
        </svg>
      </span>

      <!-- 名称 -->
      <span class="flex-1 truncate">{{ node.name }}</span>

      <!-- 文件扩展名 -->
      <span v-if="node.type === 'file' && node.ext" class="ml-2 text-[10px] text-slate-500">
        {{ node.ext }}
      </span>
    </div>

    <!-- 递归渲染子节点 -->
    <template v-if="node.type === 'folder' && node.expanded && node.children">
      <TreeNodeItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :current-file-id="currentFileId"
        :depth="depth + 1"
        @toggle="$emit('toggle', $event)"
        @open-file="$emit('open-file', $event)"
        @new-file="$emit('new-file', $event)"
        @new-folder="$emit('new-folder', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
        @move="$emit('move', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { TreeNode } from '../utils/fileTree';

const props = defineProps<{
  node: TreeNode;
  currentFileId: string | null;
  depth: number;
}>();

const emit = defineEmits<{
  (e: 'toggle', id: string): void;
  (e: 'open-file', id: string): void;
  (e: 'new-file', payload: { node: TreeNode; x: number; y: number }): void;
  (e: 'new-folder', payload: { node: TreeNode; x: number; y: number }): void;
  (e: 'rename', payload: { node: TreeNode; x: number; y: number }): void;
  (e: 'delete', payload: { node: TreeNode; x: number; y: number }): void;
  (e: 'move', payload: { sourceNode: TreeNode; targetNode: TreeNode }): void;
}>();

const isDragOver = ref(false);

const handleClick = () => {
  if (props.node.type === 'folder') {
    emit('toggle', props.node.id);
  } else {
    emit('open-file', props.node.id);
  }
};

const handleContextMenu = (e: MouseEvent) => {
  emit('rename', { node: props.node, x: e.clientX, y: e.clientY });
  
  // 如果是文件夹，还可以在这里新建文件/文件夹
  if (props.node.type === 'folder') {
    emit('new-file', { node: props.node, x: e.clientX, y: e.clientY });
    emit('new-folder', { node: props.node, x: e.clientX, y: e.clientY });
  }
};

// 拖拽开始
const handleDragStart = (e: DragEvent) => {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    // 使用 JSON 序列化节点信息
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: props.node.id,
      name: props.node.name,
      type: props.node.type,
      path: props.node.path
    }));
  }
  console.log('拖拽开始:', props.node.name);
};

// 拖拽经过
const handleDragOver = (e: DragEvent) => {
  // 只有文件夹可以作为放置目标
  if (props.node.type !== 'folder') {
    return;
  }
  
  // 获取拖拽源信息
  const data = e.dataTransfer?.getData('application/json');
  if (!data) return;
  
  try {
    const sourceInfo = JSON.parse(data);
    
    // 不能拖到自己身上
    if (sourceInfo.id === props.node.id) {
      return;
    }
    
    // 不能将父文件夹拖到子文件夹
    if (props.node.id.startsWith(sourceInfo.id + '/')) {
      return;
    }
    
    isDragOver.value = true;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  } catch (err) {
    console.error('解析拖拽数据失败:', err);
  }
};

// 拖拽离开
const handleDragLeave = (e: DragEvent) => {
  // 检查是否真正离开了元素
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    isDragOver.value = false;
  }
};

// 放置
const handleDrop = (e: DragEvent) => {
  isDragOver.value = false;
  
  if (props.node.type !== 'folder') {
    return;
  }
  
  const data = e.dataTransfer?.getData('application/json');
  if (!data) return;
  
  try {
    const sourceInfo = JSON.parse(data);
    console.log('放置到:', props.node.name, '来源:', sourceInfo.name);
    
    // 不能拖到自己身上
    if (sourceInfo.id === props.node.id) {
      console.warn('Cannot drop on itself');
      return;
    }
    
    // 不能将父文件夹拖到子文件夹
    if (props.node.id.startsWith(sourceInfo.id + '/')) {
      console.warn('Cannot move a folder into its own subfolder');
      return;
    }
    
    // 构建完整的源节点信息（从树中查找）
    emit('move', { 
      sourceNode: sourceInfo as TreeNode, 
      targetNode: props.node 
    });
  } catch (err) {
    console.error('处理放置失败:', err);
  }
};

// 拖拽结束
const handleDragEnd = () => {
  isDragOver.value = false;
  console.log('拖拽结束');
};
</script>
