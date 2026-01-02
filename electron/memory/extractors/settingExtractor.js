/**
 * Setting Extractor - 设定文件提取器
 * 从工作区的设定文件中自动提取信息并初始化记忆系统
 */

const fs = require('fs');
const path = require('path');

class SettingExtractor {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    
    // 设定文件列表（按优先级排序）
    this.settingFiles = [
      '设定.md',
      'prompt.md',
      '世界观.md',
      '提示.md',
      '人物.md'
    ];
  }

  /**
   * 提取所有设定信息
   */
  async extractAll() {
    const results = {
      worldRules: null,
      characters: [],
      plotInfo: null,
      extractedFiles: []
    };

    try {
      // 1. 提取世界观和规则
      const worldContent = await this.extractWorldSettings();
      if (worldContent) {
        results.worldRules = worldContent;
      }

      // 2. 提取人物信息
      const characters = await this.extractCharacters();
      if (characters.length > 0) {
        results.characters = characters;
      }

      // 3. 提取剧情信息（从章节文件）
      const plotInfo = await this.extractPlotInfo();
      if (plotInfo) {
        results.plotInfo = plotInfo;
      }

      console.log(`✅ 设定提取完成: 世界观=${!!worldContent}, 人物=${characters.length}, 剧情=${!!plotInfo}`);

      return results;
    } catch (error) {
      console.error('❌ 设定提取失败:', error);
      return results;
    }
  }

  /**
   * 提取世界观设定
   */
  async extractWorldSettings() {
    let worldContent = '';

    // 按优先级读取设定文件
    for (const filename of this.settingFiles) {
      const filepath = path.join(this.workspaceRoot, filename);
      
      if (fs.existsSync(filepath)) {
        try {
          const content = fs.readFileSync(filepath, 'utf-8');
          worldContent += `\n\n## ${filename}\n\n${content}`;
          console.log(`📄 读取设定文件: ${filename}`);
        } catch (err) {
          console.warn(`⚠️ 读取文件失败: ${filename}`, err.message);
        }
      }
    }

    if (!worldContent.trim()) {
      return null;
    }

    // 返回提取的内容（后续可以用 LLM 解析）
    return {
      raw_content: worldContent,
      source_files: this.settingFiles.filter(f => {
        const filepath = path.join(this.workspaceRoot, f);
        return fs.existsSync(filepath);
      })
    };
  }

  /**
   * 提取人物信息
   */
  async extractCharacters() {
    const characters = [];
    
    // 优先从人物.md 提取
    const characterFile = path.join(this.workspaceRoot, '人物.md');
    
    if (fs.existsSync(characterFile)) {
      try {
        const content = fs.readFileSync(characterFile, 'utf-8');
        
        // 简单的角色提取（后续可以用 LLM 优化）
        // 查找类似 "## 角色名" 或 "### 角色名" 的标题
        const characterMatches = content.match(/^#{2,3}\s+([^\n]+)/gm);
        
        if (characterMatches) {
          for (const match of characterMatches) {
            const name = match.replace(/^#{2,3}\s+/, '').trim();
            if (name && name.length < 20) { // 简单的名称验证
              characters.push({
                name: name,
                source: '人物.md',
                raw_content: content // 保留原始内容供后续解析
              });
            }
          }
        }
        
        console.log(`👥 从人物.md 提取到 ${characters.length} 个角色`);
      } catch (err) {
        console.warn('⚠️ 读取人物.md 失败:', err.message);
      }
    }

    // 如果没有人物.md，尝试从其他设定文件中提取
    if (characters.length === 0) {
      for (const filename of ['设定.md', 'prompt.md']) {
        const filepath = path.join(this.workspaceRoot, filename);
        if (fs.existsSync(filepath)) {
          try {
            const content = fs.readFileSync(filepath, 'utf-8');
            // 简单的角色名提取（查找常见模式）
            const namePatterns = [
              /主角[：:]\s*([^\n]+)/,
              /主角名[：:]\s*([^\n]+)/,
              /姓名[：:]\s*([^\n]+)/
            ];
            
            for (const pattern of namePatterns) {
              const match = content.match(pattern);
              if (match && match[1]) {
                const name = match[1].trim();
                if (name && !characters.find(c => c.name === name)) {
                  characters.push({
                    name: name,
                    source: filename,
                    raw_content: content
                  });
                }
              }
            }
          } catch (err) {
            // 忽略错误
          }
        }
      }
    }

    return characters;
  }

  /**
   * 提取剧情信息（从章节文件）
   */
  async extractPlotInfo() {
    const plotInfo = {
      totalChapters: 0,
      chapterFiles: [],
      latestChapter: null
    };

    try {
      // 扫描所有 .txt 文件
      const files = fs.readdirSync(this.workspaceRoot);
      const chapterFiles = files.filter(f => {
        // 匹配章节文件格式：第001-002章.txt, 第1章.txt, 第一章.txt 等
        return /\.txt$/i.test(f) && /第.*?章/i.test(f);
      });

      if (chapterFiles.length === 0) {
        return null;
      }

      // 解析章节编号
      const parsedChapters = chapterFiles.map(filename => {
        // 提取章节范围，如 "第001-002章.txt" -> [1, 2]
        const rangeMatch = filename.match(/第(\d+)-(\d+)章/i);
        if (rangeMatch) {
          return {
            filename,
            start: parseInt(rangeMatch[1]),
            end: parseInt(rangeMatch[2]),
            chapters: []
          };
        }

        // 单个章节，如 "第001章.txt" -> [1]
        const singleMatch = filename.match(/第(\d+)章/i);
        if (singleMatch) {
          const num = parseInt(singleMatch[1]);
          return {
            filename,
            start: num,
            end: num,
            chapters: [num]
          };
        }

        return null;
      }).filter(Boolean);

      // 排序
      parsedChapters.sort((a, b) => a.start - b.start);

      // 计算总章节数
      let maxChapter = 0;
      for (const chapter of parsedChapters) {
        maxChapter = Math.max(maxChapter, chapter.end);
      }

      plotInfo.totalChapters = maxChapter;
      plotInfo.chapterFiles = parsedChapters;
      plotInfo.latestChapter = maxChapter;

      console.log(`📖 检测到 ${parsedChapters.length} 个章节文件，共 ${maxChapter} 章`);

      return plotInfo;
    } catch (err) {
      console.warn('⚠️ 提取剧情信息失败:', err.message);
      return null;
    }
  }

  /**
   * 检查是否有设定文件
   */
  hasSettingFiles() {
    for (const filename of this.settingFiles) {
      const filepath = path.join(this.workspaceRoot, filename);
      if (fs.existsSync(filepath)) {
        return true;
      }
    }
    return false;
  }
}

module.exports = SettingExtractor;

