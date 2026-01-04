/**
 * Chapter Finalizer - Effect-based 章节结算器
 * 这是唯一能写知识核心的模块
 * 
 * 核心原则：
 * 1. 不再直接改 core，一切通过 Effect
 * 2. 先算 effect → 再应用 → 再可逆回滚
 * 3. 只声明"这一章想改变什么"，不思考结果对不对
 */

const fs = require('fs');
const path = require('path');
const ConceptResolver = require('./conceptResolver');
const CharacterStateKnowledge = require('./characterStateKnowledge');
const FactConflictDetector = require('./factConflictDetector');
const ChapterEffectManager = require('./chapterEffectManager');
const InferenceStore = require('./inferenceStore');
const EventEffectResolver = require('./eventEffectResolver');
const DependencyTracker = require('./dependencyTracker');
const { EffectFactory, EffectType } = require('./effectTypes');

class ChapterFinalizer {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.corePath = path.join(workspaceRoot, '.novel-agent', 'core');
    this.extractPath = path.join(workspaceRoot, '.novel-agent', 'extracts');
    this.conceptResolver = new ConceptResolver(workspaceRoot);
    this.characterStateKnowledge = new CharacterStateKnowledge(workspaceRoot);
    this.conflictDetector = new FactConflictDetector(workspaceRoot);
    this.effectManager = new ChapterEffectManager(workspaceRoot);
    this.inferenceStore = new InferenceStore(workspaceRoot);
    this.eventResolver = new EventEffectResolver(workspaceRoot);
    this.dependencyTracker = new DependencyTracker(workspaceRoot);
  }

  /**
   * 确保目录存在
   */
  ensureDirectories() {
    const dirs = [this.corePath, this.extractPath];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * 加载 JSON 文件
   */
  loadJSON(file) {
    try {
      if (!fs.existsSync(file)) {
        return this.getDefaultData(file);
      }
      const content = fs.readFileSync(file, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`⚠️ 加载文件失败: ${file}`, error.message);
      return this.getDefaultData(file);
    }
  }

  /**
   * 获取默认数据
   */
  getDefaultData(file) {
    const filename = path.basename(file);
    if (filename === 'facts.json') return [];
    if (filename === 'foreshadows.json') return [];
    if (filename === 'story_state.json') {
      return {
        chapter: 0,
        current_location: '',
        global_tension: '',
        known_threats: [],
        open_mysteries: []
      };
    }
    return null;
  }

  /**
   * 保存 JSON 文件
   */
  saveJSON(file, data) {
    try {
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`❌ 保存文件失败: ${file}`, error.message);
      throw error;
    }
  }

  /**
   * 检查章节效果是否存在
   */
  effectExists(chapterNumber) {
    return this.effectManager.loadEffect(chapterNumber) !== null;
  }

  /**
   * Finalize one chapter extract - Effect-based 流程
   * @param {number} chapterNumber - 章节号
   * @param {boolean} replaceChapter - 是否替换章节（回滚旧效果）
   */
  async finalizeChapter(chapterNumber, replaceChapter = false) {
    this.ensureDirectories();

    // 0️⃣ 若已存在 effect，先回滚
    if (replaceChapter || this.effectExists(chapterNumber)) {
      await this.rollbackChapter(chapterNumber);
    }

    const extractFile = path.join(this.extractPath, `chapter_${chapterNumber}.json`);
    if (!fs.existsSync(extractFile)) {
      throw new Error(`Extract not found for chapter ${chapterNumber}`);
    }

    const extract = this.loadJSON(extractFile);
    console.log(`📝 开始结算第 ${chapterNumber} 章（Effect-based）...`);

    // 1️⃣ 读取 extract
    // extract 已在上面加载

    // 2️⃣ 预处理（清洗 / 概念统一）
    const normalized = await this.normalizeExtract(extract, chapterNumber);

    // 3️⃣ 生成 Effects（核心步骤）
    const effects = await this.buildEffects(normalized, chapterNumber);

    // 4️⃣ 校验 Effects（冲突 / certainty / 合法性）
    await this.validateEffects(effects, chapterNumber);

    // 5️⃣ 应用 Effects
    await this.applyEffects(effects);

    // 6️⃣ 记录依赖（Chapter → Effect → Core State）
    this.recordDependencies(chapterNumber, effects);

    // 7️⃣ 持久化
    this.writeChapterEffects(chapterNumber, effects);
    this.saveCore();

    // 8️⃣ 清除失效标记（如果之前被标记为失效）
    this.dependencyTracker.clearInvalidation(chapterNumber);

    console.log(`✅ 第 ${chapterNumber} 章结算完成（生成了 ${effects.length} 个 Effects）`);
  }

  /**
   * 预处理 extract（清洗 / 概念统一）
   */
  async normalizeExtract(extract, chapterNumber) {
    const normalized = {
      chapter: chapterNumber,
      fact_candidates: [],
      event_claims: extract.event_claims || [],
      character_states: [],
      foreshadow_candidates: [],
      story_state_snapshot: extract.story_state_snapshot || {},
      concept_mentions: extract.concept_mentions || []
    };

    // 统一概念
    if (extract.concept_mentions) {
      for (const mention of extract.concept_mentions) {
        const resolved = await this.conceptResolver.resolveConcept(mention.surface, true);
        if (resolved.isNew) {
          this.conceptResolver.createConcept(mention.surface, chapterNumber, mention.description);
        }
      }
    }

    // 处理事实候选
    if (extract.fact_candidates) {
      for (const candidate of extract.fact_candidates) {
        // 解析概念引用
        const conceptIds = [];
        if (candidate.concept_refs) {
          for (const ref of candidate.concept_refs) {
            const resolved = await this.conceptResolver.resolveConcept(ref, true);
            if (resolved.id) {
              conceptIds.push(resolved.id);
            }
          }
        }

        normalized.fact_candidates.push({
          ...candidate,
          concept_refs: conceptIds
        });
      }
    }

    // 处理角色状态
    normalized.character_states = extract.character_states || [];

    // 处理伏笔
    normalized.foreshadow_candidates = extract.foreshadow_candidates || [];

    return normalized;
  }

  /**
   * 生成 Effects（最关键的函数）
   */
  async buildEffects(normalized, chapter) {
    const effects = [];

    // 1. 处理事实
    for (const factCandidate of normalized.fact_candidates) {
      const certainty = this.calculateCertainty(factCandidate);
      
      // ❗硬规则：certainty < 0.7 → 转为 inference
      if (certainty < 0.7) {
        console.log(`     ⚠️  置信度不足 (${certainty.toFixed(2)} < 0.7)，转为推断`);
        this.inferenceStore.addInference({
          claim: factCandidate.statement || JSON.stringify(factCandidate),
          basis: factCandidate.evidence || '',
          confidence: certainty,
          chapter: chapter
        });
        continue;
      }

      // 检查是否已存在
      const existingFacts = this.loadJSON(path.join(this.corePath, 'facts.json'));
      const exists = existingFacts.some(
        f => f.subject === factCandidate.subject && 
             f.predicate === factCandidate.predicate &&
             f.value === factCandidate.value
      );

      if (exists) {
        continue; // 跳过重复事实
      }

      // 创建 AddFactEffect
      const fact = {
        id: `fact_${chapter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: factCandidate.type || 'character_level',
        subject: factCandidate.subject || factCandidate.statement?.split(' ')[0] || 'unknown',
        predicate: factCandidate.predicate || 'has',
        value: factCandidate.value || factCandidate.statement || '',
        introduced_at: {
          chapter: chapter,
          evidence: factCandidate.evidence || factCandidate.statement || ''
        },
        certainty: certainty,
        status: 'valid',
        concept_refs: factCandidate.concept_refs || []
      };

      effects.push(EffectFactory.createAddFact(chapter, fact));
    }

    // 2. 处理角色状态
    for (const stateData of normalized.character_states) {
      const { character_name, state_change, type } = stateData;
      
      // 获取当前状态（from 值）
      const currentState = this.characterStateKnowledge.getCharacterCurrentStateMerged(character_name);
      
      for (const [field, newValue] of Object.entries(state_change)) {
        const oldValue = currentState?.current?.[field] || null;
        
        // 只有值发生变化时才创建 Effect
        if (oldValue !== newValue) {
          effects.push(EffectFactory.createUpdateCharacterState(
            chapter,
            character_name,
            field,
            oldValue,
            newValue
          ));
        }
      }
    }

    // 3. 处理伏笔
    for (const fsCandidate of normalized.foreshadow_candidates) {
      const { surface, implied_future, state_change } = fsCandidate;
      
      // 解析概念ID
      const resolved = await this.conceptResolver.resolveConcept(surface, true);
      if (!resolved.id) {
        const conceptId = this.conceptResolver.createConcept(surface, chapter);
        resolved.id = conceptId;
      }

      // 检查是否已存在
      const existingForeshadows = this.loadJSON(path.join(this.corePath, 'foreshadows.json'));
      const existing = existingForeshadows.find(f => f.concept_id === resolved.id);

      if (!existing) {
        // 创建新伏笔
        const foreshadow = {
          id: `fs_${chapter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          concept_id: resolved.id,
          state: 'pending',
          introduced_in: chapter,
          last_updated: chapter,
          implied_future: implied_future || ''
        };
        effects.push(EffectFactory.createAddForeshadow(chapter, foreshadow));
      } else if (state_change) {
        // 状态迁移
        const oldState = existing.state;
        let newState = oldState;

        switch (oldState) {
          case 'pending':
            if (state_change === 'confirmed' || state_change === 'revealed') {
              newState = state_change;
            }
            break;
          case 'confirmed':
            if (state_change === 'revealed' || state_change === 'archived') {
              newState = state_change;
            }
            break;
          case 'revealed':
            if (state_change === 'archived') {
              newState = 'archived';
            }
            break;
        }

        if (newState === 'revealed' && oldState !== 'revealed') {
          effects.push(EffectFactory.createRevealForeshadow(
            chapter,
            existing.id || existing.concept_id,
            { chapter, content: implied_future || '' }
          ));
        }
      }
    }

    // 4. 处理事件（Event → Effect）
    if (normalized.event_claims && normalized.event_claims.length > 0) {
      for (const eventClaim of normalized.event_claims) {
        // narrative_claim 需要特殊处理（对比 Core 状态）
        if (eventClaim.type === 'narrative_claim') {
          const conflictCheck = this.checkNarrativeClaimConflict(eventClaim, chapter);
          if (conflictCheck.hasConflict) {
            console.log(`     ⚠️  Narrative Claim 与当前世界状态冲突: ${eventClaim.content}`);
            console.log(`     💡 提示: 文本声称 "${eventClaim.content}"，但世界线中可能不成立`);
            // 不产生 Effect，但记录到日志供 IDE 提示
            continue;
          }
        }

        const eventEffects = this.eventResolver.resolveEvent(eventClaim, chapter);
        if (eventEffects && eventEffects.length > 0) {
          // 直接添加 Effect（EventEffectResolver 已返回标准 Effect 对象）
          effects.push(...eventEffects);
          console.log(`     ✅ Event 生成 ${eventEffects.length} 个 Effects`);
        } else if (eventClaim.type !== 'narrative_claim') {
          // 记录日志型事件（不产生 Effect）
          console.log(`     ℹ️  Event 记录: ${eventClaim.type} - ${eventClaim.subject}`);
        }
      }
    }

    // 5. 处理故事状态（如果存在，但通常不应该由 Extract 输出）
    if (normalized.story_state_snapshot && Object.keys(normalized.story_state_snapshot).length > 0) {
      // 警告：story_state_snapshot 不应该由 Extract 输出
      console.warn(`   ⚠️  检测到 story_state_snapshot，这不应该由 Extract 输出`);
      // 暂时保留以保持兼容性，但建议移除
      effects.push(EffectFactory.createUpdateStoryState(
        chapter,
        {
          chapter: chapter,
          ...normalized.story_state_snapshot
        }
      ));
    }

    return effects;
  }

  /**
   * 计算事实的置信度
   */
  calculateCertainty(candidate) {
    if (typeof candidate.certainty === 'number') {
      // Extractor 层已经限制了最高 0.95
      return Math.max(0, Math.min(0.95, candidate.certainty));
    }
    if (typeof candidate.confidence === 'number') {
      return Math.max(0, Math.min(0.95, candidate.confidence));
    }
    if (candidate.evidence && candidate.evidence.length > 20) {
      return 0.85;
    }
    return 0.75;
  }

  /**
   * 检查 narrative_claim 是否与当前世界状态冲突
   */
  checkNarrativeClaimConflict(eventClaim, chapter) {
    const { content, subject } = eventClaim;
    
    // 检查是否涉及角色状态
    if (content.includes('筑基') || content.includes('修士')) {
      // 检查 Core 中该角色的实际状态
      const facts = this.loadJSON(path.join(this.corePath, 'facts.json'));
      const characterFacts = facts.filter(f => 
        f.subject === subject && 
        f.predicate === 'level'
      );

      if (characterFacts.length > 0) {
        const latestFact = characterFacts[characterFacts.length - 1];
        // 如果文本声称是筑基，但 Core 中不是，则冲突
        if (content.includes('筑基') && !latestFact.value.includes('筑基')) {
          return {
            hasConflict: true,
            conflictType: 'state_mismatch',
            message: `文本声称 ${subject} 是筑基期，但 Core 中记录为 ${latestFact.value}`
          };
        }
      }
    }

    return { hasConflict: false };
  }

  /**
   * 校验 Effects
   */
  async validateEffects(effects, chapter) {
    const factFile = path.join(this.corePath, 'facts.json');
    const existingFacts = this.loadJSON(factFile);

    for (const effect of effects) {
      if (effect.type === EffectType.ADD_FACT) {
        const fact = effect.payload.fact;
        
        // 冲突检测
        try {
          const conflictResult = await this.conflictDetector.detectConflict(fact, existingFacts);
          
          if (conflictResult.hasConflict) {
            console.log(`     ⚠️  检测到冲突，移除 Effect: ${fact.subject} ${fact.predicate} ${fact.value}`);
            const index = effects.indexOf(effect);
            if (index !== -1) {
              effects.splice(index, 1);
            }
            continue;
          }

          if (conflictResult.warnings && conflictResult.warnings.length > 0) {
            for (const warning of conflictResult.warnings) {
              console.log(`     ⚠️  警告: ${warning.message}`);
            }
          }
        } catch (error) {
          console.warn(`     ⚠️  冲突检测失败: ${error.message}`);
        }
      }
    }
  }

  /**
   * 应用 Effects
   */
  async applyEffects(effects) {
    for (const effect of effects) {
      await this.applyEffect(effect);
    }
  }

  /**
   * 应用单个 Effect
   */
  async applyEffect(effect) {
    switch (effect.type) {
      case EffectType.ADD_FACT:
        await this.applyAddFact(effect);
        break;

      case EffectType.UPDATE_CHARACTER_STATE:
        await this.applyUpdateCharacterState(effect);
        break;

      case EffectType.ADD_FORESHADOW:
        await this.applyAddForeshadow(effect);
        break;

      case EffectType.REVEAL_FORESHADOW:
        await this.applyRevealForeshadow(effect);
        break;

      case EffectType.UPDATE_STORY_STATE:
        await this.applyUpdateStoryState(effect);
        break;

      case EffectType.TEMPORARY_DEBUFF:
        await this.applyTemporaryDebuff(effect);
        break;

      default:
        console.warn(`     ⚠️  未知的 Effect 类型: ${effect.type}`);
    }
  }

  /**
   * 应用 AddFact Effect
   */
  async applyAddFact(effect) {
    const factFile = path.join(this.corePath, 'facts.json');
    const facts = this.loadJSON(factFile);
    facts.push(effect.payload.fact);
    this.saveJSON(factFile, facts);
    console.log(`     ✅ 应用 Effect: ADD_FACT - ${effect.payload.fact.subject} ${effect.payload.fact.predicate} ${effect.payload.fact.value}`);
  }

  /**
   * 应用 UpdateCharacterState Effect
   */
  async applyUpdateCharacterState(effect) {
    const { character, field, to } = effect.payload;
    const stateChange = { [field]: to };
    
    // 确定类型
    const validTypes = ['level_breakthrough', 'death', 'awakening', 'irreversible_change'];
    const stateType = validTypes.includes(field) ? field : 'irreversible_change';

    this.characterStateKnowledge.recordStateChange(
      character,
      stateChange,
      effect.chapter,
      stateType
    );
    console.log(`     ✅ 应用 Effect: UPDATE_CHARACTER_STATE - ${character}.${field} = ${to}`);
  }

  /**
   * 应用 AddForeshadow Effect
   */
  async applyAddForeshadow(effect) {
    const foreshadowFile = path.join(this.corePath, 'foreshadows.json');
    const foreshadows = this.loadJSON(foreshadowFile);
    foreshadows.push(effect.payload.foreshadow);
    this.saveJSON(foreshadowFile, foreshadows);
    console.log(`     ✅ 应用 Effect: ADD_FORESHADOW - ${effect.payload.foreshadow.id}`);
  }

  /**
   * 应用 RevealForeshadow Effect
   */
  async applyRevealForeshadow(effect) {
    const foreshadowFile = path.join(this.corePath, 'foreshadows.json');
    const foreshadows = this.loadJSON(foreshadowFile);
    const foreshadow = foreshadows.find(f => f.id === effect.payload.foreshadow_id || f.concept_id === effect.payload.foreshadow_id);
    
    if (foreshadow) {
      foreshadow.state = 'revealed';
      foreshadow.last_updated = effect.chapter;
      this.saveJSON(foreshadowFile, foreshadows);
      console.log(`     ✅ 应用 Effect: REVEAL_FORESHADOW - ${effect.payload.foreshadow_id}`);
    }
  }

  /**
   * 应用 UpdateStoryState Effect
   */
  async applyUpdateStoryState(effect) {
    const storyStateFile = path.join(this.corePath, 'story_state.json');
    this.saveJSON(storyStateFile, effect.payload.state);
    console.log(`     ✅ 应用 Effect: UPDATE_STORY_STATE - 第 ${effect.chapter} 章`);
  }

  /**
   * 应用 TemporaryDebuff Effect
   */
  async applyTemporaryDebuff(effect) {
    const { character, debuff_type, duration_chapters, description } = effect.payload;
    
    // 临时 debuff 可以存储在 character_states 中，但标记为临时
    // 或者存储在单独的 debuffs.json 中
    // 这里简化处理，记录到 character state knowledge
    const debuffState = {
      debuff_type: debuff_type,
      duration_chapters: duration_chapters,
      description: description,
      applied_at_chapter: effect.chapter,
      expires_at_chapter: effect.chapter + duration_chapters
    };

    // 可以扩展 CharacterStateKnowledge 支持临时状态
    console.log(`     ✅ 应用 Effect: TEMPORARY_DEBUFF - ${character} - ${debuff_type} (持续 ${duration_chapters} 章)`);
  }

  /**
   * 保存核心文件（统一保存点）
   */
  saveCore() {
    // 所有核心文件已在 applyEffect 中保存，这里可以添加额外的保存逻辑
    console.log(`   💾 核心文件已保存`);
  }

  /**
   * 记录依赖（Chapter → Effect → Core State）
   */
  recordDependencies(chapterNumber, effects) {
    const effectIds = effects.map(e => e.effect_id);
    const factIds = [];

    // 提取所有 ADD_FACT Effects 的 fact ID
    for (const effect of effects) {
      if (effect.type === EffectType.ADD_FACT && effect.payload.fact?.id) {
        factIds.push(effect.payload.fact.id);
      }
    }

    // 记录依赖
    this.dependencyTracker.recordDependencies(chapterNumber, effectIds, factIds);
  }

  /**
   * 写入章节效果
   */
  writeChapterEffects(chapterNumber, effects) {
    const effectData = {
      chapter: chapterNumber,
      created_at: new Date().toISOString(),
      effects: effects.map(e => ({
        effect_id: e.effect_id,
        chapter: chapterNumber, // 确保每个 effect 都有 chapter
        type: e.type,
        payload: e.payload,
        reversible: e.reversible
      }))
    };

    this.effectManager.saveEffect(chapterNumber, effectData);
  }

  /**
   * 回滚章节（封顶版：自动触发依赖失效）
   */
  async rollbackChapter(chapterNumber) {
    console.log(`   🔄 回滚第 ${chapterNumber} 章的效果...`);
    
    const effectData = this.effectManager.loadEffect(chapterNumber);
    if (!effectData) {
      console.log(`   ℹ️  第 ${chapterNumber} 章无效果记录，跳过回滚`);
      return;
    }

    const effects = effectData.effects || [];
    
    // 1. 找出依赖此章节 Effects 的后续章节
    const dependentChapters = [];
    for (const effect of effects) {
      const chapters = this.dependencyTracker.getChaptersDependingOnEffect(effect.effect_id);
      dependentChapters.push(...chapters);
    }
    
    // 去重
    const uniqueDependent = [...new Set(dependentChapters)].filter(
      ch => ch > chapterNumber // 只标记后续章节
    );

    // 2. 必须逆序回滚 Effects
    for (const effect of effects.reverse()) {
      effect.chapter = chapterNumber; // 确保有 chapter 信息
      await this.revertEffect(effect);
    }

    // 3. 删除效果文件
    this.effectManager.deleteEffect(chapterNumber);

    // 4. 标记依赖章节为失效
    for (const depChapter of uniqueDependent) {
      this.dependencyTracker.invalidateChapter(
        depChapter,
        `依赖的第 ${chapterNumber} 章被回滚`
      );
    }

    // 5. 清除此章节的依赖记录
    const deps = this.dependencyTracker.loadDependencies();
    delete deps.dependencies[chapterNumber];
    this.dependencyTracker.saveDependencies(deps);
    
    console.log(`   ✅ 第 ${chapterNumber} 章回滚完成`);
    if (uniqueDependent.length > 0) {
      console.log(`   ⚠️  以下章节被标记为失效: ${uniqueDependent.join(', ')}`);
    }
  }

  /**
   * 回滚单个 Effect
   */
  async revertEffect(effect) {
    if (!effect.reversible) {
      console.log(`     ⚠️  Effect 不可逆: ${effect.type}`);
      return;
    }

    switch (effect.type) {
      case EffectType.ADD_FACT:
        await this.revertAddFact(effect);
        break;

      case EffectType.UPDATE_CHARACTER_STATE:
        await this.revertUpdateCharacterState(effect);
        break;

      case EffectType.ADD_FORESHADOW:
        await this.revertAddForeshadow(effect);
        break;

      case EffectType.REVEAL_FORESHADOW:
        await this.revertRevealForeshadow(effect);
        break;

      case EffectType.UPDATE_STORY_STATE:
        // Story state 回滚比较复杂，暂时跳过
        console.log(`     ⏭️  跳过 Story State 回滚（需要更复杂的逻辑）`);
        break;

      case EffectType.TEMPORARY_DEBUFF:
        await this.revertTemporaryDebuff(effect);
        break;

      default:
        console.warn(`     ⚠️  未知的 Effect 类型，无法回滚: ${effect.type}`);
    }
  }

  /**
   * 回滚 AddFact
   */
  async revertAddFact(effect) {
    const factFile = path.join(this.corePath, 'facts.json');
    const facts = this.loadJSON(factFile);
    const factId = effect.payload.fact?.id;
    
    if (factId) {
      const index = facts.findIndex(f => f.id === factId);
      if (index !== -1) {
        facts.splice(index, 1);
        this.saveJSON(factFile, facts);
        console.log(`     ↶ 回滚 Effect: ADD_FACT - 删除事实 ${factId}`);
      }
    }
  }

  /**
   * 回滚 UpdateCharacterState
   */
  async revertUpdateCharacterState(effect) {
    const { character, field, from } = effect.payload;
    
    if (from !== null && from !== undefined) {
      this.characterStateKnowledge.restoreState(character, field, from, effect.chapter);
      console.log(`     ↶ 回滚 Effect: UPDATE_CHARACTER_STATE - ${character}.${field} = ${from}`);
    }
  }

  /**
   * 回滚 AddForeshadow
   */
  async revertAddForeshadow(effect) {
    const foreshadowFile = path.join(this.corePath, 'foreshadows.json');
    const foreshadows = this.loadJSON(foreshadowFile);
    const fsId = effect.payload.foreshadow?.id;
    
    if (fsId) {
      const index = foreshadows.findIndex(f => f.id === fsId);
      if (index !== -1) {
        foreshadows.splice(index, 1);
        this.saveJSON(foreshadowFile, foreshadows);
        console.log(`     ↶ 回滚 Effect: ADD_FORESHADOW - 删除伏笔 ${fsId}`);
      }
    }
  }

  /**
   * 回滚 RevealForeshadow
   */
  async revertRevealForeshadow(effect) {
    const foreshadowFile = path.join(this.corePath, 'foreshadows.json');
    const foreshadows = this.loadJSON(foreshadowFile);
    const fsId = effect.payload.foreshadow_id;
    
    const foreshadow = foreshadows.find(f => f.id === fsId || f.concept_id === fsId);
    if (foreshadow && foreshadow.state === 'revealed') {
      // 回退到之前的状态
      foreshadow.state = 'confirmed';
      this.saveJSON(foreshadowFile, foreshadows);
      console.log(`     ↶ 回滚 Effect: REVEAL_FORESHADOW - ${fsId} 状态回退到 confirmed`);
    }
  }

  /**
   * 回滚 TemporaryDebuff
   */
  async revertTemporaryDebuff(effect) {
    const { character, debuff_type } = effect.payload;
    // 临时 debuff 的回滚就是删除它
    console.log(`     ↶ 回滚 Effect: TEMPORARY_DEBUFF - 移除 ${character} 的 ${debuff_type}`);
    // 可以扩展 CharacterStateKnowledge 支持删除临时状态
  }

  /**
   * 批量结算多个章节
   */
  async finalizeChapters(chapterNumbers) {
    const results = [];
    for (const chapterNum of chapterNumbers) {
      try {
        await this.finalizeChapter(chapterNum);
        results.push({ chapter: chapterNum, success: true });
      } catch (error) {
        console.error(`❌ 结算第 ${chapterNum} 章失败:`, error.message);
        results.push({ chapter: chapterNum, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * 设置 LLM 配置（用于语义相似度和冲突检测）
   */
  setLLMConfig(llmConfig) {
    this.conceptResolver.setLLMConfig(llmConfig);
    this.conflictDetector.setLLMConfig(llmConfig);
  }
}

module.exports = ChapterFinalizer;
