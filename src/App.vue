<template>
  <div class="flex flex-col h-full bg-slate-900 text-slate-100">
    <TitleBar />
    <TopBar
      @open-folder="handleOpenFolder"
      @open-workspace="handleOpenWorkspace"
      @open-settings="showSettingsDialog = true"
      @open-guide="showUserGuideDialog = true"
      @batch-check="handleBatchCheck"
      @view-history="ai.showConsistencyHistory.value = true"
    />

    <main class="flex-1 flex overflow-hidden min-h-0">
      <!-- 左侧：文件树 -->
      <FileSidebar
        :tree="fs.fileTree.value"
        :current-file-id="fs.currentFile.value ? fs.currentFile.value.id : null"
        :root-name="fs.rootName.value"
        @open-file="handleOpenFile"
        @new-file="handleNewFile"
        @new-folder="handleNewFolder"
        @refresh="handleRefresh"
        @open-vector-index="showVectorIndexDialog = true"
        @toggle-folder="fs.toggleFolder"
        @rename-file="handleRenameFile"
        @delete-file="handleDeleteFile"
        @request-rename="handleRequestRename"
        @request-delete="handleRequestDelete"
        @request-new-file="handleRequestNewFile"
        @request-new-folder="handleRequestNewFolder"
        @request-move="handleRequestMove"
      />

      <!-- 中间：编辑器区域 -->
      <section class="flex-1 min-w-0 relative border-r border-slate-800">
        <div class="h-7 flex items-center justify-between px-3 text-[11px] border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-slate-400">当前文件：</span>
            <span class="text-slate-200 font-mono">
              {{ fs.currentFile.value ? fs.currentFile.value.name : '未打开' }}
            </span>
            <span
              v-if="fs.currentFile.value && fs.isModified.value"
              class="text-amber-500 text-xs"
              title="有未保存的修改"
            >
              ●
            </span>
          </div>
          <div class="flex items-center gap-3 text-slate-500">
            <span>行列：{{ editor.cursorInfo.value }}</span>
            <button
              v-if="fs.isModified.value"
              class="text-xs px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
              @click="handleSaveFile"
            >
              保存 (Ctrl+S)
            </button>
            <button
              class="text-xs px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-white"
              @click="handleCopyContent"
            >
              复制
            </button>
          </div>
        </div>

        <div ref="editorEl" class="monaco-container"></div>

        <!-- 右键菜单：AI 文本优化 -->
        <div
          v-if="editor.showMenu.value"
          class="context-menu bg-slate-900 border border-emerald-600/30 rounded-lg shadow-2xl text-sm min-w-[200px]"
          :style="{ left: editor.menuX.value + 'px', top: editor.menuY.value + 'px' }"
          @mousedown.stop
        >
          <div class="px-3 py-2 border-b border-slate-700/50 text-[11px] text-slate-400 font-semibold">
            AI 文本优化
          </div>
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-emerald-900/20 transition-colors"
            @click="handleContextMenu('polish')"
          >
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            <span>润色文本</span>
          </button>
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-teal-900/20 transition-colors"
            @click="handleContextMenu('expand')"
          >
            <svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
            </svg>
            <span>扩写内容</span>
          </button>
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-blue-900/20 transition-colors"
            @click="handleContextMenu('shorten')"
          >
            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"></path>
            </svg>
            <span>精简内容</span>
          </button>
          <div class="border-t border-slate-700/50"></div>
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-purple-900/20 transition-colors"
            @click="handleContextMenu('continue')"
          >
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>
            </svg>
            <span>续写内容</span>
          </button>
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-indigo-900/20 transition-colors"
            @click="handleContextMenu('smart-continue')"
          >
            <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            <span>智能续写（理解式）</span>
          </button>
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-amber-900/20 transition-colors"
            @click="handleContextMenu('fix')"
          >
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>修正错误</span>
          </button>
          <div class="border-t border-slate-700/50"></div>
          <button
            class="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-rose-900/20 transition-colors"
            @click="handleContextMenu('check')"
          >
            <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
            </svg>
            <span>一致性校验</span>
          </button>
        </div>
      </section>

      <!-- 右侧：Chat/Agent/Novel 切换面板 -->
      <div class="w-96 min-w-[400px] flex flex-col border-l border-slate-800">
        <!-- Agent 初始化状态提示 -->
        <div 
          v-if="novelAgent.isInitializing.value || (!novelAgent.initialized.value && fs.workspaceRoot.value)"
          class="h-8 flex items-center justify-center gap-2 px-2 border-b border-slate-800 bg-amber-900/20 text-amber-400 text-[11px]"
        >
          <svg class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          <span>{{ novelAgent.initializationProgress.value || '正在初始化 Agent...' }}</span>
        </div>
        
        <!-- 选项卡 -->
        <div class="flex w-full border-b border-slate-800 bg-slate-950/70 scrollbar-hide">
          <button
            class="flex-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap"
            :class="rightPanelMode === 'chat' 
              ? 'text-emerald-400 border-b-2 border-emerald-600 bg-slate-900/50' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'"
            @click="rightPanelMode = 'chat'"
          >
            💬 Chat
          </button>
          <button
            class="flex-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap"
            :class="rightPanelMode === 'agent' 
              ? 'text-emerald-400 border-b-2 border-emerald-600 bg-slate-900/50' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'"
            @click="rightPanelMode = 'agent'"
          >
            🤖 Agent
          </button>
          <button
            class="flex-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap"
            :class="[
              rightPanelMode === 'memory' 
                ? 'text-emerald-400 border-b-2 border-emerald-600 bg-slate-900/50' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30',
              (!novelAgent.initialized.value || novelAgent.isInitializing.value || memory.isUpdating.value) && 'opacity-50 cursor-not-allowed'
            ]"
            :disabled="!novelAgent.initialized.value || novelAgent.isInitializing.value || memory.isUpdating.value"
            :title="memory.isUpdating.value ? '记忆系统正在更新中，请稍候...' : (!novelAgent.initialized.value || novelAgent.isInitializing.value) ? 'Agent 未初始化完成，请稍候...' : '记忆系统'"
            @click="rightPanelMode = 'memory'"
          >
            📚 记忆
          </button>
          <button
            class="flex-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap"
            :class="[
              rightPanelMode === 'rules' 
                ? 'text-emerald-400 border-b-2 border-emerald-600 bg-slate-900/50' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30',
              (!novelAgent.initialized.value || novelAgent.isInitializing.value) && 'opacity-50 cursor-not-allowed'
            ]"
            :disabled="!novelAgent.initialized.value || novelAgent.isInitializing.value"
            :title="(!novelAgent.initialized.value || novelAgent.isInitializing.value) ? 'Agent 未初始化完成，请稍候...' : '规则编辑器'"
            @click="rightPanelMode = 'rules'"
          >
            ⚙️ 规则
          </button>
          <button
            class="flex-1 px-2 py-2 text-[11px] font-medium transition-colors whitespace-nowrap"
            :class="[
              rightPanelMode === 'log' 
                ? 'text-emerald-400 border-b-2 border-emerald-600 bg-slate-900/50' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30',
              (!novelAgent.initialized.value || novelAgent.isInitializing.value) && 'opacity-50 cursor-not-allowed'
            ]"
            :disabled="!novelAgent.initialized.value || novelAgent.isInitializing.value"
            :title="(!novelAgent.initialized.value || novelAgent.isInitializing.value) ? 'Agent 未初始化完成，请稍候...' : '执行日志'"
            @click="rightPanelMode = 'log'"
          >
            📋 日志
          </button>
        </div>

        <!-- Chat 面板 -->
        <ChatPanel
          v-show="rightPanelMode === 'chat'"
          ref="chatPanelRef"
          v-model="ai.chatInput.value"
          :messages="ai.messages.value"
          :mode="ai.chatMode.value"
          :insert-mode="ai.insertMode.value"
          :is-loading="ai.isChatLoading.value"
          :selected-model="ai.selectedModelId.value"
          :has-prompt-file="!!ai.promptFileContent.value"
          @update:mode="(v) => (ai.chatMode.value = v)"
          @update:insertMode="(v) => (ai.insertMode.value = v)"
          @update:selectedModel="(v) => (ai.selectedModelId.value = v)"
          @send="handleSendChat"
          @delete-message="ai.deleteMessage"
        />

        <!-- Agent 面板（新版 Novel Agent） -->
        <AgentPanel
          v-show="rightPanelMode === 'agent'"
          :agent-messages="agent.agentMessages.value"
          :agent-input="agent.agentInput.value"
          :is-loading="agent.isAgentLoading.value"
          :current-task="agent.currentTask.value"
          @update:agentInput="(v) => (agent.agentInput.value = v)"
          @send="handleAgentSend"
          @clear-history="agent.clearAgentHistory"
          @show-diff="handleShowDiff"
          @apply-all-changes="handleApplyAllChanges"
        />

        <!-- 记忆系统面板 -->
        <div v-if="rightPanelMode === 'memory'" class="flex-1 overflow-hidden">
          <MemoryViewer :workspace-root="fs.workspaceRoot.value" />
        </div>

        <!-- Agent 执行日志面板 -->
        <div v-show="rightPanelMode === 'log'" class="flex-1 overflow-hidden">
          <AgentLog />
        </div>

        <!-- 规则管理面板 -->
        <div v-if="rightPanelMode === 'rules'" class="flex-1 overflow-hidden">
          <RuleEditor />
        </div>
      </div>
    </main>

    <!-- 设置对话框 -->
    <SettingsDialog
      :visible="showSettingsDialog"
      @close="handleSettingsClose"
    />

    <!-- 使用说明对话框 -->
    <UserGuideDialog
      :visible="showUserGuideDialog"
      @close="showUserGuideDialog = false"
    />

    <!-- 输入对话框 -->
    <InputDialog
      :visible="dialogs.inputDialog.show"
      :title="dialogs.inputDialog.title"
      :placeholder="dialogs.inputDialog.placeholder"
      :default-value="dialogs.inputDialog.defaultValue"
      @confirm="dialogs.inputDialog.onConfirm"
      @cancel="dialogs.inputDialog.show = false"
    />

    <!-- 提示对话框 -->
    <AlertDialog
      :visible="dialogs.alertDialog.show"
      :title="dialogs.alertDialog.title"
      :message="dialogs.alertDialog.message"
      :show-cancel="dialogs.alertDialog.showCancel"
      :type="dialogs.alertDialog.type"
      @confirm="dialogs.alertDialog.onConfirm"
      @cancel="dialogs.alertDialog.onCancel"
      @close="dialogs.alertDialog.show = false"
    />

    <!-- 向量索引对话框 -->
    <VectorIndexDialog
      :visible="showVectorIndexDialog"
      :workspace-root="fs.workspaceRoot.value"
      @close="showVectorIndexDialog = false"
    />

    <!-- 一致性校验对话框 -->
    <ConsistencyDialog
      :visible="ai.showConsistencyDialog.value"
      :result="ai.consistencyResult.value"
      :is-loading="ai.isChatLoading.value"
      :has-selection="!!ai.consistencySelection.value"
      @close="ai.showConsistencyDialog.value = false"
      @fix="ai.fixConsistency"
    />

    <!-- 校验历史对话框 -->
    <ConsistencyHistory
      :visible="ai.showConsistencyHistory.value"
      :workspace-path="fs.workspaceRoot.value"
      @close="ai.showConsistencyHistory.value = false"
    />

    <!-- 批量校验对话框 -->
    <BatchConsistencyDialog
      :visible="ai.showBatchCheckDialog.value"
      :workspace-root="fs.workspaceRoot.value"
      @close="ai.showBatchCheckDialog.value = false"
      @view-history="ai.showConsistencyHistory.value = true; ai.showBatchCheckDialog.value = false"
    />

    <!-- Diff 预览对话框 -->
    <DiffPreview
      :visible="agent.showDiffPreview.value"
      :change="agent.currentDiff.value"
      @close="agent.showDiffPreview.value = false"
      @apply="handleApplyChange"
      @reject="handleRejectChange"
    />

    <!-- 应用全部变更确认对话框 -->
    <div v-if="showApplyAllConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showApplyAllConfirm = false">
      <div class="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700" @click.stop>
        <h3 class="text-lg font-semibold text-slate-200 mb-3">⚠️ 确认应用变更</h3>
        <p class="text-sm text-slate-300 mb-4">
          确定要应用所有 <strong class="text-emerald-400">{{ (agent.currentTask?.value?.changes?.filter((c: FileChange) => c.status === 'pending') || []).length }}</strong> 个变更吗？
        </p>
        <div class="space-y-2 mb-4 max-h-40 overflow-auto">
          <div
            v-for="change in (agent.currentTask?.value?.changes?.filter((c: FileChange) => c.status === 'pending') || [])"
            :key="change.id"
            class="text-xs text-slate-400 bg-slate-900/50 p-2 rounded"
          >
            <span class="text-emerald-400">{{ change.action }}</span> - {{ change.fileName }}
          </div>
        </div>
        <div class="flex gap-3 justify-end">
          <button
            class="px-4 py-2 text-sm bg-slate-700 text-slate-200 rounded hover:bg-slate-600 transition-colors"
            @click="showApplyAllConfirm = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors"
            @click="confirmApplyAllChanges"
          >
            确认应用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AgentLog from './components/AgentLog.vue';
import AgentPanel from './components/AgentPanel.vue';
import AlertDialog from './components/AlertDialog.vue';
import BatchConsistencyDialog from './components/BatchConsistencyDialog.vue';
import ChatPanel from './components/ChatPanel.vue';
import ConsistencyDialog from './components/ConsistencyDialog.vue';
import ConsistencyHistory from './components/ConsistencyHistory.vue';
import DiffPreview from './components/DiffPreview.vue';
import FileSidebar from './components/FileSidebar.vue';
import InputDialog from './components/InputDialog.vue';
import MemoryViewer from './components/MemoryViewer.vue';
import RuleEditor from './components/RuleEditor.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import TitleBar from './components/TitleBar.vue';
import TopBar from './components/TopBar.vue';
import UserGuideDialog from './components/UserGuideDialog.vue';
import VectorIndexDialog from './components/VectorIndexDialog.vue';
import { useAI } from './composables/useAI';
import type { FileChange } from './composables/useAgent';
import { useAgent } from './composables/useAgent';
import { useDialogs } from './composables/useDialogs';
import { useEditor } from './composables/useEditor';
import { useFileSystem } from './composables/useFileSystem';
import { useMemory } from './composables/useMemory';
import { useNovelAgent } from './composables/useNovelAgent';
import { useRules } from './composables/useRules';
import type { TreeNode } from './utils/fileTree';

declare global {
  interface Window {
    api?: any;
  }
}

// 初始化 composables
const dialogs = useDialogs();
const { showAlert, showConfirm, showPrompt } = dialogs;

const fs = useFileSystem(showAlert, showConfirm, showPrompt);
const editor = useEditor();

const ai = useAI(
  showAlert,
  showPrompt,
  editor.getContent,
  editor.getSelection,
  editor.getContextText,
  editor.replaceSelection,
  editor.insertAtCursor,
  editor.focus
);

// Agent 相关辅助函数
const readFileForAgent = async (path: string): Promise<string | null> => {
  if (!window.api?.readFile) return null;
  const result = await window.api.readFile(path);
  return result.success ? result.content || null : null;
};

const writeFileForAgent = async (path: string, content: string): Promise<boolean> => {
  if (!window.api?.writeFile) return false;
  const result = await window.api.writeFile(path, content);
  return result.success;
};

const agent = useAgent(
  showAlert,
  readFileForAgent,
  writeFileForAgent,
  fs.workspaceRoot,
  fs.fileTree
);

// Novel Agent 系统（新）
const memory = useMemory();
const novelAgent = useNovelAgent();
const rules = useRules();

// 其他状态
const showSettingsDialog = ref(false);
const showVectorIndexDialog = ref(false);
const showUserGuideDialog = ref(false);
const chatPanelRef = ref<any>(null);
const rightPanelMode = ref<'chat' | 'agent' | 'memory' | 'log' | 'rules'>('chat');
const editorEl = ref<HTMLElement | null>(null);

// 初始化 Novel Agent 系统的函数
const initializeNovelAgentSystem = async (workspaceRoot: string) => {
  if (!workspaceRoot) {
    console.warn('⚠️ 工作区路径为空，跳过初始化');
    return;
  }

  // 重置状态
  novelAgent.initialized.value = false;
  novelAgent.isInitializing.value = true;
  novelAgent.initializationProgress.value = '正在初始化...';

  console.log('🚀 开始初始化 Novel Agent 系统...');
  console.log('工作区路径:', workspaceRoot);
  
  try {
    // 初始化记忆系统（会自动提取设定文件）
    novelAgent.initializationProgress.value = '正在初始化记忆系统...';
    console.log('📚 初始化记忆系统...');
    const memResult = await memory.initMemory(workspaceRoot);
    
    if (memResult?.success) {
      console.log('✅ 记忆系统初始化成功');
      novelAgent.initializationProgress.value = '记忆系统初始化成功，正在加载数据...';
      // 初始化后立即加载数据
      await memory.getAllCharacters();
      await memory.getPendingForeshadows();
      await memory.getSummary();
    } else {
      console.error('❌ 记忆系统初始化失败:', memResult?.error);
      novelAgent.initializationProgress.value = '记忆系统初始化失败';
      showAlert('记忆系统初始化失败', memResult?.error || '未知错误', 'danger');
    }
    
    // 初始化 Novel Agent
    novelAgent.initializationProgress.value = '正在初始化 Agent...';
    console.log('🤖 初始化 Novel Agent...');
    const agentResult = await novelAgent.initAgent(workspaceRoot);
    
    if (agentResult?.success) {
      console.log('✅ Novel Agent 初始化成功');
      novelAgent.initializationProgress.value = '初始化完成';
    } else {
      console.error('❌ Novel Agent 初始化失败:', agentResult?.error);
      novelAgent.initializationProgress.value = 'Agent 初始化失败';
      showAlert('Novel Agent 初始化失败', agentResult?.error || '未知错误', 'danger');
    }
    
    console.log('✅ Novel Agent 系统初始化完成');
  } catch (err: any) {
    console.error('❌ 初始化过程出错:', err);
    novelAgent.initializationProgress.value = '初始化过程出错';
    showAlert('初始化失败', err.message || '未知错误', 'danger');
  } finally {
    // 延迟一下再设置为 false，让用户看到完成状态
    setTimeout(() => {
      novelAgent.isInitializing.value = false;
    }, 1000);
  }
};

// 监听工作区变化，自动初始化 Novel Agent 系统
watch(() => fs.workspaceRoot.value, async (newRoot, oldRoot) => {
  // 只在工作区真正变化时初始化（避免重复初始化）
  if (newRoot && newRoot !== oldRoot) {
    // 如果当前在记忆/规则/日志面板，切换回 chat 面板（因为这些功能需要 Agent 初始化）
    if (['memory', 'rules', 'log'].includes(rightPanelMode.value)) {
      rightPanelMode.value = 'chat';
    }
    
    await initializeNovelAgentSystem(newRoot);
  }
}, { immediate: false });

// 编辑器相关处理
const initializeEditor = async () => {
  // 将模板 ref 赋值给 editor composable
  editor.editorEl.value = editorEl.value;
  
  await editor.initEditor(handleSaveFile);
  
  // 监听内容变化
  const editorInstance = editor.getEditor();
  if (editorInstance) {
    editorInstance.onDidChangeModelContent(() => {
      if (fs.currentFile.value && fs.currentFile.value.loaded) {
        const newContent = editor.getContent();
        if (newContent !== fs.currentFile.value.content) {
          fs.isModified.value = true;
        } else {
          fs.isModified.value = false;
        }
      }
    });
  }
};

const handleOpenFolder = async () => {
  await fs.openFolder(async () => {
    editor.setContent('');
    await ai.loadPromptFile(fs.fileTree.value);
  });
};

const handleOpenWorkspace = async (data: { rootDir: string; rootName: string; files: any[] }) => {
  await fs.openWorkspaceFromHistory(data, async () => {
    editor.setContent('');
    await ai.loadPromptFile(fs.fileTree.value);
  });
};

const handleOpenFile = async (id: string) => {
  await fs.openFileById(id, (content) => {
    editor.setContent(content);
    // 检查是否是提示文件
    const file = fs.currentFile.value;
    if (file) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.md') && (
        fileName.includes('prompt') || 
        fileName.includes('提示') || 
        fileName.includes('设定') || 
        fileName.includes('世界观')
      )) {
        if (!ai.promptFileContent.value || ai.promptFileContent.value !== content) {
          ai.promptFileContent.value = content;
        }
      }
    }
  });
};

const handleCopyContent = () => {
  const content = editor.getContent();
  navigator.clipboard.writeText(content.replace(/\r\n\r\n/g, '\r\n'));
  showAlert('已复制到剪贴板', '提示', 'info');
};

const handleSaveFile = async () => {
  const content = editor.getContent();
  await fs.saveFile(content, async () => {
    // 如果保存的是提示文件，重新加载
    const file = fs.currentFile.value;
    if (file) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.md') && (
        fileName.includes('prompt') || 
        fileName.includes('提示') || 
        fileName.includes('设定') || 
        fileName.includes('世界观')
      )) {
        await ai.loadPromptFile(fs.fileTree.value);
      }
    }
  });
};

const handleNewFile = () => {
  if (!window.api?.createFile) {
    showAlert('API 不可用，请重启 Electron', '错误', 'danger');
    return;
  }

  if (!fs.workspaceRoot.value) {
    showAlert('请先点击顶部「打开文件夹...」选择一个工作区', '提示', 'info');
    return;
  }

  showPrompt(
    '新建文件',
    async (fileName: string) => {
      await fs.createFile(fileName, async () => {
        await handleRefresh();
        
        // 检查是否是提示文件
        const lowerFileName = fileName.toLowerCase();
        if (lowerFileName.endsWith('.md') && (
          lowerFileName.includes('prompt') || 
          lowerFileName.includes('提示') || 
          lowerFileName.includes('设定') || 
          lowerFileName.includes('世界观')
        )) {
          setTimeout(async () => {
            await ai.loadPromptFile(fs.fileTree.value);
          }, 500);
        }
      });
    },
    '例如：新章节.txt 或 第一卷/001.txt',
    ''
  );
};

const handleNewFolder = () => {
  if (!window.api?.createFolder) {
    showAlert('API 不可用，请重启 Electron', '错误', 'danger');
    return;
  }

  if (!fs.workspaceRoot.value) {
    showAlert('请先点击顶部「打开文件夹...」选择一个工作区', '提示', 'info');
    return;
  }

  showPrompt(
    '新建文件夹',
    async (folderName: string) => {
      await fs.createFolder(folderName, handleRefresh);
    },
    '例如：第一卷 或 草稿/设定',
    ''
  );
};

const handleRefresh = async () => {
  await fs.refreshFolder(async () => {
    await ai.loadPromptFile(fs.fileTree.value);
  });
};

const handleDeleteFile = async (id: string) => {
  await fs.deleteFile(id, () => {
    editor.setContent('');
    handleRefresh();
  });
};

const handleRenameFile = async (payload: { id: string; newName: string }) => {
  await fs.renameFile(payload.id, payload.newName, handleRefresh);
};

const handleRequestRename = (payload: { node: TreeNode }) => {
  const node = payload.node;
  showPrompt(
    '重命名文件',
    (newName: string) => {
      if (newName && newName.trim() && newName !== node.name) {
        handleRenameFile({ id: node.id, newName: newName.trim() });
      }
    },
    '请输入新文件名',
    node.name
  );
};

const handleRequestDelete = (payload: { node: TreeNode }) => {
  const node = payload.node;
  const typeText = node.type === 'folder' ? '文件夹' : '文件';
  showConfirm(
    `确定要删除${typeText} "${node.name}" 吗？${node.type === 'folder' ? '（将删除其中所有内容）' : ''}`,
    () => {
      handleDeleteFile(node.id);
    },
    '确认删除',
    'danger'
  );
};

const handleRequestNewFile = (payload: { parentNode: TreeNode }) => {
  const parentNode = payload.parentNode;
  
  showPrompt(
    `在 "${parentNode.name}" 中新建文件`,
    async (fileName: string) => {
      fs.createFileInFolder(parentNode, fileName, async (parentId) => {
        await handleRefresh();
        const refreshedParent = fs.fileTree.value.find(n => n.id === parentId);
        if (refreshedParent && refreshedParent.type === 'folder') {
          refreshedParent.expanded = true;
        }
      });
    },
    '例如：第001章.txt',
    ''
  );
};

const handleRequestNewFolder = (payload: { parentNode: TreeNode }) => {
  const parentNode = payload.parentNode;
  
  showPrompt(
    `在 "${parentNode.name}" 中新建文件夹`,
    async (folderName: string) => {
      fs.createFolderInFolder(parentNode, folderName, async (parentId) => {
        await handleRefresh();
        const refreshedParent = fs.fileTree.value.find(n => n.id === parentId);
        if (refreshedParent && refreshedParent.type === 'folder') {
          refreshedParent.expanded = true;
        }
      });
    },
    '例如：第一卷',
    ''
  );
};

const handleRequestMove = (payload: { sourceNode: TreeNode; targetNode: TreeNode }) => {
  const { sourceNode, targetNode } = payload;
  
  showConfirm(
    `确定将 "${sourceNode.name}" 移动到 "${targetNode.name}" 中吗？`,
    async () => {
      await fs.moveFile(sourceNode, targetNode, handleRefresh);
    },
    '确认移动',
    'warning'
  );
};

// 右键菜单处理
const handleContextMenu = async (mode: string) => {
  editor.hideMenu();
  
  const selection = editor.getSelection();
  if (!selection) return;

  if (mode === 'check') {
    await ai.checkConsistency(
      selection.text,
      fs.workspaceRoot.value,
      fs.currentFile.value?.path || '',
      selection.range
    );
    return;
  }

  if (mode === 'smart-continue') {
    await ai.smartContinue(selection.text, selection.range, fs.currentFile.value);
    return;
  }

  if (mode === 'fix') {
    showPrompt(
      '请描述需要修正的错误',
      (errorDescription: string) => {
        if (errorDescription && errorDescription.trim()) {
          ai.fixError(selection.text, selection.range, errorDescription.trim());
        }
      },
      '例如：错别字、语法错误、逻辑不通等',
      ''
    );
    return;
  }

  if (['polish', 'expand', 'shorten', 'continue'].includes(mode)) {
    await ai.optimizeText(
      mode as 'polish' | 'expand' | 'shorten' | 'continue',
      selection.text,
      selection.range,
      fs.currentFile.value
    );
  }
};

const handleBatchCheck = () => {
  if (!fs.workspaceRoot.value) {
    showAlert('请先打开一个工作区', '提示', 'info');
    return;
  }
  ai.showBatchCheckDialog.value = true;
};

// Chat 处理
const handleSendChat = async () => {
  await ai.sendChat(fs.currentFile.value, fs.workspaceRoot.value);
};

// 设置对话框关闭
const handleSettingsClose = () => {
  showSettingsDialog.value = false;
  if (chatPanelRef.value?.refreshModels) {
    chatPanelRef.value.refreshModels();
  }
};

// Agent 处理函数
const handleAgentSend = async () => {
  if (!agent.agentInput.value.trim() || agent.isAgentLoading.value) {
    return;
  }

  const userRequest = agent.agentInput.value.trim();
  agent.agentInput.value = '';

  try {
    await agent.analyzeRequest(userRequest);
  } catch (error: any) {
    console.error('Agent 执行失败:', error);
    showAlert(error.message, 'Agent 执行失败', 'danger');
  }
};

const handleShowDiff = (change: FileChange) => {
  agent.currentDiff.value = change;
  agent.showDiffPreview.value = true;
};

const handleApplyChange = async (change: FileChange) => {
  const success = await agent.applyFileChange(change);
  if (success) {
    agent.showDiffPreview.value = false;
    await handleRefresh();
    showAlert('变更已应用', '成功', 'info');
    // 注意：单个变更应用时不更新记忆，只有应用全部变更时才更新
  }
};

const handleRejectChange = (change: FileChange) => {
  agent.rejectFileChange(change);
  agent.showDiffPreview.value = false;
  showAlert('变更已拒绝', '提示', 'info');
};

// 应用全部变更（带确认）
const showApplyAllConfirm = ref(false);
const handleApplyAllChanges = async () => {
  if (!agent.currentTask.value || agent.currentTask.value.changes.length === 0) {
    showAlert('没有待应用的变更', '提示', 'warning');
    return;
  }
  
  // 显示确认对话框
  showApplyAllConfirm.value = true;
};

const confirmApplyAllChanges = async () => {
  showApplyAllConfirm.value = false;
  
  if (!agent.currentTask.value) return;
  
  const pendingChanges = agent.currentTask.value.changes.filter(c => c.status === 'pending');
  if (pendingChanges.length === 0) {
    showAlert('没有待应用的变更', '提示', 'warning');
    return;
  }
  
  try {
    // 步骤 1: 应用所有文件变更
    showAlert('正在应用变更...', '处理中', 'info');
    for (const change of pendingChanges) {
      await agent.applyFileChange(change);
    }
    
    showAlert(`已应用 ${pendingChanges.length} 个变更`, '成功', 'info');
    await handleRefresh();
    
    // 步骤 2: 应用变更成功后，执行后续更新流程
    // 检查是否已经在更新，防止重复更新
    if (memory.isUpdating.value) {
      console.log('ℹ️ 记忆系统正在更新中，跳过重复更新');
      return;
    }
    
    // 检查记忆系统是否已初始化
    if (!memory.initialized.value) {
      console.log('ℹ️ 记忆系统未初始化，尝试初始化...');
      if (fs.workspaceRoot.value) {
        const initResult = await memory.initMemory(fs.workspaceRoot.value);
        if (!initResult?.success) {
          console.warn('⚠️ 记忆系统初始化失败:', initResult?.error);
          showAlert(`记忆系统初始化失败: ${initResult?.error}`, '警告', 'warning');
          return;
        }
      } else {
        console.warn('⚠️ 工作区未打开，无法初始化记忆系统');
        return;
      }
    }
    
    if (fs.workspaceRoot.value && memory.initialized.value && agent.currentTask.value?.executionResult) {
      const execResult = agent.currentTask.value.executionResult;
      
      if (execResult.text && execResult.userRequest) {
        try {
          // 等待文件创建完成（延迟 1 秒，确保文件系统操作完成）
          console.log('⏳ 等待文件创建完成...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 2.1 章节分析（如果有章节文件）
          const appliedFiles = pendingChanges
            .filter(c => c.status === 'applied')
            .map(c => {
              // 构建完整文件路径
              const fullPath = c.filePath.startsWith(fs.workspaceRoot.value)
                ? c.filePath
                : `${fs.workspaceRoot.value}/${c.filePath}`;
              return { filePath: fullPath, fileName: c.fileName };
            });
          
          if (appliedFiles.length > 0) {
            console.log('📊 开始分析已应用的章节...');
            try {
              // 分析每个章节文件（添加重试机制）
              for (const file of appliedFiles) {
                // 尝试从文件名提取章节号
                const chapterMatch = file.fileName.match(/第(\d+)/);
                if (chapterMatch) {
                  const chapterNum = parseInt(chapterMatch[1]);
                  console.log(`📊 分析章节文件: 第${chapterNum}章 - ${file.fileName}`);
                  
                  // 等待文件可读（最多重试 3 次，每次等待 500ms）
                  let retryCount = 0;
                  let analyzeResult = null;
                  
                  while (retryCount < 3 && !analyzeResult?.success) {
                    if (retryCount > 0) {
                      console.log(`⏳ 重试分析章节文件 (${retryCount}/3)...`);
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    // 触发章节分析
                    analyzeResult = await window.api?.memory?.analyzeChapter?.(
                      file.filePath,
                      chapterNum
                    );
                    
                    if (analyzeResult?.success) {
                      console.log(`✅ 章节分析完成: 第${chapterNum}章`);
                      break;
                    } else {
                      retryCount++;
                      if (retryCount < 3) {
                        console.warn(`⚠️ 章节分析失败，将重试: 第${chapterNum}章 - ${analyzeResult?.error}`);
                      }
                    }
                  }
                  
                  if (!analyzeResult?.success) {
                    console.warn(`⚠️ 章节分析最终失败: 第${chapterNum}章 - ${analyzeResult?.error || '未知错误'}`);
                  }
                } else {
                  console.log(`ℹ️ 跳过非章节文件: ${file.fileName}`);
                }
              }
            } catch (err: any) {
              console.warn('⚠️ 章节分析失败:', err);
            }
          }
          
          // 2.2 更新记忆系统（基于生成的文本）
          // 再次检查是否已经在更新（防止并发）
          if (memory.isUpdating.value) {
            console.log('ℹ️ 记忆系统正在更新中，跳过重复更新');
            return;
          }
          
          console.log('💾 开始更新记忆系统...');
          
          // 设置更新状态
          memory.isUpdating.value = true;
          
          try {
            // 确保传递的数据是可序列化的（避免克隆错误）
            const textToUpdate = typeof execResult.text === 'string' ? execResult.text : String(execResult.text || '');
            const userRequestToUpdate = typeof execResult.userRequest === 'string' ? execResult.userRequest : String(execResult.userRequest || '');
            const intentToUpdate = typeof execResult.intent === 'string' 
              ? execResult.intent 
              : (execResult.intent ? JSON.stringify(execResult.intent) : '');
            
            const updateResult = await window.api?.memory?.updateFromText?.(
              textToUpdate,
              userRequestToUpdate,
              intentToUpdate
            );
            
            if (updateResult?.success) {
              if (updateResult.updated) {
                console.log('✅ 记忆系统已更新');
                showAlert('记忆系统已更新', '成功', 'info');
                // 刷新记忆数据
                await memory.getSummary();
                await memory.getAllCharacters();
                await memory.getPendingForeshadows();
              } else {
                console.log('ℹ️ 无需更新记忆');
              }
            } else {
              console.warn('⚠️ 更新记忆系统失败:', updateResult?.error);
              showAlert(`记忆系统更新失败: ${updateResult?.error}`, '警告', 'warning');
            }
          } finally {
            // 无论成功失败，都要重置更新状态
            memory.isUpdating.value = false;
          }
        } catch (err: any) {
          console.warn('⚠️ 更新流程失败:', err);
          showAlert(`更新流程失败: ${err.message}`, '警告', 'warning');
          // 确保重置更新状态
          memory.isUpdating.value = false;
        }
      }
    }
  } catch (error: any) {
    console.error('应用变更失败:', error);
    showAlert(error.message, '应用变更失败', 'danger');
  }
};

// 生命周期
onMounted(async () => {
  await initializeEditor();
  window.addEventListener('mousedown', editor.hideMenu);
  
  // 如果应用启动时已经有工作区打开，也要初始化
  if (fs.workspaceRoot.value) {
    console.log('🚀 应用启动时检测到工作区，开始初始化...');
    await initializeNovelAgentSystem(fs.workspaceRoot.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', editor.hideMenu);
  editor.dispose();
});
</script>

<style scoped>
.monaco-container {
  height: calc(100vh - 2rem - 2.5rem - 1.75rem);
}

.context-menu {
  position: absolute;
  z-index: 50;
}
</style>

<style>

  /* 整体滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

/* 滚动条轨道 */
::-webkit-scrollbar-track {
  background: transparent;
}

/* 滚动条滑块 */
::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  transition: background-color 0.2s;
}

/* hover 时 */
::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.7);
}
</style>
