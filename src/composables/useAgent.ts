/**
 * useAgent - 简化的 Agent Composable
 * 现在直接使用 Novel Agent 系统，不再进行文件扫描
 * 流程：理解上下文（记忆系统）-> 规划意图 -> 写文章 -> 一致性校验 -> 重写 -> 更新记忆
 */

import { ref, type Ref } from 'vue';

export interface AgentMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface FileChange {
  id: string;
  filePath: string;
  fileName: string;
  action: 'create' | 'modify' | 'delete';
  oldContent?: string;
  newContent?: string;
  lineStart?: number;
  lineEnd?: number;
  description: string;
  status: 'pending' | 'applied' | 'rejected';
}

export interface AgentTask {
  id: string;
  description: string;
  status: 'analyzing' | 'planning' | 'executing' | 'completed' | 'failed';
  changes: FileChange[];
  error?: string;
}

export function useAgent(
  showAlert: (message: string, title?: string, type?: 'info' | 'warning' | 'danger') => void,
  readFile: (path: string) => Promise<string | null>,
  writeFile: (path: string, content: string) => Promise<boolean>,
  workspaceRoot: Ref<string>,
  fileTree: Ref<any[]>
) {
  const agentMessages = ref<AgentMessage[]>([]);
  const agentInput = ref('');
  const isAgentLoading = ref(false);
  const currentTask = ref<AgentTask | null>(null);
  const taskHistory = ref<AgentTask[]>([]);
  const selectedModelId = ref<number | null>(null);
  const showDiffPreview = ref(false);
  const currentDiff = ref<FileChange | null>(null);
  
  let nextAgentMsgId = 1;
  let nextTaskId = 1;
  let nextChangeId = 1;

  /**
   * 从用户请求中提取目标文件
   */
  const extractTargetFile = (request: string): string => {
    // 匹配 "第X章" 或 "第X-Y章"
    const chapterMatch = request.match(/第\s*(\d+)(?:[-到]\s*(\d+))?\s*章/);
    if (chapterMatch) {
      const start = chapterMatch[1];
      const end = chapterMatch[2] || start;
      if (end === start) {
        return `第${start.padStart(3, '0')}章.txt`;
      } else {
        return `第${start.padStart(3, '0')}-${end.padStart(3, '0')}章.txt`;
      }
    }

    // 匹配 "新建"、"创建" 等关键词
    if (request.match(/新建|创建|续写|写.*章/)) {
      // 尝试提取章节号
      const newChapterMatch = request.match(/(\d+)\s*章/);
      if (newChapterMatch) {
        return `第${newChapterMatch[1].padStart(3, '0')}章.txt`;
      }
      // 如果没有章节号，使用当前时间戳
      return `新章节_${Date.now()}.txt`;
    }

    // 默认返回新章节
    return `新章节_${Date.now()}.txt`;
  };

  /**
   * 确定操作类型
   */
  const determineAction = (request: string, targetFile: string): 'create' | 'modify' => {
    // 如果请求中包含 "新建"、"创建"、"续写" 等关键词，且文件不存在，则创建
    if (request.match(/新建|创建|续写|写.*章/)) {
      return 'create';
    }
    // 否则默认为修改
    return 'modify';
  };

  /**
   * 分析用户请求并执行 Novel Agent 流程
   * 新流程：
   * 1. 理解上下文（从记忆系统加载）
   * 2. 规划意图
   * 3. 生成初稿
   * 4. 一致性校验
   * 5. 重写（如果需要）
   * 6. 更新记忆
   */
  const analyzeRequest = async (userRequest: string): Promise<AgentTask> => {
    if (!window.api?.novelAgent) {
      throw new Error('Novel Agent API 不可用');
    }

    if (!workspaceRoot.value) {
      throw new Error('请先打开工作区');
    }

    const taskId = `task_${Date.now()}`;
    const task: AgentTask = {
      id: taskId,
      description: userRequest,
      status: 'analyzing',
      changes: []
    };

    currentTask.value = task;
    isAgentLoading.value = true;

    // 添加用户消息
    const userMsg: AgentMessage = {
      id: nextAgentMsgId++,
      role: 'user',
      content: userRequest,
      timestamp: Date.now()
    };
    agentMessages.value.push(userMsg);

    try {
      // 添加系统消息：开始执行
      const startMsg: AgentMessage = {
        id: nextAgentMsgId++,
        role: 'system',
        content: '🚀 开始执行 Novel Agent 流程...',
        timestamp: Date.now()
      };
      agentMessages.value.push(startMsg);

      // 步骤 1: 理解上下文（从记忆系统加载）
      task.status = 'planning';
      const contextMsg: AgentMessage = {
        id: nextAgentMsgId++,
        role: 'system',
        content: '📚 步骤 1/6: 从记忆系统加载上下文...',
        timestamp: Date.now()
      };
      agentMessages.value.push(contextMsg);

      // 步骤 2-6: 调用 Novel Agent 执行
      const result = await window.api.novelAgent.execute({
        userRequest: userRequest
      });

      if (!result.success) {
        throw new Error(result.error || 'Novel Agent 执行失败');
      }

      // 解析结果，转换为 FileChange 格式
      const changes: FileChange[] = [];

      // 如果返回了文本，需要创建或修改文件
      if (result.text) {
        // 从用户请求中提取目标文件信息
        const targetFile = extractTargetFile(userRequest);
        const action = determineAction(userRequest, targetFile);

        if (action === 'create') {
          changes.push({
            id: `change_${nextChangeId++}`,
            filePath: targetFile,
            fileName: targetFile,
            action: 'create',
            newContent: result.text,
            description: result.intent?.goal || '创建新章节',
            status: 'pending'
          });
        } else {
          // modify 操作需要提供 oldContent 和 newContent
          // 这里需要读取原文件内容
          const oldContent = await readFile(targetFile);
          changes.push({
            id: `change_${nextChangeId++}`,
            filePath: targetFile,
            fileName: targetFile,
            action: 'modify',
            oldContent: oldContent || '',
            newContent: result.text,
            description: result.intent?.goal || '修改文本',
            status: 'pending'
          });
        }
      }

      task.changes = changes;
      task.status = 'completed';

      // 添加成功消息
      const successMsg: AgentMessage = {
        id: nextAgentMsgId++,
        role: 'assistant',
        content: `✅ Novel Agent 执行完成！\n\n` +
          `📊 执行摘要：\n` +
          `- 意图规划：${result.intent ? '✅' : '❌'}\n` +
          `- 一致性校验：${result.checkResult?.status === 'pass' ? '✅ 通过' : '⚠️ 未通过'}\n` +
          `- 重写次数：${result.rewriteCount || 0}\n` +
          `- 生成文本长度：${result.text?.length || 0} 字符\n\n` +
          (result.checkResult?.status === 'pass' 
            ? '✅ 文本已通过一致性校验，符合世界观和人物设定。'
            : '⚠️ 文本未通过一致性校验，请检查。'),
        timestamp: Date.now()
      };
      agentMessages.value.push(successMsg);

      // 如果有校验结果，显示详细信息
      if (result.checkResult && result.checkResult.errors?.length > 0) {
        const errorDetails = result.checkResult.errors
          .map((e: any) => `- ${e.message}`)
          .join('\n');
        const errorMsg: AgentMessage = {
          id: nextAgentMsgId++,
          role: 'system',
          content: `⚠️ 一致性校验发现问题：\n${errorDetails}`,
          timestamp: Date.now()
        };
        agentMessages.value.push(errorMsg);
      }

      taskHistory.value.push(task);
      return task;

    } catch (error: any) {
      console.error('❌ Agent 执行失败:', error);
      task.status = 'failed';
      task.error = error.message;

      const errorMsg: AgentMessage = {
        id: nextAgentMsgId++,
        role: 'system',
        content: `❌ 执行失败：${error.message}`,
        timestamp: Date.now()
      };
      agentMessages.value.push(errorMsg);

      showAlert(error.message, 'Agent 执行失败', 'danger');
      return task;
    } finally {
      isAgentLoading.value = false;
    }
  };

  /**
   * 执行 Agent 任务（应用变更）
   */
  const executeAgentTask = async (task: AgentTask) => {
    if (!task || task.status === 'failed') {
      showAlert('任务无效或已失败', '错误', 'danger');
      return;
    }

    try {
      for (const change of task.changes) {
        if (change.status === 'pending') {
          await applyFileChange(change);
        }
      }

      showAlert('所有变更已应用', '成功', 'info');
    } catch (error: any) {
      console.error('应用变更失败:', error);
      showAlert(error.message, '应用变更失败', 'danger');
    }
  };

  /**
   * 应用单个文件变更（返回 boolean 表示成功/失败）
   */
  const applyFileChange = async (change: FileChange): Promise<boolean> => {
    if (!workspaceRoot.value) {
      throw new Error('工作区未打开');
    }

    const filePath = change.filePath.startsWith(workspaceRoot.value)
      ? change.filePath
      : `${workspaceRoot.value}/${change.filePath}`;

    try {
      if (change.action === 'create') {
        if (!change.newContent) {
          throw new Error('创建文件需要提供 newContent');
        }
        const success = await writeFile(filePath, change.newContent);
        if (success) {
          change.status = 'applied';
          console.log(`✅ 已创建文件: ${change.fileName}`);
        } else {
          throw new Error('写入文件失败');
        }
      } else if (change.action === 'modify') {
        if (!change.newContent) {
          throw new Error('修改文件需要提供 newContent');
        }
        const success = await writeFile(filePath, change.newContent);
        if (success) {
          change.status = 'applied';
          console.log(`✅ 已修改文件: ${change.fileName}`);
        } else {
          throw new Error('写入文件失败');
        }
      } else if (change.action === 'delete') {
        // 删除文件需要额外的 API
        if (window.api?.deleteFile) {
          const result = await window.api.deleteFile(filePath);
          if (result?.success) {
            change.status = 'applied';
            console.log(`✅ 已删除文件: ${change.fileName}`);
          } else {
            throw new Error(result?.error || '删除文件失败');
          }
        } else {
          throw new Error('删除文件 API 不可用');
        }
      }
    } catch (error: any) {
      console.error(`应用变更失败: ${change.fileName}`, error);
      change.status = 'rejected';
      return false;
    }

    return true;
  };

  /**
   * 拒绝变更
   */
  const rejectChange = (change: FileChange) => {
    change.status = 'rejected';
  };

  /**
   * 拒绝变更（别名，用于兼容）
   */
  const rejectFileChange = (change: FileChange) => {
    rejectChange(change);
  };

  /**
   * 应用所有变更
   */
  const applyAllChanges = async () => {
    if (!currentTask.value) {
      showAlert('没有待应用的变更', '提示', 'warning');
      return;
    }

    try {
      for (const change of currentTask.value.changes) {
        if (change.status === 'pending') {
          await applyFileChange(change);
        }
      }
      showAlert('所有变更已应用', '成功', 'info');
    } catch (error: any) {
      console.error('应用所有变更失败:', error);
      showAlert(error.message, '应用变更失败', 'danger');
    }
  };

  /**
   * 清空 Agent 历史（别名，用于兼容）
   */
  const clearAgentHistory = () => {
    resetAgent();
  };

  /**
   * 重置 Agent
   */
  const resetAgent = () => {
    agentMessages.value = [];
    agentInput.value = '';
    currentTask.value = null;
    taskHistory.value = [];
    showDiffPreview.value = false;
    currentDiff.value = null;
  };

  return {
    // 状态
    agentMessages,
    agentInput,
    isAgentLoading,
    currentTask,
    taskHistory,
    selectedModelId,
    showDiffPreview,
    currentDiff,

    // 方法
    analyzeRequest,
    executeAgentTask,
    applyFileChange,
    rejectChange,
    rejectFileChange, // 别名
    applyAllChanges,
    clearAgentHistory, // 别名
    resetAgent
  };
}
