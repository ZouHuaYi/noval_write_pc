/**
 * Character State Knowledge - 人物状态的知识化版本
 * 替代 state_history，将人物状态纳入知识核心
 * 只记录不可逆的状态变化（如境界突破、死亡、觉醒等）
 */

const fs = require('fs');
const path = require('path');
const ConceptResolver = require('./conceptResolver');

class CharacterStateKnowledge {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.corePath = path.join(workspaceRoot, '.novel-agent', 'core');
    this.stateFile = path.join(this.corePath, 'character_states.json');
    this.conceptResolver = new ConceptResolver(workspaceRoot);
  }

  /**
   * 确保目录存在
   */
  ensureDirectory() {
    if (!fs.existsSync(this.corePath)) {
      fs.mkdirSync(this.corePath, { recursive: true });
    }
  }

  /**
   * 加载人物状态数据
   */
  loadStates() {
    try {
      this.ensureDirectory();
      if (!fs.existsSync(this.stateFile)) {
        return [];
      }
      const content = fs.readFileSync(this.stateFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ 加载人物状态失败:', error.message);
      return [];
    }
  }

  /**
   * 保存人物状态数据
   */
  saveStates(states) {
    try {
      this.ensureDirectory();
      fs.writeFileSync(this.stateFile, JSON.stringify(states, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ 保存人物状态失败:', error.message);
      throw error;
    }
  }

  /**
   * 记录人物状态变化（只记录不可逆的事实）
   * @param {string} characterName - 角色名称
   * @param {Object} stateChange - 状态变化
   * @param {number} chapter - 章节号
   * @param {string} type - 变化类型：'level_breakthrough' | 'death' | 'awakening' | 'irreversible_change'
   */
  recordStateChange(characterName, stateChange, chapter, type = 'irreversible_change') {
    const states = this.loadStates();
    
    // 检查是否已存在相同的事实
    const exists = states.some(s => 
      s.character_name === characterName &&
      s.type === type &&
      s.chapter === chapter &&
      JSON.stringify(s.state_change) === JSON.stringify(stateChange)
    );

    if (exists) {
      console.log(`   ⏭️  跳过重复状态记录: ${characterName} - ${type}`);
      return;
    }

    // 解析状态变化中的概念引用
    const conceptRefs = [];
    if (stateChange.level) {
      // 境界可以是一个概念
      const resolved = this.conceptResolver.resolveConcept(stateChange.level);
      if (resolved.id) {
        conceptRefs.push(resolved.id);
      }
    }

    // 添加新状态记录
    states.push({
      state_id: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      character_name: characterName,
      type: type,
      state_change: stateChange,
      chapter: chapter,
      concept_refs: conceptRefs,
      recorded_at: new Date().toISOString()
    });

    this.saveStates(states);
    console.log(`   ✅ 记录人物状态: ${characterName} - ${type} (第${chapter}章)`);
  }

  /**
   * 获取角色的所有状态变化
   * @param {string} characterName - 角色名称
   */
  getCharacterStates(characterName) {
    const states = this.loadStates();
    return states
      .filter(s => s.character_name === characterName)
      .sort((a, b) => a.chapter - b.chapter);
  }

  /**
   * 获取角色的当前状态（最新的状态变化）
   * @param {string} characterName - 角色名称
   */
  getCharacterCurrentState(characterName) {
    const states = this.getCharacterStates(characterName);
    if (states.length === 0) {
      return null;
    }
    return states[states.length - 1];
  }

  /**
   * 获取所有角色的状态摘要
   */
  getAllCharactersSummary() {
    const states = this.loadStates();
    const summary = {};

    for (const state of states) {
      const charName = state.character_name;
      if (!summary[charName]) {
        summary[charName] = {
          character_name: charName,
          total_changes: 0,
          latest_chapter: 0,
          latest_state: null,
          states: []
        };
      }

      summary[charName].total_changes++;
      summary[charName].states.push(state);
      
      if (state.chapter > summary[charName].latest_chapter) {
        summary[charName].latest_chapter = state.chapter;
        summary[charName].latest_state = state;
      }
    }

    return Object.values(summary);
  }

  /**
   * 按类型统计状态变化
   */
  getStatisticsByType() {
    const states = this.loadStates();
    const stats = {
      level_breakthrough: 0,
      death: 0,
      awakening: 0,
      irreversible_change: 0
    };

    for (const state of states) {
      stats[state.type] = (stats[state.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * 恢复角色状态（回滚时使用）
   */
  restoreState(characterName, field, value, chapter) {
    const states = this.loadStates();
    
    // 删除该章节之后的状态变化
    const filtered = states.filter(s => {
      if (s.character_name !== characterName) return true;
      if (s.chapter < chapter) return true;
      if (s.chapter === chapter && s.state_change?.[field] === value) return false;
      return s.chapter > chapter;
    });

    // 如果指定了值，添加恢复记录
    if (value !== null && value !== undefined) {
      filtered.push({
        state_id: `state_restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        character_name: characterName,
        type: 'restored',
        state_change: { [field]: value },
        chapter: chapter,
        recorded_at: new Date().toISOString()
      });
    }

    this.saveStates(filtered);
    console.log(`   ✅ 恢复角色状态: ${characterName}.${field} = ${value}`);
  }

  /**
   * 获取角色的当前状态（合并所有状态变化）
   */
  getCharacterCurrentStateMerged(characterName) {
    const states = this.getCharacterStates(characterName);
    if (states.length === 0) {
      return null;
    }

    // 合并所有状态变化
    const merged = {};
    for (const state of states) {
      if (state.state_change) {
        Object.assign(merged, state.state_change);
      }
    }

    return {
      character_name: characterName,
      current: merged,
      timeline: states.map(s => ({
        chapter: s.chapter,
        changes: s.state_change,
        type: s.type
      }))
    };
  }
}

module.exports = CharacterStateKnowledge;

