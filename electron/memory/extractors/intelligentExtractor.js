/**
 * Intelligent Extractor - 智能提取器
 * 使用 LLM 从设定文件和章节文件中提取结构化信息并更新记忆系统
 */

const fs = require('fs');
const path = require('path');
const { callLLM } = require('../../core/llm');
const { safeParseJSON } = require('../../utils/jsonParser');
const ExtractWriter = require('./extractWriter');
const FileStateManager = require('../managers/fileStateManager');
const ExtractValidator = require('./extractValidator');

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
          maxTokens: 2000
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
   * 使用 LLM 从章节内容中提取信息（Extract Prompt 2.0：证据化数据）
   */
  async extractFromChapter(content, chapterNumber, filename) {
    // 限制内容长度
    const limitedContent = content.substring(0, 3000);

    // Extract Prompt 2.0 - SYSTEM PROMPT（修正版）
    const systemPrompt = `你是一个【小说文本信息提取器】，不是作者，也不是世界观裁决者。

你的职责：
1. 只提取【文本中明确或暗示的主张】
2. 为每一条主张提供【原文证据】
3. 对每一条主张给出【不确定性评估（0~1）】
4. 不允许推理补全未在文本中出现的信息
5. 不允许将"感觉、可能、暗示"当作已成立事实
6. 不允许解释剧情意图或推测作者想法

你不决定哪些信息会进入长期记忆。
你只输出结构化的"候选信息"。

⚠️ 重要规则：
- 所有条目必须包含 evidence（原文引用）
- 必须给出 certainty（0~1）
- certainty < 0.7 的内容不得进入 fact_claims
- 如果你不确定是否成立，请放入 inference_only

❌ 禁止事项：
- 禁止将"尝试"、"失败"、"可能"等事件性描述放入 fact_claims
- 禁止将伪长期状态（如"突破失败状态"）放入 state_claims
- 禁止在 foreshadow 中解释剧情意图
- 禁止输出 story_state_snapshot（这不是 Extract 的职责）`;

    // Extract Prompt 2.0 - USER PROMPT
    const userPrompt = `以下是小说第 ${chapterNumber} 章的内容：

<<<TEXT
${limitedContent}
TEXT>>>

请从中提取【候选主张】，并严格按 JSON 格式输出。

提取类型包括：
- fact_claims（事实主张）：世界在这一章之后仍然成立的事实，certainty >= 0.7
  ❌ 禁止：尝试、失败、可能等事件性描述
- event_claims（事件主张）：一次性事件（如突破尝试、战斗、对话）
- state_claims（状态变化主张）：角色的长期状态变化（如境界、位置）
  ❌ 禁止：伪长期状态（如"突破失败状态"）
- foreshadow_candidates（伏笔候选）：文本中暗示未来的内容
  ❌ 禁止：解释剧情意图或推测作者想法
- inference_only（仅推断）：不足以成为事实的推断，certainty < 0.7

⚠️ 规则：
- 所有条目必须包含 evidence（原文引用）
- 必须给出 certainty（0~1）
- certainty < 0.7 的内容不得进入 fact_claims
- 如果你不确定是否成立，请放入 inference_only
- 事件性内容必须放入 event_claims，不能放入 fact_claims

输出 JSON 格式：
<json>
{
  "chapter": ${chapterNumber},
  "fact_claims": [
    {
      "subject": "张三",
      "predicate": "level",
      "value": "筑基期",
      "type": "character_level",
      "evidence": "他体内灵力骤然凝实，正式踏入筑基之境",
      "certainty": 0.95
    }
  ],
  "event_claims": [
    {
      "type": "breakthrough_attempt",
      "subject": "张三",
      "result": "failed",
      "evidence": "这一次突破，仍旧失败了",
      "certainty": 0.95
    }
  ],
  "state_claims": [
    {
      "character": "张三",
      "field": "location",
      "value": "青云山",
      "evidence": "他回到了青云山",
      "certainty": 0.9
    }
  ],
  "foreshadow_candidates": [
    {
      "surface": "多次冲击瓶颈失败",
      "evidence": "数次冲击瓶颈，却始终无法形成稳定循环",
      "certainty": 0.8
    }
  ],
      "inference_only": [
        {
          "claim": "张三可能即将突破筑基",
          "basis": "灵力出现质变描写",
          "certainty": 0.6
        }
      ]
    }
    </json>

⚠️ 重要：
- 不要输出 concept_mentions（这不是 Extract 的职责）
- certainty 最高 0.95（不能给 1）
- 文本明示的内容不要放入 inference_only，应该用 event_claims 的 narrative_claim 类型`;

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

      // 校验提取结果
      const validator = new ExtractValidator();
      const validation = validator.validateExtract(extracted);
      
      if (!validation.valid) {
        console.warn(`   ⚠️  Extract 校验失败，尝试自动修复...`);
        for (const error of validation.errors) {
          console.warn(`     - ${error.message}`);
        }
        // 自动修复（过滤无效 claims）
        extracted = validator.filterInvalidClaims(extracted);
      }

      // 清理和验证提取结果（ExtractCleaner 只做三件事：去重、合并、丢弃不完整项）
      const cleaned = this.cleanExtract(extracted);

      // 写入 ChapterExtract（临时账本）
      await this.extractWriter.writeExtract(chapterNumber, cleaned);
      
      console.log(`✅ 已写入 ChapterExtract: chapter_${chapterNumber}.json`);
      
      // 标记为已写入
      cleaned.extract_written = true;
      
      // 返回提取结果
      return cleaned;

    } catch (error) {
      console.error(`❌ LLM 解析章节失败: ${filename}`, error.message);
      // 抛出错误，让调用者知道失败原因
      throw new Error(`章节提取失败: ${error.message}`);
    }
  }

  /**
   * 清理提取结果（ExtractCleaner 只做三件事：去重、合并、丢弃不完整项）
   * 绝不做判断
   */
  cleanExtract(extracted) {
    const cleaned = {
      chapter: extracted.chapter || 0,
      fact_claims: [],
      event_claims: [],
      state_claims: [],
      foreshadow_candidates: [],
      inference_only: []
      // ❌ 不包含 concept_mentions（这不是 Extract 的职责）
    };

    // 1. 处理 fact_claims（去重、丢弃不完整项）
    if (extracted.fact_claims && Array.isArray(extracted.fact_claims)) {
      const seen = new Set();
      for (const claim of extracted.fact_claims) {
        // 丢弃不完整项（缺 evidence 或 certainty）
        if (!claim.evidence || typeof claim.certainty !== 'number') {
          console.log(`   ⚠️  丢弃不完整的事实主张: 缺少 evidence 或 certainty`);
          continue;
        }

        // 去重（基于 subject + predicate + value）
        const key = `${claim.subject || ''}_${claim.predicate || ''}_${claim.value || ''}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        // 确保 certainty >= 0.7（否则应该进入 inference_only）
        if (claim.certainty < 0.7) {
          console.log(`   ⚠️  事实主张 certainty < 0.7，移至 inference_only`);
          cleaned.inference_only.push({
            claim: `${claim.subject} ${claim.predicate} ${claim.value}`,
            basis: claim.evidence,
            certainty: claim.certainty
          });
          continue;
        }

        cleaned.fact_claims.push(claim);
      }
    }

    // 2. 处理 state_claims（去重、丢弃不完整项）
    if (extracted.state_claims && Array.isArray(extracted.state_claims)) {
      const seen = new Set();
      for (const claim of extracted.state_claims) {
        // 丢弃不完整项
        if (!claim.evidence || typeof claim.certainty !== 'number' || !claim.character || !claim.field) {
          console.log(`   ⚠️  丢弃不完整的状态主张`);
          continue;
        }

        // 去重（基于 character + field）
        const key = `${claim.character}_${claim.field}`;
        if (seen.has(key)) {
          // 合并同证据（保留 certainty 更高的）
          const existing = cleaned.state_claims.find(c => c.character === claim.character && c.field === claim.field);
          if (existing && claim.certainty > existing.certainty) {
            Object.assign(existing, claim);
          }
          continue;
        }
        seen.add(key);

        cleaned.state_claims.push(claim);
      }
    }

    // 3. 处理 foreshadow_candidates（去重、丢弃不完整项）
    if (extracted.foreshadow_candidates && Array.isArray(extracted.foreshadow_candidates)) {
      const seen = new Set();
      for (const candidate of extracted.foreshadow_candidates) {
        // 丢弃不完整项
        if (!candidate.evidence || typeof candidate.certainty !== 'number') {
          console.log(`   ⚠️  丢弃不完整的伏笔候选`);
          continue;
        }

        // 去重（基于 title 或 hint）
        const key = candidate.title || candidate.hint || '';
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        cleaned.foreshadow_candidates.push(candidate);
      }
    }

    // 4. 处理 inference_only（去重、丢弃不完整项）
    if (extracted.inference_only && Array.isArray(extracted.inference_only)) {
      const seen = new Set();
      for (const inference of extracted.inference_only) {
        // 丢弃不完整项
        if (!inference.claim || typeof inference.certainty !== 'number') {
          console.log(`   ⚠️  丢弃不完整的推断`);
          continue;
        }

        // 去重（基于 claim）
        if (seen.has(inference.claim)) {
          continue;
        }
        seen.add(inference.claim);

        cleaned.inference_only.push(inference);
      }
    }

    // 5. 处理 event_claims（去重、丢弃不完整项）
    if (extracted.event_claims && Array.isArray(extracted.event_claims)) {
      const seen = new Set();
      for (const claim of extracted.event_claims) {
        // 丢弃不完整项
        if (!claim.evidence || typeof claim.certainty !== 'number' || !claim.type || !claim.subject) {
          console.log(`   ⚠️  丢弃不完整的事件主张`);
          continue;
        }

        // 去重（基于 type + subject + result）
        const key = `${claim.type}_${claim.subject}_${claim.result || ''}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        cleaned.event_claims.push(claim);
      }
    }

    // ❌ concept_mentions 不属于 Extract 输出
    // 如果存在，记录警告但不处理
    if (extracted.concept_mentions && extracted.concept_mentions.length > 0) {
      console.log(`   ⚠️  检测到 concept_mentions，已忽略（这不是 Extract 的职责）`);
    }

    // 转换格式以兼容旧的 ChapterFinalizer（向后兼容）
    // 将 fact_claims 转换为 fact_candidates
    cleaned.fact_candidates = cleaned.fact_claims.map(claim => ({
      statement: `${claim.subject} ${claim.predicate} ${claim.value}`,
      type: claim.type || 'character_level',
      subject: claim.subject,
      predicate: claim.predicate,
      value: claim.value,
      confidence: claim.certainty >= 0.9 ? 'canonical' : 'observed',
      evidence: claim.evidence,
      certainty: claim.certainty
    }));

    // 将 state_claims 转换为 character_states
    cleaned.character_states = cleaned.state_claims.map(claim => ({
      character_name: claim.character,
      state_change: { [claim.field]: claim.value },
      chapter: cleaned.chapter,
      type: claim.field === 'level' ? 'level_breakthrough' : 'irreversible_change'
    }));

    // 转换 foreshadow_candidates 格式
    cleaned.foreshadow_candidates = cleaned.foreshadow_candidates.map(candidate => ({
      surface: candidate.surface || candidate.title || candidate.hint || '',
      implied_future: candidate.hint || '',
      chapter: cleaned.chapter
    }));

    // 处理 narrative_claim events（文本明示但受世界约束）
    // 这些应该从 inference_only 中提取出来
    const validator = new ExtractValidator();
    const narrativeClaims = cleaned.inference_only.filter(inf => {
      // 如果 basis 是明确的文本引用，且 claim 是状态相关，转为 narrative_claim
      return inf.basis && inf.basis.length > 20 && 
             (inf.claim.includes('展现') || inf.claim.includes('描写为') || 
              inf.claim.includes('被描写') || inf.claim.includes('声称'));
    });

    for (const narrative of narrativeClaims) {
      // 从 inference_only 中移除
      cleaned.inference_only = cleaned.inference_only.filter(inf => inf !== narrative);
      
      // 添加到 event_claims
      cleaned.event_claims.push({
        type: 'narrative_claim',
        subject: this.extractSubjectFromClaim(narrative.claim),
        content: narrative.claim,
        evidence: narrative.basis,
        certainty: narrative.certainty || 0.8
      });
    }

    // 再次过滤 inference_only，移除状态归因推断
    cleaned.inference_only = cleaned.inference_only.filter(inf => {
      if (validator.isStateIdentityInference(inf.claim)) {
        console.log(`   ⚠️  移除状态归因推断: ${inf.claim}`);
        return false;
      }
      return true;
    });

    console.log(`   🧹 清理完成: ${cleaned.fact_claims.length} 个事实主张, ${cleaned.event_claims.length} 个事件主张, ${cleaned.state_claims.length} 个状态主张, ${cleaned.foreshadow_candidates.length} 个伏笔候选, ${cleaned.inference_only.length} 个推断`);

    return cleaned;
  }

  /**
   * 从 claim 中提取 subject
   */
  extractSubjectFromClaim(claim) {
    if (!claim || typeof claim !== 'string') {
      return 'unknown';
    }

    // 简单提取：假设第一个词是 subject
    const words = claim.split(/\s+/);
    return words[0] || 'unknown';
  }

}

module.exports = IntelligentExtractor;

