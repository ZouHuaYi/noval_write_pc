import { ref, type Ref } from 'vue';

export interface EditorPosition {
  lineNumber: number;
  column: number;
}

export function useEditor() {
  const editorEl = ref<HTMLElement | null>(null);
  const cursorInfo = ref('1:1');
  const showMenu = ref(false);
  const menuX = ref(0);
  const menuY = ref(0);
  
  let editorInstance: any = null;
  let monacoLoaderScript: HTMLScriptElement | null = null;
  let lastCursorPosition: EditorPosition | null = null;

  // 加载 Monaco 编辑器
  const loadMonaco = () => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).monaco) {
        resolve();
        return;
      }

      monacoLoaderScript = document.createElement('script');
      monacoLoaderScript.src =
        'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
      monacoLoaderScript.onload = () => {
        const req = (window as any).require;
        if (!req) {
          reject(new Error('Monaco require not found'));
          return;
        }

        req.config({
          paths: {
            vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
          }
        });

        req(['vs/editor/editor.main'], () => {
          resolve();
        });
      };
      monacoLoaderScript.onerror = () => reject(new Error('加载 Monaco 失败'));
      document.body.appendChild(monacoLoaderScript);
    });
  };

  // 初始化编辑器
  const initEditor = async (onSave?: () => void) => {
    if (!editorEl.value) return;

    await loadMonaco();

    const monaco = (window as any).monaco;
    editorInstance = monaco.editor.create(editorEl.value, {
      value: '',
      language: 'markdown',
      theme: 'vs-dark',
      fontSize: 14,
      automaticLayout: true,
      contextmenu: false,
      wordWrap: 'on',
      wrappingIndent: 'indent',
      scrollBeyondLastLine: false
    });

    // 光标位置变化事件
    editorInstance.onDidChangeCursorPosition((e: any) => {
      cursorInfo.value = e.position.lineNumber + ':' + e.position.column;
      lastCursorPosition = e.position;
    });

    // 右键菜单事件
    editorInstance.onContextMenu((e: any) => {
      const domEvent = e.event;
      domEvent.preventDefault();
      domEvent.stopPropagation();

      const editorRect = editorEl.value?.getBoundingClientRect();
      if (editorRect) {
        menuX.value = editorRect.left + editorRect.width / 2 - 200;
        menuY.value = editorRect.top + editorRect.height / 2 - 250;
      } else {
        menuX.value = domEvent.browserEvent.clientX;
        menuY.value = domEvent.browserEvent.clientY;
      }
      showMenu.value = true;
    });

    // 保存快捷键
    if (onSave) {
      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onSave);
    }

    return editorInstance;
  };

  // 获取编辑器实例
  const getEditor = () => editorInstance;

  // 获取编辑器内容
  const getContent = (): string => {
    if (!editorInstance) return '';
    return editorInstance.getModel()?.getValue() || '';
  };

  // 设置编辑器内容
  const setContent = (content: string) => {
    if (!editorInstance) return;
    editorInstance.getModel()?.setValue(content);
  };

  // 获取选中的文本
  const getSelection = (): { text: string; range: any } | null => {
    if (!editorInstance) return null;
    const model = editorInstance.getModel();
    const selection = editorInstance.getSelection();
    if (!selection || selection.isEmpty() || !model) return null;
    
    return {
      text: model.getValueInRange(selection),
      range: selection
    };
  };

  // 替换选中的文本
  const replaceSelection = (text: string, range?: any) => {
    if (!editorInstance) return;
    const targetRange = range || editorInstance.getSelection();
    if (!targetRange) return;
    
    editorInstance.executeEdits('replace', [{
      range: targetRange,
      text: text,
      forceMoveMarkers: true
    }]);
  };

  // 在光标位置插入文本
  const insertAtCursor = (text: string) => {
    if (!editorInstance) return;
    
    const model = editorInstance.getModel();
    if (!model) return;
    
    let position = editorInstance.getPosition() || lastCursorPosition;
    
    if (!position) {
      const lineCount = model.getLineCount();
      const lastLineLength = model.getLineMaxColumn(lineCount);
      position = { lineNumber: lineCount, column: lastLineLength };
    }
    
    const monaco = (window as any).monaco;
    editorInstance.executeEdits('insert', [{
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: text,
      forceMoveMarkers: true
    }]);
  };

  // 获取上下文文本（选中文本前后的内容）
  const getContextText = (range: any, beforeChars: number = 500, afterChars: number = 500) => {
    if (!editorInstance) return { before: '', after: '' };
    
    const model = editorInstance.getModel();
    if (!model) return { before: '', after: '' };
    
    const fullText = model.getValue();
    const startOffset = model.getOffsetAt({ 
      lineNumber: range.startLineNumber, 
      column: range.startColumn 
    });
    const endOffset = model.getOffsetAt({ 
      lineNumber: range.endLineNumber, 
      column: range.endColumn 
    });
    
    const beforeStart = Math.max(0, startOffset - beforeChars);
    const beforeText = fullText.substring(beforeStart, startOffset);
    
    const afterEnd = Math.min(fullText.length, endOffset + afterChars);
    const afterText = fullText.substring(endOffset, afterEnd);
    
    return { before: beforeText, after: afterText };
  };

  // 隐藏右键菜单
  const hideMenu = () => {
    showMenu.value = false;
  };

  // 聚焦编辑器
  const focus = () => {
    if (editorInstance) {
      editorInstance.focus();
    }
  };

  // 清理编辑器
  const dispose = () => {
    if (editorInstance) {
      editorInstance.dispose();
      editorInstance = null;
    }
    if (monacoLoaderScript && monacoLoaderScript.parentNode) {
      monacoLoaderScript.parentNode.removeChild(monacoLoaderScript);
      monacoLoaderScript = null;
    }
  };

  return {
    // Refs
    editorEl,
    cursorInfo,
    showMenu,
    menuX,
    menuY,
    
    // Methods
    loadMonaco,
    initEditor,
    getEditor,
    getContent,
    setContent,
    getSelection,
    replaceSelection,
    insertAtCursor,
    getContextText,
    hideMenu,
    focus,
    dispose
  };
}

