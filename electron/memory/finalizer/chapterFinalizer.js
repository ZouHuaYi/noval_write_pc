/**
 * Chapter Finalizer - 章节结算器
 * 这是唯一能写知识核心的模块
 * 负责将 ChapterExtract 安全、可控地合并进 Knowledge Core
 */

const fs = require('fs');
const path = require('path');
const ConceptResolver = require('./conceptResolver');
const CharacterStateKnowledge = require('./characterStateKnowledge');
const FactConflictDetector = require('./factConflictDetector');

class ChapterFinalizer {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.corePath = path.join(workspaceRoot, '.novel-agent', 'core');
    this.extractPath = path.join(workspaceRoot, '.novel-agent', 'extracts');
    this.conceptResolver = new ConceptResolver(workspaceRoot);
    this.characterStateKnowledge = new CharacterStateKnowledge(workspaceRoot);
    this.conflictDetector = new FactConflictDetector(workspaceRoot);
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
   * Finalize one chapter extract
   * @param {number} chapterNumber - 章节号
   */
  async finalizeChapter(chapterNumber) {
    this.ensureDirectories();

    const extractFile = path.join(this.extractPath, `chapter_${chapterNumber}.json`);

    if (!fs.existsSync(extractFile)) {
      throw new Error(`Extract not found for chapter ${chapterNumber}`);
    }

    const extract = this.loadJSON(extractFile);

    console.log(`📝 开始结算第 ${chapterNumber} 章...`);

    // 1. 合并概念（现在是异步的）
    await this.mergeConcepts(extract);

    // 2. 合并事实（现在是异步的）
    await this.mergeFacts(extract);

    // 3. 合并伏笔
    await this.mergeForeshadows(extract);

    // 4. 合并人物状态（知识化版本）
    await this.mergeCharacterStates(extract);

    // 5. 更新故事状态
    this.updateStoryState(extract);

    console.log(`✅ 第 ${chapterNumber} 章结算完成`);

    // 5. 删除 extract（可选，建议保留用于调试）
    // fs.unlinkSync(extractFile);
  }

  /**
   * 1. Concept merge
   */
  async mergeConcepts(extract) {
    if (!extract.concept_mentions || extract.concept_mentions.length === 0) {
      return;
    }

    console.log(`   🔗 合并概念 (${extract.concept_mentions.length} 个)...`);

    for (const mention of extract.concept_mentions) {
      const { surface, chapter, description } = mention;

      const resolved = await this.conceptResolver.resolveConcept(surface, true);

      if (resolved.isNew) {
        // 创建新概念
        const conceptId = this.conceptResolver.createConcept(surface, chapter, description);
        console.log(`     ✅ 创建新概念: ${surface} (${conceptId})`);
      } else {
        // 添加别名
        this.conceptResolver.addAlias(resolved.id, surface);
        // 如果描述更清晰，更新描述
        if (description) {
          this.conceptResolver.updateDescription(resolved.id, description);
        }
        const similarityInfo = resolved.similarity ? ` (相似度: ${resolved.similarity.toFixed(3)})` : '';
        console.log(`     🔄 更新概念别名: ${surface} -> ${resolved.id}${similarityInfo}`);
      }
    }
  }

  /**
   * 2. Fact merge（不可逆，只增不改）
   */
  async mergeFacts(extract) {
    if (!extract.fact_candidates || extract.fact_candidates.length === 0) {
      return;
    }

    console.log(`   📋 合并事实 (${extract.fact_candidates.length} 个)...`);

    const factFile = path.join(this.corePath, 'facts.json');
    const facts = this.loadJSON(factFile);

    for (const candidate of extract.fact_candidates) {
      // 检查是否已存在相同的事实
      const exists = facts.some(
        f => f.statement === candidate.statement
      );

      if (exists) {
        console.log(`     ⏭️  跳过重复事实: ${candidate.statement.substring(0, 50)}...`);
        continue;
      }

      // 冲突检测
      try {
        const conflictResult = await this.conflictDetector.detectConflict(candidate, facts);
        
        if (conflictResult.hasConflict) {
          console.log(`     ⚠️  检测到冲突，跳过事实: ${candidate.statement.substring(0, 50)}...`);
          for (const conflict of conflictResult.conflicts) {
            console.log(`       - ${conflict.message} (严重程度: ${conflict.severity})`);
          }
          continue; // 跳过有冲突的事实
        }

        // 显示警告
        if (conflictResult.warnings && conflictResult.warnings.length > 0) {
          for (const warning of conflictResult.warnings) {
            console.log(`     ⚠️  警告: ${warning.message}`);
          }
        }
      } catch (error) {
        console.warn(`     ⚠️  冲突检测失败，继续添加: ${error.message}`);
      }

      // 解析概念引用（现在是异步的）
      const conceptIds = [];
      if (candidate.concept_refs) {
        for (const ref of candidate.concept_refs) {
          const resolved = await this.conceptResolver.resolveConcept(ref, true);
          if (resolved.id) {
            conceptIds.push(resolved.id);
          }
        }
      }

      facts.push({
        fact_id: `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: candidate.type || 'world_rule',
        statement: candidate.statement,
        introduced_in: extract.chapter,
        confidence: candidate.confidence || 'observed',
        concept_refs: conceptIds,
        evidence: candidate.evidence || '',
        source_refs: candidate.source_refs || []
      });
      console.log(`     ✅ 添加事实: ${candidate.statement.substring(0, 50)}...`);
    }

    this.saveJSON(factFile, facts);
  }

  /**
   * 3. Foreshadow State Machine
   */
  async mergeForeshadows(extract) {
    if (!extract.foreshadow_candidates || extract.foreshadow_candidates.length === 0) {
      return;
    }

    console.log(`   🔮 合并伏笔 (${extract.foreshadow_candidates.length} 个)...`);

    const foreshadowFile = path.join(this.corePath, 'foreshadows.json');
    const foreshadows = this.loadJSON(foreshadowFile);

    for (const candidate of extract.foreshadow_candidates) {
      const { surface, chapter, implied_future, state_change } = candidate;

      // 解析概念ID（现在是异步的）
      const resolved = await this.conceptResolver.resolveConcept(surface, true);
      if (!resolved.id) {
        // 如果概念不存在，先创建
        const conceptId = this.conceptResolver.createConcept(surface, chapter);
        resolved.id = conceptId;
      }

      // 查找现有伏笔
      const existing = foreshadows.find(
        f => f.concept_id === resolved.id
      );

      if (!existing) {
        // 创建新伏笔
        foreshadows.push({
          concept_id: resolved.id,
          state: 'pending',
          introduced_in: chapter,
          last_updated: chapter,
          implied_future: implied_future || ''
        });
        console.log(`     ✅ 创建新伏笔: ${surface} (${resolved.id})`);
      } else {
        // 状态迁移（不允许回退）
        const oldState = existing.state;
        let newState = oldState;

        if (state_change) {
          // 根据状态变化规则迁移
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
        }

        if (newState !== oldState) {
          existing.state = newState;
          existing.last_updated = chapter;
          if (implied_future) {
            existing.implied_future = implied_future;
          }
          console.log(`     🔄 伏笔状态迁移: ${surface} (${oldState} -> ${newState})`);
        } else {
          console.log(`     ⏭️  伏笔状态未变化: ${surface} (${oldState})`);
        }
      }
    }

    this.saveJSON(foreshadowFile, foreshadows);
  }

  /**
   * 4. Story State（整章覆盖）
   */
  updateStoryState(extract) {
    if (!extract.story_state_snapshot) {
      return;
    }

    console.log(`   📖 更新故事状态...`);

    const file = path.join(this.corePath, 'story_state.json');
    const newState = {
      chapter: extract.chapter,
      ...extract.story_state_snapshot
    };

    // 解析概念引用（现在是异步的，但这里同步处理，因为只是字符串匹配）
    // 注意：这里使用同步方法，因为只是简单的字符串匹配
    if (newState.known_threats && Array.isArray(newState.known_threats)) {
      // 暂时保持字符串，后续可以在结算时异步解析
      // newState.known_threats = newState.known_threats.map(threat => {
      //   const resolved = await this.conceptResolver.resolveConcept(threat);
      //   return resolved.id || threat;
      // });
    }

    if (newState.open_mysteries && Array.isArray(newState.open_mysteries)) {
      // 暂时保持字符串，后续可以在结算时异步解析
    }

    this.saveJSON(file, newState);
    console.log(`     ✅ 故事状态已更新: 第 ${extract.chapter} 章`);
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
   * 4. Character State Knowledge（人物状态知识化）
   */
  async mergeCharacterStates(extract) {
    if (!extract.character_states || extract.character_states.length === 0) {
      return;
    }

    console.log(`   👤 合并人物状态 (${extract.character_states.length} 个)...`);

    for (const stateData of extract.character_states) {
      const { character_name, state_change, chapter, type } = stateData;

      // 只记录不可逆的状态变化
      const validTypes = ['level_breakthrough', 'death', 'awakening', 'irreversible_change'];
      const stateType = validTypes.includes(type) ? type : 'irreversible_change';

      this.characterStateKnowledge.recordStateChange(
        character_name,
        state_change,
        chapter,
        stateType
      );
    }
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

