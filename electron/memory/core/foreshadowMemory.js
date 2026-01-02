/**
 * Foreshadow Memory - 伏笔记忆
 * 存储已埋下的伏笔、何时揭示、何时解决等信息
 */

const fs = require('fs').promises;
const path = require('path');

class ForeshadowMemory {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.memoryDir = path.join(workspaceRoot, '.novel-agent');
    this.memoryFile = path.join(this.memoryDir, 'foreshadow-memory.json');
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
        console.log('✅ 加载伏笔记忆成功');
      } catch (e) {
        console.log('📝 创建新的伏笔记忆');
        this.data = this.getDefaultMemory();
        await this.save();
      }
    } catch (error) {
      console.error('❌ 初始化伏笔记忆失败:', error);
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
      foreshadows: []
    };
  }

  /**
   * 添加伏笔
   */
  async addForeshadow(foreshadow) {
    const foreshadowData = {
      id: foreshadow.id || `foreshadow_${Date.now()}`,
      title: foreshadow.title,
      introduced_at: foreshadow.introduced_at || { chapter: null, paragraph: null },
      content: foreshadow.content,
      hints: foreshadow.hints || [],
      status: 'pending', // pending, revealed, resolved
      trigger_condition: foreshadow.trigger_condition || '',
      expected_reveal: foreshadow.expected_reveal || '',
      importance: foreshadow.importance || 'normal', // minor, normal, major, critical
      related_characters: foreshadow.related_characters || [],
      related_plot: foreshadow.related_plot || [],
      created_at: new Date().toISOString()
    };

    this.data.foreshadows.push(foreshadowData);
    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 添加伏笔: ${foreshadow.title}`);

    return foreshadowData.id;
  }

  /**
   * 添加伏笔暗示
   */
  async addHint(foreshadowId, hint) {
    const foreshadow = this.getForeshadow(foreshadowId);
    if (!foreshadow) {
      throw new Error(`伏笔不存在: ${foreshadowId}`);
    }

    foreshadow.hints.push({
      chapter: hint.chapter,
      content: hint.content,
      subtlety: hint.subtlety || 'medium', // subtle, medium, obvious
      added_at: new Date().toISOString()
    });

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 添加伏笔暗示: ${foreshadow.title} (第${hint.chapter}章)`);
  }

  /**
   * 揭示伏笔
   */
  async revealForeshadow(foreshadowId, revealDetails) {
    const foreshadow = this.getForeshadow(foreshadowId);
    if (!foreshadow) {
      throw new Error(`伏笔不存在: ${foreshadowId}`);
    }

    foreshadow.status = 'revealed';
    foreshadow.revealed_at = {
      chapter: revealDetails.chapter,
      content: revealDetails.content,
      revealed_time: new Date().toISOString()
    };

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 伏笔已揭示: ${foreshadow.title}`);
  }

  /**
   * 解决伏笔
   */
  async resolveForeshadow(foreshadowId, resolveDetails) {
    const foreshadow = this.getForeshadow(foreshadowId);
    if (!foreshadow) {
      throw new Error(`伏笔不存在: ${foreshadowId}`);
    }

    foreshadow.status = 'resolved';
    foreshadow.resolved_at = {
      chapter: resolveDetails.chapter,
      content: resolveDetails.content,
      resolved_time: new Date().toISOString()
    };

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 伏笔已解决: ${foreshadow.title}`);
  }

  /**
   * 获取伏笔
   */
  getForeshadow(foreshadowId) {
    return this.data.foreshadows.find(f => f.id === foreshadowId);
  }

  /**
   * 获取所有待处理的伏笔
   */
  getPendingForeshadows() {
    return this.data.foreshadows.filter(f => f.status === 'pending');
  }

  /**
   * 获取已揭示但未解决的伏笔
   */
  getRevealedForeshadows() {
    return this.data.foreshadows.filter(f => f.status === 'revealed');
  }

  /**
   * 获取已解决的伏笔
   */
  getResolvedForeshadows() {
    return this.data.foreshadows.filter(f => f.status === 'resolved');
  }

  /**
   * 根据重要性获取伏笔
   */
  getForeshadowsByImportance(importance) {
    return this.data.foreshadows.filter(f => f.importance === importance);
  }

  /**
   * 获取章节相关伏笔
   * @param {number} chapterNum - 章节号
   */
  getChapterForeshadows(chapterNum) {
    const introduced = this.data.foreshadows.filter(
      f => f.introduced_at?.chapter === chapterNum
    );

    const hinted = this.data.foreshadows.filter(f =>
      f.hints.some(h => h.chapter === chapterNum)
    );

    const revealed = this.data.foreshadows.filter(
      f => f.revealed_at?.chapter === chapterNum
    );

    const resolved = this.data.foreshadows.filter(
      f => f.resolved_at?.chapter === chapterNum
    );

    return {
      introduced,
      hinted,
      revealed,
      resolved
    };
  }

  /**
   * 检查是否有应该触发的伏笔
   */
  checkTriggeredForeshadows(context) {
    const triggered = [];

    for (const foreshadow of this.getPendingForeshadows()) {
      if (!foreshadow.trigger_condition) continue;

      // 简单的条件匹配（实际应该更智能）
      const conditionMet = this.evaluateCondition(
        foreshadow.trigger_condition,
        context
      );

      if (conditionMet) {
        triggered.push(foreshadow);
      }
    }

    return triggered;
  }

  /**
   * 评估触发条件（简化版）
   */
  evaluateCondition(condition, context) {
    // TODO: 实现更复杂的条件评估逻辑
    // 这里只是简单示例
    const lowerCondition = condition.toLowerCase();
    const lowerContext = JSON.stringify(context).toLowerCase();
    return lowerContext.includes(lowerCondition);
  }

  /**
   * 查询伏笔
   */
  queryForeshadows(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const foreshadow of this.data.foreshadows) {
      const foreshadowStr = JSON.stringify(foreshadow).toLowerCase();
      if (foreshadowStr.includes(lowerQuery)) {
        results.push(foreshadow);
      }
    }

    return results;
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    return {
      total: this.data.foreshadows.length,
      pending: this.getPendingForeshadows().length,
      revealed: this.getRevealedForeshadows().length,
      resolved: this.getResolvedForeshadows().length,
      by_importance: {
        minor: this.getForeshadowsByImportance('minor').length,
        normal: this.getForeshadowsByImportance('normal').length,
        major: this.getForeshadowsByImportance('major').length,
        critical: this.getForeshadowsByImportance('critical').length
      }
    };
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
      console.error('❌ 保存伏笔记忆失败:', error);
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
    console.log('🔄 伏笔记忆已重置');
  }
}

module.exports = ForeshadowMemory;

