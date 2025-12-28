/**
 * Performance Optimizer - 性能优化工具
 * 提供缓存、并行处理等性能优化功能
 */

class PerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 分钟缓存
  }

  /**
   * 缓存结果
   */
  cacheResult(key, value, timeout = null) {
    const expireTime = timeout || this.cacheTimeout;
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      expireTime: Date.now() + expireTime
    });
  }

  /**
   * 获取缓存结果
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expireTime) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * 清除缓存
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 并行执行多个异步任务
   */
  async parallel(tasks, options = {}) {
    const {
      maxConcurrency = 3,
      onProgress = null
    } = options;

    const results = [];
    const executing = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const promise = Promise.resolve(task()).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        results[i] = result;
        
        if (onProgress) {
          onProgress(i + 1, tasks.length);
        }
        
        return result;
      });

      executing.push(promise);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * 批量处理
   */
  async batch(items, processor, options = {}) {
    const {
      batchSize = 5,
      onProgress = null
    } = options;

    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      
      results.push(...batchResults);

      if (onProgress) {
        onProgress(Math.min(i + batchSize, items.length), items.length);
      }
    }

    return results;
  }

  /**
   * 防抖函数
   */
  debounce(fn, delay) {
    let timeoutId = null;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * 节流函数
   */
  throttle(fn, delay) {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return fn(...args);
      }
    };
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(prefix, ...args) {
    const argsStr = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    }).join('_');
    
    return `${prefix}_${argsStr}`;
  }
}

module.exports = PerformanceOptimizer;

