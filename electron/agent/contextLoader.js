/**
 * Context Loader - 智能上下文加载器
 * 根据操作类型和目标章节，智能加载前后文
 */

const fs = require('fs').promises;
const path = require('path');

class ContextLoader {
  constructor(workspaceRoot, fileScanner, chapterFileManager, memoryManager = null) {
    this.workspaceRoot = workspaceRoot;
    this.fileScanner = fileScanner;
    this.chapterFileManager = chapterFileManager;
    this.memoryManager = memoryManager; // 用于获取设定文件内容
    
    // 设定文件列表（按优先级排序）
    this.settingFiles = [
      '设定.md',
      'prompt.md',
      '世界观.md',
      '提示.md',
      '人物.md'
    ];
    
    // 性能优化：添加缓存机制
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 分钟缓存
    this.fileContentCache = new Map(); // 文件内容缓存
    this.fileContentCacheTimeout = 2 * 60 * 1000; // 2 分钟文件内容缓存
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
  
  /**
   * 获取缓存
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
   * 设置缓存
   */
  setCache(key, value, timeout = null) {
    const expireTime = timeout || this.cacheTimeout;
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      expireTime: Date.now() + expireTime
    });
  }
  
  /**
   * 清除缓存
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      this.fileContentCache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
    for (const key of this.fileContentCache.keys()) {
      if (pattern.test(key)) {
        this.fileContentCache.delete(key);
      }
    }
  }
  
  /**
   * 获取文件内容（带缓存）
   */
  async getFileContent(filePath) {
    const cacheKey = `file_content_${filePath}`;
    const cached = this.fileContentCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expireTime) {
      return cached.content;
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.fileContentCache.set(cacheKey, {
        content,
        timestamp: Date.now(),
        expireTime: Date.now() + this.fileContentCacheTimeout
      });
      return content;
    } catch (error) {
      console.warn(`读取文件失败: ${filePath}`, error.message);
      return null;
    }
  }

  /**
   * 智能加载上下文
   * @param {Object} options - 选项
   * @param {string} options.intentType - 意图类型 (REWRITE/CHECK/CONTINUE/CREATE)
   * @param {number} options.targetChapter - 目标章节号
   * @param {string} options.targetFile - 目标文件路径
   * @param {string} options.userRequest - 用户请求
   * @param {Object} options.memoryContext - 记忆系统上下文
   * @returns {Object} 增强的上下文
   */
  async loadSmartContext(options) {
    const { intentType, targetChapter, targetFile, userRequest, memoryContext } = options;

    // 基础上下文（从记忆系统）
    const context = {
      ...memoryContext,
      text_context: {
        before: [],
        current: null,
        after: [],
        related: [],
        settings: [] // 新增：设定文件上下文
      }
    };

    // 根据意图类型加载不同的上下文
    if (intentType === 'REWRITE' || intentType === 'CHECK') {
      // 重写/校验：需要加载前后文
      await this.loadRewriteContext(context, targetChapter, targetFile, userRequest);
    } else if (intentType === 'CONTINUE') {
      // 续写：主要加载前文
      await this.loadContinueContext(context, targetChapter, userRequest);
    } else if (intentType === 'CREATE') {
      // 创建：加载相关设定和前文（如果有）
      await this.loadCreateContext(context, targetChapter, userRequest);
    }

    // 对于前面几章（第1-3章），如果没有足够的前文，加载设定文件作为补充
    if (targetChapter && targetChapter <= 3) {
      await this.loadSettingsContext(context, targetChapter);
    }

    return context;
  }

  /**
   * 加载重写/校验上下文
   */
  async loadRewriteContext(context, targetChapter, targetFile, userRequest) {
    console.log('📚 加载重写/校验上下文...');

    // 1. 读取当前文件内容（使用缓存）
    let currentContent = '';
    let currentFilePath = null;

    if (targetFile) {
      currentFilePath = this.resolveFilePath(targetFile);
      currentContent = await this.getFileContent(currentFilePath);
      if (currentContent) {
        context.text_context.current = {
          file: targetFile,
          path: currentFilePath,
          content: currentContent,
          length: currentContent.length
        };
      }
    } else if (targetChapter) {
      // 检查缓存
      const cacheKey = this.generateCacheKey('chapter_file', targetChapter);
      let chapterFile = this.getCached(cacheKey);
      
      if (!chapterFile) {
        chapterFile = await this.chapterFileManager.getChapterFile(targetChapter);
        if (chapterFile) {
          this.setCache(cacheKey, chapterFile, 10 * 60 * 1000); // 10分钟缓存
        }
      }
      
      if (chapterFile) {
        currentFilePath = chapterFile.path;
        currentContent = await this.getFileContent(currentFilePath);
        if (currentContent) {
          context.text_context.current = {
            file: chapterFile.name,
            path: currentFilePath,
            content: currentContent,
            chapter: targetChapter,
            length: currentContent.length
          };
        }
      }
    }

    // 2. 智能判断需要加载的前后文
    const contextStrategy = this.analyzeContextNeeds(userRequest, currentContent);

    // 3. 加载前文（如果需要）
    if (contextStrategy.needsBefore && targetChapter && targetChapter > 1) {
      const beforeChapters = await this.getContextChapters(targetChapter, 'before', contextStrategy.beforeCount);
      context.text_context.before = await this.loadChapters(beforeChapters);
      console.log(`   加载前文: ${beforeChapters.length} 章`);
    } else if (targetChapter && targetChapter <= 3) {
      // 对于前面几章，如果没有前文，加载设定文件作为补充
      await this.loadSettingsContext(context, targetChapter);
    }

    // 4. 加载后文（如果需要）
    if (contextStrategy.needsAfter && targetChapter) {
      const afterChapters = await this.getContextChapters(targetChapter, 'after', contextStrategy.afterCount);
      context.text_context.after = await this.loadChapters(afterChapters);
      console.log(`   加载后文: ${afterChapters.length} 章`);
    }

    // 5. 加载相关章节（基于向量检索或关键词）
    if (contextStrategy.needsRelated) {
      context.text_context.related = await this.loadRelatedChapters(userRequest, targetChapter);
      console.log(`   加载相关章节: ${context.text_context.related.length} 章`);
    }

    return context;
  }

  /**
   * 加载续写上下文
   */
  async loadContinueContext(context, targetChapter, userRequest) {
    console.log('📚 加载续写上下文...');

    // 续写主要需要前文
    if (targetChapter && targetChapter > 1) {
      // 加载最近 N 章（默认 3 章）
      const beforeCount = this.analyzeContextNeeds(userRequest, null).beforeCount || 3;
      const beforeChapters = await this.getContextChapters(targetChapter, 'before', beforeCount);
      context.text_context.before = await this.loadChapters(beforeChapters);
      console.log(`   加载前文: ${beforeChapters.length} 章`);
    } else if (targetChapter && targetChapter <= 3) {
      // 对于前面几章，如果没有前文，加载设定文件作为补充
      await this.loadSettingsContext(context, targetChapter);
    }

    return context;
  }

  /**
   * 加载创建上下文
   */
  async loadCreateContext(context, targetChapter, userRequest) {
    console.log('📚 加载创建上下文...');

    // 创建新章节时，如果有前文，加载前文
    if (targetChapter && targetChapter > 1) {
      const beforeChapters = await this.getContextChapters(targetChapter, 'before', 2);
      context.text_context.before = await this.loadChapters(beforeChapters);
      console.log(`   加载前文: ${beforeChapters.length} 章`);
    } else if (targetChapter && targetChapter <= 3) {
      // 对于前面几章，如果没有前文，加载设定文件作为补充
      await this.loadSettingsContext(context, targetChapter);
    }

    return context;
  }

  /**
   * 加载设定文件上下文（用于前面几章）
   */
  async loadSettingsContext(context, targetChapter) {
    console.log(`📚 加载设定文件上下文（第${targetChapter}章）...`);
    
    const settings = [];
    
    // 1. 优先从记忆系统获取设定文件内容（如果可用）
    if (this.memoryManager && this.memoryManager.world) {
      const worldData = this.memoryManager.world.getData();
      if (worldData.custom_rules && worldData.custom_rules.length > 0) {
        for (const rule of worldData.custom_rules) {
          if (rule.source && this.settingFiles.includes(rule.source)) {
            settings.push({
              file: rule.source,
              content: rule.content || '',
              type: 'world_rule',
              length: (rule.content || '').length
            });
            console.log(`   ✅ 从记忆系统加载: ${rule.source}`);
          }
        }
      }
    }
    
    // 2. 如果记忆系统没有，直接从文件读取（使用缓存）
    if (settings.length === 0) {
      for (const filename of this.settingFiles) {
        const filepath = path.join(this.workspaceRoot, filename);
        const content = await this.getFileContent(filepath);
        if (content && content.trim()) {
          settings.push({
            file: filename,
            content: content,
            type: 'setting',
            length: content.length
          });
          console.log(`   ✅ 读取设定文件: ${filename} (${content.length} 字)`);
        }
      }
    }
    
    // 3. 如果还是没有，尝试读取人物.md（使用缓存）
    if (settings.length === 0) {
      const characterFile = path.join(this.workspaceRoot, '人物.md');
      const content = await this.getFileContent(characterFile);
      if (content && content.trim()) {
        settings.push({
          file: '人物.md',
          content: content,
          type: 'character',
          length: content.length
        });
        console.log(`   ✅ 读取人物设定: 人物.md (${content.length} 字)`);
      }
    }
    
    context.text_context.settings = settings;
    
    if (settings.length > 0) {
      console.log(`   ✅ 已加载 ${settings.length} 个设定文件`);
    } else {
      console.warn(`   ⚠️ 未找到设定文件，前面几章可能缺少上下文`);
    }
    
    return context;
  }

  /**
   * 分析上下文需求
   * 根据用户请求和当前内容，智能判断需要加载哪些上下文
   */
  analyzeContextNeeds(userRequest, currentContent) {
    const lowerRequest = (userRequest || '').toLowerCase();
    const lowerContent = (currentContent || '').toLowerCase();

    // 默认策略
    let needsBefore = true;
    let needsAfter = false;
    let needsRelated = false;
    let beforeCount = 3;
    let afterCount = 2;

    // 分析用户请求中的关键词
    if (lowerRequest.includes('前面') || lowerRequest.includes('前文') || 
        lowerRequest.includes('之前') || lowerRequest.includes('上文')) {
      needsBefore = true;
      beforeCount = 5; // 需要更多前文
    }

    if (lowerRequest.includes('后面') || lowerRequest.includes('后文') || 
        lowerRequest.includes('之后') || lowerRequest.includes('下文') ||
        lowerRequest.includes('后续')) {
      needsAfter = true;
      afterCount = 3;
    }

    if (lowerRequest.includes('相关') || lowerRequest.includes('关联') ||
        lowerRequest.includes('涉及') || lowerRequest.includes('提到')) {
      needsRelated = true;
    }

    // 分析操作类型
    if (lowerRequest.includes('一致性') || lowerRequest.includes('连贯性') ||
        lowerRequest.includes('校验') || lowerRequest.includes('检查')) {
      // 校验需要前后文
      needsBefore = true;
      needsAfter = true;
      beforeCount = 5;
      afterCount = 3;
    }

    if (lowerRequest.includes('重写') || lowerRequest.includes('修改') ||
        lowerRequest.includes('改写') || lowerRequest.includes('优化')) {
      // 重写主要需要前文，但也要考虑后文影响
      needsBefore = true;
      needsAfter = true;
      beforeCount = 3;
      afterCount = 2;
    }

    // 分析当前内容（如果有）
    if (currentContent) {
      // 如果内容中提到后续章节，可能需要加载后文
      if (lowerContent.includes('下一章') || lowerContent.includes('后续') ||
          lowerContent.includes('之后') || lowerContent.includes('后来')) {
        needsAfter = true;
      }

      // 如果内容中提到前面章节，可能需要更多前文
      if (lowerContent.includes('前面') || lowerContent.includes('之前') ||
          lowerContent.includes('上文') || lowerContent.includes('前文')) {
        needsBefore = true;
        beforeCount = Math.max(beforeCount, 5);
      }
    }

    return {
      needsBefore,
      needsAfter,
      needsRelated,
      beforeCount,
      afterCount
    };
  }

  /**
   * 获取上下文章节列表
   */
  async getContextChapters(targetChapter, direction, count) {
    const chapters = [];
    
    // 先扫描章节（如果还没扫描）
    if (!this.fileScanner.chapterMapping || this.fileScanner.chapterMapping.size === 0) {
      await this.fileScanner.scanChapterFiles();
    }
    
    if (direction === 'before') {
      const start = Math.max(1, targetChapter - count);
      for (let i = start; i < targetChapter; i++) {
        if (this.fileScanner.hasChapter(i)) {
          chapters.push(i);
        }
      }
    } else if (direction === 'after') {
      // 获取最新章节号
      const mapping = this.fileScanner.getChapterMapping();
      const chapterNumbers = Object.keys(mapping || {}).map(n => parseInt(n));
      const latestChapter = chapterNumbers.length > 0 ? Math.max(...chapterNumbers) : 0;
      const end = Math.min(latestChapter, targetChapter + count);
      for (let i = targetChapter + 1; i <= end; i++) {
        if (this.fileScanner.hasChapter(i)) {
          chapters.push(i);
        }
      }
    }

    return chapters;
  }

  /**
   * 加载章节内容（优化版：使用缓存和批量操作）
   */
  async loadChapters(chapterNumbers) {
    if (!chapterNumbers || chapterNumbers.length === 0) {
      return [];
    }
    
    // 批量加载，使用缓存
    const results = [];
    const uncachedChapters = [];
    
    // 先检查缓存
    for (const chapterNum of chapterNumbers) {
      const cacheKey = this.generateCacheKey('chapter_content', chapterNum);
      const cached = this.getCached(cacheKey);
      if (cached) {
        results.push(cached);
      } else {
        uncachedChapters.push(chapterNum);
      }
    }
    
    // 批量加载未缓存的章节（并行处理，最多3个并发）
    if (uncachedChapters.length > 0) {
      const batchSize = 3;
      for (let i = 0; i < uncachedChapters.length; i += batchSize) {
        const batch = uncachedChapters.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (chapterNum) => {
            try {
              const chapterFile = await this.chapterFileManager.getChapterFile(chapterNum);
              if (!chapterFile) {
                return null;
              }
              
              const content = await this.getFileContent(chapterFile.path);
              if (!content) {
                return null;
              }
              
              const result = {
                chapter: chapterNum,
                file: chapterFile.name,
                path: chapterFile.path,
                content: content,
                length: content.length
              };
              
              // 缓存结果
              const cacheKey = this.generateCacheKey('chapter_content', chapterNum);
              this.setCache(cacheKey, result, 10 * 60 * 1000); // 10分钟缓存
              
              return result;
            } catch (error) {
              console.warn(`加载章节 ${chapterNum} 失败:`, error.message);
              return null;
            }
          })
        );
        
        results.push(...batchResults.filter(r => r !== null));
      }
    }
    
    // 按章节号排序
    results.sort((a, b) => a.chapter - b.chapter);
    
    return results;
  }
  
  /**
   * 加载章节内容（旧版，保留兼容性）
   */
  async loadChapters_old(chapterNumbers) {
    const chapters = [];
    
    for (const chapterNum of chapterNumbers) {
      try {
        const content = await this.fileScanner.readChapterContent(chapterNum);
        if (content) {
          chapters.push({
            chapter: chapterNum,
            content: content,
            length: content.length,
            preview: content.substring(0, 200) + '...'
          });
        }
      } catch (error) {
        console.warn(`无法读取第${chapterNum}章:`, error.message);
      }
    }

    return chapters;
  }

  /**
   * 加载相关章节（基于关键词匹配）
   */
  async loadRelatedChapters(userRequest, targetChapter) {
    // 提取关键词
    const keywords = this.extractKeywords(userRequest);
    if (keywords.length === 0) {
      return [];
    }

    // 扫描所有章节，查找包含关键词的章节
    const relatedChapters = [];
    
    // 先扫描章节（如果还没扫描）
    if (!this.fileScanner.chapterMapping || this.fileScanner.chapterMapping.size === 0) {
      await this.fileScanner.scanChapterFiles();
    }
    
    const mapping = this.fileScanner.getChapterMapping();
    const allChapters = Object.keys(mapping || {}).map(n => parseInt(n)).filter(n => n !== targetChapter);

    // 批量处理，使用缓存（最多处理前20章，避免性能问题）
    const chaptersToCheck = allChapters.slice(0, 20);
    const batchSize = 5;
    
    for (let i = 0; i < chaptersToCheck.length; i += batchSize) {
      const batch = chaptersToCheck.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (chapterNum) => {
          if (chapterNum === targetChapter) return null;
          
          try {
            // 检查缓存
            const cacheKey = this.generateCacheKey('chapter_content', chapterNum);
            let content = null;
            const cached = this.getCached(cacheKey);
            
            if (cached && cached.content) {
              content = cached.content;
            } else {
              content = await this.fileScanner.readChapterContent(chapterNum);
              if (content) {
                // 缓存结果
                this.setCache(cacheKey, { content, chapter: chapterNum }, 10 * 60 * 1000);
              }
            }
            
            if (content) {
              const lowerContent = content.toLowerCase();
              // 检查是否包含关键词
              const matchCount = keywords.filter(kw => lowerContent.includes(kw.toLowerCase())).length;
              if (matchCount > 0) {
                return {
                  chapter: chapterNum,
                  content: content,
                  length: content.length,
                  matchScore: matchCount / keywords.length,
                  preview: content.substring(0, 200) + '...'
                };
              }
            }
            return null;
          } catch (error) {
            console.warn(`无法读取第${chapterNum}章:`, error.message);
            return null;
          }
        })
      );
      
      relatedChapters.push(...batchResults.filter(r => r !== null));
    }

    // 按匹配分数排序，返回前 5 个
    return relatedChapters
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    // 简单的关键词提取（可以后续优化）
    const keywords = [];
    
    // 提取角色名（2-4字）
    const charNamePattern = /[张李王刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤][明华强伟军建平志刚勇辉峰磊涛鹏飞超杰浩宇博文俊凯][明华强伟军建平志刚勇辉峰磊涛鹏飞超杰浩宇博文俊凯]?/g;
    const charMatches = text.match(charNamePattern);
    if (charMatches) {
      keywords.push(...charMatches);
    }

    // 提取重要名词（可以通过更复杂的NLP实现）
    const importantWords = ['突破', '修炼', '境界', '雷种', '天元宗', '筑基', '金丹', '元婴'];
    for (const word of importantWords) {
      if (text.includes(word)) {
        keywords.push(word);
      }
    }

    return [...new Set(keywords)]; // 去重
  }

  /**
   * 解析文件路径
   */
  resolveFilePath(fileName) {
    if (!fileName) return null;
    
    if (path.isAbsolute(fileName)) {
      return fileName;
    }
    
    return path.join(this.workspaceRoot, fileName);
  }

  /**
   * 构建上下文提示词
   */
  buildContextPrompt(context, intentType) {
    let prompt = '';

    // 设定文件（优先显示，特别是前面几章）
    if (context.text_context.settings && context.text_context.settings.length > 0) {
      prompt += `# 基础设定（重要：请严格遵守这些设定）\n`;
      for (const setting of context.text_context.settings) {
        prompt += `\n## ${setting.file}\n`;
        // 限制长度，避免提示词过长
        const maxLength = 2000;
        const content = setting.content.length > maxLength 
          ? setting.content.substring(0, maxLength) + '...' 
          : setting.content;
        prompt += `${content}\n`;
      }
      prompt += '\n';
    }

    // 当前内容
    if (context.text_context.current) {
      const current = context.text_context.current;
      prompt += `# 当前${intentType === 'REWRITE' ? '需要重写' : intentType === 'CHECK' ? '需要校验' : ''}的内容\n`;
      prompt += `文件: ${current.file}\n`;
      if (current.chapter) {
        prompt += `章节: 第${current.chapter}章\n`;
      }
      prompt += `内容长度: ${current.length} 字\n\n`;
      
      // 如果是重写/校验，显示内容预览
      if (intentType === 'REWRITE' || intentType === 'CHECK') {
        const preview = current.content.substring(0, 1000);
        prompt += `内容预览:\n${preview}${current.content.length > 1000 ? '...' : ''}\n\n`;
      }
    }

    // 前文
    if (context.text_context.before && context.text_context.before.length > 0) {
      prompt += `# 前文（共 ${context.text_context.before.length} 章）\n`;
      for (const chapter of context.text_context.before) {
        prompt += `\n## 第${chapter.chapter}章（${chapter.length} 字）\n`;
        prompt += `${chapter.preview}\n`;
      }
      prompt += '\n';
    }

    // 后文
    if (context.text_context.after && context.text_context.after.length > 0) {
      prompt += `# 后文（共 ${context.text_context.after.length} 章）\n`;
      for (const chapter of context.text_context.after) {
        prompt += `\n## 第${chapter.chapter}章（${chapter.length} 字）\n`;
        prompt += `${chapter.preview}\n`;
      }
      prompt += '\n';
    }

    // 相关章节
    if (context.text_context.related && context.text_context.related.length > 0) {
      prompt += `# 相关章节（共 ${context.text_context.related.length} 章）\n`;
      for (const chapter of context.text_context.related) {
        prompt += `\n## 第${chapter.chapter}章（匹配度: ${chapter.matchScore}）\n`;
        prompt += `${chapter.preview}\n`;
      }
      prompt += '\n';
    }

    return prompt;
  }
}

module.exports = ContextLoader;

