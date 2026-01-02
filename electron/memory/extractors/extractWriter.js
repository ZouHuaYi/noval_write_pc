/**
 * Extract Writer - ChapterExtract 写入器
 * Agent 只能通过这个接口写入 ChapterExtract（临时账本）
 */

const fs = require('fs');
const path = require('path');
const ExtractCleaner = require('./finalizer/extractCleaner');

class ExtractWriter {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.extractPath = path.join(workspaceRoot, '.novel-agent', 'extracts');
    this.cleaner = new ExtractCleaner(workspaceRoot);
  }

  /**
   * 确保目录存在
   */
  ensureDirectory() {
    if (!fs.existsSync(this.extractPath)) {
      fs.mkdirSync(this.extractPath, { recursive: true });
    }
  }

  /**
   * 写入 ChapterExtract
   * @param {number} chapterNumber - 章节号
   * @param {Object} extract - ChapterExtract 数据
   */
  async writeExtract(chapterNumber, extract) {
    this.ensureDirectory();

    const extractFile = path.join(this.extractPath, `chapter_${chapterNumber}.json`);

    // 确保章节号存在
    extract.chapter = chapterNumber;

    // 验证数据结构
    if (!extract.fact_candidates) extract.fact_candidates = [];
    if (!extract.concept_mentions) extract.concept_mentions = [];
    if (!extract.foreshadow_candidates) extract.foreshadow_candidates = [];
    if (!extract.story_state_snapshot) extract.story_state_snapshot = {};
    if (!extract.raw_notes) extract.raw_notes = '';

    try {
      fs.writeFileSync(extractFile, JSON.stringify(extract, null, 2), 'utf-8');
      console.log(`✅ 已写入 ChapterExtract: chapter_${chapterNumber}.json`);
      return { success: true, file: extractFile };
    } catch (error) {
      console.error(`❌ 写入 ChapterExtract 失败:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 读取 ChapterExtract
   */
  readExtract(chapterNumber) {
    const extractFile = path.join(this.extractPath, `chapter_${chapterNumber}.json`);
    
    if (!fs.existsSync(extractFile)) {
      return null;
    }

    try {
      const content = fs.readFileSync(extractFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ 读取 ChapterExtract 失败:`, error.message);
      return null;
    }
  }

  /**
   * 删除 ChapterExtract
   */
  deleteExtract(chapterNumber) {
    const extractFile = path.join(this.extractPath, `chapter_${chapterNumber}.json`);
    
    if (fs.existsSync(extractFile)) {
      try {
        fs.unlinkSync(extractFile);
        console.log(`✅ 已删除 ChapterExtract: chapter_${chapterNumber}.json`);
        return { success: true };
      } catch (error) {
        console.error(`❌ 删除 ChapterExtract 失败:`, error.message);
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  }

  /**
   * 列出所有 extracts
   */
  listExtracts() {
    this.ensureDirectory();
    
    try {
      const files = fs.readdirSync(this.extractPath);
      return files
        .filter(f => f.startsWith('chapter_') && f.endsWith('.json'))
        .map(f => {
          const match = f.match(/chapter_(\d+)\.json/);
          return match ? parseInt(match[1]) : null;
        })
        .filter(n => n !== null)
        .sort((a, b) => a - b);
    } catch (error) {
      console.error(`❌ 列出 extracts 失败:`, error.message);
      return [];
    }
  }
}

module.exports = ExtractWriter;

