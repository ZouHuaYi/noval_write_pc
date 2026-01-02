/**
 * useAgent - 简化的 Agent Composable
 * 现在直接使用 Novel Agent 系统，不再进行文件扫描
 * 流程：理解上下文（记忆系统）-> 规划意图 -> 写文章 -> 一致性校验 -> 重写 -> 更新记忆
 */

import { ref, type Ref } from 'vue';
import { getAllFiles } from '../utils/fileTree';

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
  status: 'analyzing' | 'planning' | 'executing' | 'completed' | 'failed' | 'waiting_confirmation';
  changes: FileChange[];
  error?: string;
  // 保存执行结果，用于应用变更后更新记忆
  executionResult?: {
    text: string;
    intent?: any;
    userRequest: string;
  };
  // 待确认的大纲信息
  pendingConfirmation?: {
    outline: string;
    scenes: any[];
    executionContext: any;
    skillResults: any[];
    pendingExecution: any;
  };
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
  
  // 用于取消 Agent 执行的引用
  let novelAgentRef: any = null;

  /**
   * 取消 Agent 执行
   */
  const cancelAgent = async () => {
    if (novelAgentRef && novelAgentRef.cancelTask) {
      try {
        await novelAgentRef.cancelTask();
        console.log('✅ Agent 执行已取消');
      } catch (error: any) {
        console.error('取消 Agent 执行失败:', error);
      }
    }
    isAgentLoading.value = false;
    
    // 添加取消消息
    const cancelMsg: AgentMessage = {
      id: nextAgentMsgId++,
      role: 'system',
      content: '⚠️ 用户取消了 Agent 执行',
      timestamp: Date.now()
    };
    agentMessages.value.push(cancelMsg);
    
    if (currentTask.value) {
      currentTask.value.status = 'failed';
    }
  };

  /**
   * 设置 Novel Agent 引用（用于取消功能）
   */
  const setNovelAgentRef = (ref: any) => {
    novelAgentRef = ref;
  };

  /**
   * 从用户请求中提取目标文件
   * 优先提取 @文件名 格式的引用
   */
  const extractTargetFile = (request: string): string => {
    // 优先匹配 @文件名 格式（例如：@第001章.txt）
    const atFileMatch = request.match(/@([^\s@]+)/);
    if (atFileMatch) {
      const fileName = atFileMatch[1].trim();
      // 移除 @ 符号，返回文件名
      return fileName;
    }

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

      // 提取目标文件（如果有 @文件名 引用）
      const targetFileName = extractTargetFile(userRequest);
      
      // 步骤 2-6: 调用 Novel Agent 执行
      const result = await window.api.novelAgent.execute({
        userRequest: userRequest,
        targetFile: targetFileName || undefined // 如果有目标文件，传递给 Agent
      });

      if (!result.success) {
        throw new Error(result.error || 'Novel Agent 执行失败');
      }

      // 检查是否需要用户确认大纲
      if (result.requiresUserConfirmation && result.confirmationType === 'outline') {
        // 保存待确认的任务状态
        task.status = 'waiting_confirmation';
        task.pendingConfirmation = {
          outline: result.outline,
          scenes: result.scenes,
          executionContext: result.executionContext,
          skillResults: result.skillResults,
          pendingExecution: result.pendingExecution
        };

        // 添加等待确认消息
        const confirmMsg: AgentMessage = {
          id: nextAgentMsgId++,
          role: 'system',
          content: `📋 章节大纲已生成，请确认后继续执行。\n\n大纲预览：\n${result.outline?.substring(0, 200)}...`,
          timestamp: Date.now()
        };
        agentMessages.value.push(confirmMsg);

        // 触发大纲确认对话框（通过事件或回调）
        // 这里需要在前端组件中处理，显示对话框
        // 暂时返回任务，等待用户确认
        return task;
      }

      // 解析结果，转换为 FileChange 格式
      const changes: FileChange[] = [];

      // 如果返回了文本，需要创建或修改文件
      if (result.text) {
        // 优先使用 result 中的 target_file_path（重写模式）
        let targetFilePath = result.target_file_path;
        let finalTargetFileName = targetFileName;
        
        if (!targetFilePath) {
          // 如果没有，使用之前提取的目标文件名
          const action = determineAction(userRequest, targetFileName);
          
          // 构建完整文件路径
          targetFilePath = targetFileName;
          if (workspaceRoot.value && !targetFilePath.startsWith(workspaceRoot.value)) {
            // 如果文件名不包含完整路径，需要从文件树中查找
            const allFiles = fileTree.value ? getAllFiles(fileTree.value) : [];
            const matchedFile = allFiles.find(f => f.name === targetFileName || f.relativePath === targetFileName);
            if (matchedFile && matchedFile.path) {
              targetFilePath = matchedFile.path;
              finalTargetFileName = matchedFile.name;
            } else {
              // 如果找不到，使用相对路径
              targetFilePath = `${workspaceRoot.value}/${targetFileName}`;
            }
          }
        } else {
          // 从完整路径中提取文件名
          const pathParts = targetFilePath.split(/[/\\]/);
          finalTargetFileName = pathParts[pathParts.length - 1] || targetFileName;
        }

        // 判断操作类型（根据意图分析结果）
        const intentType = result.intent_analysis?.intent_type;
        const action = intentType === 'REWRITE' || intentType === 'CHECK' ? 'modify' : 
                      (intentType === 'CREATE' ? 'create' : determineAction(userRequest, targetFileName));

        if (action === 'create') {
          changes.push({
            id: `change_${nextChangeId++}`,
            filePath: targetFilePath,
            fileName: finalTargetFileName,
            action: 'create',
            newContent: result.text,
            description: result.intent?.goal || '创建新章节',
            status: 'pending'
          });
        } else {
          // modify 操作需要提供 oldContent 和 newContent
          // 重写模式时，result 可能包含 original_content
          let oldContent = result.intent?.original_content;
          if (!oldContent) {
            // 如果没有，读取原文件内容
            oldContent = await readFile(targetFilePath) || '';
          }
          
          changes.push({
            id: `change_${nextChangeId++}`,
            filePath: targetFilePath,
            fileName: finalTargetFileName,
            action: 'modify',
            oldContent: oldContent,
            newContent: result.text,
            description: result.intent?.goal || (intentType === 'REWRITE' ? '重写章节' : '修改文本'),
            status: 'pending'
          });
        }
      }

      task.changes = changes;
      task.status = 'completed';
      
      // 保存执行结果，用于应用变更后更新记忆
      task.executionResult = {
        text: result.text || '',
        intent: result.intent,
        userRequest: userRequest
      };

      // 添加成功消息（不自动应用变更，需要用户确认）
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
            ? '✅ 文本已通过一致性校验，符合世界观和人物设定。\n\n'
            : '⚠️ 文本未通过一致性校验，请检查。\n\n') +
          `📝 提示：请点击"应用全部变更"按钮查看预览并确认应用变更。应用变更成功后，系统将自动更新记忆。`,
        timestamp: Date.now()
      };
      agentMessages.value.push(successMsg);

      // 如果有校验结果，显示详细信息
      if (result.checkResult && Array.isArray(result.checkResult.errors) && result.checkResult.errors.length > 0) {
        const errorDetails = result.checkResult.errors
          .map((e: any) => `- ${e.message || e.issue || JSON.stringify(e)}`)
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
   * 应用所有变更（需要确认）
   */
  const applyAllChanges = async (): Promise<boolean> => {
    if (!currentTask.value) {
      showAlert('没有待应用的变更', '提示', 'warning');
      return false;
    }

    try {
      for (const change of currentTask.value.changes) {
        if (change.status === 'pending') {
          await applyFileChange(change);
        }
      }
      showAlert('所有变更已应用', '成功', 'info');
      return true;
    } catch (error: any) {
      console.error('应用所有变更失败:', error);
      showAlert(error.message, '应用变更失败', 'danger');
      return false;
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

  /**
   * 确认大纲并继续执行
   * @param task - 待确认的任务
   * @param userModifiedOutline - 用户修改后的大纲（可选）
   */
  const confirmOutlineAndContinue = async (task: AgentTask, userModifiedOutline?: string): Promise<AgentTask> => {
    if (!task.pendingConfirmation) {
      throw new Error('任务没有待确认的大纲');
    }

    if (!window.api?.novelAgent) {
      throw new Error('Novel Agent API 不可用');
    }

    isAgentLoading.value = true;

    try {
      // 添加确认消息
      const confirmMsg: AgentMessage = {
        id: nextAgentMsgId++,
        role: 'system',
        content: '✅ 大纲已确认，继续执行...',
        timestamp: Date.now()
      };
      agentMessages.value.push(confirmMsg);

      // 调用继续执行
      const result = await window.api.novelAgent.continueExecution({
        userModifiedOutline: userModifiedOutline
      });

      if (!result.success) {
        throw new Error(result.error || '继续执行失败');
      }

      // 清除待确认状态
      task.pendingConfirmation = undefined;
      task.status = 'analyzing';

      // 解析结果，转换为 FileChange 格式
      const changes: FileChange[] = [];

      // 如果返回了文本，需要创建或修改文件
      if (result.text) {
        const targetFileName = extractTargetFile(task.description);
        let targetFilePath = result.target_file_path;
        let finalTargetFileName = targetFileName;

        if (!targetFilePath) {
          const action = determineAction(task.description, targetFileName);
          targetFilePath = targetFileName;
          if (workspaceRoot.value && targetFilePath && !targetFilePath.startsWith(workspaceRoot.value)) {
            const allFiles = fileTree.value ? getAllFiles(fileTree.value) : [];
            const matchedFile = allFiles.find(f => f.name === targetFileName || f.relativePath === targetFileName);
            if (matchedFile && matchedFile.path) {
              targetFilePath = matchedFile.path;
              finalTargetFileName = matchedFile.name;
            } else {
              targetFilePath = `${workspaceRoot.value}/${targetFileName}`;
            }
          } else if (!targetFilePath && workspaceRoot.value) {
            targetFilePath = `${workspaceRoot.value}/${targetFileName}`;
          }
        } else {
          if (targetFilePath) {
            const pathParts = targetFilePath.split(/[/\\]/);
            finalTargetFileName = pathParts && pathParts.length > 0 ? pathParts[pathParts.length - 1] : targetFileName;
          } else {
            finalTargetFileName = targetFileName;
          }
        }

        const intentType = result.intent_analysis?.intent_type;
        const action = intentType === 'REWRITE' || intentType === 'CHECK' ? 'modify' : 
                      (intentType === 'CREATE' ? 'create' : determineAction(task.description, targetFileName));

        if (action === 'create') {
          changes.push({
            id: `change_${nextChangeId++}`,
            filePath: targetFilePath,
            fileName: finalTargetFileName,
            action: 'create',
            newContent: result.text,
            description: result.intent?.goal || '创建新章节',
            status: 'pending'
          });
        } else {
          let oldContent = result.intent?.original_content;
          if (!oldContent) {
            oldContent = await readFile(targetFilePath) || '';
          }
          
          changes.push({
            id: `change_${nextChangeId++}`,
            filePath: targetFilePath,
            fileName: finalTargetFileName,
            action: 'modify',
            oldContent: oldContent,
            newContent: result.text,
            description: result.intent?.goal || (intentType === 'REWRITE' ? '重写章节' : '修改文本'),
            status: 'pending'
          });
        }
      }

      task.changes = changes;
      task.status = 'completed';
      
      // 保存执行结果
      task.executionResult = {
        text: result.text || '',
        intent: result.intent,
        userRequest: task.description
      };

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
            ? '✅ 文本已通过一致性校验，符合世界观和人物设定。\n\n'
            : '⚠️ 文本未通过一致性校验，请检查。\n\n') +
          `📝 提示：请点击"应用全部变更"按钮查看预览并确认应用变更。应用变更成功后，系统将自动更新记忆。`,
        timestamp: Date.now()
      };
      agentMessages.value.push(successMsg);

      // 如果有校验结果，显示详细信息
      if (result.checkResult && Array.isArray(result.checkResult.errors) && result.checkResult.errors.length > 0) {
        const errorDetails = result.checkResult.errors
          .map((e: any) => `- ${e.message || e.issue || JSON.stringify(e)}`)
          .join('\n');
        const errorMsg: AgentMessage = {
          id: nextAgentMsgId++,
          role: 'system',
          content: `⚠️ 一致性校验发现问题：\n${errorDetails}`,
          timestamp: Date.now()
        };
        agentMessages.value.push(errorMsg);
      }

      return task;

    } catch (error: any) {
      console.error('❌ 继续执行失败:', error);
      task.status = 'failed';
      task.error = error.message;

      const errorMsg: AgentMessage = {
        id: nextAgentMsgId++,
        role: 'system',
        content: `❌ 继续执行失败：${error.message}`,
        timestamp: Date.now()
      };
      agentMessages.value.push(errorMsg);

      showAlert(error.message, '继续执行失败', 'danger');
      return task;
    } finally {
      isAgentLoading.value = false;
    }
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
    resetAgent,
    cancelAgent,
    setNovelAgentRef,
    confirmOutlineAndContinue
  };
}
