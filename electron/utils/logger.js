/**
 * 统一日志管理器
 * 负责整理 Agent 日志和记录模型请求/响应
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.workspaceRoot = null;
    this.logDir = null;
    this.agentLogs = []; // Agent 执行日志（内存中）
    this.maxAgentLogs = 200; // 最多保留200条 Agent 日志
    
    // 日志级别
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    
    this.currentLevel = this.levels.INFO;
  }

  /**
   * 初始化日志系统
   * @param {string} workspaceRoot - 工作区根目录
   */
  initialize(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    
    // 创建日志目录：工作区/.novel-agent/logs
    this.logDir = path.join(workspaceRoot, '.novel-agent', 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // 清理旧的 Agent 日志
    this.agentLogs = [];
    
    console.log(`📝 日志系统已初始化: ${this.logDir}`);
  }

  /**
   * 获取当前日志文件路径（按日期和小时）
   * @returns {string} 日志文件路径
   */
  getLogFilePath() {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hour = String(now.getHours()).padStart(2, '0'); // HH
    
    const dateDir = path.join(this.logDir, date);
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }
    
    return path.join(dateDir, `${hour}.txt`);
  }

  /**
   * 写入日志到文件
   * @param {string} content - 日志内容
   */
  writeToFile(content) {
    try {
      const logFile = this.getLogFilePath();
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${content}\n`;
      
      fs.appendFileSync(logFile, logEntry, 'utf-8');
    } catch (error) {
      console.error('写入日志文件失败:', error.message);
    }
  }

  /**
   * 记录 Agent 日志（整理后的格式）
   * @param {string} action - 操作名称
   * @param {Object} data - 数据
   * @param {string} state - 状态
   */
  logAgent(action, data = {}, state = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      state: state || 'UNKNOWN',
      action,
      data: this.sanitizeData(data) // 清理数据，移除敏感信息
    };

    // 添加到内存日志
    this.agentLogs.push(logEntry);
    
    // 限制日志大小
    if (this.agentLogs.length > this.maxAgentLogs) {
      this.agentLogs = this.agentLogs.slice(-this.maxAgentLogs);
    }

    // 格式化输出到控制台（简化版，只显示重要信息）
    const dataStr = Object.keys(data).length > 0 
      ? ` | ${JSON.stringify(data).substring(0, 100)}` 
      : '';
    
    // 根据状态选择日志级别
    if (state === 'ERROR' || action.includes('失败') || action.includes('错误')) {
      console.error(`[Agent] ❌ ${action}${dataStr}`);
    } else if (action.includes('完成') || action.includes('成功')) {
      console.log(`[Agent] ✅ ${action}${dataStr}`);
    } else {
      console.log(`[Agent] ℹ️ ${action}${dataStr}`);
    }
  }

  /**
   * 记录模型请求和响应
   * @param {Object} request - 请求信息
   * @param {Object} response - 响应信息
   * @param {number} duration - 耗时（毫秒）
   */
  logLLMRequest(request, response, duration = null) {
    try {
      const logContent = {
        type: 'LLM_REQUEST',
        timestamp: new Date().toISOString(),
        request: {
          model: request.model || 'unknown',
          baseUrl: request.baseUrl || 'unknown',
          messages: this.sanitizeMessages(request.messages || []),
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          // 不记录 API Key
        },
        response: {
          success: response.success || false,
          content: response.content ? this.truncateText(response.content, 500) : null,
          error: response.error || null,
          usage: response.usage || null
        },
        duration: duration ? `${duration}ms` : null
      };

      // 写入文件
      const logText = this.formatLLMLog(logContent);
      this.writeToFile(logText);

      // 控制台输出（简化）
      const status = response.success ? '✅' : '❌';
      const model = request.model || 'unknown';
      const durationStr = duration ? ` (${duration}ms)` : '';
      console.log(`${status} [LLM] ${model}${durationStr}`);
      
      if (!response.success && response.error) {
        console.error(`  错误: ${response.error}`);
      }
    } catch (error) {
      console.error('记录 LLM 日志失败:', error.message);
    }
  }

  /**
   * 格式化 LLM 日志
   * @param {Object} logContent - 日志内容
   * @returns {string} 格式化后的日志文本
   */
  formatLLMLog(logContent) {
    const lines = [];
    lines.push('='.repeat(80));
    lines.push(`[${logContent.type}] ${logContent.timestamp}`);
    lines.push('-'.repeat(80));
    
    // 请求信息
    lines.push('📤 请求:');
    lines.push(`  模型: ${logContent.request.model}`);
    lines.push(`  API: ${logContent.request.baseUrl}`);
    lines.push(`  Temperature: ${logContent.request.temperature || 'N/A'}`);
    lines.push(`  Max Tokens: ${logContent.request.maxTokens || 'N/A'}`);
    lines.push(`  消息数量: ${logContent.request.messages.length}`);
    
    // 消息内容（简化）
    logContent.request.messages.forEach((msg, idx) => {
      const role = msg.role || 'unknown';
      const content = this.truncateText(msg.content || '', 200);
      lines.push(`  [${idx + 1}] ${role}: ${content}`);
    });
    
    lines.push('');
    
    // 响应信息
    lines.push('📥 响应:');
    lines.push(`  状态: ${logContent.response.success ? '✅ 成功' : '❌ 失败'}`);
    
    if (logContent.response.success) {
      if (logContent.response.content) {
        lines.push(`  内容: ${logContent.response.content}`);
      }
      if (logContent.response.usage) {
        lines.push(`  使用量: ${JSON.stringify(logContent.response.usage)}`);
      }
    } else {
      lines.push(`  错误: ${logContent.response.error || '未知错误'}`);
    }
    
    if (logContent.duration) {
      lines.push(`  耗时: ${logContent.duration}`);
    }
    
    lines.push('='.repeat(80));
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * 清理消息内容（移除敏感信息，截断长文本）
   * @param {Array} messages - 消息列表
   * @returns {Array} 清理后的消息列表
   */
  sanitizeMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: this.truncateText(msg.content || '', 500) // 最多保留500字符
    }));
  }

  /**
   * 清理数据对象（移除敏感信息）
   * @param {Object} data - 数据对象
   * @returns {Object} 清理后的数据对象
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    
    // 移除敏感字段
    const sensitiveFields = ['apiKey', 'api_key', 'password', 'token', 'secret'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***HIDDEN***';
      }
    }

    // 截断长文本
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 1000) + '... [truncated]';
      }
    }

    return sanitized;
  }

  /**
   * 截断文本
   * @param {string} text - 文本
   * @param {number} maxLength - 最大长度
   * @returns {string} 截断后的文本
   */
  truncateText(text, maxLength = 500) {
    if (!text || typeof text !== 'string') {
      return text;
    }
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '... [truncated]';
  }

  /**
   * 获取 Agent 日志
   * @param {number} count - 获取数量
   * @returns {Array} 日志列表
   */
  getAgentLogs(count = 50) {
    return this.agentLogs.slice(-count);
  }

  /**
   * 清空 Agent 日志
   */
  clearAgentLogs() {
    this.agentLogs = [];
  }

  /**
   * 获取日志文件列表
   * @param {string} date - 日期（YYYY-MM-DD），可选
   * @returns {Array} 日志文件路径列表
   */
  getLogFiles(date = null) {
    try {
      if (!this.logDir || !fs.existsSync(this.logDir)) {
        return [];
      }

      if (date) {
        const dateDir = path.join(this.logDir, date);
        if (!fs.existsSync(dateDir)) {
          return [];
        }
        return fs.readdirSync(dateDir)
          .filter(file => file.endsWith('.txt'))
          .map(file => path.join(dateDir, file))
          .sort();
      }

      // 返回所有日期的日志文件
      const dates = fs.readdirSync(this.logDir)
        .filter(item => {
          const itemPath = path.join(this.logDir, item);
          return fs.statSync(itemPath).isDirectory();
        })
        .sort()
        .reverse(); // 最新的在前

      const files = [];
      for (const date of dates) {
        const dateDir = path.join(this.logDir, date);
        const dateFiles = fs.readdirSync(dateDir)
          .filter(file => file.endsWith('.txt'))
          .map(file => path.join(dateDir, file))
          .sort()
          .reverse();
        files.push(...dateFiles);
      }

      return files;
    } catch (error) {
      console.error('获取日志文件列表失败:', error.message);
      return [];
    }
  }
}

// 创建单例
const logger = new Logger();

module.exports = logger;

