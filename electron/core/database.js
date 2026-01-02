const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

// 初始化数据库
function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'novel-ide.db');
  
  console.log('数据库路径:', dbPath);
  
  db = new Database(dbPath);
  
  // 创建 LLM 模型配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      max_tokens INTEGER DEFAULT 2000,
      temperature REAL DEFAULT 0.7,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 添加新字段（如果不存在）
  try {
    db.exec(`ALTER TABLE llm_models ADD COLUMN max_tokens INTEGER DEFAULT 2000`);
  } catch (e) {
    // 字段已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE llm_models ADD COLUMN temperature REAL DEFAULT 0.7`);
  } catch (e) {
    // 字段已存在，忽略错误
  }
  
  // 创建 Embedding 模型配置表（用于向量化）
  db.exec(`
    CREATE TABLE IF NOT EXISTS embedding_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建历史工作区表
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      last_opened DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建向量索引表（用于存储文本块的向量）
  db.exec(`
    CREATE TABLE IF NOT EXISTS vector_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(file_path, chunk_index)
    )
  `);
  
  // 创建校验结果表（用于存储一致性校验历史）
  db.exec(`
    CREATE TABLE IF NOT EXISTS consistency_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_path TEXT,
      file_path TEXT,
      checked_text TEXT NOT NULL,
      result TEXT NOT NULL,
      context_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('数据库初始化完成');
  
  return db;
}

// 获取数据库实例
function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

// LLM 模型相关操作
const llmModels = {
  // 获取所有模型
  getAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM llm_models ORDER BY is_default DESC, created_at DESC').all();
  },
  
  // 根据 ID 获取模型
  getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM llm_models WHERE id = ?').get(id);
  },
  
  // 获取默认模型
  getDefault() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM llm_models WHERE is_default = 1').get();
  },
  
  // 添加模型
  add({ name, apiKey, baseUrl, model, maxTokens = 2000, temperature = 0.7, isDefault = false }) {
    const db = getDatabase();
    
    // 如果设置为默认，先取消其他模型的默认状态
    if (isDefault) {
      db.prepare('UPDATE llm_models SET is_default = 0').run();
    }
    
    const result = db.prepare(`
      INSERT INTO llm_models (name, api_key, base_url, model, max_tokens, temperature, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, apiKey, baseUrl, model, maxTokens, temperature, isDefault ? 1 : 0);
    
    return result.lastInsertRowid;
  },
  
  // 更新模型
  update(id, { name, apiKey, baseUrl, model, maxTokens = 2000, temperature = 0.7, isDefault }) {
    const db = getDatabase();
    
    // 如果设置为默认，先取消其他模型的默认状态
    if (isDefault) {
      db.prepare('UPDATE llm_models SET is_default = 0').run();
    }
    
    db.prepare(`
      UPDATE llm_models 
      SET name = ?, api_key = ?, base_url = ?, model = ?, max_tokens = ?, temperature = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, apiKey, baseUrl, model, maxTokens, temperature, isDefault ? 1 : 0, id);
    
    return true;
  },
  
  // 删除模型
  delete(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM llm_models WHERE id = ?').run(id);
    return true;
  },
  
  // 设置默认模型
  setDefault(id) {
    const db = getDatabase();
    db.prepare('UPDATE llm_models SET is_default = 0').run();
    db.prepare('UPDATE llm_models SET is_default = 1 WHERE id = ?').run(id);
    return true;
  }
};

// 设置相关操作
const settings = {
  get(key) {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  
  set(key, value) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, value);
    return true;
  }
};

// 历史工作区相关操作
const workspaceHistory = {
  // 获取所有历史工作区（按最后打开时间倒序）
  getAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM workspace_history ORDER BY last_opened DESC').all();
  },
  
  // 添加或更新工作区
  addOrUpdate(path, name) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO workspace_history (path, name, last_opened)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(path) DO UPDATE SET 
        name = ?,
        last_opened = CURRENT_TIMESTAMP
    `).run(path, name, name);
    return true;
  },
  
  // 删除工作区（同时删除关联的向量索引）
  delete(id) {
    const db = getDatabase();
    // 先获取工作区路径
    const workspace = db.prepare('SELECT path FROM workspace_history WHERE id = ?').get(id);
    
    if (workspace && workspace.path) {
      // 删除该工作区的所有向量索引
      vectorIndex.deleteByWorkspace(workspace.path);
    }
    
    // 删除工作区记录
    db.prepare('DELETE FROM workspace_history WHERE id = ?').run(id);
    return true;
  },
  
  // 清空所有历史
  clear() {
    const db = getDatabase();
    db.prepare('DELETE FROM workspace_history').run();
    return true;
  }
};

// Embedding 模型相关操作
const embeddingModels = {
  // 获取所有模型
  getAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM embedding_models ORDER BY is_default DESC, created_at DESC').all();
  },
  
  // 根据 ID 获取模型
  getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM embedding_models WHERE id = ?').get(id);
  },
  
  // 获取默认模型
  getDefault() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM embedding_models WHERE is_default = 1').get();
  },
  
  // 添加模型
  add({ name, apiKey, baseUrl, model, isDefault = false }) {
    const db = getDatabase();
    
    // 如果设置为默认，先取消其他模型的默认状态
    if (isDefault) {
      db.prepare('UPDATE embedding_models SET is_default = 0').run();
    }
    
    const result = db.prepare(`
      INSERT INTO embedding_models (name, api_key, base_url, model, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, apiKey, baseUrl, model, isDefault ? 1 : 0);
    
    return result.lastInsertRowid;
  },
  
  // 更新模型
  update(id, { name, apiKey, baseUrl, model, isDefault }) {
    const db = getDatabase();
    
    // 如果设置为默认，先取消其他模型的默认状态
    if (isDefault) {
      db.prepare('UPDATE embedding_models SET is_default = 0').run();
    }
    
    db.prepare(`
      UPDATE embedding_models 
      SET name = ?, api_key = ?, base_url = ?, model = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, apiKey, baseUrl, model, isDefault ? 1 : 0, id);
    
    return true;
  },
  
  // 删除模型
  delete(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM embedding_models WHERE id = ?').run(id);
    return true;
  },
  
  // 设置默认模型
  setDefault(id) {
    const db = getDatabase();
    db.prepare('UPDATE embedding_models SET is_default = 0').run();
    db.prepare('UPDATE embedding_models SET is_default = 1 WHERE id = ?').run(id);
    return true;
  }
};

// 向量索引相关操作
const vectorIndex = {
  // 添加或更新文本块的向量
  addOrUpdate(filePath, chunkIndex, chunkText, embedding) {
    const db = getDatabase();
    const embeddingJson = JSON.stringify(embedding);
    db.prepare(`
      INSERT INTO vector_index (file_path, chunk_index, chunk_text, embedding)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(file_path, chunk_index) DO UPDATE SET 
        chunk_text = ?,
        embedding = ?,
        created_at = CURRENT_TIMESTAMP
    `).run(filePath, chunkIndex, chunkText, embeddingJson, chunkText, embeddingJson);
    return true;
  },
  
  // 获取某个文件的所有向量
  getByFile(filePath) {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM vector_index WHERE file_path = ? ORDER BY chunk_index').all(filePath);
    return rows.map(row => ({
      ...row,
      embedding: JSON.parse(row.embedding)
    }));
  },
  
  // 删除某个文件的所有向量
  deleteByFile(filePath) {
    const db = getDatabase();
    db.prepare('DELETE FROM vector_index WHERE file_path = ?').run(filePath);
    return true;
  },
  
  // 删除某个工作区的所有向量（文件路径以工作区路径开头）
  deleteByWorkspace(workspacePath) {
    const db = getDatabase();
    // 使用 LIKE 查询删除所有以工作区路径开头的文件
    db.prepare('DELETE FROM vector_index WHERE file_path LIKE ?').run(workspacePath + '%');
    return true;
  },
  
  // 获取所有向量（用于搜索）
  getAll() {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM vector_index ORDER BY file_path, chunk_index').all();
    return rows.map(row => ({
      ...row,
      embedding: JSON.parse(row.embedding)
    }));
  },
  
  // 清空所有向量索引
  clear() {
    const db = getDatabase();
    db.prepare('DELETE FROM vector_index').run();
    return true;
  }
};

// 校验结果相关操作
const consistencyResults = {
  // 添加校验结果
  add({ workspacePath, filePath, checkedText, result, contextInfo }) {
    const db = getDatabase();
    const result_ = db.prepare(`
      INSERT INTO consistency_results (workspace_path, file_path, checked_text, result, context_info)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      workspacePath || null, 
      filePath || null, 
      checkedText, 
      result, 
      contextInfo ? JSON.stringify(contextInfo) : null
    );
    return result_.lastInsertRowid;
  },
  
  // 获取所有校验结果（按时间倒序）
  getAll() {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM consistency_results ORDER BY created_at DESC').all();
    return rows.map(row => ({
      ...row,
      context_info: row.context_info ? JSON.parse(row.context_info) : null
    }));
  },
  
  // 获取某个工作区的校验结果
  getByWorkspace(workspacePath) {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM consistency_results WHERE workspace_path = ? ORDER BY created_at DESC').all(workspacePath);
    return rows.map(row => ({
      ...row,
      context_info: row.context_info ? JSON.parse(row.context_info) : null
    }));
  },
  
  // 获取某个文件的校验结果
  getByFile(filePath) {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM consistency_results WHERE file_path = ? ORDER BY created_at DESC').all(filePath);
    return rows.map(row => ({
      ...row,
      context_info: row.context_info ? JSON.parse(row.context_info) : null
    }));
  },
  
  // 删除指定校验结果
  delete(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM consistency_results WHERE id = ?').run(id);
    return true;
  },
  
  // 清空所有校验结果
  clear() {
    const db = getDatabase();
    db.prepare('DELETE FROM consistency_results').run();
    return true;
  },
  
  // 删除某个工作区的所有校验结果
  deleteByWorkspace(workspacePath) {
    const db = getDatabase();
    db.prepare('DELETE FROM consistency_results WHERE workspace_path = ?').run(workspacePath);
    return true;
  }
};

// 关闭数据库
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  llmModels,
  embeddingModels,
  settings,
  workspaceHistory,
  vectorIndex,
  consistencyResults,
  closeDatabase
};

