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
   * 添加角色
   */
  async addCharacter(character) {
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
   * 更新角色状态
   */
  async updateCharacterState(charIdOrName, stateUpdates) {
    const char = this.getCharacter(charIdOrName);
    if (!char) {
      throw new Error(`角色不存在: ${charIdOrName}`);
    }

    char.current_state = {
      ...char.current_state,
      ...stateUpdates
    };

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 更新角色状态: ${char.name}`);
  }

  /**
   * 添加角色历史事件
   */
  async addCharacterHistory(charIdOrName, event) {
    const char = this.getCharacter(charIdOrName);
    if (!char) {
      throw new Error(`角色不存在: ${charIdOrName}`);
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

