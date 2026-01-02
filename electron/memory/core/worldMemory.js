/**
 * World Memory - 世界观记忆
 * 存储世界规则、修炼体系、魔法系统等长期不变的设定
 */

const fs = require('fs').promises;
const path = require('path');

class WorldMemory {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.memoryDir = path.join(workspaceRoot, '.novel-agent');
    this.memoryFile = path.join(this.memoryDir, 'world-memory.json');
    this.data = null;
  }

  /**
   * 初始化记忆
   */
  async initialize() {
    try {
      // 确保目录存在
      await fs.mkdir(this.memoryDir, { recursive: true });

      // 尝试加载现有记忆
      try {
        const content = await fs.readFile(this.memoryFile, 'utf-8');
        this.data = JSON.parse(content);
        console.log('✅ 加载世界观记忆成功');
      } catch (e) {
        // 文件不存在，创建默认记忆
        console.log('📝 创建新的世界观记忆');
        this.data = this.getDefaultMemory();
        await this.save();
      }
    } catch (error) {
      console.error('❌ 初始化世界观记忆失败:', error);
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
      world_rules: {
        cultivation_system: {
          levels: [],
          constraints: {},
          description: ''
        },
        magic_system: {
          elements: [],
          rules: {},
          description: ''
        },
        tech_level: 'unknown',
        geography: {
          continents: [],
          major_locations: [],
          description: ''
        },
        social_structure: {
          factions: [],
          power_hierarchy: [],
          description: ''
        }
      },
      custom_rules: []
    };
  }

  /**
   * 获取世界规则
   */
  getRules() {
    return this.data?.world_rules || {};
  }

  /**
   * 获取修炼/魔法体系
   */
  getCultivationSystem() {
    return this.data?.world_rules?.cultivation_system || {};
  }

  /**
   * 获取魔法系统
   */
  getMagicSystem() {
    return this.data?.world_rules?.magic_system || {};
  }

  /**
   * 获取地理信息
   */
  getGeography() {
    return this.data?.world_rules?.geography || {};
  }

  /**
   * 更新世界规则
   */
  async updateRules(rules) {
    this.data.world_rules = {
      ...this.data.world_rules,
      ...rules
    };
    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log('✅ 世界规则已更新');
  }

  /**
   * 更新修炼体系
   */
  async updateCultivationSystem(system) {
    this.data.world_rules.cultivation_system = {
      ...this.data.world_rules.cultivation_system,
      ...system
    };
    this.data.last_updated = new Date().toISOString();
    await this.save();
  }

  /**
   * 添加自定义规则
   */
  async addCustomRule(rule) {
    if (!this.data.custom_rules) {
      this.data.custom_rules = [];
    }
    this.data.custom_rules.push({
      ...rule,
      added_at: new Date().toISOString()
    });
    await this.save();
  }

  /**
   * 查询规则
   * @param {string} query - 查询关键词
   */
  queryRules(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // 搜索修炼体系
    const cultivation = this.data.world_rules.cultivation_system;
    if (JSON.stringify(cultivation).toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'cultivation_system',
        data: cultivation
      });
    }

    // 搜索魔法系统
    const magic = this.data.world_rules.magic_system;
    if (JSON.stringify(magic).toLowerCase().includes(lowerQuery)) {
      results.push({
        type: 'magic_system',
        data: magic
      });
    }

    // 搜索自定义规则
    if (this.data.custom_rules) {
      const matchingRules = this.data.custom_rules.filter(rule =>
        JSON.stringify(rule).toLowerCase().includes(lowerQuery)
      );
      results.push(...matchingRules.map(r => ({ type: 'custom_rule', data: r })));
    }

    return results;
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
      console.error('❌ 保存世界观记忆失败:', error);
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
    console.log('🔄 世界观记忆已重置');
  }
}

module.exports = WorldMemory;

