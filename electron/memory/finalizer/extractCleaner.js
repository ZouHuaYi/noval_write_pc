/**
 * Extract Cleaner - 自动清理 ChapterExtract
 * 清理已结算的或过期的 extracts
 */

const fs = require('fs');
const path = require('path');

class ExtractCleaner {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.extractPath = path.join(workspaceRoot, '.novel-agent', 'extracts');
  }

  /**
   * 清理已结算的 extracts
   * @param {Array} finalizedChapters - 已结算的章节号列表
   * @param {boolean} dryRun - 是否只是预览，不实际删除
   * @returns {Object} - { deleted: [], kept: [], errors: [] }
   */
  cleanFinalized(finalizedChapters, dryRun = false) {
    const result = {
      deleted: [],
      kept: [],
      errors: []
    };

    if (!fs.existsSync(this.extractPath)) {
      return result;
    }

    try {
      const files = fs.readdirSync(this.extractPath);
      const extractFiles = files.filter(f => f.startsWith('chapter_') && f.endsWith('.json'));

      for (const file of extractFiles) {
        const match = file.match(/chapter_(\d+)\.json/);
        if (!match) continue;

        const chapterNum = parseInt(match[1]);

        if (finalizedChapters.includes(chapterNum)) {
          const filePath = path.join(this.extractPath, file);
          
          if (!dryRun) {
            try {
              fs.unlinkSync(filePath);
              result.deleted.push(chapterNum);
              console.log(`   🗑️  已删除已结算的 extract: chapter_${chapterNum}.json`);
            } catch (error) {
              result.errors.push({ chapter: chapterNum, error: error.message });
              console.error(`   ❌ 删除失败: chapter_${chapterNum}.json`, error.message);
            }
          } else {
            result.deleted.push(chapterNum);
          }
        } else {
          result.kept.push(chapterNum);
        }
      }
    } catch (error) {
      result.errors.push({ error: error.message });
      console.error('❌ 清理 extracts 失败:', error.message);
    }

    return result;
  }

  /**
   * 清理过期的 extracts（超过指定天数未结算）
   * @param {number} maxAgeDays - 最大保留天数（默认30天）
   * @param {boolean} dryRun - 是否只是预览
   * @returns {Object} - { deleted: [], kept: [], errors: [] }
   */
  cleanOld(maxAgeDays = 30, dryRun = false) {
    const result = {
      deleted: [],
      kept: [],
      errors: []
    };

    if (!fs.existsSync(this.extractPath)) {
      return result;
    }

    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // 转换为毫秒
    const now = Date.now();

    try {
      const files = fs.readdirSync(this.extractPath);
      const extractFiles = files.filter(f => f.startsWith('chapter_') && f.endsWith('.json'));

      for (const file of extractFiles) {
        const filePath = path.join(this.extractPath, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          const match = file.match(/chapter_(\d+)\.json/);
          const chapterNum = match ? parseInt(match[1]) : null;

          if (!dryRun) {
            try {
              fs.unlinkSync(filePath);
              result.deleted.push({ chapter: chapterNum, file: file, age: Math.floor(age / (24 * 60 * 60 * 1000)) });
              console.log(`   🗑️  已删除过期 extract: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} 天前)`);
            } catch (error) {
              result.errors.push({ file: file, error: error.message });
              console.error(`   ❌ 删除失败: ${file}`, error.message);
            }
          } else {
            result.deleted.push({ chapter: chapterNum, file: file, age: Math.floor(age / (24 * 60 * 60 * 1000)) });
          }
        } else {
          const match = file.match(/chapter_(\d+)\.json/);
          result.kept.push(match ? parseInt(match[1]) : null);
        }
      }
    } catch (error) {
      result.errors.push({ error: error.message });
      console.error('❌ 清理过期 extracts 失败:', error.message);
    }

    return result;
  }

  /**
   * 清理所有 extracts（危险操作）
   * @param {boolean} dryRun - 是否只是预览
   * @returns {Object} - { deleted: [], errors: [] }
   */
  cleanAll(dryRun = false) {
    const result = {
      deleted: [],
      errors: []
    };

    if (!fs.existsSync(this.extractPath)) {
      return result;
    }

    try {
      const files = fs.readdirSync(this.extractPath);
      const extractFiles = files.filter(f => f.startsWith('chapter_') && f.endsWith('.json'));

      for (const file of extractFiles) {
        const filePath = path.join(this.extractPath, file);
        const match = file.match(/chapter_(\d+)\.json/);
        const chapterNum = match ? parseInt(match[1]) : null;

        if (!dryRun) {
          try {
            fs.unlinkSync(filePath);
            result.deleted.push(chapterNum);
            console.log(`   🗑️  已删除 extract: ${file}`);
          } catch (error) {
            result.errors.push({ file: file, error: error.message });
            console.error(`   ❌ 删除失败: ${file}`, error.message);
          }
        } else {
          result.deleted.push(chapterNum);
        }
      }
    } catch (error) {
      result.errors.push({ error: error.message });
      console.error('❌ 清理所有 extracts 失败:', error.message);
    }

    return result;
  }

  /**
   * 获取清理统计信息
   */
  getCleanupStats() {
    const stats = {
      total: 0,
      finalized: [],
      old: [],
      recent: []
    };

    if (!fs.existsSync(this.extractPath)) {
      return stats;
    }

    try {
      const files = fs.readdirSync(this.extractPath);
      const extractFiles = files.filter(f => f.startsWith('chapter_') && f.endsWith('.json'));
      stats.total = extractFiles.length;

      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      for (const file of extractFiles) {
        const filePath = path.join(this.extractPath, file);
        const stats_fs = fs.statSync(filePath);
        const match = file.match(/chapter_(\d+)\.json/);
        const chapterNum = match ? parseInt(match[1]) : null;

        if (stats_fs.mtimeMs < thirtyDaysAgo) {
          stats.old.push(chapterNum);
        } else {
          stats.recent.push(chapterNum);
        }
      }
    } catch (error) {
      console.error('❌ 获取清理统计失败:', error.message);
    }

    return stats;
  }
}

module.exports = ExtractCleaner;

