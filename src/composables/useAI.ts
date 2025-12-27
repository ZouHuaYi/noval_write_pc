import { ref } from 'vue';
import type { TreeNode } from '../utils/fileTree';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export function useAI(
  showAlert: (message: string, title?: string, type?: 'info' | 'warning' | 'danger') => void,
  showPrompt: (title: string, onConfirm: (value: string) => void, placeholder?: string, defaultValue?: string) => void,
  getEditorContent: () => string,
  getEditorSelection: () => { text: string; range: any } | null,
  getEditorContext: (range: any, beforeChars?: number, afterChars?: number) => { before: string; after: string },
  replaceEditorSelection: (text: string, range?: any) => void,
  insertAtCursor: (text: string) => void,
  focusEditor: () => void
) {
  const messages = ref<ChatMessage[]>([]);
  const chatInput = ref('');
  const chatMode = ref<'file' | 'selection'>('file');
  const insertMode = ref<'append' | 'replace'>('append');
  const isChatLoading = ref(false);
  const selectedModelId = ref<number | null>(null);
  const promptFileContent = ref<string>('');
  
  const showConsistencyDialog = ref(false);
  const showConsistencyHistory = ref(false);
  const showBatchCheckDialog = ref(false);
  const consistencyResult = ref<string>('');
  const consistencySelection = ref<any>(null);

  let nextMsgId = 1;

  // 文本优化（润色、扩写、精简、续写）
  const optimizeText = async (
    mode: 'polish' | 'expand' | 'shorten' | 'continue',
    text: string,
    range: any,
    currentFile: TreeNode | null
  ) => {
    if (!window.api?.llm) {
      showAlert('LLM API 不可用，请重启应用', '错误', 'danger');
      return;
    }

    try {
      isChatLoading.value = true;
      
      const context = getEditorContext(range);
      
      let contextInfo = '';
      if (context.before) {
        contextInfo += `\n\n【前文上下文】\n${context.before}\n`;
      }
      contextInfo += `\n【需要${mode === 'polish' ? '润色' : mode === 'expand' ? '扩写' : mode === 'shorten' ? '精简' : '续写'}的文本】\n${text}\n`;
      if (context.after && mode !== 'continue') {
        contextInfo += `\n【后文上下文】\n${context.after}\n`;
      }
      
      const prompts: Record<string, string> = {
        polish: `请对【需要润色的文本】进行润色，使其更加流畅、生动、富有文学性，保持原意但提升表达质量。注意与前后文的衔接和风格统一。${contextInfo}`,
        expand: `请对【需要扩写的文本】进行扩写，增加细节描写、环境描写或心理描写，使内容更加丰富生动。注意与前后文的逻辑连贯和风格一致。${contextInfo}`,
        shorten: `请对【需要精简的文本】进行精简，保留核心信息和主要情节，删除冗余内容。注意不要影响与前后文的连贯性。${contextInfo}`,
        continue: `请基于前文和【需要续写的文本】，自然地续写下文。保持风格、人物性格和故事逻辑的一致性，确保情节发展合理。${contextInfo}`
      };
      
      const prompt = prompts[mode] || `请优化以下文本：${contextInfo}`;
      
      let systemContent = '你是一个专业的小说写作助手，擅长文本润色、扩写、精简和续写。';
      
      if (promptFileContent.value) {
        systemContent += `\n\n【重要：世界观和人物设定】\n${promptFileContent.value}\n\n请严格遵守以上设定和提示，确保优化后的内容符合世界观、人物性格和故事背景。`;
      }
      
      systemContent += '\n\n请直接返回处理后的文本，不要有任何多余的说明或标记。只返回优化后的核心文本内容。';
      
      const result = await window.api.llm.chat(
        selectedModelId.value,
        [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.7, maxTokens: 2000 }
      );
      
      if (!result.success || !result.response) {
        throw new Error(result.error || '优化失败');
      }
      
      let optimizedText = result.response.trim();
      optimizedText = optimizedText.replace(/^【.*?】\s*/g, '');
      optimizedText = optimizedText.replace(/\n【.*?】\s*/g, '\n');
      optimizedText = optimizedText.replace(/\n{3,}/g, '\n\n');
      
      replaceEditorSelection(optimizedText, range);
    } catch (e: any) {
      console.error(e);
      showAlert('文本优化失败：' + e.message, '错误', 'danger');
    } finally {
      isChatLoading.value = false;
    }
  };

  // 智能续写（理解式）
  const smartContinue = async (
    text: string,
    range: any,
    currentFile: TreeNode | null
  ) => {
    if (!window.api?.llm) {
      showAlert('LLM API 不可用，请重启应用', '错误', 'danger');
      return;
    }

    if (!selectedModelId.value) {
      showAlert('请先在设置中配置并选择一个LLM模型', '提示', 'warning');
      return;
    }

    try {
      isChatLoading.value = true;
      showAlert('正在进行智能续写，请稍候...\n第一步：理解内容（约10-20秒）\n第二步：生成续写（约20-30秒）', '处理中', 'info');
      
      let chapterInfo = '';
      if (currentFile && currentFile.name) {
        const fileName = currentFile.name;
        const chapterMatch = fileName.match(/第?(\d+)[-到](\d+)章?|(\d+)[-_](\d+)/);
        if (chapterMatch) {
          const start = chapterMatch[1] || chapterMatch[3];
          const end = chapterMatch[2] || chapterMatch[4];
          chapterInfo = `当前文件包含第${start}章到第${end}章的内容。`;
        } else {
          const singleMatch = fileName.match(/第?(\d+)章?/);
          if (singleMatch) {
            chapterInfo = `当前文件是第${singleMatch[1]}章。`;
          }
        }
      }
      
      const fullText = getEditorContent();
      
      const understandPrompt = `请仔细阅读以下小说内容，总结出关键信息：

${chapterInfo ? `【章节信息】\n${chapterInfo}\n\n` : ''}【完整内容】
${fullText.length > 3000 ? fullText.substring(0, 3000) + '\n\n[内容过长，已截取前3000字]' : fullText}

请从以下几个方面进行总结：
1. 当前故事发展到了什么阶段？
2. 主要人物有哪些？他们的状态如何？
3. 当前的场景和氛围是什么？
4. 有哪些伏笔或未解决的情节？
5. 接下来可能的发展方向是什么？

请简洁地总结，不超过300字。`;
      
      let systemContent = '你是一个专业的小说创作助手，擅长理解故事脉络和续写内容。';
      if (promptFileContent.value) {
        systemContent += `\n\n【重要：世界观和人物设定】\n${promptFileContent.value}\n\n请严格遵守以上设定。`;
      }
      
      const understandResult = await window.api.llm.chat(
        selectedModelId.value,
        [
          { role: 'system', content: systemContent },
          { role: 'user', content: understandPrompt }
        ],
        { temperature: 0.3, maxTokens: 500 }
      );
      
      if (!understandResult.success || !understandResult.response) {
        throw new Error('理解内容失败：' + (understandResult.error || '未知错误'));
      }
      
      const understanding = understandResult.response;
      
      const continuePrompt = `基于以下对故事的理解，请自然地续写下文：

【故事理解】
${understanding}

${chapterInfo ? `【章节信息】\n${chapterInfo}\n\n` : ''}【当前结尾】
${text}

请注意：
1. 保持与前文的风格、语气一致
2. 遵守世界观和人物设定
3. 情节发展要合理自然
4. 续写内容应该在500-800字左右
5. 直接开始续写，不要有任何说明文字

请开始续写：`;
      
      const continueResult = await window.api.llm.chat(
        selectedModelId.value,
        [
          { role: 'system', content: systemContent + '\n\n你现在要基于对故事的理解，自然地续写下文。' },
          { role: 'user', content: continuePrompt }
        ],
        { temperature: 0.8, maxTokens: 1500 }
      );
      
      if (!continueResult.success || !continueResult.response) {
        throw new Error('续写失败：' + (continueResult.error || '未知错误'));
      }
      
      let continuedText = continueResult.response.trim();
      continuedText = continuedText.replace(/^【.*?】\s*/g, '');
      continuedText = continuedText.replace(/\n【.*?】\s*/g, '\n');
      continuedText = continuedText.replace(/\n{3,}/g, '\n\n');
      
      insertAtCursor('\n\n' + continuedText);
      showAlert('智能续写完成！已基于内容理解生成续写内容。', '成功', 'info');
      
    } catch (e: any) {
      console.error(e);
      showAlert('智能续写失败：' + e.message, '错误', 'danger');
    } finally {
      isChatLoading.value = false;
    }
  };

  // 修正错误
  const fixError = async (
    text: string,
    range: any,
    errorDescription: string
  ) => {
    if (!window.api?.llm) {
      showAlert('LLM API 不可用，请重启应用', '错误', 'danger');
      return;
    }

    try {
      isChatLoading.value = true;
      
      const context = getEditorContext(range);
      
      let contextInfo = '';
      if (context.before) {
        contextInfo += `\n\n【前文上下文】\n${context.before}\n`;
      }
      contextInfo += `\n【需要修正的文本】\n${text}\n`;
      if (context.after) {
        contextInfo += `\n【后文上下文】\n${context.after}\n`;
      }
      contextInfo += `\n【用户指出的错误】\n${errorDescription}\n`;
      
      const prompt = `请根据用户指出的错误，修正【需要修正的文本】。确保与前后文的语境一致，只返回修正后的文本，不要有任何多余的说明。${contextInfo}`;
      
      let systemContent = '你是一个专业的小说写作助手，擅长修正文本中的错误。';
      
      if (promptFileContent.value) {
        systemContent += `\n\n【重要：世界观和人物设定】\n${promptFileContent.value}\n\n请严格遵守以上设定和提示，确保修正后的内容符合世界观、人物性格和故事背景。`;
      }
      
      systemContent += '\n\n请直接返回修正后的文本，不要有任何多余的说明或标记。只返回修正后的核心文本内容。';
      
      const result = await window.api.llm.chat(
        selectedModelId.value,
        [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.7, maxTokens: 2000 }
      );
      
      if (!result.success || !result.response) {
        throw new Error(result.error || '修正失败');
      }
      
      let fixedText = result.response.trim();
      fixedText = fixedText.replace(/^【.*?】\s*/g, '');
      fixedText = fixedText.replace(/\n【.*?】\s*/g, '\n');
      fixedText = fixedText.replace(/\n{3,}/g, '\n\n');
      
      replaceEditorSelection(fixedText, range);
    } catch (e: any) {
      console.error(e);
      showAlert('修正错误失败：' + e.message, '错误', 'danger');
    } finally {
      isChatLoading.value = false;
    }
  };

  // 一致性校验
  const checkConsistency = async (
    text: string,
    workspaceRoot: string,
    currentFilePath: string,
    selection?: any
  ) => {
    if (!window.api?.consistency) {
      showAlert('一致性校验功能不可用，请重启应用', '错误', 'danger');
      return;
    }

    consistencySelection.value = selection || null;

    try {
      isChatLoading.value = true;
      consistencyResult.value = '正在分析...';
      showConsistencyDialog.value = true;
      
      const result = await window.api.consistency.check(
        text,
        workspaceRoot,
        currentFilePath
      );
      
      if (!result.success) {
        throw new Error(result.error || '校验失败');
      }
      
      consistencyResult.value = result.result || '校验完成，但未返回结果';
      
      if (result.contextInfo) {
        console.log('一致性校验上下文信息:', result.contextInfo);
      }
    } catch (e: any) {
      console.error(e);
      consistencyResult.value = `❌ 校验失败：${e.message}`;
    } finally {
      isChatLoading.value = false;
    }
  };

  // 一致性修正
  const fixConsistency = async () => {
    if (!window.api?.llm) {
      showAlert('LLM API 不可用，请重启应用', '错误', 'danger');
      return;
    }

    if (!consistencySelection.value) {
      showAlert('无法修正：未找到原始选中区域', '错误', 'danger');
      return;
    }

    try {
      isChatLoading.value = true;
      
      const selection = getEditorSelection();
      if (!selection) return;
      
      const context = getEditorContext(consistencySelection.value);
      
      let contextInfo = '';
      if (context.before) {
        contextInfo += `\n\n【前文上下文】\n${context.before}\n`;
      }
      contextInfo += `\n【需要修正的文本】\n${selection.text}\n`;
      if (context.after) {
        contextInfo += `\n【后文上下文】\n${context.after}\n`;
      }
      contextInfo += `\n【一致性校验结果】\n${consistencyResult.value}\n`;
      
      const prompt = `根据一致性校验结果中指出的问题，修正【需要修正的文本】。确保修正后的内容与世界观设定、人物设定、前后文保持一致。只返回修正后的文本，不要有任何多余的说明。${contextInfo}`;
      
      let systemContent = '你是一个专业的小说写作助手，擅长根据一致性问题修正文本内容。';
      
      if (promptFileContent.value) {
        systemContent += `\n\n【重要：世界观和人物设定】\n${promptFileContent.value}\n\n请严格遵守以上设定和提示，确保修正后的内容符合世界观、人物性格和故事背景。`;
      }
      
      systemContent += '\n\n请直接返回修正后的文本，不要有任何多余的说明或标记。只返回修正后的核心文本内容。';
      
      const result = await window.api.llm.chat(
        selectedModelId.value,
        [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.7, maxTokens: 2000 }
      );
      
      if (!result.success || !result.response) {
        throw new Error(result.error || '修正失败');
      }
      
      let fixedText = result.response.trim();
      fixedText = fixedText.replace(/^【.*?】\s*/g, '');
      fixedText = fixedText.replace(/\n【.*?】\s*/g, '\n');
      fixedText = fixedText.replace(/\n{3,}/g, '\n\n');
      
      replaceEditorSelection(fixedText, consistencySelection.value);
      showConsistencyDialog.value = false;
    } catch (e: any) {
      console.error(e);
      showAlert('一致性修正失败：' + e.message, '错误', 'danger');
    } finally {
      isChatLoading.value = false;
    }
  };

  // 限制上下文长度
  const limitContextLength = (text: string, maxChars: number = 3000): string => {
    if (text.length <= maxChars) return text;
    
    const contextText = text.substring(text.length - maxChars);
    return `[为保持聚焦，仅展示最近 ${maxChars} 字内容]\n\n${contextText}`;
  };

  // Chat 发送消息
  const sendChat = async (
    currentFile: TreeNode | null,
    workspaceRoot: string
  ) => {
    if (!chatInput.value || isChatLoading.value) return;

    if (!window.api?.llm) {
      showAlert('LLM API 不可用，请重启 Electron', '错误', 'danger');
      return;
    }

    const fullText = getEditorContent();
    const selection = getEditorSelection();
    const selectedText = selection?.text || '';

    const contextText = chatMode.value === 'selection' 
      ? selectedText 
      : limitContextLength(fullText, 3000);

    let systemPrompt = '你是一个专业的小说写作助手。';
    
    if (promptFileContent.value) {
      systemPrompt += `\n\n【重要提示和设定】\n${promptFileContent.value}\n\n请严格遵守以上设定和提示。`;
    }
    
    if (chatMode.value === 'selection') {
      systemPrompt += `\n\n用户会给你一段选中的文本，并提出问题或要求。请基于这段文本回答用户的问题或执行用户的指令。\n\n选中的文本内容：\n${contextText || '(用户没有选中任何文本)'}`;
    } else {
      systemPrompt += `\n\n用户会给你当前正在编辑的文件附近的内容，并提出问题或要求。请基于这段内容回答用户的问题或执行用户的指令。\n\n当前编辑区域内容：\n${contextText || '(当前文件为空)'}`;
    }

    const userMsg: ChatMessage = {
      id: nextMsgId++,
      role: 'user',
      content: chatInput.value
    };
    messages.value.push(userMsg);

    const userQuestion = chatInput.value;
    chatInput.value = '';
    isChatLoading.value = true;

    try {
      const llmMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion }
      ];

      const result = await window.api.llm.chat(
        selectedModelId.value,
        llmMessages,
        { temperature: 0.7, maxTokens: 2000 }
      );

      if (!result.success || !result.response) {
        throw new Error(result.error || '调用 LLM API 失败');
      }

      const assistantText = result.response;

      const assistantMsg: ChatMessage = {
        id: nextMsgId++,
        role: 'assistant',
        content: assistantText
      };
      messages.value.push(assistantMsg);

      if (insertMode.value === 'replace' && selection) {
        replaceEditorSelection(assistantText, selection.range);
      } else {
        let cleanedText = assistantText.trim();
        cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
        
        const fullContent = getEditorContent();
        const lines = fullContent.split('\n');
        const lastLine = lines[lines.length - 1] || '';
        const isEmptyLine = !lastLine.trim();
        
        const prefix = isEmptyLine ? '\n' : '\n\n';
        insertAtCursor(prefix + cleanedText);
        focusEditor();
      }
    } catch (error: any) {
      console.error('LLM 调用失败:', error);
      showAlert(`LLM 调用失败：${error.message}`, '错误', 'danger');
      
      if (messages.value[messages.value.length - 1]?.id === userMsg.id) {
        messages.value.pop();
      }
      
      chatInput.value = userQuestion;
    } finally {
      isChatLoading.value = false;
    }
  };

  // 删除消息
  const deleteMessage = (id: number) => {
    const index = messages.value.findIndex(msg => msg.id === id);
    if (index !== -1) {
      messages.value.splice(index, 1);
    }
  };

  // 加载提示文件
  const loadPromptFile = async (fileTree: TreeNode[]) => {
    if (!window.api?.readFile) {
      promptFileContent.value = '';
      return;
    }
    
    const findMdFile = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.type === 'file' && node.ext === 'md') {
          const name = node.name.toLowerCase();
          if (name.includes('prompt') || name.includes('提示') || name.includes('设定') || name.includes('世界观')) {
            return node;
          }
        }
        if (node.type === 'folder' && node.children) {
          const found = findMdFile(node.children);
          if (found) return found;
        }
      }
      for (const node of nodes) {
        if (node.type === 'file' && node.ext === 'md') {
          return node;
        }
        if (node.type === 'folder' && node.children) {
          const found = findMdFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const mdFile = findMdFile(fileTree);
    if (mdFile && mdFile.path) {
      try {
        const result = await window.api.readFile(mdFile.path);
        if (result.success && result.content) {
          promptFileContent.value = result.content;
          console.log('已加载提示文件:', mdFile.name);
        }
      } catch (e) {
        console.error('加载提示文件失败:', e);
      }
    } else {
      promptFileContent.value = '';
    }
  };

  return {
    // State
    messages,
    chatInput,
    chatMode,
    insertMode,
    isChatLoading,
    selectedModelId,
    promptFileContent,
    showConsistencyDialog,
    showConsistencyHistory,
    showBatchCheckDialog,
    consistencyResult,
    consistencySelection,
    
    // Methods
    optimizeText,
    smartContinue,
    fixError,
    checkConsistency,
    fixConsistency,
    sendChat,
    deleteMessage,
    loadPromptFile
  };
}

