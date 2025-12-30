/**
 * Intelligent Extractor - 智能提取器
 * 使用 LLM 从设定文件和章节文件中提取结构化信息并更新记忆系统
 */

const fs = require('fs');
const path = require('path');
const { callLLM } = require('../llm');
const { safeParseJSON } = require('../utils/jsonParser');
const ExtractWriter = require('./extractWriter');
const FileStateManager = require('./fileStateManager');

class IntelligentExtractor {
  constructor(workspaceRoot, memoryManager, llmConfig, vectorIndex = null) {
    this.workspaceRoot = workspaceRoot;
    this.memoryManager = memoryManager;
    this.llmConfig = llmConfig;
    this.vectorIndex = vectorIndex; // 向量索引（可选）
    this.fileStateManager = new FileStateManager(workspaceRoot);
    this.extractWriter = new ExtractWriter(workspaceRoot);
    this.onProgress = null; // 进度回调
    
    this.settingFiles = [
      '设定.md',
      'prompt.md',
      '世界观.md',
      '提示.md',
      '人物.md'
    ];
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  /**
   * 报告进度
   */
  reportProgress(current, total, message) {
    if (this.onProgress) {
      this.onProgress({
        current,
        total,
        message,
        percentage: Math.round((current / total) * 100)
      });
    }
  }

  /**
   * 智能提取所有信息
   * @param {object} options - 提取选项
   * @param {number} options.chapterBatchSize - 章节批处理大小
   * @param {number} options.maxChapters - 最大处理章节数（0表示全部）
   */
  async extractAll(options = {}) {
    try {
      console.log('🧠 开始智能提取文件内容...');

      const {
        chapterBatchSize = 5,
        maxChapters = 0,
        forceRescan = false
      } = options;

      // 1. 提取设定文件信息
      this.reportProgress(0, 100, '提取设定文件...');
      await this.extractSettings(forceRescan);

      // 2. 提取章节文件信息（分批处理）
      this.reportProgress(50, 100, '提取章节文件...');
      const chapterResult = await this.extractChapters(chapterBatchSize, maxChapters, forceRescan);

      this.reportProgress(100, 100, '提取完成');

      console.log('✅ 智能提取完成');
      console.log(`📊 统计: 处理了 ${chapterResult.processed} 个章节，跳过了 ${chapterResult.skipped} 个未修改的文件`);

      return {
        success: true,
        chapters: chapterResult
      };
    } catch (error) {
      console.error('❌ 智能提取失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 提取设定文件信息（支持增量更新）
   * @param {boolean} forceRescan - 是否强制重新扫描（忽略文件状态）
   */
  async extractSettings(forceRescan = false) {
    const settingContents = [];
    const filesToProcess = [];

    // 检查哪些文件需要处理
    for (const filename of this.settingFiles) {
      const filepath = path.join(this.workspaceRoot, filename);
      if (fs.existsSync(filepath)) {
        if (forceRescan || this.fileStateManager.needsProcessing(filepath)) {
          filesToProcess.push({ filename, filepath });
        } else {
          console.log(`⏭️ 跳过未修改的设定文件: ${filename}`);
        }
      }
    }

    if (filesToProcess.length === 0) {
      console.log('ℹ️ 所有设定文件都是最新的，无需重新提取');
      return;
    }

    console.log(`📚 需要处理 ${filesToProcess.length} 个设定文件`);

    // 读取需要处理的文件
    for (const { filename, filepath } of filesToProcess) {
      try {
        const content = fs.readFileSync(filepath, 'utf-8');
        settingContents.push({
          filename,
          filepath,
          content: content.substring(0, 5000) // 限制长度
        });
        console.log(`📄 读取设定文件: ${filename}`);
      } catch (err) {
        console.warn(`⚠️ 读取文件失败: ${filename}`, err.message);
      }
    }

    if (settingContents.length === 0) {
      return;
    }

    // 合并所有设定内容
    const combinedContent = settingContents.map(s => `## ${s.filename}\n\n${s.content}`).join('\n\n---\n\n');

    // 使用 LLM 提取结构化信息
    await this.extractFromSettings(combinedContent, settingContents);
  }

  /**
   * 使用 LLM 从设定文件中提取信息
   */
  async extractFromSettings(content, settingFiles = []) {
    const systemPrompt = `你是一个【小说设定解析程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符

你必须且只能在 <json> 和 </json> 之间输出内容。

# 任务
从提供的设定文件中提取以下信息：
1. 世界观规则（修炼体系、魔法体系、世界规则等）
2. 人物信息（姓名、性格、境界、位置等）
3. 剧情背景（当前阶段、主要事件等）

# 输出格式
<json>
{
  "world_rules": [
    {
      "type": "cultivation_system" | "magic_system" | "world_rule",
      "name": "规则名称",
      "description": "规则描述",
      "details": "详细内容"
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist" | "antagonist" | "supporting",
      "personality": {
        "traits": ["性格1", "性格2"],
        "description": "性格描述"
      },
      "current_state": {
        "level": "境界",
        "location": "位置",
        "skills": ["技能1", "技能2"]
      }
    }
  ],
  "plot_background": {
    "current_stage": "初期/中期/后期",
    "main_events": ["事件1", "事件2"],
    "world_state": "世界状态描述"
  }
}
</json>`;

    const userPrompt = `请从以下设定文件中提取信息：

${content}

请仔细分析并提取所有相关信息。`;

    try {
      console.log('🤖 使用 LLM 解析设定文件...');
      
      const responseText = await callLLM(
        this.llmConfig,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.3,
          maxTokens: 4096
        }
      );

      const extracted = safeParseJSON(responseText, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });

      // 更新记忆系统
      await this.updateMemoryFromExtracted(extracted);

      // 更新文件状态（标记为已处理）
      for (const { filepath } of settingFiles) {
        this.fileStateManager.updateFileState(filepath, {
          type: 'setting',
          extracted: true
        });
      }

    } catch (error) {
      console.error('❌ LLM 解析设定文件失败:', error.message);
    }
  }

  /**
   * 从提取的信息更新记忆系统
   */
  async updateMemoryFromExtracted(extracted) {
    if (!extracted) return;

    try {
      // 1. 更新世界观规则
      if (extracted.world_rules && Array.isArray(extracted.world_rules)) {
        for (const rule of extracted.world_rules) {
          try {
            const worldData = this.memoryManager.world.getData();
            if (!worldData.custom_rules) {
              worldData.custom_rules = [];
            }

            // 检查是否已存在
            const exists = worldData.custom_rules.find(r => r.name === rule.name);
            if (!exists) {
              worldData.custom_rules.push({
                id: `extracted_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: rule.type || 'world_rule',
                name: rule.name,
                description: rule.description,
                content: rule.details,
                source: '设定文件提取'
              });
              console.log(`✅ 添加世界观规则: ${rule.name}`);
            }
          } catch (err) {
            console.warn(`⚠️ 添加世界观规则失败: ${rule.name}`, err.message);
          }
        }
        await this.memoryManager.world.save();
      }

      // 2. 添加角色
      if (extracted.characters && Array.isArray(extracted.characters)) {
        for (const char of extracted.characters) {
          try {
            // 检查角色是否已存在
            const existing = this.memoryManager.character.getCharacter(char.name);
            if (!existing) {
              await this.memoryManager.character.addCharacter({
                name: char.name,
                role: char.role || 'supporting',
                personality: char.personality || {},
                current_state: char.current_state || {},
                source: '设定文件提取'
              });
              console.log(`✅ 添加角色: ${char.name}`);
            } else {
              // 更新现有角色
              if (char.personality) {
                await this.memoryManager.character.updateCharacterState(char.name, {
                  personality: char.personality
                });
              }
              if (char.current_state) {
                await this.memoryManager.character.updateCharacterState(char.name, char.current_state);
              }
              console.log(`✅ 更新角色: ${char.name}`);
            }
          } catch (err) {
            console.warn(`⚠️ 添加/更新角色失败: ${char.name}`, err.message);
          }
        }
      }

      // 3. 更新剧情背景
      if (extracted.plot_background) {
        try {
          const plotData = this.memoryManager.plot.getData();
          if (extracted.plot_background.current_stage) {
            plotData.main_plotline.current_stage = extracted.plot_background.current_stage;
          }
          if (extracted.plot_background.main_events) {
            for (const event of extracted.plot_background.main_events) {
              plotData.main_plotline.completed_events = plotData.main_plotline.completed_events || [];
              plotData.main_plotline.completed_events.push({
                name: event,
                chapter: 0,
                description: event,
                significance: 'normal'
              });
            }
          }
          await this.memoryManager.plot.save();
          console.log('✅ 更新剧情背景');
        } catch (err) {
          console.warn('⚠️ 更新剧情背景失败:', err.message);
        }
      }

    } catch (error) {
      console.error('❌ 更新记忆系统失败:', error);
    }
  }

  /**
   * 递归扫描目录，查找章节文件
   * @param {string} dir - 目录路径
   * @param {Array} fileList - 文件列表（输出）
   */
  scanDirectory(dir, fileList = []) {
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        
        // 跳过隐藏文件和目录
        if (file.startsWith('.')) {
          continue;
        }
        
        // 跳过 node_modules 等常见目录
        if (stat.isDirectory()) {
          const dirName = path.basename(filepath);
          if (['node_modules', '.git', '.vscode', '.cursor', 'node_modules', 'dist', 'build'].includes(dirName)) {
            continue;
          }
          // 递归扫描子目录
          this.scanDirectory(filepath, fileList);
        } else if (stat.isFile()) {
          // 支持多种文件格式：.txt, .md
          const ext = path.extname(file).toLowerCase();
          if ((ext === '.txt' || ext === '.md') && /第.*?章/i.test(file)) {
            fileList.push({
              filename: file,
              filepath: filepath,
              relativePath: path.relative(this.workspaceRoot, filepath)
            });
          }
        }
      }
      
      return fileList;
    } catch (error) {
      console.warn(`⚠️ 扫描目录失败: ${dir}`, error.message);
      return fileList;
    }
  }

  /**
   * 提取章节文件信息（支持分批处理和增量更新）
   * @param {number} batchSize - 每批处理的文件数
   * @param {number} maxFiles - 最大处理文件数（0表示全部）
   * @param {boolean} forceRescan - 是否强制重新扫描（忽略文件状态）
   */
  async extractChapters(batchSize = 5, maxFiles = 0, forceRescan = false) {
    try {
      // 递归扫描章节文件（支持子目录）
      console.log('🔍 开始扫描章节文件（递归扫描）...');
      const allFiles = this.scanDirectory(this.workspaceRoot);
      
      // 按文件名排序
      allFiles.sort((a, b) => {
        // 提取章节号进行排序
        const matchA = a.filename.match(/第(\d+)/i);
        const matchB = b.filename.match(/第(\d+)/i);
        if (matchA && matchB) {
          return parseInt(matchA[1]) - parseInt(matchB[1]);
        }
        return a.filename.localeCompare(b.filename);
      });
      
      console.log(`📚 扫描到 ${allFiles.length} 个章节文件`);
      
      if (allFiles.length === 0) {
        console.log('ℹ️ 未找到章节文件');
        return { processed: 0, total: 0, skipped: 0 };
      }

      // 过滤出需要处理的文件（增量更新）
      const filesToProcess = [];
      const skippedFiles = [];

      for (const fileInfo of allFiles) {
        if (forceRescan || this.fileStateManager.needsProcessing(fileInfo.filepath)) {
          filesToProcess.push(fileInfo);
        } else {
          skippedFiles.push(fileInfo.filename);
        }
      }

      if (skippedFiles.length > 0) {
        console.log(`⏭️ 跳过 ${skippedFiles.length} 个未修改的章节文件`);
      }

      if (filesToProcess.length === 0) {
        console.log('ℹ️ 所有章节文件都是最新的，无需重新提取');
        return { processed: 0, total: allFiles.length, skipped: skippedFiles.length };
      }

      // 限制处理数量
      const filesToActuallyProcess = maxFiles > 0 
        ? filesToProcess.slice(0, maxFiles)
        : filesToProcess;

      console.log(`📖 找到 ${allFiles.length} 个章节文件，需要处理 ${filesToActuallyProcess.length} 个`);

      // 分批处理
      const totalBatches = Math.ceil(filesToActuallyProcess.length / batchSize);
      let processedCount = 0;

      for (let i = 0; i < filesToActuallyProcess.length; i += batchSize) {
        const batch = filesToActuallyProcess.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        console.log(`📦 处理第 ${batchNumber}/${totalBatches} 批（${batch.length} 个文件）`);

        for (const fileInfo of batch) {
          const { filename, filepath } = fileInfo;
          try {
            const content = fs.readFileSync(filepath, 'utf-8');
            
            // 提取章节编号
            const chapterMatch = filename.match(/第(\d+)(?:-(\d+))?章/i);
            const startChapter = chapterMatch ? parseInt(chapterMatch[1]) : 0;
            
            console.log(`📄 处理章节文件: ${fileInfo.relativePath || filename} (第${startChapter}章)`);
            
            // 报告进度
            this.reportProgress(
              processedCount + 1,
              filesToActuallyProcess.length,
              `处理 ${fileInfo.relativePath || filename}`
            );
            
            // 使用 LLM 提取章节信息
            await this.extractFromChapter(content, startChapter, filepath);
            
            // 更新文件状态
            this.fileStateManager.updateFileState(filepath, {
              type: 'chapter',
              chapter: startChapter,
              extracted: true
            });

            processedCount++;

            // 批次间稍作延迟，避免 API 限流
            if (processedCount < filesToActuallyProcess.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }

          } catch (err) {
            console.warn(`⚠️ 处理章节文件失败: ${filename}`, err.message);
          }
        }

        // 批次间延迟
        if (i + batchSize < filesToActuallyProcess.length) {
          console.log('⏸️ 批次间休息 2 秒...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`✅ 章节提取完成: 处理了 ${processedCount} 个文件`);
      return {
        processed: processedCount,
        total: allFiles.length,
        skipped: skippedFiles.length
      };

    } catch (error) {
      console.error('❌ 提取章节信息失败:', error);
      return { processed: 0, total: 0, skipped: 0, error: error.message };
    }
  }

  /**
   * 使用 LLM 从章节内容中提取信息（重构版：输出 ChapterExtract）
   */
  async extractFromChapter(content, chapterNumber, filename) {
    // 限制内容长度
    const limitedContent = content.substring(0, 3000);

    const systemPrompt = `你是小说分析 Agent，而不是记忆系统。

# 核心规则
1. **禁止直接写入任何长期记忆**
2. **只能输出 ChapterExtract JSON**
3. **不得重复总结已有事实**，只在发现"可能新增信息"时输出
4. **所有概念请用自然语言**，不要尝试生成 ID

# 任务
从提供的章节内容中提取以下信息：
1. 事实候选（世界规则、生物学事实、不可逆事件）
2. 概念提及（新概念或已有概念的不同表述）
3. 伏笔候选（未来承诺）
4. 故事状态快照

# 输出格式（ChapterExtract）
<json>
{
  "chapter": ${chapterNumber},
  "fact_candidates": [
    {
      "statement": "事实陈述（客观、不可逆）",
      "type": "world_rule" | "biology" | "irreversible_event" | "location",
      "confidence": "observed" | "canonical",
      "evidence": "证据来源",
      "source_refs": ["章节引用"],
      "concept_refs": ["相关概念表面文本"]
    }
  ],
  "concept_mentions": [
    {
      "surface": "概念表面文本（如'地磁异常'）",
      "context": "出现上下文",
      "chapter": ${chapterNumber},
      "description": "概念描述（可选）"
    }
  ],
  "foreshadow_candidates": [
    {
      "surface": "伏笔相关概念表面文本",
      "implied_future": "暗示的未来",
      "chapter": ${chapterNumber}
    }
  ],
  "story_state_snapshot": {
    "current_location": "当前地点",
    "global_tension": "low" | "medium" | "high" | "critical",
    "known_threats": ["威胁概念表面文本"],
    "open_mysteries": ["未解之谜概念表面文本"]
  },
  "raw_notes": "如果只是确认已有事实，在这里说明"
}
</json>`;

    const userPrompt = `这是第${chapterNumber}章的内容：

${limitedContent}

请提取其中的事实、概念、伏笔和故事状态。`;

    try {
      const responseText = await callLLM(
        this.llmConfig,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          temperature: 0.3,
          maxTokens: 3000
        }
      );

      const extracted = safeParseJSON(responseText, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });

      // 确保章节号存在
      extracted.chapter = chapterNumber;

      // 写入 ChapterExtract（临时账本）
      await this.extractWriter.writeExtract(chapterNumber, extracted);
      
      console.log(`✅ 已写入 ChapterExtract: chapter_${chapterNumber}.json`);
      
      // 返回提取结果
      return extracted;

    } catch (error) {
      console.error(`❌ LLM 解析章节失败: ${filename}`, error.message);
      // 抛出错误，让调用者知道失败原因
      throw new Error(`章节提取失败: ${error.message}`);
    }
  }

  /**
   * 从章节提取的信息更新记忆系统（已废弃）
   * 现在改为写入 ChapterExtract，由 ChapterFinalizer 统一结算
   * @deprecated 使用 extractFromChapter 写入 ChapterExtract
   */
  async updateMemoryFromChapter(extracted, chapterNumber) {
    // 此方法已废弃，保留用于兼容性
    console.log('⚠️ updateMemoryFromChapter 已废弃，请使用 ChapterExtract + ChapterFinalizer');
  }
}

module.exports = IntelligentExtractor;

