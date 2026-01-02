/**
 * Character Memory - 人物记忆
 * 存储人物性格、当前状态、关系网等信息
 */

const fs = require('fs').promises;
const path = require('path');

class CharacterMemory {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.memoryDir = path.join(workspaceRoot, '.novel-agent');
    this.memoryFile = path.join(this.memoryDir, 'character-memory.json');
    this.data = null;
  }

  /**
   * 初始化记忆
   */
  async initialize() {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });

      try {
        const content = await fs.readFile(this.memoryFile, 'utf-8');
        this.data = JSON.parse(content);
        console.log('✅ 加载人物记忆成功');
      } catch (e) {
        console.log('📝 创建新的人物记忆');
        this.data = this.getDefaultMemory();
        await this.save();
      }
    } catch (error) {
      console.error('❌ 初始化人物记忆失败:', error);
      this.data = this.getDefaultMemory();
    }
  }

  /**
   * 获取默认记忆
   */
  getDefaultMemory() {
    return {
      version: '1.0',
      last_updated: new Date().toISOString(),
      characters: {}
    };
  }

  /**
   * 添加角色（如果已存在同名角色，则返回现有角色的ID）
   */
  async addCharacter(character) {
    // 先检查是否已存在同名角色
    const existing = this.getCharacter(character.name);
    if (existing) {
      console.log(`ℹ️ 角色已存在: ${character.name}，跳过添加`);
      return existing.id;
    }

    const charId = character.id || this.generateCharacterId(character.name);
    
    this.data.characters[charId] = {
      id: charId,
      name: character.name,
      role: character.role || 'supporting', // protagonist, antagonist, supporting
      personality: {
        traits: character.personality?.traits || [],
        forbidden_traits: character.personality?.forbidden_traits || [],
        description: character.personality?.description || ''
      },
      current_state: {
        level: character.current_state?.level || 'unknown',
        location: character.current_state?.location || 'unknown',
        injuries: character.current_state?.injuries || [],
        possessions: character.current_state?.possessions || [],
        skills: character.current_state?.skills || [],
        emotional_state: character.current_state?.emotional_state || 'normal'
      },
      relationships: character.relationships || {},
      history: character.history || [],
      created_at: new Date().toISOString()
    };

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 添加角色: ${character.name}`);
    return charId;
  }

  /**
   * 生成角色ID
   */
  generateCharacterId(name) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `char_${name}_${timestamp}_${random}`;
  }

  /**
   * 获取角色
   */
  getCharacter(charIdOrName) {
    // 尝试通过 ID 查找
    if (this.data.characters[charIdOrName]) {
      return this.data.characters[charIdOrName];
    }

    // 尝试通过名称查找
    for (const [id, char] of Object.entries(this.data.characters)) {
      if (char.name === charIdOrName) {
        return char;
      }
    }

    return null;
  }

  /**
   * 获取所有角色
   */
  getAllCharacters() {
    return Object.values(this.data.characters);
  }

  /**
   * 获取主要角色
   */
  getMainCharacters() {
    return Object.values(this.data.characters).filter(
      char => char.role === 'protagonist' || char.role === 'antagonist'
    );
  }

  /**
   * 删除角色的状态历史（用于清理无用记忆）
   * @param {string} charIdOrName - 角色ID或名称
   * @param {number} chapterNumber - 章节号（删除该章节的状态历史）
   */
  async removeStateHistoryByChapter(charIdOrName, chapterNumber) {
    const char = this.getCharacter(charIdOrName);
    if (!char) {
      return false;
    }

    if (!char.state_history) {
      return false;
    }

    const beforeCount = char.state_history.length;
    char.state_history = char.state_history.filter(
      h => h.chapter !== chapterNumber
    );
    const removedCount = beforeCount - char.state_history.length;

    if (removedCount > 0) {
      this.data.last_updated = new Date().toISOString();
      await this.save();
      console.log(`✅ 已删除 ${char.name} 在第${chapterNumber}章的 ${removedCount} 条状态历史`);
    }

    return removedCount > 0;
  }

  /**
   * 删除角色的历史记录（用于清理无用记忆）
   * @param {string} charIdOrName - 角色ID或名称
   * @param {number} chapterNumber - 章节号（删除该章节的历史记录）
   */
  async removeHistoryByChapter(charIdOrName, chapterNumber) {
    const char = this.getCharacter(charIdOrName);
    if (!char) {
      return false;
    }

    if (!char.history) {
      return false;
    }

    const beforeCount = char.history.length;
    char.history = char.history.filter(
      h => h.chapter !== chapterNumber
    );
    const removedCount = beforeCount - char.history.length;

    if (removedCount > 0) {
      this.data.last_updated = new Date().toISOString();
      await this.save();
      console.log(`✅ 已删除 ${char.name} 在第${chapterNumber}章的 ${removedCount} 条历史记录`);
    }

    return removedCount > 0;
  }

  /**
   * 更新角色状态（增强版：记录状态迁移历史）
   * @param {string} charIdOrName - 角色ID或名称
   * @param {Object} stateUpdates - 状态更新
   * @param {Object} options - 选项 { chapter, source, replaceChapter } - replaceChapter: 如果提供，会先删除该章节的旧状态
   */
  async updateCharacterState(charIdOrName, stateUpdates, options = {}) {
    const char = this.getCharacter(charIdOrName);
    if (!char) {
      throw new Error(`角色不存在: ${charIdOrName}`);
    }

    // 如果指定了 replaceChapter，先删除该章节的旧状态
    if (options.replaceChapter) {
      await this.removeStateHistoryByChapter(charIdOrName, options.replaceChapter);
      await this.removeHistoryByChapter(charIdOrName, options.replaceChapter);
    }

    // 保存旧状态（深拷贝）
    const oldState = JSON.parse(JSON.stringify(char.current_state));

    // 更新状态
    char.current_state = {
      ...char.current_state,
      ...stateUpdates
    };

    // 检测状态变化
    const changes = this.detectStateChanges(oldState, char.current_state);

    // 如果有变化，记录状态迁移历史
    if (changes.length > 0) {
      if (!char.state_history) {
        char.state_history = [];
      }

      char.state_history.push({
        timestamp: new Date().toISOString(),
        chapter: options.chapter || null,
        from: oldState,
        to: JSON.parse(JSON.stringify(char.current_state)),
        changes: changes,
        source: options.source || 'unknown' // 'memory_updater', 'manual', 'rule_engine' 等
      });

      // 限制历史记录数量（保留最近100条）
      if (char.state_history.length > 100) {
        char.state_history = char.state_history.slice(-100);
      }
    }

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 更新角色状态: ${char.name} (${changes.length} 个变化)`);
  }

  /**
   * 检测状态变化
   */
  detectStateChanges(oldState, newState) {
    const changes = [];
    
    // 检查每个字段的变化
    for (const key in newState) {
      const oldValue = oldState[key];
      const newValue = newState[key];
      
      // 数组类型特殊处理
      if (Array.isArray(oldValue) && Array.isArray(newValue)) {
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push({
            field: key,
            from: oldValue,
            to: newValue,
            type: 'array_change'
          });
        }
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          from: oldValue,
          to: newValue,
          type: 'value_change'
        });
      }
    }

    // 检查是否有字段被删除
    for (const key in oldState) {
      if (!(key in newState)) {
        changes.push({
          field: key,
          from: oldState[key],
          to: null,
          type: 'field_removed'
        });
      }
    }

    return changes;
  }

  /**
   * 获取角色状态历史
   */
  getStateHistory(charIdOrName, limit = 10) {
    const char = this.getCharacter(charIdOrName);
    if (!char || !char.state_history) {
      return [];
    }
    return char.state_history.slice(-limit);
  }

  /**
   * 获取角色状态迁移轨迹
   */
  getStateTrajectory(charIdOrName, field = null) {
    const char = this.getCharacter(charIdOrName);
    if (!char || !char.state_history) {
      return [];
    }

    const trajectory = [];
    for (const record of char.state_history) {
      if (field) {
        // 只追踪特定字段
        const change = record.changes.find(c => c.field === field);
        if (change) {
          trajectory.push({
            timestamp: record.timestamp,
            chapter: record.chapter,
            from: change.from,
            to: change.to
          });
        }
      } else {
        // 追踪所有变化
        trajectory.push({
          timestamp: record.timestamp,
          chapter: record.chapter,
          changes: record.changes
        });
      }
    }

    return trajectory;
  }

  /**
   * 添加角色历史事件（如果角色不存在，先创建角色）
   */
  async addCharacterHistory(charIdOrName, event) {
    let char = this.getCharacter(charIdOrName);
    if (!char) {
      // 如果角色不存在，先创建
      console.log(`⚠️ 角色不存在，先创建: ${charIdOrName}`);
      const charId = await this.addCharacter({
        name: charIdOrName,
        role: 'supporting'
      });
      char = this.getCharacter(charId);
    }

    char.history.push({
      ...event,
      recorded_at: new Date().toISOString()
    });

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 添加角色历史: ${char.name} - ${event.event}`);
  }

  /**
   * 更新角色关系
   */
  async updateRelationship(charIdOrName, targetChar, relationship) {
    const char = this.getCharacter(charIdOrName);
    if (!char) {
      throw new Error(`角色不存在: ${charIdOrName}`);
    }

    char.relationships[targetChar] = {
      ...relationship,
      updated_at: new Date().toISOString()
    };

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 更新角色关系: ${char.name} ↔ ${targetChar}`);
  }

  /**
   * 查询角色
   */
  queryCharacters(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const char of Object.values(this.data.characters)) {
      const charStr = JSON.stringify(char).toLowerCase();
      if (charStr.includes(lowerQuery)) {
        results.push(char);
      }
    }

    return results;
  }

  /**
   * 获取角色相关上下文
   * @param {string[]} charNames - 角色名称列表
   */
  getRelevantContext(charNames) {
    const context = [];
    
    for (const name of charNames) {
      const char = this.getCharacter(name);
      if (char) {
        context.push({
          name: char.name,
          role: char.role,
          personality: char.personality,
          current_state: char.current_state,
          recent_history: char.history.slice(-5) // 最近5个事件
        });
      }
    }

    return context;
  }

  /**
   * 保存记忆
   */
  async save() {
    try {
      await fs.writeFile(
        this.memoryFile,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('❌ 保存人物记忆失败:', error);
      throw error;
    }
  }

  /**
   * 获取完整记忆数据
   */
  getData() {
    return this.data;
  }

  /**
   * 重置记忆
   */
  async reset() {
    this.data = this.getDefaultMemory();
    await this.save();
    console.log('🔄 人物记忆已重置');
  }
}

module.exports = CharacterMemory;

