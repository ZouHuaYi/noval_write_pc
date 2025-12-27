<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    @click.self="handleClose"
  >
    <div class="bg-slate-900 border border-rose-600/30 rounded-lg shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-gradient-to-r from-rose-900/20 to-pink-900/20">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
          </svg>
          <h2 class="text-xl font-bold text-slate-100">批量一致性校验</h2>
        </div>
        <button
          class="p-1 rounded hover:bg-slate-800 transition-colors"
          @click="handleClose"
        >
          <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="flex-1 overflow-auto px-6 py-4">
        <!-- 未开始状态：文件选择 -->
        <div v-if="!isChecking && !checkComplete" class="space-y-4">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm text-slate-300">
              找到 <span class="text-emerald-400 font-bold">{{ txtFiles.length }}</span> 个txt文件
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 rounded text-sm bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30"
                @click="selectAll"
              >
                全选
              </button>
              <button
                class="px-3 py-1.5 rounded text-sm bg-slate-700/50 hover:bg-slate-700 text-slate-300"
                @click="selectNone"
              >
                取消全选
              </button>
            </div>
          </div>

          <div class="space-y-2 max-h-[400px] overflow-auto">
            <label
              v-for="file in txtFiles"
              :key="file.path"
              class="flex items-center gap-3 p-3 rounded bg-slate-800/50 hover:bg-slate-800 cursor-pointer border border-slate-700/50"
            >
              <input
                type="checkbox"
                :checked="selectedFiles.has(file.path)"
                class="w-4 h-4 rounded"
                @change="toggleFile(file.path)"
              />
              <div class="flex-1">
                <div class="text-sm text-slate-200">{{ file.name }}</div>
                <div class="text-xs text-slate-500">{{ file.relativePath }}</div>
              </div>
            </label>
          </div>

          <div v-if="txtFiles.length === 0" class="text-center py-12 text-slate-500">
            <svg class="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p>当前工作区没有txt文件</p>
          </div>
        </div>

        <!-- 校验中状态：进度显示 -->
        <div v-if="isChecking" class="space-y-4">
          <div class="flex items-center justify-center py-8">
            <div class="flex flex-col items-center gap-3">
              <svg class="w-12 h-12 animate-spin text-rose-400" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-slate-300">{{ checkingStatus }}</p>
              <p class="text-sm text-slate-500">{{ checkingDetail }}</p>
            </div>
          </div>

          <div class="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
            <div class="text-sm text-slate-400 mb-2">正在处理的文件:</div>
            <div class="text-slate-200 text-sm">{{ currentFileName }}</div>
          </div>

          <!-- 进度条 -->
          <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              class="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all duration-300"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>

          <!-- 已读取的文件列表 -->
          <div v-if="loadedFiles.length > 0" class="space-y-2 max-h-[300px] overflow-auto">
            <div class="text-sm text-slate-400 mb-2">已读取 {{ loadedFiles.length }} / {{ totalFiles }} 个文件:</div>
            <div
              v-for="file in loadedFiles"
              :key="file"
              class="p-2 rounded bg-slate-800/30 text-xs border-l-2 border-emerald-500"
            >
              <div class="text-slate-300">✓ {{ file }}</div>
            </div>
          </div>
        </div>

        <!-- 完成状态：结果汇总 -->
        <div v-if="checkComplete && !isChecking" class="space-y-4">
          <div 
            class="border rounded-lg p-4"
            :class="checkSuccess ? 'bg-emerald-900/20 border-emerald-600/30' : 'bg-red-900/20 border-red-600/30'"
          >
            <div class="flex items-center gap-2 mb-2">
              <svg v-if="checkSuccess" class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <svg v-else class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span :class="checkSuccess ? 'text-emerald-400' : 'text-red-400'" class="font-bold">
                {{ checkSuccess ? '合并校验完成！' : '校验失败' }}
              </span>
            </div>
            <div class="text-sm text-slate-300 space-y-1">
              <div>已合并: {{ totalFiles }} 个文件</div>
              <div>总字数: <span class="text-emerald-400">{{ totalChars }}</span> 字</div>
              <div v-if="mergedFileList.length > 0">
                <div class="text-xs text-slate-400 mt-2">包含文件:</div>
                <div class="text-xs text-slate-500 ml-2">
                  {{ mergedFileList.join(', ') }}
                </div>
              </div>
            </div>
          </div>

          <!-- 校验结果 -->
          <div v-if="checkSuccess" class="bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <div class="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <div class="text-sm font-medium text-slate-200">校验结果</div>
              <button
                class="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                @click="resultExpanded = !resultExpanded"
              >
                <span>{{ resultExpanded ? '收起' : '展开' }}</span>
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="resultExpanded ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'"></path>
                </svg>
              </button>
            </div>
            <div v-if="resultExpanded" class="p-4">
              <div class="text-sm text-slate-200 whitespace-pre-wrap max-h-[500px] overflow-auto">
                {{ checkResult }}
              </div>
            </div>
          </div>

          <!-- 错误信息 -->
          <div v-if="!checkSuccess && checkError" class="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
            <div class="text-sm text-red-300">
              <div class="font-bold mb-1">错误信息:</div>
              <div>{{ checkError }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 bg-slate-950/50">
        <button
          v-if="!isChecking && !checkComplete"
          class="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="selectedFiles.size === 0"
          @click="startCheck"
        >
          开始校验 ({{ selectedFiles.size }} 个文件)
        </button>
        <button
          v-if="checkComplete"
          class="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors text-sm font-medium"
          @click="viewHistory"
        >
          查看历史记录
        </button>
        <button
          v-if="checkComplete"
          class="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors text-sm font-medium"
          @click="resetCheck"
        >
          重新选择
        </button>
        <button
          class="px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-800 text-slate-300 transition-colors text-sm"
          :disabled="isChecking"
          @click="handleClose"
        >
          {{ isChecking ? '校验中...' : '关闭' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

interface TxtFile {
  path: string;
  name: string;
  relativePath: string;
}

interface CheckResult {
  filePath: string;
  fileName: string;
  relativePath: string;
  success: boolean;
  result?: string;
  error?: string;
}

const props = defineProps<{
  visible: boolean;
  workspaceRoot: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'view-history'): void;
}>();

const txtFiles = ref<TxtFile[]>([]);
const selectedFiles = ref<Set<string>>(new Set());
const isChecking = ref(false);
const checkComplete = ref(false);
const checkSuccess = ref(false);
const checkResult = ref('');
const checkError = ref('');
const currentIndex = ref(0);
const currentFileName = ref('');
const checkingStatus = ref('');
const checkingDetail = ref('');
const totalFiles = ref(0);
const totalChars = ref(0);
const loadedFiles = ref<string[]>([]);
const mergedFileList = ref<string[]>([]);
const resultExpanded = ref(true);

const progressPercent = computed(() => {
  if (totalFiles.value === 0) return 0;
  return ((currentIndex.value) / totalFiles.value) * 100;
});

// 加载txt文件列表
const loadTxtFiles = async () => {
  if (!props.workspaceRoot || !window.api?.refreshFolder) return;
  
  const result = await window.api.refreshFolder(props.workspaceRoot);
  if (result.success && result.files) {
    txtFiles.value = result.files
      .filter((f: any) => f.type === 'file' && f.path.toLowerCase().endsWith('.txt'))
      .map((f: any) => ({
        path: f.path,
        name: f.name,
        relativePath: f.relativePath
      }));
  }
};

// 全选
const selectAll = () => {
  selectedFiles.value = new Set(txtFiles.value.map(f => f.path));
};

// 取消全选
const selectNone = () => {
  selectedFiles.value.clear();
};

// 切换文件选择
const toggleFile = (path: string) => {
  if (selectedFiles.value.has(path)) {
    selectedFiles.value.delete(path);
  } else {
    selectedFiles.value.add(path);
  }
};

// 开始批量校验（合并文件内容）
const startCheck = async () => {
  if (selectedFiles.value.size === 0) return;
  
  isChecking.value = true;
  checkComplete.value = false;
  checkSuccess.value = false;
  checkResult.value = '';
  checkError.value = '';
  currentIndex.value = 0;
  totalFiles.value = selectedFiles.value.size;
  loadedFiles.value = [];
  mergedFileList.value = [];
  
  const filesToCheck = txtFiles.value.filter(f => selectedFiles.value.has(f.path));
  
  // 按文件名排序（章节顺序）
  filesToCheck.sort((a, b) => {
    // 尝试提取数字进行排序
    const numA = a.name.match(/\d+/);
    const numB = b.name.match(/\d+/);
    if (numA && numB) {
      return parseInt(numA[0]) - parseInt(numB[0]);
    }
    return a.name.localeCompare(b.name);
  });
  
  try {
    checkingStatus.value = '正在读取文件...';
    checkingDetail.value = `共 ${totalFiles.value} 个文件`;
    
    // 读取所有文件内容
    const fileContents: { name: string; content: string }[] = [];
    
    for (let i = 0; i < filesToCheck.length; i++) {
      const file = filesToCheck[i];
      currentIndex.value = i;
      currentFileName.value = file.name;
      checkingDetail.value = `正在读取 ${i + 1} / ${totalFiles.value}`;
      
      const readResult = await window.api!.readFile!(file.path);
      if (!readResult.success) {
        throw new Error(`读取文件 ${file.name} 失败: ${readResult.error}`);
      }
      
      const content = readResult.content || '';
      fileContents.push({
        name: file.name,
        content: content
      });
      
      loadedFiles.value.push(file.name);
      mergedFileList.value.push(file.name);
      
      // 短暂延迟，让用户看到进度
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    currentIndex.value = totalFiles.value;
    
    // 合并文件内容
    checkingStatus.value = '正在合并文件内容...';
    checkingDetail.value = '准备校验';
    
    let mergedContent = '';
    for (const file of fileContents) {
      mergedContent += `\n\n========== 文件: ${file.name} ==========\n\n`;
      mergedContent += file.content;
    }
    
    totalChars.value = mergedContent.length;
    
    // 如果合并后的内容太长，截取或分段
    let textToCheck = mergedContent;
    const maxLength = 10000; // 最多校验10000字
    
    if (mergedContent.length > maxLength) {
      textToCheck = mergedContent.substring(0, maxLength);
      checkingDetail.value = `内容过长，仅校验前 ${maxLength} 字`;
    }
    
    // 调用校验API
    checkingStatus.value = '正在进行一致性校验...';
    checkingDetail.value = '这可能需要1-2分钟，请耐心等待';
    
    const result = await window.api!.consistency!.check(
      textToCheck,
      props.workspaceRoot,
      `合并文件: ${mergedFileList.value.join(', ')}`
    );
    
    if (result.success) {
      checkSuccess.value = true;
      checkResult.value = result.result || '校验完成';
    } else {
      checkSuccess.value = false;
      checkError.value = result.error || '校验失败';
    }
    
  } catch (err: any) {
    checkSuccess.value = false;
    checkError.value = err.message || '校验过程出错';
  } finally {
    isChecking.value = false;
    checkComplete.value = true;
  }
};

// 重置校验
const resetCheck = () => {
  checkComplete.value = false;
  checkSuccess.value = false;
  isChecking.value = false;
  currentIndex.value = 0;
  checkResult.value = '';
  checkError.value = '';
  loadedFiles.value = [];
  mergedFileList.value = [];
  selectedFiles.value.clear();
};

// 查看历史
const viewHistory = () => {
  emit('view-history');
};

// 关闭对话框
const handleClose = () => {
  if (!isChecking.value) {
    emit('close');
  }
};

onMounted(() => {
  if (props.visible && props.workspaceRoot) {
    loadTxtFiles();
  }
});

// 监听 visible 变化
import { watch } from 'vue';
watch(() => props.visible, (newVal) => {
  if (newVal && props.workspaceRoot) {
    loadTxtFiles();
    resetCheck();
  }
});
</script>

<style scoped>
/* 自定义滚动条 */
.overflow-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.7);
}
</style>

