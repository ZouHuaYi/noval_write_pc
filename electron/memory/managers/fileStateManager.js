/**
 * File State Manager - 文件状态管理器
 * 跟踪文件修改时间，实现增量更新
 */

const fs = require('fs');
const path = require('path');

class FileStateManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.stateFile = path.join(workspaceRoot, '.novel-memory', 'file-states.json');
    this.states = this.loadStates();
  }

  /**
   * 加载文件状态
   */
  loadStates() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const content = fs.readFileSync(this.stateFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn('⚠️ 加载文件状态失败:', err.message);
    }
    return {};
  }

  /**
   * 保存文件状态
   */
  saveStates() {
    try {
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.stateFile, JSON.stringify(this.states, null, 2), 'utf-8');
    } catch (err) {
      console.error('❌ 保存文件状态失败:', err.message);
    }
  }

  /**
   * 获取文件修改时间
   */
  getFileMtime(filepath) {
    try {
      const stats = fs.statSync(filepath);
      return stats.mtime.getTime();
    } catch (err) {
      return 0;
    }
  }

  /**
   * 检查文件是否需要处理
   * @param {string} filepath - 文件路径
   * @returns {boolean} 是否需要处理
   */
  needsProcessing(filepath) {
    const relativePath = path.relative(this.workspaceRoot, filepath);
    const currentMtime = this.getFileMtime(filepath);
    const savedMtime = this.states[relativePath]?.mtime || 0;

    return currentMtime > savedMtime;
  }

  /**
   * 更新文件状态
   * @param {string} filepath - 文件路径
   * @param {object} metadata - 元数据（可选）
   */
  updateFileState(filepath, metadata = {}) {
    const relativePath = path.relative(this.workspaceRoot, filepath);
    const currentMtime = this.getFileMtime(filepath);

    this.states[relativePath] = {
      mtime: currentMtime,
      processedAt: new Date().toISOString(),
      ...metadata
    };

    this.saveStates();
  }

  /**
   * 获取所有已处理的文件
   */
  getProcessedFiles() {
    return Object.keys(this.states);
  }

  /**
   * 清除文件状态（用于重新处理）
   */
  clearState(filepath) {
    const relativePath = path.relative(this.workspaceRoot, filepath);
    delete this.states[relativePath];
    this.saveStates();
  }

  /**
   * 清除所有状态
   */
  clearAllStates() {
    this.states = {};
    this.saveStates();
  }
}

module.exports = FileStateManager;

