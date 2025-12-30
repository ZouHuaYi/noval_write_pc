/**
 * Foreshadow Panel - 伏笔回收面板数据接口
 * 提供伏笔状态查询、统计和回收建议
 */

const fs = require('fs');
const path = require('path');
const ConceptResolver = require('./conceptResolver');

class ForeshadowPanel {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.corePath = path.join(workspaceRoot, '.novel-agent', 'core');
    this.conceptResolver = new ConceptResolver(workspaceRoot);
  }

  /**
   * 加载伏笔数据
   */
  loadForeshadows() {
    try {
      const foreshadowFile = path.join(this.corePath, 'foreshadows.json');
      if (!fs.existsSync(foreshadowFile)) {
        return [];
      }
      const content = fs.readFileSync(foreshadowFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ 加载伏笔数据失败:', error.message);
      return [];
    }
  }

  /**
   * 获取所有伏笔（带概念信息）
   */
  getAllForeshadows() {
    const foreshadows = this.loadForeshadows();
    const concepts = this.conceptResolver.getAllConcepts();

    return foreshadows.map(f => {
      const concept = concepts[f.concept_id] || {};
      return {
        ...f,
        concept_name: concept.aliases?.[0] || f.concept_id,
        concept_aliases: concept.aliases || [],
        concept_description: concept.description || ''
      };
    });
  }

  /**
   * 按状态分组伏笔
   */
  getForeshadowsByState() {
    const all = this.getAllForeshadows();
    
    return {
      pending: all.filter(f => f.state === 'pending'),
      confirmed: all.filter(f => f.state === 'confirmed'),
      revealed: all.filter(f => f.state === 'revealed'),
      archived: all.filter(f => f.state === 'archived')
    };
  }

  /**
   * 获取伏笔统计信息
   */
  getStatistics() {
    const byState = this.getForeshadowsByState();
    
    return {
      total: byState.pending.length + byState.confirmed.length + byState.revealed.length + byState.archived.length,
      pending: byState.pending.length,
      confirmed: byState.confirmed.length,
      revealed: byState.revealed.length,
      archived: byState.archived.length,
      active: byState.pending.length + byState.confirmed.length, // 活跃伏笔（未揭示）
      resolved: byState.revealed.length + byState.archived.length // 已解决伏笔
    };
  }

  /**
   * 获取待回收伏笔（pending 或 confirmed 状态，且超过一定章节数未更新）
   * @param {number} currentChapter - 当前章节
   * @param {number} thresholdChapters - 阈值章节数（默认10章）
   */
  getPendingRecycle(currentChapter, thresholdChapters = 10) {
    const byState = this.getForeshadowsByState();
    const allPending = [...byState.pending, ...byState.confirmed];

    return allPending.filter(f => {
      const chaptersSinceUpdate = currentChapter - (f.last_updated || f.introduced_in);
      return chaptersSinceUpdate >= thresholdChapters;
    }).map(f => ({
      ...f,
      chapters_since_update: currentChapter - (f.last_updated || f.introduced_in),
      recommendation: this.getRecycleRecommendation(f, currentChapter)
    }));
  }

  /**
   * 获取回收建议
   */
  getRecycleRecommendation(foreshadow, currentChapter) {
    const chaptersSinceUpdate = currentChapter - (foreshadow.last_updated || foreshadow.introduced_in);
    
    if (foreshadow.state === 'pending' && chaptersSinceUpdate >= 20) {
      return '建议揭示或归档：已超过20章未更新';
    } else if (foreshadow.state === 'confirmed' && chaptersSinceUpdate >= 15) {
      return '建议揭示：已确认但长时间未揭示';
    } else if (chaptersSinceUpdate >= 10) {
      return '建议检查：已超过10章未更新';
    }
    
    return '正常';
  }

  /**
   * 获取未解之谜列表（pending 状态的伏笔）
   */
  getOpenMysteries() {
    const byState = this.getForeshadowsByState();
    return byState.pending.map(f => ({
      concept_id: f.concept_id,
      concept_name: f.concept_name,
      introduced_in: f.introduced_in,
      implied_future: f.implied_future,
      last_updated: f.last_updated
    }));
  }

  /**
   * 获取伏笔时间线（按引入章节排序）
   */
  getTimeline() {
    const all = this.getAllForeshadows();
    return all.sort((a, b) => (a.introduced_in || 0) - (b.introduced_in || 0));
  }

  /**
   * 获取特定概念的伏笔历史
   * @param {string} conceptId - 概念ID
   */
  getConceptForeshadowHistory(conceptId) {
    const foreshadows = this.loadForeshadows();
    return foreshadows.filter(f => f.concept_id === conceptId);
  }

  /**
   * 搜索伏笔（按概念名称或描述）
   * @param {string} query - 搜索关键词
   */
  searchForeshadows(query) {
    const all = this.getAllForeshadows();
    const lowerQuery = query.toLowerCase();
    
    return all.filter(f => {
      return (
        f.concept_name.toLowerCase().includes(lowerQuery) ||
        f.concept_aliases.some(alias => alias.toLowerCase().includes(lowerQuery)) ||
        f.concept_description.toLowerCase().includes(lowerQuery) ||
        f.implied_future.toLowerCase().includes(lowerQuery)
      );
    });
  }
}

module.exports = ForeshadowPanel;

