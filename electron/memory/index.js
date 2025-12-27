/**
 * Memory Manager - 记忆管理器
 * 统一管理所有类型的记忆
 */

const WorldMemory = require('./worldMemory');
const CharacterMemory = require('./characterMemory');
const PlotMemory = require('./plotMemory');
const ForeshadowMemory = require('./foreshadowMemory');
const SettingExtractor = require('./settingExtractor');
const IntelligentExtractor = require('./intelligentExtractor');

class MemoryManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.world = null;
    this.character = null;
    this.plot = null;
    this.foreshadow = null;
    this.initialized = false;
    this.settingExtractor = new SettingExtractor(workspaceRoot);
    this.llmConfig = null; // LLM 配置，稍后设置
    this.vectorIndex = null; // 向量索引，稍后设置
  }

  /**
   * 设置 LLM 配置
   */
  setLLMConfig(config) {
    this.llmConfig = config;
  }

  /**
   * 设置向量索引
   */
  setVectorIndex(vectorIndex) {
    this.vectorIndex = vectorIndex;
  }

  /**
   * 初始化所有记忆系统
   */
  async initialize(llmConfig = null) {
    try {
      console.log('🚀 初始化 Novel Agent 记忆系统...');

      // 保存 LLM 配置
      if (llmConfig) {
        this.setLLMConfig(llmConfig);
      }

      // 初始化各个记忆模块
      this.world = new WorldMemory(this.workspaceRoot);
      await this.world.initialize();

      this.character = new CharacterMemory(this.workspaceRoot);
      await this.character.initialize();

      this.plot = new PlotMemory(this.workspaceRoot);
      await this.plot.initialize();

      this.foreshadow = new ForeshadowMemory(this.workspaceRoot);
      await this.foreshadow.initialize();

      // 自动提取设定文件信息（简单提取）
      await this.autoExtractSettings();

      // 智能提取（使用 LLM 解析文件内容）
      if (this.llmConfig) {
        await this.intelligentExtract();
      } else {
        console.log('ℹ️ 未配置 LLM，跳过智能提取');
      }

      this.initialized = true;
      console.log('✅ 记忆系统初始化完成');
      
      return { success: true };
    } catch (error) {
      console.error('❌ 记忆系统初始化失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 智能提取文件内容（使用 LLM）
   * @param {object} options - 提取选项
   * @param {number} options.chapterBatchSize - 章节批处理大小
   * @param {number} options.maxChapters - 最大处理章节数（0表示全部）
   * @param {function} options.onProgress - 进度回调
   */
  async intelligentExtract(options = {}) {
    if (!this.llmConfig) {
      console.log('ℹ️ LLM 未配置，跳过智能提取');
      return { success: false, error: 'LLM 未配置' };
    }

    try {
      console.log('🧠 开始智能提取文件内容...');
      
      const extractor = new IntelligentExtractor(
        this.workspaceRoot,
        this,
        this.llmConfig,
        this.vectorIndex // 传递向量索引
      );

      // 设置进度回调
      if (options.onProgress) {
        extractor.setProgressCallback(options.onProgress);
      }

      const result = await extractor.extractAll({
        chapterBatchSize: options.chapterBatchSize || 5,
        maxChapters: options.maxChapters || 0
      });
      
      console.log('✅ 智能提取完成');
      return result;
    } catch (error) {
      console.error('❌ 智能提取失败（不影响初始化）:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 自动提取设定文件信息
   */
  async autoExtractSettings() {
    try {
      // 检查是否有设定文件
      if (!this.settingExtractor.hasSettingFiles()) {
        console.log('ℹ️ 未找到设定文件，跳过自动提取');
        return;
      }

      console.log('📚 开始提取设定文件信息...');
      const extracted = await this.settingExtractor.extractAll();

      // 1. 更新世界观规则
      if (extracted.worldRules) {
        try {
          // 将原始内容添加到自定义规则中
          const worldData = this.world.getData();
          if (!worldData.custom_rules) {
            worldData.custom_rules = [];
          }

          // 添加设定文件内容作为规则
          for (const sourceFile of extracted.worldRules.source_files) {
            worldData.custom_rules.push({
              id: `setting_${sourceFile}`,
              type: 'world_rule',
              name: `设定文件: ${sourceFile}`,
              description: `来自 ${sourceFile} 的设定`,
              content: extracted.worldRules.raw_content,
              source: sourceFile
            });
          }

          await this.world.save();
          console.log('✅ 世界观规则已更新');
        } catch (err) {
          console.warn('⚠️ 更新世界观规则失败:', err.message);
        }
      }

      // 2. 添加角色
      if (extracted.characters.length > 0) {
        for (const charInfo of extracted.characters) {
          try {
            // 检查角色是否已存在
            const existing = this.character.getCharacter(charInfo.name);
            if (!existing) {
              // 添加新角色
              await this.character.addCharacter({
                name: charInfo.name,
                role: 'supporting', // 默认配角，后续可以优化识别主角
                personality: {
                  description: `来自 ${charInfo.source} 的角色`
                }
              });
              console.log(`✅ 添加角色: ${charInfo.name}`);
            }
          } catch (err) {
            console.warn(`⚠️ 添加角色失败: ${charInfo.name}`, err.message);
          }
        }
      }

      // 3. 更新剧情信息
      if (extracted.plotInfo) {
        try {
          const plotData = this.plot.getData();
          
          // 更新当前阶段（基于章节数）
          if (extracted.plotInfo.totalChapters > 0) {
            let stage = '初期';
            if (extracted.plotInfo.totalChapters > 20) {
              stage = '后期';
            } else if (extracted.plotInfo.totalChapters > 10) {
              stage = '中期';
            }

            plotData.main_plotline.current_stage = stage;
            plotData.main_plotline.total_chapters = extracted.plotInfo.totalChapters;
            plotData.main_plotline.latest_chapter = extracted.plotInfo.latestChapter;

            await this.plot.save();
            console.log(`✅ 剧情信息已更新: 共 ${extracted.plotInfo.totalChapters} 章，当前阶段: ${stage}`);
          }
        } catch (err) {
          console.warn('⚠️ 更新剧情信息失败:', err.message);
        }
      }

      console.log('✅ 设定文件信息提取完成');
    } catch (error) {
      console.warn('⚠️ 自动提取设定文件失败（不影响初始化）:', error.message);
    }
  }

  /**
   * 检查是否已初始化
   */
  checkInitialized() {
    if (!this.initialized) {
      throw new Error('记忆系统未初始化，请先调用 initialize()');
    }
  }

  /**
   * 获取所有记忆的摘要
   */
  async getSummary() {
    this.checkInitialized();

    return {
      world: {
        has_cultivation_system: !!this.world.getData().world_rules.cultivation_system?.levels?.length,
        has_magic_system: !!this.world.getData().world_rules.magic_system?.elements?.length,
        custom_rules_count: this.world.getData().custom_rules?.length || 0
      },
      character: {
        total_characters: this.character.getAllCharacters().length,
        main_characters: this.character.getMainCharacters().length
      },
      plot: {
        current_stage: this.plot.getData().main_plotline.current_stage,
        completed_events_count: this.plot.getData().main_plotline.completed_events?.length || 0,
        pending_goals_count: this.plot.getData().main_plotline.pending_goals?.length || 0
      },
      foreshadow: this.foreshadow.getStatistics()
    };
  }

  /**
   * 加载上下文（供 Agent 使用）
   * @param {Object} request - 用户请求
   */
  async loadContext(request) {
    this.checkInitialized();

    const context = {
      world_rules: this.world.getRules(),
      characters: [],
      plot_state: this.plot.getCurrentState(),
      foreshadows: {
        pending: this.foreshadow.getPendingForeshadows(),
        revealed: this.foreshadow.getRevealedForeshadows()
      }
    };

    // 提取请求中提到的角色
    const mentionedChars = this.extractMentionedCharacters(request);
    if (mentionedChars.length > 0) {
      context.characters = this.character.getRelevantContext(mentionedChars);
    } else {
      // 如果没有明确提到，加载主要角色
      context.characters = this.character.getMainCharacters();
    }

    return context;
  }

  /**
   * 从请求中提取提到的角色（简化版）
   */
  extractMentionedCharacters(request) {
    const characters = [];
    const allChars = this.character.getAllCharacters();

    for (const char of allChars) {
      if (request.includes(char.name)) {
        characters.push(char.name);
      }
    }

    return characters;
  }

  /**
   * 更新记忆（基于文本内容）
   * @param {Object} updates - 更新内容
   */
  async updateFromText(updates) {
    this.checkInitialized();

    const results = {
      world: false,
      character: false,
      plot: false,
      foreshadow: false
    };

    try {
      // 更新世界规则
      if (updates.world_rules) {
        await this.world.updateRules(updates.world_rules);
        results.world = true;
      }

      // 更新角色状态
      if (updates.character_updates) {
        for (const [charName, stateUpdates] of Object.entries(updates.character_updates)) {
          try {
            await this.character.updateCharacterState(charName, stateUpdates);
            results.character = true;
          } catch (e) {
            console.warn(`角色更新失败: ${charName}`, e.message);
          }
        }
      }

      // 添加角色历史
      if (updates.character_history) {
        for (const [charName, event] of Object.entries(updates.character_history)) {
          try {
            await this.character.addCharacterHistory(charName, event);
            results.character = true;
          } catch (e) {
            console.warn(`角色历史添加失败: ${charName}`, e.message);
          }
        }
      }

      // 更新剧情
      if (updates.plot_updates) {
        if (updates.plot_updates.completed_events) {
          for (const event of updates.plot_updates.completed_events) {
            await this.plot.addCompletedEvent(event);
          }
          results.plot = true;
        }

        if (updates.plot_updates.timeline_events) {
          for (const event of updates.plot_updates.timeline_events) {
            await this.plot.addTimelineEvent(event);
          }
          results.plot = true;
        }

        if (updates.plot_updates.current_stage) {
          await this.plot.updateCurrentStage(updates.plot_updates.current_stage);
          results.plot = true;
        }
      }

      // 添加新伏笔
      if (updates.new_foreshadows) {
        for (const foreshadow of updates.new_foreshadows) {
          await this.foreshadow.addForeshadow(foreshadow);
        }
        results.foreshadow = true;
      }

      // 更新伏笔状态
      if (updates.foreshadow_updates) {
        for (const update of updates.foreshadow_updates) {
          if (update.action === 'reveal') {
            await this.foreshadow.revealForeshadow(update.id, update.details);
            results.foreshadow = true;
          } else if (update.action === 'resolve') {
            await this.foreshadow.resolveForeshadow(update.id, update.details);
            results.foreshadow = true;
          }
        }
      }

      console.log('✅ 记忆更新完成:', results);
      return { success: true, updated: results };

    } catch (error) {
      console.error('❌ 记忆更新失败:', error);
      return { success: false, error: error.message, partial_results: results };
    }
  }

  /**
   * 查询所有记忆
   */
  async query(searchQuery) {
    this.checkInitialized();

    const results = {
      world: this.world.queryRules(searchQuery),
      characters: this.character.queryCharacters(searchQuery),
      plot: this.plot.queryPlot(searchQuery),
      foreshadows: this.foreshadow.queryForeshadows(searchQuery)
    };

    return results;
  }

  /**
   * 重置所有记忆
   */
  async resetAll() {
    this.checkInitialized();

    await this.world.reset();
    await this.character.reset();
    await this.plot.reset();
    await this.foreshadow.reset();

    console.log('🔄 所有记忆已重置');
    return { success: true };
  }

  /**
   * 导出所有记忆（用于备份）
   */
  async exportAll() {
    this.checkInitialized();

    return {
      exported_at: new Date().toISOString(),
      workspace: this.workspaceRoot,
      memories: {
        world: this.world.getData(),
        character: this.character.getData(),
        plot: this.plot.getData(),
        foreshadow: this.foreshadow.getData()
      }
    };
  }

  /**
   * 导入记忆（用于恢复）
   */
  async importAll(exportedData) {
    this.checkInitialized();

    try {
      if (exportedData.memories.world) {
        this.world.data = exportedData.memories.world;
        await this.world.save();
      }

      if (exportedData.memories.character) {
        this.character.data = exportedData.memories.character;
        await this.character.save();
      }

      if (exportedData.memories.plot) {
        this.plot.data = exportedData.memories.plot;
        await this.plot.save();
      }

      if (exportedData.memories.foreshadow) {
        this.foreshadow.data = exportedData.memories.foreshadow;
        await this.foreshadow.save();
      }

      console.log('✅ 记忆导入完成');
      return { success: true };

    } catch (error) {
      console.error('❌ 记忆导入失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = MemoryManager;

