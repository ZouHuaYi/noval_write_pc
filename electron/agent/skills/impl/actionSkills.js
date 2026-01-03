/**
 * Action Skills - 动作相关 Skills
 * 有副作用的操作（文件写入、记忆更新等）
 */

const fs = require('fs').promises;
const path = require('path');

class ActionSkills {
  constructor(workspaceRoot, dependencies = {}) {
    this.workspaceRoot = workspaceRoot;
    this.memory = dependencies.memory;
    this.chapterFileManager = dependencies.chapterFileManager;
    this.dependencies = dependencies; // 保存完整依赖
  }

  /**
   * save_chapter - 保存章节到文件系统
   */
  async saveChapter(input, options = {}) {
    const { chapterId, content, filePath } = input;
    
    if (!content) {
      throw new Error('Content is required to save chapter');
    }

    let targetPath = filePath;

    // 如果没有提供文件路径，根据章节号生成
    if (!targetPath) {
      if (typeof chapterId === 'number' || /^\d+$/.test(String(chapterId))) {
        const chapter = parseInt(chapterId);
        
        // 优先使用章节文件管理器
        if (this.chapterFileManager) {
          const chapterFile = await this.chapterFileManager.getChapterFile(chapter);
          if (chapterFile) {
            targetPath = chapterFile.path;
          } else {
            // 生成新文件路径
            targetPath = path.join(this.workspaceRoot, `第${chapter}章.md`);
          }
        } else {
          targetPath = path.join(this.workspaceRoot, `第${chapter}章.md`);
        }
      } else {
        // 当作文件路径处理
        targetPath = path.isAbsolute(chapterId) 
          ? chapterId 
          : path.join(this.workspaceRoot, chapterId);
      }
    }

    // 确保目录存在
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });

    // 保存文件
    await fs.writeFile(targetPath, content, 'utf-8');

    return {
      success: true,
      filePath: targetPath
    };
  }

  /**
   * finalize_chapter - 最终化章节
   * 整理章节，生成最终可发布版本，并更新记忆系统
   */
  async finalizeChapter(input, options = {}) {
    const { content, checks = {}, chapterNumber } = input;
    
    if (!content) {
      throw new Error('Content is required to finalize chapter');
    }

    if (!chapterNumber) {
      throw new Error('Chapter number is required to finalize chapter');
    }

    if (!this.memory) {
      throw new Error('Memory manager not available');
    }

    try {
      // 检查 ChapterExtract 是否存在
      const extractWriter = this.dependencies?.extractWriter;
      const extractExists = extractWriter ? extractWriter.readExtract(chapterNumber) !== null : false;
      
      // 如果 ChapterExtract 不存在，先创建它（通过 update_story_memory）
      if (!extractExists) {
        console.log(`⚠️ 第 ${chapterNumber} 章没有 ChapterExtract，先创建...`);
        
        const memoryUpdater = this.dependencies?.memoryUpdater;
        const llmCaller = options.llmCaller;
        
        if (memoryUpdater && llmCaller) {
          // 从 content 中提取章节号（如果 content 中有章节标题）
          const chapterMatch = content.match(/第\s*(\d+)\s*章/);
          const extractedChapter = chapterMatch ? parseInt(chapterMatch[1]) : chapterNumber;
          
          // 创建 ChapterExtract
          const updateResult = await memoryUpdater.update(
            content,
            { userRequest: `第${extractedChapter}章` },
            options.context || {},
            llmCaller
          );
          
          if (!updateResult.success) {
            console.warn(`⚠️ 创建 ChapterExtract 失败: ${updateResult.error}`);
            // 继续执行，即使创建失败
          } else {
            console.log(`✅ ChapterExtract 已创建: chapter_${extractedChapter}.json`);
          }
        } else {
          console.warn(`⚠️ 无法创建 ChapterExtract: memoryUpdater 或 llmCaller 不可用`);
        }
      }
      
      // 调用记忆系统的 finalizeChapter 方法
      const result = await this.memory.finalizeChapter(chapterNumber);
      
      if (!result.success) {
        throw new Error(result.error || 'Finalize failed');
      }

      // 生成摘要
      const summary = this.generateSummary(content, checks);

      return {
        finalContent: content, // 最终内容（可能经过处理）
        summary: summary
      };
    } catch (error) {
      console.error('最终化章节失败:', error);
      throw new Error(`最终化章节失败: ${error.message}`);
    }
  }

  /**
   * 生成章节摘要
   */
  generateSummary(content, checks) {
    const summary = {
      length: content.length,
      wordCount: this.countWords(content),
      status: checks.status || 'unknown',
      score: checks.overall_score || 0,
      errorCount: checks.errors?.length || 0
    };

    return `章节长度: ${summary.length} 字符, ${summary.wordCount} 字; ` +
           `状态: ${summary.status}, 评分: ${summary.score}/100; ` +
           `错误数: ${summary.errorCount}`;
  }

  /**
   * 统计字数（简单版）
   */
  countWords(text) {
    // 中文字符计数
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 英文单词计数
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    
    return chineseChars + englishWords;
  }

  /**
   * update_memory - 更新记忆系统
   */
  async updateMemory(input, options = {}) {
    const { content, request, context = {}, replaceChapter = null } = input;
    
    if (!content) {
      throw new Error('Content is required to update memory');
    }

    if (!this.memory) {
      throw new Error('Memory manager not available');
    }

    const memoryUpdater = this.dependencies?.memoryUpdater;
    const llmCaller = options.llmCaller;

    if (!memoryUpdater) {
      throw new Error('Memory updater not available');
    }

    try {
      // 构建更新请求
      const updateRequest = {
        ...request,
        userRequest: request.userRequest || '',
        replace_chapter: replaceChapter
      };

      // 调用记忆更新器
      const result = await memoryUpdater.update(
        content,
        updateRequest,
        context,
        llmCaller
      );

      return {
        success: result.success !== false,
        memoryUpdated: result.success !== false, // 用于 Planner 规划的状态
        updated: result.updated || {} // 仅用于日志和调试
      };
    } catch (error) {
      console.error('更新记忆失败:', error);
      return {
        success: false,
        error: error.message,
        updated: {}
      };
    }
  }

  /**
   * update_story_memory (合并版) - 合并了 update_memory
   */
  async updateStoryMemoryMerged(input, options = {}) {
    const result = await this.updateMemory(input, options);
    // 确保返回 memoryUpdated 字段（用于 Planner 规划）
    return {
      ...result,
      memoryUpdated: result.success !== false
    };
  }
}

module.exports = ActionSkills;

