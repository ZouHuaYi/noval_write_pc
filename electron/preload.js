const { contextBridge, ipcRenderer } = require('electron');

// 这里先提供一个 mock 的重写函数：简单在前后加标记，方便验证流程
contextBridge.exposeInMainWorld('api', {
  rewriteSelection: async ({ text, mode }) => {
    const labelMap = {
      polish: '润色',
      expand: '扩写',
      shorten: '精简'
    };
    const label = labelMap[mode] || '重写';
    // 模拟耗时
    await new Promise((resolve) => setTimeout(resolve, 400));
    return `【${label}后】` + text;
  },
  // 打开单个文件（带内容）
  openLocalFile: async () => {
    return await ipcRenderer.invoke('file:openDialog');
  },
  // 打开文件夹（返回文件列表，不含内容）
  openFolder: async () => {
    return await ipcRenderer.invoke('folder:openDialog');
  },
  // 读取文件内容（懒加载）
  readFile: async (filePath) => {
    return await ipcRenderer.invoke('file:read', filePath);
  },
  // 保存文件内容
  writeFile: async (filePath, content) => {
    return await ipcRenderer.invoke('file:write', { filePath, content });
  },
  // 新建文件
  createFile: async (filePath, content = '') => {
    return await ipcRenderer.invoke('file:create', { filePath, content });
  },
  // 删除文件或文件夹
  deleteFile: async (filePath) => {
    return await ipcRenderer.invoke('file:delete', filePath);
  },
  // 创建文件夹
  createFolder: async (folderPath) => {
    return await ipcRenderer.invoke('folder:create', folderPath);
  },
  // 移动文件或文件夹
  moveFile: async (sourcePath, targetPath) => {
    return await ipcRenderer.invoke('file:move', { sourcePath, targetPath });
  },
  // 重命名文件或文件夹
  renameFile: async (oldPath, newPath) => {
    return await ipcRenderer.invoke('file:rename', { oldPath, newPath });
  },
  // 刷新文件夹
  refreshFolder: async (rootDir) => {
    return await ipcRenderer.invoke('folder:refresh', rootDir);
  },
  // ========== LLM 模型管理 ==========
  llm: {
    getAll: async () => await ipcRenderer.invoke('llm:getAll'),
    getDefault: async () => await ipcRenderer.invoke('llm:getDefault'),
    add: async (modelData) => await ipcRenderer.invoke('llm:add', modelData),
    update: async (id, modelData) => await ipcRenderer.invoke('llm:update', { id, ...modelData }),
    delete: async (id) => await ipcRenderer.invoke('llm:delete', id),
    setDefault: async (id) => await ipcRenderer.invoke('llm:setDefault', id),
    chat: async (modelId, messages, options) => await ipcRenderer.invoke('llm:chat', { modelId, messages, options })
  },
  // ========== Embedding 模型管理 ==========
  embedding: {
    getAll: async () => await ipcRenderer.invoke('embedding:getAll'),
    getDefault: async () => await ipcRenderer.invoke('embedding:getDefault'),
    add: async (modelData) => await ipcRenderer.invoke('embedding:add', modelData),
    update: async (id, modelData) => await ipcRenderer.invoke('embedding:update', { id, ...modelData }),
    delete: async (id) => await ipcRenderer.invoke('embedding:delete', id),
    setDefault: async (id) => await ipcRenderer.invoke('embedding:setDefault', id)
  },
  // ========== 历史工作区管理 ==========
  workspace: {
    getHistory: async () => await ipcRenderer.invoke('workspace:getHistory'),
    deleteHistory: async (id) => await ipcRenderer.invoke('workspace:deleteHistory', id),
    openHistory: async (workspacePath) => await ipcRenderer.invoke('workspace:openHistory', workspacePath)
  },
  // ========== 向量索引管理 ==========
  vector: {
    addOrUpdate: async (filePath, chunkIndex, chunkText, embedding) => 
      await ipcRenderer.invoke('vector:addOrUpdate', { filePath, chunkIndex, chunkText, embedding }),
    getByFile: async (filePath) => await ipcRenderer.invoke('vector:getByFile', filePath),
    deleteByFile: async (filePath) => await ipcRenderer.invoke('vector:deleteByFile', filePath),
    deleteByWorkspace: async (workspacePath) => await ipcRenderer.invoke('vector:deleteByWorkspace', workspacePath),
    getAll: async () => await ipcRenderer.invoke('vector:getAll'),
    clear: async () => await ipcRenderer.invoke('vector:clear'),
    buildIndex: async (rootDir, embeddingModelId) => await ipcRenderer.invoke('vector:buildIndex', { rootDir, embeddingModelId }),
    onIndexProgress: (callback) => {
      ipcRenderer.on('vector:indexProgress', (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('vector:indexProgress');
    }
  },
  // ========== 窗口控制 ==========
  window: {
    minimize: async () => await ipcRenderer.invoke('window:minimize'),
    maximize: async () => await ipcRenderer.invoke('window:maximize'),
    close: async () => await ipcRenderer.invoke('window:close'),
    isMaximized: async () => await ipcRenderer.invoke('window:isMaximized')
  },
  // ========== 一致性校验 ==========
  consistency: {
    check: async (text, workspaceRoot, filePath) => 
      await ipcRenderer.invoke('consistency:check', { text, workspaceRoot, filePath }),
    getAll: async () => await ipcRenderer.invoke('consistency:getAll'),
    getByWorkspace: async (workspacePath) => await ipcRenderer.invoke('consistency:getByWorkspace', workspacePath),
    delete: async (id) => await ipcRenderer.invoke('consistency:delete', id),
    clear: async () => await ipcRenderer.invoke('consistency:clear')
  },
  // ========== Novel Agent 记忆系统 ==========
  memory: {
    init: async (workspaceRoot) => await ipcRenderer.invoke('memory:init', workspaceRoot),
    getSummary: async () => await ipcRenderer.invoke('memory:getSummary'),
    query: async (query) => await ipcRenderer.invoke('memory:query', query),
    addCharacter: async (character) => await ipcRenderer.invoke('memory:addCharacter', character),
    updateCharacter: async (charName, updates) => await ipcRenderer.invoke('memory:updateCharacter', { charName, updates }),
    getAllCharacters: async () => await ipcRenderer.invoke('memory:getAllCharacters'),
    addForeshadow: async (foreshadow) => await ipcRenderer.invoke('memory:addForeshadow', foreshadow),
    getPendingForeshadows: async () => await ipcRenderer.invoke('memory:getPendingForeshadows'),
    addPlotEvent: async (eventData) => await ipcRenderer.invoke('memory:addPlotEvent', eventData),
    updateWorldRules: async (rules) => await ipcRenderer.invoke('memory:updateWorldRules', rules),
    export: async () => await ipcRenderer.invoke('memory:export'),
    import: async (data) => await ipcRenderer.invoke('memory:import', data),
    reset: async () => await ipcRenderer.invoke('memory:reset'),
    extract: async (options) => await ipcRenderer.invoke('memory:extract', options),
    updateFromText: async (text, userRequest, intent) => await ipcRenderer.invoke('memory:updateFromText', { text, userRequest, intent }),
    analyzeChapter: async (filePath, chapterNumber) => await ipcRenderer.invoke('memory:analyzeChapter', { filePath, chapterNumber }),
    onExtractProgress: (callback) => {
      ipcRenderer.on('memory:extract:progress', (event, progress) => callback(progress));
      return () => ipcRenderer.removeAllListeners('memory:extract:progress');
    }
  },
  // ========== Novel Agent 执行 ==========
  novelAgent: {
    init: async (workspaceRoot) => await ipcRenderer.invoke('novelAgent:init', workspaceRoot),
    execute: async (request) => await ipcRenderer.invoke('novelAgent:execute', request),
    getState: async () => await ipcRenderer.invoke('novelAgent:getState'),
    getLog: async (count) => await ipcRenderer.invoke('novelAgent:getLog', count),
    cancel: async () => await ipcRenderer.invoke('novelAgent:cancel'),
    getCurrentTask: async () => await ipcRenderer.invoke('novelAgent:getCurrentTask')
  },
  // ========== 规则管理 ==========
  rules: {
    getAll: async () => await ipcRenderer.invoke('rules:getAll'),
    reload: async () => await ipcRenderer.invoke('rules:reload'),
    getStats: async () => await ipcRenderer.invoke('rules:getStats')
  }
});

