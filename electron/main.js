const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, llmModels, embeddingModels, settings, workspaceHistory, vectorIndex, consistencyResults, closeDatabase } = require('./database');
const { callLLM } = require('./llm');

// Novel Agent 和记忆系统
const AgentOrchestrator = require('./agent/orchestrator');
const MemoryManager = require('./memory');

let mainWindow;
let currentAgent = null; // 当前工作区的 Agent 实例
let currentMemory = null; // 当前工作区的 Memory 实例
let fileWatcher = null; // 文件监听器
let watchedWorkspaceRoot = null; // 当前监听的工作区路径

const isDev = !app.isPackaged;

// 文本分块函数
function splitTextIntoChunks(text, chunkSize = 500) {
  const chunks = [];
  let currentChunk = '';
  
  // 按段落分割
  const paragraphs = text.split(/\n\n+/);
  
  for (const para of paragraphs) {
    if (!para.trim()) continue;
    
    // 如果当前块加上这个段落不超过限制，就加入当前块
    if (currentChunk.length + para.length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      // 否则，保存当前块并开始新块
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      // 如果单个段落太长，进一步分割
      if (para.length > chunkSize) {
        const sentences = para.match(/[^。！？.!?]+[。！？.!?]+/g) || [para];
        let tempChunk = '';
        
        for (const sent of sentences) {
          if (tempChunk.length + sent.length <= chunkSize) {
            tempChunk += sent;
          } else {
            if (tempChunk) {
              chunks.push(tempChunk.trim());
            }
            tempChunk = sent;
          }
        }
        
        if (tempChunk) {
          currentChunk = tempChunk;
        }
      } else {
        currentChunk = para;
      }
    }
  }
  
  // 添加最后一个块
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

// 获取文本的 embedding 向量
async function getEmbedding(model, text) {
  const axios = require('axios');
  
  try {
    // 使用OpenAI兼容的embedding API
    const response = await axios.post(
      `${model.base_url}/embeddings`,
      {
        input: text,
        model: model.model || 'text-embedding-ada-002'
      },
      {
        headers: {
          'Authorization': `Bearer ${model.api_key}`,
          'Content-Type': 'application/json'
        },
        timeout: 6000000
      }
    );
    
    if (response.data && response.data.data && response.data.data[0]) {
      return response.data.data[0].embedding;
    }
    
    throw new Error('Invalid embedding response');
  } catch (err) {
    throw new Error(`Embedding API 调用失败: ${err.message}`);
  }
}

// 计算向量余弦相似度
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

// 搜索最相关的文本块
async function searchSimilarChunks(queryEmbedding, topK = 5) {
  try {
    const allVectors = vectorIndex.getAll();
    
    if (allVectors.length === 0) {
      return [];
    }
    
    // 计算相似度
    const similarities = allVectors.map(vector => ({
      ...vector,
      similarity: cosineSimilarity(queryEmbedding, vector.embedding)
    }));
    
    // 按相似度排序并返回 topK 个结果
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(({ id, file_path, chunk_index, chunk_text, similarity }) => ({
        id,
        filePath: file_path,
        chunkIndex: chunk_index,
        text: chunk_text,
        similarity: similarity.toFixed(4)
      }));
  } catch (err) {
    console.error('搜索相似文本块失败:', err);
    return [];
  }
}

// 递归读取目录下的所有文件和文件夹（排除隐藏文件和系统文件）
function walkDirForAllFiles(dir, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // 跳过隐藏文件和系统文件夹
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '$RECYCLE.BIN') {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 添加文件夹本身
        results.push({ path: fullPath, type: 'folder' });
        // 递归扫描文件夹内容
        walkDirForAllFiles(fullPath, results);
      } else {
        // 添加文件
        results.push({ path: fullPath, type: 'file' });
      }
    }
  } catch (err) {
    console.error('Error reading directory:', dir, err);
  }
  return results;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false, // 无边框窗口
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (isDev) {
    // 开发环境：加载 Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // 开发环境打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载打包后的静态文件
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    console.log('加载文件路径:', indexPath);
    console.log('__dirname:', __dirname);
    console.log('文件是否存在:', require('fs').existsSync(indexPath));
    
    mainWindow.loadFile(indexPath);
    
    // 临时：打开开发者工具查看错误（调试用）
    // mainWindow.webContents.openDevTools();
  }

  // 监听加载失败
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
  });

  // 过滤 DevTools Console 中的 Autofill 错误（Electron 已知兼容性问题）
  mainWindow.webContents.on('console-message', (event, level, message) => {
    // 过滤掉 Autofill 相关的错误信息
    if (message.includes('Autofill.enable') || message.includes('Autofill.setAddresses')) {
      event.preventDefault();
      return;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 初始化数据库
  initDatabase();
  
  createWindow();

  // 打开本地 txt/md 文件
  ipcMain.handle('file:openDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Text/Markdown', extensions: ['txt', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths.length) return null;

    const filePath = result.filePaths[0];
    const content = await fs.promises.readFile(filePath, 'utf-8');

    return {
      path: filePath,
      name: path.basename(filePath),
      content
    };
  });

  // 选择文件夹并返回目录树结构（不读取文件内容，懒加载）
  ipcMain.handle('folder:openDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths.length) return null;

    const rootDir = result.filePaths[0];
    const rootName = path.basename(rootDir);
    const items = walkDirForAllFiles(rootDir);

    const files = items.map((item) => {
      const rel = path.relative(rootDir, item.path);
      return {
        path: item.path,
        name: path.basename(item.path),
        relativePath: rel.replace(/\\/g, '/'),
        type: item.type
      };
    });

    // 保存到历史工作区
    try {
      workspaceHistory.addOrUpdate(rootDir, rootName);
    } catch (err) {
      console.error('保存历史工作区失败:', err);
    }

    return {
      rootDir,
      rootName,
      files
    };
  });

  // 读取单个文件内容（懒加载）
  ipcMain.handle('file:read', async (event, filePath) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 保存文件内容
  ipcMain.handle('file:write', async (event, { filePath, content }) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 新建文件
  ipcMain.handle('file:create', async (event, { filePath, content = '' }) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除文件或文件夹
  ipcMain.handle('file:delete', async (event, filePath) => {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) {
        await fs.promises.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(filePath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 创建文件夹
  ipcMain.handle('folder:create', async (event, folderPath) => {
    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 移动文件或文件夹
  ipcMain.handle('file:move', async (event, { sourcePath, targetPath }) => {
    try {
      // 确保目标文件夹存在
      const targetDir = path.dirname(targetPath);
      await fs.promises.mkdir(targetDir, { recursive: true });
      
      // 移动文件或文件夹
      await fs.promises.rename(sourcePath, targetPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 重命名文件或文件夹
  ipcMain.handle('file:rename', async (event, { oldPath, newPath }) => {
    try {
      await fs.promises.rename(oldPath, newPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 刷新文件夹（重新扫描）
  ipcMain.handle('folder:refresh', async (event, rootDir) => {
    try {
      const items = walkDirForAllFiles(rootDir);
      const files = items.map((item) => {
        const rel = path.relative(rootDir, item.path);
        return {
          path: item.path,
          name: path.basename(item.path),
          relativePath: rel.replace(/\\/g, '/'),
          type: item.type
        };
      });
      return { success: true, files };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ========== LLM 模型管理 ==========
  
  // 获取所有模型
  ipcMain.handle('llm:getAll', async () => {
    try {
      const models = llmModels.getAll();
      return { success: true, models };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 获取默认模型
  ipcMain.handle('llm:getDefault', async () => {
    try {
      const model = llmModels.getDefault();
      return { success: true, model };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 添加模型
  ipcMain.handle('llm:add', async (event, modelData) => {
    try {
      const id = llmModels.add(modelData);
      return { success: true, id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 更新模型
  ipcMain.handle('llm:update', async (event, { id, ...modelData }) => {
    try {
      llmModels.update(id, modelData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 删除模型
  ipcMain.handle('llm:delete', async (event, id) => {
    try {
      llmModels.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 设置默认模型
  ipcMain.handle('llm:setDefault', async (event, id) => {
    try {
      llmModels.setDefault(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 调用 LLM API
  ipcMain.handle('llm:chat', async (event, { modelId, messages, options }) => {
    try {
      const model = modelId ? llmModels.getById(modelId) : llmModels.getDefault();
      
      if (!model) {
        return { success: false, error: '未找到可用的模型配置' };
      }
      
      const config = {
        baseUrl: model.base_url,
        apiKey: model.api_key,
        model: model.model
      };
      
      const response = await callLLM(config, messages, options);
      return { success: true, response };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ========== Embedding 模型管理 ==========
  
  // 获取所有 embedding 模型
  ipcMain.handle('embedding:getAll', async () => {
    try {
      const models = embeddingModels.getAll();
      return { success: true, models };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 获取默认 embedding 模型
  ipcMain.handle('embedding:getDefault', async () => {
    try {
      const model = embeddingModels.getDefault();
      return { success: true, model };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 添加 embedding 模型
  ipcMain.handle('embedding:add', async (event, modelData) => {
    try {
      const id = embeddingModels.add(modelData);
      return { success: true, id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 更新 embedding 模型
  ipcMain.handle('embedding:update', async (event, { id, ...modelData }) => {
    try {
      embeddingModels.update(id, modelData);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 删除 embedding 模型
  ipcMain.handle('embedding:delete', async (event, id) => {
    try {
      embeddingModels.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 设置默认 embedding 模型
  ipcMain.handle('embedding:setDefault', async (event, id) => {
    try {
      embeddingModels.setDefault(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ========== 历史工作区管理 ==========
  
  // 获取所有历史工作区
  ipcMain.handle('workspace:getHistory', async () => {
    try {
      const history = workspaceHistory.getAll();
      return { success: true, history };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 删除历史工作区
  ipcMain.handle('workspace:deleteHistory', async (event, id) => {
    try {
      workspaceHistory.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 打开历史工作区
  ipcMain.handle('workspace:openHistory', async (event, workspacePath) => {
    try {
      // 检查路径是否存在
      if (!fs.existsSync(workspacePath)) {
        return { success: false, error: '工作区路径不存在' };
      }
      
      const rootDir = workspacePath;
      const rootName = path.basename(rootDir);
      const items = walkDirForAllFiles(rootDir);

      const files = items.map((item) => {
        const rel = path.relative(rootDir, item.path);
        return {
          path: item.path,
          name: path.basename(item.path),
          relativePath: rel.replace(/\\/g, '/'),
          type: item.type
        };
      });

      // 更新最后打开时间
      workspaceHistory.addOrUpdate(rootDir, rootName);

      return {
        success: true,
        data: {
          rootDir,
          rootName,
          files
        }
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ========== 向量索引管理 ==========
  
  // 添加或更新向量索引
  ipcMain.handle('vector:addOrUpdate', async (event, { filePath, chunkIndex, chunkText, embedding }) => {
    try {
      vectorIndex.addOrUpdate(filePath, chunkIndex, chunkText, embedding);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 获取文件的所有向量
  ipcMain.handle('vector:getByFile', async (event, filePath) => {
    try {
      const vectors = vectorIndex.getByFile(filePath);
      return { success: true, vectors };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 删除文件的向量索引
  ipcMain.handle('vector:deleteByFile', async (event, filePath) => {
    try {
      vectorIndex.deleteByFile(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 删除工作区的所有向量索引
  ipcMain.handle('vector:deleteByWorkspace', async (event, workspacePath) => {
    try {
      vectorIndex.deleteByWorkspace(workspacePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 获取所有向量索引
  ipcMain.handle('vector:getAll', async () => {
    try {
      const vectors = vectorIndex.getAll();
      return { success: true, vectors };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 清空所有向量索引
  ipcMain.handle('vector:clear', async () => {
    try {
      vectorIndex.clear();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // ========== 窗口控制 ==========
  
  // 最小化窗口
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });
  
  // 最大化/还原窗口
  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });
  
  // 关闭窗口
  ipcMain.handle('window:close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });
  
  // 检查窗口是否最大化
  ipcMain.handle('window:isMaximized', () => {
    if (mainWindow) {
      return mainWindow.isMaximized();
    }
    return false;
  });

  // 一致性校验
  ipcMain.handle('consistency:check', async (event, { text, workspaceRoot, filePath }) => {
    try {
      // 1. 获取 Embedding 模型
      const embeddingModel = embeddingModels.getDefault();
      if (!embeddingModel) {
        return { success: false, error: '未配置 Embedding 模型，请先在设置中添加' };
      }
      
      // 2. 获取 LLM 模型
      const llmModel = llmModels.getDefault();
      if (!llmModel) {
        return { success: false, error: '未配置 LLM 模型，请先在设置中添加' };
      }
      
      // 3. 生成文本的 embedding
      const queryEmbedding = await getEmbedding(embeddingModel, text);
      
      // 4. 搜索相关内容（从向量索引中）
      const similarChunks = await searchSimilarChunks(queryEmbedding, 5);
      
      // 5. 读取 MD 提示文件（如果有）
      let promptContent = '';
      if (workspaceRoot) {
        const items = walkDirForAllFiles(workspaceRoot);
        const mdFile = items.find(item => {
          if (item.type !== 'file') return false;
          const name = path.basename(item.path).toLowerCase();
          return name.endsWith('.md') && (
            name.includes('prompt') || 
            name.includes('提示') || 
            name.includes('设定') || 
            name.includes('世界观')
          );
        });
        
        if (mdFile) {
          try {
            promptContent = await fs.promises.readFile(mdFile.path, 'utf-8');
          } catch (e) {
            console.error('读取提示文件失败:', e);
          }
        }
      }
      
      // 6. 构建校验提示词
      let checkPrompt = `你是一个专业的小说创作顾问，负责检查文本的一致性。请仔细分析以下内容，找出可能存在的问题：

【待检查的文本】
${text}

`;
      
      if (promptContent) {
        checkPrompt += `【世界观和设定】
${promptContent}

`;
      }
      
      if (similarChunks.length > 0) {
        checkPrompt += `【相关的已有内容】（从整个作品中检索到的相关段落）
${similarChunks.map((chunk, idx) => 
  `${idx + 1}. 来自 ${path.basename(chunk.filePath)}:\n${chunk.text}\n`
).join('\n')}

`;
      }
      
      checkPrompt += `请从以下几个方面进行一致性校验：

1. **时间冲突**：检查时间线是否合理，是否有前后矛盾的时间描述
2. **人物冲突**：检查人物性格、能力、背景是否与设定一致，是否出现了不该出现的人物
3. **世界观冲突**：检查是否符合世界观设定，是否出现了不该有的事物或技术
4. **情节合理性**：检查情节发展是否合理，是否有逻辑漏洞
5. **前后矛盾**：检查是否与之前的内容存在矛盾

请按以下格式输出：

## 检查结果

【总体评价】
（简要说明整体一致性如何）

【发现的问题】
（如果有问题，请详细列出；如果没有问题，说明"未发现明显问题"）

1. 问题类型：xxx
   - 具体描述：xxx
   - 建议修改：xxx

【优点】
（列出文本中做得好的地方）

请务必基于提供的设定和相关内容进行判断，如果没有足够信息则说明"信息不足，无法判断"。`;
      
      // 7. 调用 LLM 进行分析
      const config = {
        baseUrl: llmModel.base_url,
        apiKey: llmModel.api_key,
        model: llmModel.model
      };
      
      const response = await callLLM(
        config,
        [
          { role: 'system', content: '你是一个专业的小说创作顾问，擅长一致性校验和内容审查。' },
          { role: 'user', content: checkPrompt }
        ],
        { temperature: 0.3, maxTokens: 2000 }
      );
      
      const contextInfo = {
        hasPromptFile: !!promptContent,
        relatedChunksCount: similarChunks.length,
        similarChunks: similarChunks.map(c => ({
          file: path.basename(c.filePath),
          similarity: c.similarity
        }))
      };
      
      // 8. 保存校验结果到数据库
      try {
        consistencyResults.add({
          workspacePath: workspaceRoot || null,
          filePath: filePath || null,
          checkedText: text.length > 1000 ? text.substring(0, 1000) + '...' : text, // 限制保存的文本长度
          result: response,
          contextInfo: contextInfo
        });
      } catch (dbErr) {
        console.error('保存校验结果到数据库失败:', dbErr);
      }
      
      return {
        success: true,
        result: response,
        contextInfo: contextInfo
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ========== 校验结果管理 ==========
  
  // 获取所有校验结果
  ipcMain.handle('consistency:getAll', async () => {
    try {
      const results = consistencyResults.getAll();
      return { success: true, results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 获取工作区的校验结果
  ipcMain.handle('consistency:getByWorkspace', async (event, workspacePath) => {
    try {
      const results = consistencyResults.getByWorkspace(workspacePath);
      return { success: true, results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 删除校验结果
  ipcMain.handle('consistency:delete', async (event, id) => {
    try {
      consistencyResults.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // 清空所有校验结果
  ipcMain.handle('consistency:clear', async () => {
    try {
      consistencyResults.clear();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 构建工作区的向量索引
  ipcMain.handle('vector:buildIndex', async (event, { rootDir, embeddingModelId }) => {
    try {
      // 获取Embedding模型配置
      const model = embeddingModelId ? embeddingModels.getById(embeddingModelId) : embeddingModels.getDefault();
      
      if (!model) {
        return { success: false, error: '未找到可用的 Embedding 模型配置，请先在设置中添加' };
      }
      
      // 收集所有txt文件
      const items = walkDirForAllFiles(rootDir);
      const txtFiles = items
        .filter(item => item.type === 'file' && item.path.toLowerCase().endsWith('.txt'))
        .map(item => item.path);
      
      if (txtFiles.length === 0) {
        return { success: true, message: '没有找到txt文件', indexed: 0, total: 0 };
      }
      
      let indexed = 0;
      const errors = [];
      
      // 处理每个txt文件
      for (const filePath of txtFiles) {
        try {
          // 读取文件内容
          const content = await fs.promises.readFile(filePath, 'utf-8');
          
          // 分块（每500字符一块，可以调整）
          const chunks = splitTextIntoChunks(content, 500);
          
          // 为每个块生成embedding
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            try {
              // 调用embedding API
              const embedding = await getEmbedding(model, chunk);
              
              // 存储到数据库
              vectorIndex.addOrUpdate(filePath, i, chunk, embedding);
            } catch (embErr) {
              console.error(`为文件 ${filePath} 的块 ${i} 生成embedding失败:`, embErr);
              errors.push(`${path.basename(filePath)}[块${i}]: ${embErr.message}`);
            }
          }
          
          indexed++;
          
          // 发送进度更新
          mainWindow.webContents.send('vector:indexProgress', {
            current: indexed,
            total: txtFiles.length,
            file: path.basename(filePath)
          });
          
        } catch (fileErr) {
          console.error(`处理文件 ${filePath} 失败:`, fileErr);
          errors.push(`${path.basename(filePath)}: ${fileErr.message}`);
        }
      }
      
      return {
        success: true,
        indexed,
        total: txtFiles.length,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ==================== Novel Agent 记忆系统 IPC ====================
  
  // 初始化记忆系统
  ipcMain.handle('memory:init', async (event, workspaceRoot) => {
    try {
      if (!workspaceRoot) {
        return { success: false, error: '工作区路径不能为空' };
      }

      currentMemory = new MemoryManager(workspaceRoot);
      
      // 设置向量索引（如果可用）
      try {
        if (vectorIndex && workspaceRoot) {
          currentMemory.setVectorIndex(vectorIndex);
          console.log('✅ 已设置向量索引');
        }
      } catch (err) {
        console.warn('⚠️ 设置向量索引失败:', err.message);
      }
      
      // 获取 LLM 配置（用于智能提取）
      let llmConfig = null;
      try {
        const defaultModel = llmModels.getDefault();
        if (defaultModel && defaultModel.base_url && defaultModel.api_key && defaultModel.model) {
          llmConfig = {
            baseUrl: defaultModel.base_url,
            apiKey: defaultModel.api_key,
            model: defaultModel.model
          };
          console.log(`🤖 使用 LLM 模型进行智能提取: ${defaultModel.name || defaultModel.id}`);
        } else {
          console.log('ℹ️ LLM 模型配置不完整，跳过智能提取');
        }
      } catch (err) {
        console.warn('⚠️ 获取 LLM 配置失败，将跳过智能提取:', err.message);
      }
      
      const result = await currentMemory.initialize(llmConfig);
      
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取记忆摘要
  ipcMain.handle('memory:getSummary', async () => {
    try {
      if (!currentMemory) {
        return { success: false, error: '记忆系统不存在，请先打开工作区' };
      }

      // 如果未初始化，返回空摘要而不是错误
      if (!currentMemory.initialized) {
        return { 
          success: true, 
          summary: {
            world: { has_cultivation_system: false, has_magic_system: false, custom_rules_count: 0 },
            character: { total_characters: 0, main_characters: 0 },
            plot: { current_stage: '未知', completed_events_count: 0, pending_goals_count: 0 },
            foreshadow: { total: 0, pending: 0, revealed: 0, resolved: 0 }
          }
        };
      }

      const summary = await currentMemory.getSummary();
      return { success: true, summary };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 查询记忆
  ipcMain.handle('memory:query', async (event, query) => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      const results = await currentMemory.query(query);
      return { success: true, results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 添加角色
  ipcMain.handle('memory:addCharacter', async (event, character) => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      const charId = await currentMemory.character.addCharacter(character);
      return { success: true, id: charId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 更新角色状态
  ipcMain.handle('memory:updateCharacter', async (event, { charName, updates }) => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      await currentMemory.character.updateCharacterState(charName, updates);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取所有角色
  ipcMain.handle('memory:getAllCharacters', async () => {
    try {
      if (!currentMemory) {
        return { success: true, characters: [] };
      }

      // 如果未初始化，返回空数组
      if (!currentMemory.initialized) {
        return { success: true, characters: [] };
      }

      const characters = currentMemory.character.getAllCharacters();
      return { success: true, characters };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 添加伏笔
  ipcMain.handle('memory:addForeshadow', async (event, foreshadow) => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      const id = await currentMemory.foreshadow.addForeshadow(foreshadow);
      return { success: true, id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取待处理的伏笔
  ipcMain.handle('memory:getPendingForeshadows', async () => {
    try {
      if (!currentMemory) {
        return { success: true, foreshadows: [] };
      }

      // 如果未初始化，返回空数组
      if (!currentMemory.initialized) {
        return { success: true, foreshadows: [] };
      }

      const foreshadows = currentMemory.foreshadow.getPendingForeshadows();
      return { success: true, foreshadows };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 添加剧情事件
  ipcMain.handle('memory:addPlotEvent', async (event, eventData) => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      const eventId = await currentMemory.plot.addCompletedEvent(eventData);
      return { success: true, id: eventId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 更新世界规则
  ipcMain.handle('memory:updateWorldRules', async (event, rules) => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      await currentMemory.world.updateRules(rules);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 导出记忆
  ipcMain.handle('memory:export', async () => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      const data = await currentMemory.exportAll();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 导入记忆
  ipcMain.handle('memory:import', async (event, data) => {
    try {
      if (!currentMemory || !currentMemory.initialized) {
        return { success: false, error: '记忆系统未初始化' };
      }

      const result = await currentMemory.importAll(data);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 重置记忆
  ipcMain.handle('memory:reset', async () => {
    try {
      // 允许重置未初始化的系统（用于清理状态）
      if (!currentMemory) {
        return { success: false, error: '记忆系统不存在' };
      }

      await currentMemory.resetAll();
      // 重置后，currentMemory 仍然存在，但 initialized 为 false
      // 需要重新调用 initialize 才能使用
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 手动触发智能提取
  ipcMain.handle('memory:extract', async (event, options = {}) => {
    try {
      // 如果未初始化，尝试自动初始化
      if (!currentMemory) {
        return { success: false, error: '记忆系统不存在，请先打开工作区' };
      }

      if (!currentMemory.initialized) {
        // 尝试自动初始化
        const workspaceRoot = currentMemory.workspaceRoot;
        if (!workspaceRoot) {
          return { success: false, error: '工作区路径为空，无法初始化' };
        }

        console.log('🔄 记忆系统未初始化，尝试自动初始化...');
        
        // 获取 LLM 配置
        let llmConfig = null;
        try {
          const defaultModel = llmModels.getDefault();
          if (defaultModel && defaultModel.base_url && defaultModel.api_key && defaultModel.model) {
            llmConfig = {
              baseUrl: defaultModel.base_url,
              apiKey: defaultModel.api_key,
              model: defaultModel.model
            };
          }
        } catch (err) {
          console.warn('⚠️ 获取 LLM 配置失败:', err.message);
        }

        const initResult = await currentMemory.initialize(llmConfig);
        if (!initResult.success) {
          return { success: false, error: '自动初始化失败: ' + initResult.error };
        }

        // 初始化成功后，启动文件监听
        startFileWatcher(workspaceRoot);
      }

      // 获取 LLM 配置
      let llmConfig = null;
      try {
        const defaultModel = llmModels.getDefault();
        if (defaultModel && defaultModel.base_url && defaultModel.api_key && defaultModel.model) {
          llmConfig = {
            baseUrl: defaultModel.base_url,
            apiKey: defaultModel.api_key,
            model: defaultModel.model
          };
        }
      } catch (err) {
        return { success: false, error: 'LLM 配置获取失败: ' + err.message };
      }

      if (!llmConfig) {
        return { success: false, error: 'LLM 未配置' };
      }

      currentMemory.setLLMConfig(llmConfig);

      // 设置向量索引
      if (vectorIndex) {
        currentMemory.setVectorIndex(vectorIndex);
      }

      // 执行智能提取
      const result = await currentMemory.intelligentExtract({
        chapterBatchSize: options.chapterBatchSize || 5,
        maxChapters: options.maxChapters || 0,
        forceRescan: options.forceRescan || false, // 支持强制重新扫描
        onProgress: (progress) => {
          // 通过事件发送进度更新
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('memory:extract:progress', progress);
          }
        }
      });

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ==================== Novel Agent 执行 IPC ====================

  // LLM 调用包装器（供 Agent 使用）
  const createLLMCaller = () => {
    return async ({ systemPrompt, userPrompt, temperature, maxTokens, topP }) => {
      try {
        const model = llmModels.getDefault();
        if (!model) {
          throw new Error('未找到可用的模型配置');
        }

        const config = {
          baseUrl: model.base_url,
          apiKey: model.api_key,
          model: model.model
        };

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];

        const response = await callLLM(config, messages, {
          temperature: temperature || 0.3,
          maxTokens: maxTokens || 2000,
          topP: topP || 0.95
        });

        return { success: true, response };
      } catch (err) {
        return { success: false, error: err.message };
      }
    };
  };

  // 初始化 Novel Agent
  ipcMain.handle('novelAgent:init', async (event, workspaceRoot) => {
    try {
      if (!workspaceRoot) {
        return { success: false, error: '工作区路径不能为空' };
      }

      currentAgent = new AgentOrchestrator(workspaceRoot);
      const result = await currentAgent.initialize();
      
      // 同时初始化记忆系统（如果还没初始化）
      if (!currentMemory || currentMemory.workspaceRoot !== workspaceRoot) {
        currentMemory = currentAgent.memory;
      }

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 执行 Agent 任务
  ipcMain.handle('novelAgent:execute', async (event, request) => {
    try {
      if (!currentAgent || !currentAgent.initialized) {
        return { success: false, error: 'Agent 未初始化，请先初始化' };
      }

      const llmCaller = createLLMCaller();
      const result = await currentAgent.execute(request, llmCaller);
      
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取 Agent 状态
  ipcMain.handle('novelAgent:getState', async () => {
    try {
      if (!currentAgent) {
        return { success: false, error: 'Agent 未初始化' };
      }

      const state = currentAgent.getState();
      return { success: true, state };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取执行日志
  ipcMain.handle('novelAgent:getLog', async (event, count = 10) => {
    try {
      if (!currentAgent) {
        return { success: false, error: 'Agent 未初始化' };
      }

      const log = currentAgent.getExecutionLog(count);
      return { success: true, log };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 取消 Agent 执行
  ipcMain.handle('novelAgent:cancel', async () => {
    try {
      if (!currentAgent) {
        return { success: false, error: 'Agent 未初始化' };
      }

      currentAgent.cancel();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取当前任务
  ipcMain.handle('novelAgent:getCurrentTask', async () => {
    try {
      if (!currentAgent) {
        return { success: false, error: 'Agent 未初始化' };
      }

      const task = currentAgent.getCurrentTask();
      return { success: true, task };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ==================== 规则管理 IPC ====================

  // 获取所有规则
  ipcMain.handle('rules:getAll', async () => {
    try {
      if (!currentAgent || !currentAgent.ruleEngine) {
        return { success: false, error: 'Agent 未初始化或规则引擎不可用' };
      }

      const rules = currentAgent.ruleEngine.getAllRules();
      return { success: true, rules };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 重新加载规则
  ipcMain.handle('rules:reload', async () => {
    try {
      if (!currentAgent || !currentAgent.ruleEngine) {
        return { success: false, error: 'Agent 未初始化或规则引擎不可用' };
      }

      const result = await currentAgent.ruleEngine.reload();
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取规则统计
  ipcMain.handle('rules:getStats', async () => {
    try {
      if (!currentAgent || !currentAgent.ruleEngine) {
        return { success: false, error: 'Agent 未初始化或规则引擎不可用' };
      }

      const stats = currentAgent.ruleEngine.getStatistics();
      return { success: true, stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopFileWatcher(); // 停止文件监听
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});

