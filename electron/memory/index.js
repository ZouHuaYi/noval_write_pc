/**
 * Memory Manager - 记忆管理器
 * 统一管理所有类型的记忆
 */

const WorldMemory = require('./core/worldMemory');
const CharacterMemory = require('./core/characterMemory');
const PlotMemory = require('./core/plotMemory');
const ForeshadowMemory = require('./core/foreshadowMemory');
const SettingExtractor = require('./extractors/settingExtractor');
const IntelligentExtractor = require('./extractors/intelligentExtractor');
const ChapterFinalizer = require('./finalizer/chapterFinalizer');
const ExtractWriter = require('./extractors/extractWriter');
const ConceptResolver = require('./finalizer/conceptResolver');
const ForeshadowPanel = require('./finalizer/foreshadowPanel');
const CharacterStateKnowledge = require('./finalizer/characterStateKnowledge');

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
    // 新架构组件
    this.chapterFinalizer = new ChapterFinalizer(workspaceRoot);
    this.extractWriter = new ExtractWriter(workspaceRoot);
    this.conceptResolver = new ConceptResolver(workspaceRoot);
    this.foreshadowPanel = new ForeshadowPanel(workspaceRoot);
    this.characterStateKnowledge = new CharacterStateKnowledge(workspaceRoot);
    // 缓存 ExtractCleaner 实例
    this.extractCleaner = null;
  }

  /**
   * 设置 LLM 配置（同时传递给新架构组件）
   */
  setLLMConfig(config) {
    this.llmConfig = config;
    // 传递给 ChapterFinalizer 用于语义相似度
    if (config && config.baseUrl && config.apiKey) {
      // 从数据库获取默认的 embedding 模型配置
      let embeddingConfig = {
        ...config,
        embeddingModel: config.embeddingModel || 'text-embedding-ada-002'
      };

      try {
        const { embeddingModels } = require('../core/database');
        const defaultEmbeddingModel = embeddingModels.getDefault();
        if (defaultEmbeddingModel && defaultEmbeddingModel.base_url && defaultEmbeddingModel.api_key && defaultEmbeddingModel.model) {
          // 使用数据库中的 embedding 模型配置
          embeddingConfig = {
            baseUrl: defaultEmbeddingModel.base_url,
            apiKey: defaultEmbeddingModel.api_key,
            embeddingModel: defaultEmbeddingModel.model
          };
          console.log(`📊 使用 Embedding 模型: ${defaultEmbeddingModel.name || defaultEmbeddingModel.model}`);
        } else if (config.embeddingModel) {
          // 如果 config 中已有 embeddingModel，使用它
          console.log(`📊 使用配置中的 Embedding 模型: ${config.embeddingModel}`);
        } else {
          console.warn('⚠️ 未找到 Embedding 模型配置，使用默认值');
        }
      } catch (error) {
        console.warn('⚠️ 获取 Embedding 模型配置失败:', error.message);
        // 继续使用默认配置
      }

      this.chapterFinalizer.setLLMConfig(embeddingConfig);
    }
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
        // 检查是否已有记忆数据
        const hasMemoryData = this.hasMemoryData();
        
        if (hasMemoryData) {
          console.log('📚 检测到已有记忆数据，使用增量模式（只处理新文件）...');
          // 已有记忆数据，使用增量模式，只处理新文件或已修改的文件
          await this.intelligentExtract({
            forceRescan: false, // 增量模式，不强制扫描
            chapterBatchSize: 5,
            maxChapters: 0
          });
        } else {
          console.log('🔄 首次初始化，将扫描所有文件...');
          // 没有记忆数据，强制扫描所有文件
          await this.intelligentExtract({
            forceRescan: true, // 首次初始化，强制扫描所有文件
            chapterBatchSize: 5,
            maxChapters: 0
          });
        }
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
   * 检查是否已有记忆数据
   * @returns {boolean} 如果已有记忆数据返回 true，否则返回 false
   */
  hasMemoryData() {
    try {
      const fs = require('fs');
      const path = require('path');
      const memoryDir = path.join(this.workspaceRoot, '.novel-agent');
      
      // 检查记忆目录是否存在
      if (!fs.existsSync(memoryDir)) {
        return false;
      }
      
      // 检查各个记忆文件是否存在且有内容
      const memoryFiles = [
        'character-memory.json',
        'plot-memory.json',
        'world-memory.json',
        'foreshadow-memory.json'
      ];
      
      let hasData = false;
      for (const filename of memoryFiles) {
        const filepath = path.join(memoryDir, filename);
        if (fs.existsSync(filepath)) {
          try {
            const content = fs.readFileSync(filepath, 'utf-8');
            const data = JSON.parse(content);
            
            // 检查是否有实际数据（不是空对象或默认数据）
            if (filename === 'character-memory.json') {
              // 检查是否有角色数据
              if (data.characters && Object.keys(data.characters).length > 0) {
                hasData = true;
                break;
              }
            } else if (filename === 'plot-memory.json') {
              // 检查是否有剧情数据
              if (data.main_plotline && (
                data.main_plotline.completed_events?.length > 0 ||
                data.main_plotline.pending_goals?.length > 0 ||
                data.main_plotline.current_stage
              )) {
                hasData = true;
                break;
              }
            } else if (filename === 'world-memory.json') {
              // 检查是否有世界观数据
              if (data.custom_rules?.length > 0 || 
                  data.world_rules?.cultivation_system ||
                  data.world_rules?.magic_system) {
                hasData = true;
                break;
              }
            } else if (filename === 'foreshadow-memory.json') {
              // 检查是否有伏笔数据
              if (data.foreshadows?.length > 0) {
                hasData = true;
                break;
              }
            }
          } catch (err) {
            // 文件损坏，忽略
            continue;
          }
        }
      }
      
      return hasData;
    } catch (error) {
      console.warn('⚠️ 检查记忆数据失败:', error.message);
      // 出错时默认认为没有记忆数据，需要扫描
      return false;
    }
  }


  /**
   * 智能提取文件内容（使用 LLM）
   * @param {object} options - 提取选项
   * @param {number} options.chapterBatchSize - 章节批处理大小
   * @param {number} options.maxChapters - 最大处理章节数（0表示全部）
   * @param {boolean} options.forceRescan - 是否强制重新扫描（默认false）
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
        maxChapters: options.maxChapters || 0,
        forceRescan: options.forceRescan || false // 传递 forceRescan 参数
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
            if (extracted.plotInfo.totalChapters > 100) {
              stage = '后期';
            } else if (extracted.plotInfo.totalChapters > 50) {
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
   * @param {Object|string} request - 用户请求或配置对象
   * @param {Object} options - 选项
   * @param {string} options.perspective - 视角类型: 'omniscient' | 'limited' | 'first_person'
   * @param {string} options.perspectiveCharacter - 视角角色（limited 时使用）
   * @param {number} options.chapter - 当前章节号
   */
  async loadContext(request, options = {}) {
    this.checkInitialized();

    // 解析请求
    const requestStr = typeof request === 'string' ? request : request.text || '';
    const perspective = options.perspective || this.detectPerspective(requestStr);
    const perspectiveCharacter = options.perspectiveCharacter || this.extractPerspectiveCharacter(requestStr);
    const chapter = options.chapter || this.getCurrentChapter();

    // 加载基础数据
    const worldRules = this.world.getRules();
    const plotState = this.plot.getCurrentState();
    const allFacts = this.getAllFacts();
    const allForeshadows = this.getAllForeshadows();
    const characterStates = this.characterStateKnowledge.getAllCharactersSummary();

    // 构建 Narrative Context
    const context = {
      world_rules: worldRules,
      visible_characters: [],
      plot_progress: plotState,
      available_foreshadows: [],
      forbidden_knowledge: [],
      narrative_constraints: {
        cannot_happen: [],
        must_respect: []
      },
      perspective: {
        type: perspective,
        character: perspectiveCharacter || null
      },
      chapter: chapter
    };

    // 1. 过滤事实（按章节和置信度）
    const visibleFacts = this.filterFactsByNarrative(allFacts, chapter, perspective, perspectiveCharacter);
    context.visible_facts = visibleFacts;

    // 2. 过滤角色（基于视角）
    const mentionedChars = this.extractMentionedCharacters(requestStr);
    if (perspective === 'limited' && perspectiveCharacter) {
      // 限制视角：只显示该角色知道的信息
      context.visible_characters = this.getCharacterContextLimited(perspectiveCharacter, chapter);
    } else if (mentionedChars.length > 0) {
      context.visible_characters = this.character.getRelevantContext(mentionedChars);
    } else {
      context.visible_characters = this.character.getMainCharacters();
    }

    // 3. 过滤伏笔（按状态和视角）
    context.available_foreshadows = this.filterForeshadowsByNarrative(
      allForeshadows,
      chapter,
      perspective,
      perspectiveCharacter
    );

    // 4. 构建叙事约束
    context.narrative_constraints = this.buildNarrativeConstraints(
      visibleFacts,
      context.available_foreshadows,
      perspective,
      perspectiveCharacter,
      chapter
    );

    // 5. 添加禁止知识（角色不应该知道的信息）
    context.forbidden_knowledge = this.getForbiddenKnowledge(
      allFacts,
      visibleFacts,
      allForeshadows,
      context.available_foreshadows,
      perspective,
      perspectiveCharacter
    );

    return context;
  }

  /**
   * 检测视角类型
   */
  detectPerspective(request) {
    if (!request || typeof request !== 'string') {
      return 'omniscient';
    }
    
    const lower = request.toLowerCase();
    if (lower.includes('第一人称') || lower.includes('我') || lower.includes('first person')) {
      return 'first_person';
    }
    if (lower.includes('限制视角') || lower.includes('limited') || lower.includes('视角')) {
      return 'limited';
    }
    return 'omniscient';
  }

  /**
   * 提取视角角色
   */
  extractPerspectiveCharacter(request) {
    if (!request || typeof request !== 'string') {
      return null;
    }
    
    // 尝试从请求中提取角色名
    const allChars = this.character.getAllCharacters();
    for (const char of allChars) {
      if (request.includes(char.name)) {
        return char.name;
      }
    }
    return null;
  }

  /**
   * 获取当前章节号
   */
  getCurrentChapter() {
    const storyState = this.getStoryState();
    return storyState.chapter || 0;
  }

  /**
   * 按叙事规则过滤事实
   */
  filterFactsByNarrative(facts, chapter, perspective, perspectiveCharacter) {
    return facts.filter(fact => {
      // 只包含该章节之前或当前章节的事实
      if (fact.introduced_at?.chapter > chapter) {
        return false;
      }
      
      // 限制视角：只包含该角色可能知道的事实
      if (perspective === 'limited' && perspectiveCharacter) {
        // 如果事实涉及该角色，则可见
        if (fact.subject === perspectiveCharacter) {
          return true;
        }
        // 如果事实发生在该角色在场的地方，则可见
        // 这里简化处理，实际应该检查位置信息
        return true; // 暂时全部可见，后续可以优化
      }
      
      return true;
    });
  }

  /**
   * 获取限制视角的角色上下文
   */
  getCharacterContextLimited(characterName, chapter) {
    const char = this.character.getCharacter(characterName);
    if (!char) {
      return [];
    }

    // 获取该角色的当前状态
    const state = this.characterStateKnowledge.getCharacterCurrentStateMerged(characterName);
    
    return [{
      ...char,
      current_state: state?.current || char.current_state,
      known_facts: this.getCharacterKnownFacts(characterName, chapter),
      known_characters: this.getCharacterKnownCharacters(characterName, chapter)
    }];
  }

  /**
   * 获取角色已知的事实
   */
  getCharacterKnownFacts(characterName, chapter) {
    const allFacts = this.getAllFacts();
    return allFacts.filter(fact => {
      // 涉及该角色的事实
      if (fact.subject === characterName) {
        return true;
      }
      // 该角色在场时发生的事实（简化处理）
      return fact.introduced_at?.chapter <= chapter;
    });
  }

  /**
   * 获取角色已知的其他角色
   */
  getCharacterKnownCharacters(characterName, chapter) {
    const allChars = this.character.getAllCharacters();
    const char = this.character.getCharacter(characterName);
    if (!char) {
      return [];
    }

    // 返回有关系的角色
    return allChars.filter(c => {
      if (c.name === characterName) return false;
      if (char.relationships?.[c.name]) return true;
      return true; // 简化处理
    });
  }

  /**
   * 按叙事规则过滤伏笔
   */
  filterForeshadowsByNarrative(foreshadows, chapter, perspective, perspectiveCharacter) {
    return foreshadows.map(fs => {
      const isRevealed = fs.state === 'revealed' || fs.state === 'archived';
      const isPending = fs.state === 'pending';
      
      // 未揭示的伏笔：只给 hint，不给 detail
      if (isPending) {
        return {
          id: fs.id || fs.concept_id,
          hint_only: true,
          detail_visible: false,
          state: fs.state,
          introduced_in: fs.introduced_in
        };
      }
      
      // 已揭示的伏笔：可以给完整信息
      return {
        id: fs.id || fs.concept_id,
        hint_only: false,
        detail_visible: true,
        state: fs.state,
        introduced_in: fs.introduced_in,
        implied_future: fs.implied_future
      };
    });
  }

  /**
   * 构建叙事约束
   */
  buildNarrativeConstraints(facts, foreshadows, perspective, perspectiveCharacter, chapter) {
    const constraints = {
      cannot_happen: [],
      must_respect: []
    };

    // 基于事实的约束
    for (const fact of facts) {
      if (fact.type === 'character_death' && fact.status === 'valid') {
        constraints.cannot_happen.push(`${fact.subject} 死亡`);
      }
    }

    // 基于视角的约束
    if (perspective === 'limited' && perspectiveCharacter) {
      constraints.must_respect.push(`${perspectiveCharacter} 尚未知道某些信息`);
      
      // 未揭示的伏笔：角色不应该明确知道
      for (const fs of foreshadows) {
        if (fs.hint_only && !fs.detail_visible) {
          constraints.must_respect.push(`伏笔 ${fs.id} 尚未揭示，只能暗示`);
        }
      }
    }

    return constraints;
  }

  /**
   * 获取禁止知识（角色不应该知道的信息）
   */
  getForbiddenKnowledge(allFacts, visibleFacts, allForeshadows, availableForeshadows, perspective, perspectiveCharacter) {
    const forbidden = [];

    if (perspective === 'limited' && perspectiveCharacter) {
      // 找出不可见的事实
      const visibleFactIds = new Set(visibleFacts.map(f => f.id));
      for (const fact of allFacts) {
        if (!visibleFactIds.has(fact.id)) {
          forbidden.push({
            type: 'fact',
            id: fact.id,
            reason: `${perspectiveCharacter} 不应该知道此信息`
          });
        }
      }

      // 找出不可见的伏笔详情
      for (const fs of allForeshadows) {
        const available = availableForeshadows.find(af => af.id === (fs.id || fs.concept_id));
        if (available && available.hint_only) {
          forbidden.push({
            type: 'foreshadow',
            id: fs.id || fs.concept_id,
            reason: '伏笔尚未揭示，只能暗示'
          });
        }
      }
    }

    return forbidden;
  }

  /**
   * 从请求中提取提到的角色
   * 优化：支持更智能的匹配（考虑角色别名、昵称等）
   */
  extractMentionedCharacters(request) {
    if (!request || typeof request !== 'string') {
      return [];
    }

    const characters = [];
    const allChars = this.character.getAllCharacters();
    const requestLower = request.toLowerCase();

    for (const char of allChars) {
      const charNameLower = char.name.toLowerCase();
      // 精确匹配或包含匹配
      if (requestLower.includes(charNameLower) || charNameLower.includes(requestLower)) {
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

      // 更新角色状态（支持状态迁移历史）
      if (updates.character_updates) {
        console.log(`   📝 更新角色状态 (${Object.keys(updates.character_updates).length} 个角色)...`);
        
        // 从 character_history 中提取章节号（如果存在）
        const chapterMap = {};
        if (updates.character_history) {
          for (const [charName, event] of Object.entries(updates.character_history)) {
            if (event.chapter) {
              chapterMap[charName] = event.chapter;
            }
          }
        }

        // 处理删除的角色状态（如果章节被重写）
        if (updates.character_updates._delete_by_chapter) {
          for (const chapterNum of updates.character_updates._delete_by_chapter) {
            const allChars = this.character.getAllCharacters();
            for (const char of allChars) {
              // 使用合并后的方法，一次性删除状态历史和历史记录
              await this.character.removeHistoryByChapter(char.name, chapterNum, { 
                stateHistory: true, 
                history: true 
              });
            }
            console.log(`     ✅ 已清理第${chapterNum}章的所有角色状态历史`);
            results.character = true;
          }
        }

        for (const [charName, stateUpdates] of Object.entries(updates.character_updates)) {
          // 跳过特殊字段
          if (charName.startsWith('_')) continue;
          
          try {
            // 先检查角色是否存在
            const existing = this.character.getCharacter(charName);
            if (!existing) {
              // 如果角色不存在，先创建
              console.log(`     ⚠️ 角色不存在，先创建: ${charName}`);
              await this.character.addCharacter({
                name: charName,
                role: 'supporting',
                current_state: stateUpdates
              });
            }
            
            // 更新角色状态（如果章节被重写，先删除旧状态）
            const chapter = chapterMap[charName] || updates.chapter || null;
            await this.character.updateCharacterState(
              charName, 
              stateUpdates,
              {
                chapter: chapter,
                source: 'memory_updater',
                replaceChapter: updates.replace_chapter || null // 如果提供，会先删除该章节的旧状态
              }
            );
            console.log(`     ✅ 已更新角色: ${charName}`);
            results.character = true;
          } catch (e) {
            console.warn(`     ❌ 角色更新失败: ${charName}`, e.message);
          }
        }
      }

      // 添加角色历史
      if (updates.character_history) {
        const historyCount = Object.keys(updates.character_history).length;
        console.log(`   📚 添加角色历史 (${historyCount} 个)...`);
        for (const [charName, event] of Object.entries(updates.character_history)) {
          try {
            await this.character.addCharacterHistory(charName, event);
            console.log(`     ✅ 已添加历史: ${charName} - ${event.event || '事件'}`);
            results.character = true;
          } catch (e) {
            console.warn(`     ❌ 角色历史添加失败: ${charName}`, e.message);
          }
        }
      }

      // 更新剧情（支持删除、更新、新增）
      if (updates.plot_updates) {
        console.log(`   📖 更新剧情信息...`);
        results.plot = await this.updatePlot(updates.plot_updates) || results.plot;
      }

      // 添加新伏笔
      if (updates.new_foreshadows) {
        console.log(`   🔮 添加新伏笔 (${updates.new_foreshadows.length} 个)...`);
        for (const foreshadow of updates.new_foreshadows) {
          await this.foreshadow.addForeshadow(foreshadow);
          console.log(`     ✅ ${foreshadow.title || '伏笔'}`);
        }
        results.foreshadow = true;
      }

      // 更新伏笔状态
      if (updates.foreshadow_updates) {
        console.log(`   🔮 更新伏笔状态 (${updates.foreshadow_updates.length} 个)...`);
        results.foreshadow = await this.updateForeshadows(updates.foreshadow_updates) || results.foreshadow;
      }

      // 更新世界规则
      if (updates.world_rules) {
        console.log(`   🌍 更新世界规则...`);
        await this.world.updateRules(updates.world_rules);
        results.world = true;
        console.log(`     ✅ 世界规则已更新`);
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
    // 重置时不需要检查初始化状态，允许重置未初始化的系统
    try {
      if (this.world) await this.world.reset();
      if (this.character) await this.character.reset();
      if (this.plot) await this.plot.reset();
      if (this.foreshadow) await this.foreshadow.reset();
    } catch (err) {
      console.warn('⚠️ 重置部分记忆模块失败:', err.message);
    }

    // 重置后，标记为未初始化，需要重新初始化
    this.initialized = false;
    console.log('🔄 所有记忆已重置，系统需要重新初始化');
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
   * 优化：合并重复的保存逻辑
   */
  async importAll(exportedData) {
    this.checkInitialized();

    if (!exportedData || !exportedData.memories) {
      return { success: false, error: '无效的导入数据' };
    }

    const memoryModules = [
      { key: 'world', module: this.world },
      { key: 'character', module: this.character },
      { key: 'plot', module: this.plot },
      { key: 'foreshadow', module: this.foreshadow }
    ];

    const results = { success: true, errors: [] };

    for (const { key, module } of memoryModules) {
      if (exportedData.memories[key]) {
        try {
          module.data = exportedData.memories[key];
          await module.save();
        } catch (error) {
          results.errors.push({ module: key, error: error.message });
          results.success = false;
        }
      }
    }

    if (results.success) {
      console.log('✅ 记忆导入完成');
    } else {
      console.error('❌ 记忆导入部分失败:', results.errors);
    }

    return results;
  }

  /**
   * 结算章节（将 ChapterExtract 合并到 Knowledge Core）
   * @param {number} chapterNumber - 章节号
   * @param {boolean} replaceChapter - 是否替换章节（回滚旧效果）
   */
  async finalizeChapter(chapterNumber, replaceChapter = false) {
    this.checkInitialized();
    try {
      await this.chapterFinalizer.finalizeChapter(chapterNumber, replaceChapter);
      return { success: true };
    } catch (error) {
      console.error(`❌ 结算第 ${chapterNumber} 章失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量结算章节
   * @param {number[]} chapterNumbers - 章节号数组
   */
  async finalizeChapters(chapterNumbers) {
    this.checkInitialized();
    try {
      // 确保 chapterNumbers 是纯数字数组
      const validChapterNumbers = chapterNumbers
        .filter(num => typeof num === 'number' && !isNaN(num))
        .map(num => Number(num));
      
      if (validChapterNumbers.length === 0) {
        return { success: false, error: '没有有效的章节号' };
      }

      const results = await this.chapterFinalizer.finalizeChapters(validChapterNumbers);
      
      // 确保返回的数据是可序列化的
      const serializableResults = results.map(r => ({
        chapter: Number(r.chapter),
        success: Boolean(r.success),
        error: r.error ? String(r.error) : undefined
      }));
      
      return { success: true, results: serializableResults };
    } catch (error) {
      console.error('❌ 批量结算失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 读取 ChapterExtract
   * @param {number} chapterNumber - 章节号
   */
  readExtract(chapterNumber) {
    return this.extractWriter.readExtract(chapterNumber);
  }

  /**
   * 列出所有 ChapterExtract
   */
  listExtracts() {
    return this.extractWriter.listExtracts();
  }

  /**
   * 获取所有概念
   */
  getAllConcepts() {
    return this.conceptResolver.getAllConcepts();
  }

  /**
   * 读取核心文件（通用方法，合并了 getAllFacts, getStoryState, getAllForeshadows）
   * @param {string} filename - 文件名（如 'facts.json', 'story_state.json', 'foreshadows.json'）
   * @param {*} defaultValue - 文件不存在时的默认值
   * @returns {*} 文件内容或默认值
   */
  readCoreFile(filename, defaultValue = null) {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(this.workspaceRoot, '.novel-agent', 'core', filename);
      
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ 读取核心文件失败: ${filename}`, error);
      return defaultValue;
    }
  }

  /**
   * 获取所有事实
   */
  getAllFacts() {
    return this.readCoreFile('facts.json', []);
  }

  /**
   * 获取故事状态
   */
  getStoryState() {
    return this.readCoreFile('story_state.json', {
      chapter: 0,
      current_location: '',
      global_tension: '',
      known_threats: [],
      open_mysteries: []
    });
  }

  /**
   * 获取所有伏笔（新架构）
   */
  getAllForeshadows() {
    return this.readCoreFile('foreshadows.json', []);
  }

  /**
   * 获取章节效果
   */
  getChapterEffect(chapterNumber) {
    const ChapterEffectManager = require('./finalizer/chapterEffectManager');
    const effectManager = new ChapterEffectManager(this.workspaceRoot);
    return effectManager.loadEffect(chapterNumber);
  }

  /**
   * 获取依赖此章节的后续章节
   */
  getDependentChapters(chapterNumber) {
    const ChapterEffectManager = require('./finalizer/chapterEffectManager');
    const effectManager = new ChapterEffectManager(this.workspaceRoot);
    return effectManager.getDependentChapters(chapterNumber);
  }

  /**
   * 回滚章节
   */
  async rollbackChapter(chapterNumber) {
    this.checkInitialized();
    try {
      await this.chapterFinalizer.rollbackChapter(chapterNumber);
      return { success: true };
    } catch (error) {
      console.error(`❌ 回滚第 ${chapterNumber} 章失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取推断列表
   */
  getInferences(chapterNumber = null) {
    const InferenceStore = require('./finalizer/inferenceStore');
    const inferenceStore = new InferenceStore(this.workspaceRoot);
    if (chapterNumber) {
      return inferenceStore.getInferencesByChapter(chapterNumber);
    }
    return inferenceStore.getPendingInferences();
  }

  /**
   * 获取依赖图（用于可视化）
   */
  getDependencyGraph() {
    this.checkInitialized();
    const DependencyTracker = require('./finalizer/dependencyTracker');
    const tracker = new DependencyTracker(this.workspaceRoot);
    return tracker.getDependencyGraph();
  }

  /**
   * 获取失效章节列表
   */
  getInvalidatedChapters() {
    this.checkInitialized();
    const DependencyTracker = require('./finalizer/dependencyTracker');
    const tracker = new DependencyTracker(this.workspaceRoot);
    return tracker.getInvalidatedChapters();
  }

  /**
   * 检查章节是否失效
   */
  isChapterInvalidated(chapterNumber) {
    this.checkInitialized();
    const DependencyTracker = require('./finalizer/dependencyTracker');
    const tracker = new DependencyTracker(this.workspaceRoot);
    return tracker.isChapterInvalidated(chapterNumber);
  }

  /**
   * 获取章节的依赖信息
   */
  getChapterDependencies(chapterNumber) {
    this.checkInitialized();
    const DependencyTracker = require('./finalizer/dependencyTracker');
    const tracker = new DependencyTracker(this.workspaceRoot);
    return tracker.getChapterDependencies(chapterNumber);
  }

  /**
   * 获取伏笔回收面板数据
   * @param {number} currentChapter - 当前章节（可选）
   */
  getForeshadowPanelData(currentChapter = null) {
    this.checkInitialized();
    
    const panel = this.foreshadowPanel;
    const data = {
      statistics: panel.getStatistics(),
      byState: panel.getForeshadowsByState(),
      timeline: panel.getTimeline(),
      openMysteries: panel.getOpenMysteries()
    };

    if (currentChapter) {
      data.pendingRecycle = panel.getPendingRecycle(currentChapter);
    }

    return data;
  }

  /**
   * 搜索伏笔
   * @param {string} query - 搜索关键词
   */
  searchForeshadows(query) {
    this.checkInitialized();
    return this.foreshadowPanel.searchForeshadows(query);
  }

  /**
   * 获取人物状态知识（所有角色）
   */
  getAllCharacterStates() {
    this.checkInitialized();
    return this.characterStateKnowledge.getAllCharactersSummary();
  }

  /**
   * 获取特定角色的状态
   * @param {string} characterName - 角色名称
   */
  getCharacterStates(characterName) {
    this.checkInitialized();
    return this.characterStateKnowledge.getCharacterStates(characterName);
  }

  /**
   * 获取角色的当前状态
   * @param {string} characterName - 角色名称
   */
  getCharacterCurrentState(characterName) {
    this.checkInitialized();
    return this.characterStateKnowledge.getCharacterCurrentState(characterName);
  }

  /**
   * 获取人物状态统计
   */
  getCharacterStateStatistics() {
    this.checkInitialized();
    return this.characterStateKnowledge.getStatisticsByType();
  }

  /**
   * 清理已结算的 extracts
   * @param {Array} finalizedChapters - 已结算的章节号列表
   * @param {boolean} dryRun - 是否只是预览
   */
  cleanFinalizedExtracts(finalizedChapters, dryRun = false) {
    this.checkInitialized();
    return this.chapterFinalizer.cleanFinalizedExtracts(finalizedChapters, dryRun);
  }

  /**
   * 获取 ExtractCleaner 实例（缓存）
   */
  getExtractCleaner() {
    if (!this.extractCleaner) {
      const ExtractCleaner = require('./finalizer/extractCleaner');
      this.extractCleaner = new ExtractCleaner(this.workspaceRoot);
    }
    return this.extractCleaner;
  }

  /**
   * 清理过期的 extracts
   * @param {number} maxAgeDays - 最大保留天数
   * @param {boolean} dryRun - 是否只是预览
   */
  cleanOldExtracts(maxAgeDays = 30, dryRun = false) {
    this.checkInitialized();
    return this.getExtractCleaner().cleanOld(maxAgeDays, dryRun);
  }

  /**
   * 获取清理统计信息
   */
  getExtractCleanupStats() {
    this.checkInitialized();
    return this.getExtractCleaner().getCleanupStats();
  }

  /**
   * 更新剧情（内部辅助方法，合并重复逻辑）
   */
  async updatePlot(plotUpdates) {
    let updated = false;

    // 处理删除的事件
    if (plotUpdates.deleted_events?.length > 0) {
      console.log(`     - 删除剧情事件: ${plotUpdates.deleted_events.length} 个`);
      for (const eventId of plotUpdates.deleted_events) {
        await this.plot.removeCompletedEvent(eventId);
        console.log(`       ✅ 已删除事件: ${eventId}`);
      }
      updated = true;
    }
    
    // 根据章节删除事件
    if (plotUpdates.delete_events_by_chapter?.length > 0) {
      for (const chapterNum of plotUpdates.delete_events_by_chapter) {
        const removedCount = await this.plot.removeEventsByChapter(chapterNum);
        console.log(`       ✅ 已删除第${chapterNum}章的 ${removedCount} 个事件`);
      }
      updated = true;
    }
    
    // 处理更新的事件
    if (plotUpdates.updated_events?.length > 0) {
      console.log(`     - 更新剧情事件: ${plotUpdates.updated_events.length} 个`);
      for (const event of plotUpdates.updated_events) {
        await this.plot.updateCompletedEvent(event.id, event);
        console.log(`       ✅ 已更新事件: ${event.name || event.id}`);
      }
      updated = true;
    }
    
    // 处理新增的事件
    if (plotUpdates.completed_events?.length > 0) {
      console.log(`     - 添加剧情事件: ${plotUpdates.completed_events.length} 个`);
      for (const event of plotUpdates.completed_events) {
        await this.plot.addCompletedEvent(event);
        console.log(`       ✅ ${event.name || '事件'}`);
      }
      updated = true;
    }

    // 添加时间线事件
    if (plotUpdates.timeline_events?.length > 0) {
      console.log(`     - 添加时间线事件: ${plotUpdates.timeline_events.length} 个`);
      for (const event of plotUpdates.timeline_events) {
        await this.plot.addTimelineEvent(event);
      }
      updated = true;
    }

    // 更新当前阶段
    if (plotUpdates.current_stage) {
      console.log(`     - 更新当前阶段: ${plotUpdates.current_stage}`);
      await this.plot.updateCurrentStage(plotUpdates.current_stage);
      updated = true;
    }

    return updated;
  }

  /**
   * 更新伏笔状态（内部辅助方法）
   */
  async updateForeshadows(foreshadowUpdates) {
    let updated = false;

    for (const update of foreshadowUpdates) {
      try {
        if (update.action === 'reveal') {
          await this.foreshadow.revealForeshadow(update.id, update.details);
          console.log(`     ✅ 揭示伏笔: ${update.title || update.id}`);
          updated = true;
        } else if (update.action === 'resolve') {
          await this.foreshadow.resolveForeshadow(update.id, update.details);
          console.log(`     ✅ 解决伏笔: ${update.title || update.id}`);
          updated = true;
        }
      } catch (error) {
        console.warn(`     ❌ 更新伏笔失败: ${update.id}`, error.message);
      }
    }

    return updated;
  }
}

module.exports = MemoryManager;

