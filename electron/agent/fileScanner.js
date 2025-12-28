/**
 * File Scanner - 文件扫描器
 * 扫描和识别章节文件，处理多文件章节的情况
 * 
 * 支持的格式：
 * - 第001章.txt
 * - 第001-002章.txt（多章节文件）
 * - 第002章_part1.txt + 第002章_part2.txt（多文件章节）
 * - chapter_01.txt
 * - 第一章.txt
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileScanner {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.chapterMapping = new Map(); // 章节编号 -> 文件信息
    this.fileCache = new Map(); // 文件路径 -> 内容缓存
  }

  /**
   * 扫描工作区，识别所有章节文件
   * @returns {Promise<Object>} 章节文件映射
   */
  async scanChapterFiles() {
    try {
      console.log('📂 开始扫描章节文件...');
      
      if (!this.workspaceRoot) {
        throw new Error('工作区路径未设置');
      }

      // 读取目录
      const files = await fs.readdir(this.workspaceRoot);
      
      // 过滤章节文件
      const chapterFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return (ext === '.txt' || ext === '.md') && this.isChapterFile(file);
      });

      console.log(`📖 找到 ${chapterFiles.length} 个可能的章节文件`);

      // 解析章节文件
      const parsedChapters = [];
      for (const file of chapterFiles) {
        const filePath = path.join(this.workspaceRoot, file);
        const parsed = await this.parseChapterFile(file, filePath);
        if (parsed) {
          parsedChapters.push(parsed);
        }
      }

      // 构建章节映射
      this.buildChapterMapping(parsedChapters);

      const totalChapters = this.chapterMapping.size;
      const latestChapter = Math.max(...Array.from(this.chapterMapping.keys()), 0);
      
      console.log(`✅ 扫描完成：识别到 ${totalChapters} 个章节，最新章节：第${latestChapter}章`);

      return {
        success: true,
        chapterMapping: this.getChapterMapping(),
        totalChapters,
        latestChapter,
        fileCount: chapterFiles.length
      };

    } catch (error) {
      console.error('❌ 扫描章节文件失败:', error);
      return {
        success: false,
        error: error.message,
        chapterMapping: {},
        totalChapters: 0,
        latestChapter: 0
      };
    }
  }

  /**
   * 判断是否为章节文件
   */
  isChapterFile(filename) {
    const patterns = [
      /第\s*\d+章/i,           // 第001章
      /第\s*\d+\s*-\s*\d+\s*章/i, // 第001-002章
      /chapter\s*\d+/i,        // chapter_01
      /第[一二三四五六七八九十]+章/,  // 第一章
      /chapter_\d+/i           // chapter_01
    ];

    return patterns.some(pattern => pattern.test(filename));
  }

  /**
   * 解析章节文件
   */
  async parseChapterFile(filename, filePath) {
    try {
      // 获取文件信息
      const stats = await fs.stat(filePath);
      const fileHash = await this.getFileHash(filePath);

      // 解析章节编号
      const chapterInfo = this.extractChapterNumber(filename);
      
      if (!chapterInfo) {
        return null;
      }

      // 检查是否为多文件章节的一部分
      const isPartFile = /_part\d+|_part_\d+|第\d+章.*?[上下中]|第\d+章.*?[一二三四五六七八九十]/i.test(filename);

      return {
        filename,
        filePath,
        chapterNumber: chapterInfo.number,
        chapterRange: chapterInfo.range,
        isPartFile,
        partNumber: isPartFile ? this.extractPartNumber(filename) : null,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        fileHash
      };

    } catch (error) {
      console.error(`解析文件失败: ${filename}`, error);
      return null;
    }
  }

  /**
   * 提取章节编号
   */
  extractChapterNumber(filename) {
    // 匹配：第001-002章.txt
    const rangeMatch = filename.match(/第\s*(\d+)\s*-\s*(\d+)\s*章/i);
    if (rangeMatch) {
      return {
        number: parseInt(rangeMatch[1]),
        range: {
          start: parseInt(rangeMatch[1]),
          end: parseInt(rangeMatch[2])
        }
      };
    }

    // 匹配：第001章.txt
    const singleMatch = filename.match(/第\s*(\d+)\s*章/i);
    if (singleMatch) {
      const num = parseInt(singleMatch[1]);
      return {
        number: num,
        range: {
          start: num,
          end: num
        }
      };
    }

    // 匹配：chapter_01.txt
    const chapterMatch = filename.match(/chapter[_\s](\d+)/i);
    if (chapterMatch) {
      const num = parseInt(chapterMatch[1]);
      return {
        number: num,
        range: {
          start: num,
          end: num
        }
      };
    }

    // 匹配：第一章.txt（中文数字）
    const chineseMatch = filename.match(/第([一二三四五六七八九十百千万]+)章/);
    if (chineseMatch) {
      const num = this.chineseToNumber(chineseMatch[1]);
      if (num > 0) {
        return {
          number: num,
          range: {
            start: num,
            end: num
          }
        };
      }
    }

    return null;
  }

  /**
   * 提取部分编号（用于多文件章节）
   */
  extractPartNumber(filename) {
    const partMatch = filename.match(/_part[_\s]?(\d+)|([上下中])/i);
    if (partMatch) {
      if (partMatch[1]) {
        return parseInt(partMatch[1]);
      }
      // 中文：上=1, 中=2, 下=3
      const chineseMap = { '上': 1, '中': 2, '下': 3 };
      return chineseMap[partMatch[2]] || 1;
    }
    return 1;
  }

  /**
   * 中文数字转阿拉伯数字（简化版）
   */
  chineseToNumber(chinese) {
    const map = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
    };
    
    if (chinese.length === 1) {
      return map[chinese] || 0;
    }
    
    // 简化处理：只处理简单的数字
    if (chinese === '十一') return 11;
    if (chinese === '十二') return 12;
    // ... 可以扩展
    
    return 0;
  }

  /**
   * 构建章节映射
   */
  buildChapterMapping(parsedFiles) {
    this.chapterMapping.clear();

    // 按章节编号分组
    const chapterGroups = new Map();
    
    for (const file of parsedFiles) {
      if (file.chapterRange) {
        // 处理章节范围
        for (let num = file.chapterRange.start; num <= file.chapterRange.end; num++) {
          if (!chapterGroups.has(num)) {
            chapterGroups.set(num, []);
          }
          chapterGroups.get(num).push({
            ...file,
            chapterNumber: num
          });
        }
      } else {
        const num = file.chapterNumber;
        if (!chapterGroups.has(num)) {
          chapterGroups.set(num, []);
        }
        chapterGroups.get(num).push(file);
      }
    }

    // 构建最终映射
    for (const [chapterNum, files] of chapterGroups) {
      // 按部分编号排序（如果是多文件章节）
      files.sort((a, b) => {
        if (a.isPartFile && b.isPartFile) {
          return (a.partNumber || 0) - (b.partNumber || 0);
        }
        return 0;
      });

      // 计算总字数
      const totalWords = files.reduce((sum, f) => sum + (f.wordCount || 0), 0);

      this.chapterMapping.set(chapterNum, {
        chapterNumber: chapterNum,
        files: files.map(f => ({
          filename: f.filename,
          filePath: f.filePath,
          size: f.size,
          lastModified: f.lastModified,
          fileHash: f.fileHash,
          isPartFile: f.isPartFile,
          partNumber: f.partNumber
        })),
        totalWords,
        status: totalWords > 0 ? 'completed' : 'not_written',
        lastModified: files[0]?.lastModified || new Date().toISOString()
      });
    }
  }

  /**
   * 读取章节内容（可能来自多个文件）
   * @param {number} chapterNumber - 章节编号
   * @returns {Promise<string>} 章节内容
   */
  async readChapterContent(chapterNumber) {
    const chapterInfo = this.chapterMapping.get(chapterNumber);
    
    if (!chapterInfo || !chapterInfo.files || chapterInfo.files.length === 0) {
      return null;
    }

    // 读取所有文件内容
    const contents = [];
    for (const file of chapterInfo.files) {
      try {
        // 检查缓存
        if (this.fileCache.has(file.filePath)) {
          const cached = this.fileCache.get(file.filePath);
          // 检查文件是否修改
          const currentHash = await this.getFileHash(file.filePath);
          if (cached.hash === currentHash) {
            contents.push(cached.content);
            continue;
          }
        }

        // 读取文件
        const content = await fs.readFile(file.filePath, 'utf-8');
        
        // 更新缓存
        this.fileCache.set(file.filePath, {
          content,
          hash: file.fileHash,
          timestamp: Date.now()
        });

        contents.push(content);
      } catch (error) {
        console.error(`读取文件失败: ${file.filePath}`, error);
      }
    }

    // 合并内容（多文件章节用换行分隔）
    return contents.join('\n\n');
  }

  /**
   * 获取文件哈希（用于检测修改）
   */
  async getFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      return '';
    }
  }

  /**
   * 获取章节映射（JSON 格式）
   */
  getChapterMapping() {
    const mapping = {};
    for (const [chapterNum, info] of this.chapterMapping) {
      mapping[chapterNum] = info;
    }
    return mapping;
  }

  /**
   * 获取章节信息
   */
  getChapterInfo(chapterNumber) {
    return this.chapterMapping.get(chapterNumber) || null;
  }

  /**
   * 检查章节是否存在
   */
  hasChapter(chapterNumber) {
    return this.chapterMapping.has(chapterNumber);
  }

  /**
   * 获取最新章节编号
   */
  getLatestChapter() {
    if (this.chapterMapping.size === 0) {
      return 0;
    }
    return Math.max(...Array.from(this.chapterMapping.keys()));
  }

  /**
   * 获取所有章节编号
   */
  getAllChapterNumbers() {
    return Array.from(this.chapterMapping.keys()).sort((a, b) => a - b);
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.fileCache.clear();
  }

  /**
   * 检查文件是否修改（通过哈希）
   */
  async checkFileModified(filePath) {
    const cached = this.fileCache.get(filePath);
    if (!cached) {
      return true; // 未缓存，视为已修改
    }

    const currentHash = await this.getFileHash(filePath);
    return cached.hash !== currentHash;
  }
}

module.exports = FileScanner;

