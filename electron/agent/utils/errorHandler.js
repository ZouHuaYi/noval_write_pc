/**
 * Error Handler - 统一错误处理工具
 * 提供统一的错误处理、恢复和报告机制
 */

class ErrorHandler {
  /**
   * 处理错误并返回标准格式
   */
  static handleError(error, context = {}) {
    const errorInfo = {
      message: error.message || '未知错误',
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };

    // 分类错误
    if (error.name === 'TypeError') {
      errorInfo.type = 'type_error';
      errorInfo.severity = 'high';
    } else if (error.name === 'ReferenceError') {
      errorInfo.type = 'reference_error';
      errorInfo.severity = 'high';
    } else if (error.message.includes('LLM')) {
      errorInfo.type = 'llm_error';
      errorInfo.severity = 'medium';
      errorInfo.recoverable = true;
    } else if (error.message.includes('网络') || error.message.includes('network')) {
      errorInfo.type = 'network_error';
      errorInfo.severity = 'medium';
      errorInfo.recoverable = true;
    } else {
      errorInfo.type = 'unknown_error';
      errorInfo.severity = 'medium';
    }

    return errorInfo;
  }

  /**
   * 判断错误是否可恢复
   */
  static isRecoverable(error) {
    const recoverablePatterns = [
      /LLM.*失败/i,
      /网络/i,
      /timeout/i,
      /连接/i,
      /重试/i
    ];

    return recoverablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * 生成错误恢复建议
   */
  static generateRecoverySuggestion(error) {
    if (error.message.includes('LLM')) {
      return {
        action: 'retry',
        message: 'LLM 调用失败，建议重试',
        maxRetries: 3
      };
    }

    if (error.message.includes('网络')) {
      return {
        action: 'retry',
        message: '网络错误，建议检查网络连接后重试',
        maxRetries: 2
      };
    }

    return {
      action: 'manual',
      message: '需要手动处理',
      maxRetries: 0
    };
  }

  /**
   * 包装异步函数，添加错误处理
   */
  static wrapAsync(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const errorInfo = this.handleError(error, context);
        console.error('❌ 执行失败:', errorInfo);
        throw errorInfo;
      }
    };
  }

  /**
   * 带重试的异步执行
   */
  static async withRetry(fn, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      onRetry = null,
      shouldRetry = null
    } = options;

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // 检查是否应该重试
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt); // 指数退避
          console.log(`⏳ 重试中... (${attempt + 1}/${maxRetries})，${delay}ms 后重试`);
          
          if (onRetry) {
            onRetry(attempt + 1, error);
          }

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 睡眠函数
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 超时包装
   */
  static withTimeout(promise, timeoutMs, timeoutMessage = '操作超时') {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]);
  }
}

module.exports = ErrorHandler;

