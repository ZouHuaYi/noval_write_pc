/**
 * Chapter File Manager - 章节文件管理器
 * 管理章节文件映射、缓存和分析结果
 */

const fs = require('fs').promises;
const path = require('path');

class ChapterFileManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.mappingFile = path.join(workspaceRoot, '.novel-agent', 'chapter-mapping.json');
    this.analysisCacheDir = path.join(workspaceRoot, '.novel-agent', 'chapter-analysis');
    this.mapping = null;
  }

  /**
   * 初始化
   */
  async initialize() {
    try {
      // 确保目录存在
      await this.ensureDirectories();

      // 加载映射
      await this.loadMapping();

      return { success: true };
    } catch (error) {
      console.error('初始化章节文件管理器失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 确保目录存在
   */
  async ensureDirectories() {
    const dirs = [
      path.dirname(this.mappingFile),
      this.analysisCacheDir
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // 目录可能已存在
      }
    }
  }

  /**
   * 加载章节映射
   */
  async loadMapping() {
    try {
      const content = await fs.readFile(this.mappingFile, 'utf-8');
      this.mapping = JSON.parse(content);
      console.log('✅ 已加载章节映射');
    } catch (error) {
      // 文件不存在，使用空映射
      this.mapping = {
        version: '1.0',
        workspace_root: this.workspaceRoot,
        chapter_files: {},
        latest_chapter: 0,
        total_chapters: 0,
        last_updated: new Date().toISOString()
      };
      console.log('📝 创建新的章节映射');
    }
  }

  /**
   * 保存章节映射
   */
  async saveMapping() {
    try {
      if (!this.mapping) {
        return;
      }

      this.mapping.last_updated = new Date().toISOString();
      await fs.writeFile(
        this.mappingFile,
        JSON.stringify(this.mapping, null, 2),
        'utf-8'
      );
      console.log('✅ 已保存章节映射');
    } catch (error) {
      console.error('保存章节映射失败:', error);
    }
  }

  /**
   * 更新章节映射（从 FileScanner 的结果）
   */
  async updateMapping(chapterMapping) {
    if (!this.mapping) {
      await this.loadMapping();
    }

    this.mapping.chapter_files = chapterMapping;
    this.mapping.latest_chapter = Math.max(
      ...Object.keys(chapterMapping).map(n => parseInt(n)),
      0
    );
    this.mapping.total_chapters = Object.keys(chapterMapping).length;

    await this.saveMapping();
  }

  /**
   * 获取章节信息
   */
  getChapterInfo(chapterNumber) {
    if (!this.mapping) {
      return null;
    }
    return this.mapping.chapter_files[chapterNumber] || null;
  }

  /**
   * 获取分析结果缓存路径
   */
  getAnalysisCachePath(chapterNumber) {
    return path.join(this.analysisCacheDir, `chapter_${chapterNumber}.json`);
  }

  /**
   * 保存章节分析结果
   */
  async saveAnalysis(chapterNumber, analysis) {
    try {
      const cachePath = this.getAnalysisCachePath(chapterNumber);
      const data = {
        chapterNumber,
        analyzedAt: new Date().toISOString(),
        ...analysis
      };
      await fs.writeFile(
        cachePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
      console.log(`✅ 已保存章节 ${chapterNumber} 的分析结果`);
    } catch (error) {
      console.error(`保存章节分析结果失败: ${chapterNumber}`, error);
    }
  }

  /**
   * 加载章节分析结果
   */
  async loadAnalysis(chapterNumber) {
    try {
      const cachePath = this.getAnalysisCachePath(chapterNumber);
      const content = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // 文件不存在或读取失败
      return null;
    }
  }

  /**
   * 检查分析结果是否需要更新
   */
  async needsAnalysisUpdate(chapterNumber) {
    const chapterInfo = this.getChapterInfo(chapterNumber);
    if (!chapterInfo) {
      return false; // 章节不存在
    }

    const analysis = await this.loadAnalysis(chapterNumber);
    if (!analysis) {
      return true; // 没有分析结果
    }

    // 检查文件是否修改
    const lastModified = new Date(chapterInfo.lastModified);
    const analyzedAt = new Date(analysis.analyzedAt);

    return lastModified > analyzedAt;
  }

  /**
   * 获取最近 N 章的分析结果
   */
  async getRecentAnalysis(count = 3) {
    if (!this.mapping) {
      return [];
    }

    const chapterNumbers = Object.keys(this.mapping.chapter_files)
      .map(n => parseInt(n))
      .filter(n => n > 0)
      .sort((a, b) => b - a) // 降序
      .slice(0, count);

    const analyses = [];
    for (const chapterNum of chapterNumbers) {
      const analysis = await this.loadAnalysis(chapterNum);
      if (analysis) {
        analyses.push(analysis);
      }
    }

    return analyses.sort((a, b) => a.chapterNumber - b.chapterNumber); // 升序
  }

  /**
   * 清除分析缓存
   */
  async clearAnalysisCache() {
    try {
      const files = await fs.readdir(this.analysisCacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.analysisCacheDir, file));
        }
      }
      console.log('✅ 已清除分析缓存');
    } catch (error) {
      console.error('清除分析缓存失败:', error);
    }
  }

  /**
   * 获取映射信息
   */
  getMapping() {
    return this.mapping;
  }
}

module.exports = ChapterFileManager;

