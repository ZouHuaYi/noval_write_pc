/**
 * Context Skills - 上下文相关 Skills
 * 只读操作，无副作用
 */

const fs = require('fs').promises;
const path = require('path');

class ContextSkills {
  constructor(workspaceRoot, dependencies = {}) {
    this.workspaceRoot = workspaceRoot;
    this.memory = dependencies.memory;
    this.contextLoader = dependencies.contextLoader;
    this.chapterFileManager = dependencies.chapterFileManager;
    this.dependencies = dependencies; // 保存完整依赖
  }

  /**
   * load_story_context - 加载小说完整上下文
   */
  async loadStoryContext(input, options = {}) {
    const { novelId, include = ['world', 'characters', 'plot', 'foreshadows'] } = input;
    
    if (!this.memory) {
      throw new Error('Memory manager not available');
    }

    const context = {
      worldRules: null,
      characters: [],
      plotState: null,
      foreshadows: []
    };

    // 加载世界观规则
    if (include.includes('world')) {
      context.worldRules = this.memory.world.getRules();
    }

    // 加载角色信息
    if (include.includes('characters')) {
      context.characters = this.memory.character.getMainCharacters();
    }

    // 加载剧情状态
    if (include.includes('plot')) {
      context.plotState = this.memory.plot.getCurrentState();
    }

    // 加载伏笔
    if (include.includes('foreshadows')) {
      context.foreshadows = {
        pending: this.memory.foreshadow.getPendingForeshadows(),
        revealed: this.memory.foreshadow.getRevealedForeshadows()
      };
    }

    return context;
  }

  /**
   * load_chapter_content - 读取章节内容
   */
  async loadChapterContent(input, options = {}) {
    const { chapterId } = input;
    
    if (!chapterId) {
      throw new Error('chapterId is required');
    }

    let content = '';
    let chapter = null;
    let filePath = null;

    // 如果是数字，当作章节号处理
    if (typeof chapterId === 'number' || /^\d+$/.test(String(chapterId))) {
      chapter = parseInt(chapterId);
      
      if (this.chapterFileManager) {
        const chapterFile = await this.chapterFileManager.getChapterFile(chapter);
        if (chapterFile) {
          filePath = chapterFile.path;
          content = await fs.readFile(filePath, 'utf-8');
        } else {
          throw new Error(`Chapter ${chapter} not found`);
        }
      } else {
        // 回退到直接读取文件
        const possiblePaths = [
          path.join(this.workspaceRoot, `第${chapter}章.md`),
          path.join(this.workspaceRoot, `chapter_${chapter}.md`),
          path.join(this.workspaceRoot, `${chapter}.md`)
        ];
        
        for (const p of possiblePaths) {
          try {
            content = await fs.readFile(p, 'utf-8');
            filePath = p;
            break;
          } catch (e) {
            // 继续尝试下一个路径
          }
        }
        
        if (!content) {
          throw new Error(`Chapter ${chapter} file not found`);
        }
      }
    } else {
      // 当作文件路径处理
      filePath = path.isAbsolute(chapterId) 
        ? chapterId 
        : path.join(this.workspaceRoot, chapterId);
      
      content = await fs.readFile(filePath, 'utf-8');
      
      // 尝试从文件名提取章节号
      const match = filePath.match(/第(\d+)章|chapter[_\s]?(\d+)|(\d+)\.md/);
      if (match) {
        chapter = parseInt(match[1] || match[2] || match[3]);
      }
    }

    return {
      content,
      chapter,
      file: filePath
    };
  }

  /**
   * analyze_previous_chapters - 分析已有章节
   */
  async analyzePreviousChapters(input, options = {}) {
    const { targetChapter, recentCount = 3 } = input;
    
    if (!targetChapter) {
      throw new Error('targetChapter is required');
    }

    const fileScanner = this.dependencies?.fileScanner;
    const chapterFileManager = this.dependencies?.chapterFileManager;
    const chapterAnalyzer = this.dependencies?.chapterAnalyzer;
    const performanceOptimizer = this.dependencies?.performanceOptimizer;
    const llmCaller = options.llmCaller;

    if (!fileScanner || !chapterAnalyzer) {
      throw new Error('File scanner or chapter analyzer not available');
    }

    try {
      // 获取最近 N 章
      const startChapter = Math.max(1, targetChapter - recentCount);
      const chapterNumbers = [];
      
      for (let i = startChapter; i < targetChapter; i++) {
        if (fileScanner.hasChapter && fileScanner.hasChapter(i)) {
          chapterNumbers.push(i);
        }
      }

      if (chapterNumbers.length === 0) {
        return { analyses: [] };
      }

      // 并行处理：先检查缓存，再分析需要更新的章节
      const analysisTasks = chapterNumbers.map(chapterNum => async () => {
        // 检查是否需要更新
        let needsUpdate = true;
        if (chapterFileManager && chapterFileManager.needsAnalysisUpdate) {
          needsUpdate = await chapterFileManager.needsAnalysisUpdate(chapterNum);
        }
        
        if (!needsUpdate && chapterFileManager) {
          // 使用缓存
          const cached = await chapterFileManager.loadAnalysis(chapterNum);
          if (cached) {
            return cached;
          }
        }

        // 重新分析
        const content = await fileScanner.readChapterContent(chapterNum);
        if (content && llmCaller) {
          const analysis = await chapterAnalyzer.analyzeChapter(chapterNum, content, llmCaller);
          if (analysis && analysis.success) {
            // 保存分析结果
            if (chapterFileManager && chapterFileManager.saveAnalysis) {
              await chapterFileManager.saveAnalysis(chapterNum, analysis);
            }
            return analysis;
          }
        }
        return null;
      });

      // 并行执行（限制并发数）
      let analyses;
      if (performanceOptimizer && performanceOptimizer.parallel) {
        analyses = await performanceOptimizer.parallel(analysisTasks, {
          maxConcurrency: 2,
          onProgress: (current, total) => {
            // 进度回调
          }
        });
      } else {
        // 回退到顺序执行
        analyses = [];
        for (const task of analysisTasks) {
          const result = await task();
          if (result) analyses.push(result);
        }
      }

      // 过滤 null 并排序
      const filtered = analyses.filter(a => a !== null).sort((a, b) => 
        (a.chapterNumber || 0) - (b.chapterNumber || 0)
      );

      return { analyses: filtered };
    } catch (error) {
      console.error('分析已有章节失败:', error);
      return { analyses: [] };
    }
  }

  /**
   * scan_chapters - 扫描章节文件
   */
  async scanChapters(input, options = {}) {
    const fileScanner = this.dependencies?.fileScanner;
    const chapterFileManager = this.dependencies?.chapterFileManager;

    if (!fileScanner) {
      throw new Error('File scanner not available');
    }

    try {
      const result = await fileScanner.scanChapterFiles();
      
      // 更新章节文件管理器
      if (result.success && chapterFileManager && chapterFileManager.updateMapping) {
        await chapterFileManager.updateMapping(result.chapterMapping);
      }

      return {
        totalChapters: result.totalChapters || 0,
        latestChapter: result.latestChapter || 0,
        chapterMapping: result.chapterMapping || {}
      };
    } catch (error) {
      console.error('扫描章节文件失败:', error);
      return {
        totalChapters: 0,
        latestChapter: 0,
        chapterMapping: {}
      };
    }
  }
}

module.exports = ContextSkills;

