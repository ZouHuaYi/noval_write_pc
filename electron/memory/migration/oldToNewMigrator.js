/**
 * Old to New Migrator - 从旧架构迁移到新架构
 * 将旧的记忆数据迁移到新的知识核心架构
 */

const fs = require('fs');
const path = require('path');
const ConceptResolver = require('../finalizer/conceptResolver');
const ChapterFinalizer = require('../finalizer/chapterFinalizer');

class OldToNewMigrator {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.oldMemoryDir = path.join(workspaceRoot, '.novel-agent');
    this.newCoreDir = path.join(workspaceRoot, '.novel-agent', 'core');
    this.conceptResolver = new ConceptResolver(workspaceRoot);
    this.chapterFinalizer = new ChapterFinalizer(workspaceRoot);
  }

  /**
   * 执行完整迁移
   * @param {Object} options - 迁移选项
   * @returns {Promise<Object>} - 迁移结果
   */
  async migrate(options = {}) {
    const result = {
      success: true,
      migrated: {
        concepts: 0,
        facts: 0,
        foreshadows: 0,
        characterStates: 0
      },
      errors: []
    };

    try {
      console.log('🔄 开始迁移旧架构数据到新架构...');

      // 1. 迁移概念（从角色、剧情、伏笔中提取）
      const conceptsResult = await this.migrateConcepts();
      result.migrated.concepts = conceptsResult.count;
      if (conceptsResult.errors.length > 0) {
        result.errors.push(...conceptsResult.errors);
      }

      // 2. 迁移事实（从世界观规则中提取）
      const factsResult = await this.migrateFacts();
      result.migrated.facts = factsResult.count;
      if (factsResult.errors.length > 0) {
        result.errors.push(...factsResult.errors);
      }

      // 3. 迁移伏笔
      const foreshadowsResult = await this.migrateForeshadows();
      result.migrated.foreshadows = foreshadowsResult.count;
      if (foreshadowsResult.errors.length > 0) {
        result.errors.push(...foreshadowsResult.errors);
      }

      // 4. 迁移人物状态（从 state_history 中提取不可逆变化）
      const statesResult = await this.migrateCharacterStates();
      result.migrated.characterStates = statesResult.count;
      if (statesResult.errors.length > 0) {
        result.errors.push(...statesResult.errors);
      }

      console.log('✅ 迁移完成:', result.migrated);

      if (result.errors.length > 0) {
        console.warn('⚠️  迁移过程中有错误:', result.errors);
        result.success = false;
      }

      return result;
    } catch (error) {
      console.error('❌ 迁移失败:', error);
      result.success = false;
      result.errors.push({ type: 'migration_failed', error: error.message });
      return result;
    }
  }

  /**
   * 迁移概念
   */
  async migrateConcepts() {
    const result = { count: 0, errors: [] };
    const concepts = this.conceptResolver.loadConcepts();

    try {
      // 从角色记忆中提取概念
      const characterFile = path.join(this.oldMemoryDir, 'character-memory.json');
      if (fs.existsSync(characterFile)) {
        const characterData = JSON.parse(fs.readFileSync(characterFile, 'utf-8'));
        
        if (characterData.characters) {
          for (const [charId, char] of Object.entries(characterData.characters)) {
            // 提取角色名作为概念
            if (char.name) {
              const conceptId = `concept_character_${charId}`;
              if (!concepts[conceptId]) {
                concepts[conceptId] = {
                  aliases: [char.name],
                  description: `角色: ${char.name}`,
                  first_seen: 0
                };
                result.count++;
              }
            }

            // 提取境界作为概念
            if (char.current_state?.level) {
              const levelConceptId = `concept_level_${char.current_state.level}`;
              if (!concepts[levelConceptId]) {
                concepts[levelConceptId] = {
                  aliases: [char.current_state.level],
                  description: `境界: ${char.current_state.level}`,
                  first_seen: 0
                };
                result.count++;
              }
            }
          }
        }
      }

      // 从伏笔记忆中提取概念
      const foreshadowFile = path.join(this.oldMemoryDir, 'foreshadow-memory.json');
      if (fs.existsSync(foreshadowFile)) {
        const foreshadowData = JSON.parse(fs.readFileSync(foreshadowFile, 'utf-8'));
        
        if (foreshadowData.foreshadows) {
          for (const foreshadow of foreshadowData.foreshadows) {
            if (foreshadow.title) {
              // 尝试从标题中提取概念
              const resolved = await this.conceptResolver.resolveConcept(foreshadow.title, false);
              if (resolved.isNew) {
                const conceptId = this.conceptResolver.createConcept(foreshadow.title, foreshadow.introduced_at?.chapter || 0, foreshadow.content);
                result.count++;
              }
            }
          }
        }
      }

      this.conceptResolver.saveConcepts(concepts);
    } catch (error) {
      result.errors.push({ type: 'concepts', error: error.message });
    }

    return result;
  }

  /**
   * 迁移事实
   */
  async migrateFacts() {
    const result = { count: 0, errors: [] };

    try {
      const factFile = path.join(this.newCoreDir, 'facts.json');
      let facts = [];
      if (fs.existsSync(factFile)) {
        facts = JSON.parse(fs.readFileSync(factFile, 'utf-8'));
      }

      // 从世界观规则中提取事实
      const worldFile = path.join(this.oldMemoryDir, 'world-memory.json');
      if (fs.existsSync(worldFile)) {
        const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf-8'));
        
        // 提取自定义规则作为事实
        if (worldData.custom_rules && Array.isArray(worldData.custom_rules)) {
          for (const rule of worldData.custom_rules) {
            if (rule.content && rule.type === 'world_rule') {
              const fact = {
                fact_id: `fact_migrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'world_rule',
                statement: rule.content.substring(0, 200), // 限制长度
                introduced_in: 0,
                confidence: 'migrated',
                concept_refs: [],
                evidence: rule.source || '',
                source_refs: []
              };

              // 检查是否已存在
              const exists = facts.some(f => f.statement === fact.statement);
              if (!exists) {
                facts.push(fact);
                result.count++;
              }
            }
          }
        }
      }

      // 保存事实
      fs.mkdirSync(this.newCoreDir, { recursive: true });
      fs.writeFileSync(factFile, JSON.stringify(facts, null, 2), 'utf-8');
    } catch (error) {
      result.errors.push({ type: 'facts', error: error.message });
    }

    return result;
  }

  /**
   * 迁移伏笔
   */
  async migrateForeshadows() {
    const result = { count: 0, errors: [] };

    try {
      const foreshadowFile = path.join(this.newCoreDir, 'foreshadows.json');
      let foreshadows = [];
      if (fs.existsSync(foreshadowFile)) {
        foreshadows = JSON.parse(fs.readFileSync(foreshadowFile, 'utf-8'));
      }

      // 从旧伏笔记忆中迁移
      const oldForeshadowFile = path.join(this.oldMemoryDir, 'foreshadow-memory.json');
      if (fs.existsSync(oldForeshadowFile)) {
        const oldData = JSON.parse(fs.readFileSync(oldForeshadowFile, 'utf-8'));
        
        if (oldData.foreshadows && Array.isArray(oldData.foreshadows)) {
          for (const oldF of oldData.foreshadows) {
            // 解析概念ID
            let conceptId = null;
            if (oldF.title) {
              const resolved = await this.conceptResolver.resolveConcept(oldF.title, false);
              if (resolved.id) {
                conceptId = resolved.id;
              } else {
                conceptId = this.conceptResolver.createConcept(oldF.title, oldF.introduced_at?.chapter || 0);
              }
            }

            if (conceptId) {
              // 检查是否已存在
              const exists = foreshadows.find(f => f.concept_id === conceptId);
              if (!exists) {
                // 映射状态
                let state = 'pending';
                if (oldF.status === 'revealed') {
                  state = 'revealed';
                } else if (oldF.status === 'resolved') {
                  state = 'archived';
                }

                foreshadows.push({
                  concept_id: conceptId,
                  state: state,
                  introduced_in: oldF.introduced_at?.chapter || 0,
                  last_updated: oldF.introduced_at?.chapter || 0,
                  implied_future: oldF.content || ''
                });
                result.count++;
              }
            }
          }
        }
      }

      // 保存伏笔
      fs.mkdirSync(this.newCoreDir, { recursive: true });
      fs.writeFileSync(foreshadowFile, JSON.stringify(foreshadows, null, 2), 'utf-8');
    } catch (error) {
      result.errors.push({ type: 'foreshadows', error: error.message });
    }

    return result;
  }

  /**
   * 迁移人物状态
   */
  async migrateCharacterStates() {
    const result = { count: 0, errors: [] };

    try {
      const CharacterStateKnowledge = require('../finalizer/characterStateKnowledge');
      const stateKnowledge = new CharacterStateKnowledge(this.workspaceRoot);

      // 从角色记忆中提取不可逆状态变化
      const characterFile = path.join(this.oldMemoryDir, 'character-memory.json');
      if (fs.existsSync(characterFile)) {
        const characterData = JSON.parse(fs.readFileSync(characterFile, 'utf-8'));
        
        if (characterData.characters) {
          for (const [charId, char] of Object.entries(characterData.characters)) {
            // 从 state_history 中提取不可逆变化
            if (char.state_history && Array.isArray(char.state_history)) {
              for (const history of char.state_history) {
                // 检查是否是境界突破
                if (history.changes) {
                  for (const change of history.changes) {
                    if (change.field === 'level' && change.to) {
                      stateKnowledge.recordStateChange(
                        char.name,
                        { level: change.to },
                        history.chapter || 0,
                        'level_breakthrough'
                      );
                      result.count++;
                    }
                  }
                }
              }
            }

            // 检查当前状态中是否有死亡标记
            if (char.current_state?.status === 'dead' || char.current_state?.alive === false) {
              stateKnowledge.recordStateChange(
                char.name,
                { status: 'dead' },
                0,
                'death'
              );
              result.count++;
            }
          }
        }
      }
    } catch (error) {
      result.errors.push({ type: 'character_states', error: error.message });
    }

    return result;
  }

  /**
   * 预览迁移（不实际执行）
   */
  async previewMigration() {
    const result = {
      concepts: { count: 0, samples: [] },
      facts: { count: 0, samples: [] },
      foreshadows: { count: 0, samples: [] },
      characterStates: { count: 0, samples: [] }
    };

    // 预览概念
    const characterFile = path.join(this.oldMemoryDir, 'character-memory.json');
    if (fs.existsSync(characterFile)) {
      const characterData = JSON.parse(fs.readFileSync(characterFile, 'utf-8'));
      if (characterData.characters) {
        result.concepts.count = Object.keys(characterData.characters).length;
        result.concepts.samples = Object.values(characterData.characters).slice(0, 3).map(c => c.name);
      }
    }

    // 预览事实
    const worldFile = path.join(this.oldMemoryDir, 'world-memory.json');
    if (fs.existsSync(worldFile)) {
      const worldData = JSON.parse(fs.readFileSync(worldFile, 'utf-8'));
      if (worldData.custom_rules) {
        result.facts.count = worldData.custom_rules.length;
        result.facts.samples = worldData.custom_rules.slice(0, 3).map(r => r.content?.substring(0, 50));
      }
    }

    // 预览伏笔
    const foreshadowFile = path.join(this.oldMemoryDir, 'foreshadow-memory.json');
    if (fs.existsSync(foreshadowFile)) {
      const foreshadowData = JSON.parse(fs.readFileSync(foreshadowFile, 'utf-8'));
      if (foreshadowData.foreshadows) {
        result.foreshadows.count = foreshadowData.foreshadows.length;
        result.foreshadows.samples = foreshadowData.foreshadows.slice(0, 3).map(f => f.title);
      }
    }

    return result;
  }
}

module.exports = OldToNewMigrator;

