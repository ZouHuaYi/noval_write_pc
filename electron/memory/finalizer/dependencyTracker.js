/**
 * Dependency Tracker - 依赖追踪器
 * 
 * 依赖只允许存在于：Chapter → Effect → Core State
 * 禁止：Chapter → Chapter, Chapter → Extract Output
 */

const fs = require('fs');
const path = require('path');

class DependencyTracker {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.corePath = path.join(workspaceRoot, '.novel-agent', 'core');
    this.dependencyFile = path.join(this.corePath, 'dependencies.json');
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
   * 加载依赖图
   */
  loadDependencies() {
    this.ensureDirectory();
    if (!fs.existsSync(this.dependencyFile)) {
      return {
        version: '1.0',
        dependencies: {},
        invalidated_chapters: []
      };
    }
    try {
      const content = fs.readFileSync(this.dependencyFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ 加载依赖图失败:', error.message);
      return {
        version: '1.0',
        dependencies: {},
        invalidated_chapters: []
      };
    }
  }

  /**
   * 保存依赖图
   */
  saveDependencies(data) {
    this.ensureDirectory();
    try {
      fs.writeFileSync(this.dependencyFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ 保存依赖图失败:', error.message);
      throw error;
    }
  }

  /**
   * 记录章节依赖的 Effect
   * 
   * @param {number} chapterNumber - 章节号
   * @param {Array} effectIds - 依赖的 Effect ID 列表
   * @param {Array} factIds - 依赖的 Fact ID 列表（可选）
   */
  recordDependencies(chapterNumber, effectIds = [], factIds = []) {
    const deps = this.loadDependencies();
    
    if (!deps.dependencies[chapterNumber]) {
      deps.dependencies[chapterNumber] = {
        chapter: chapterNumber,
        depends_on_effects: [],
        depends_on_facts: [],
        created_at: new Date().toISOString()
      };
    }

    deps.dependencies[chapterNumber].depends_on_effects = effectIds;
    deps.dependencies[chapterNumber].depends_on_facts = factIds;
    deps.dependencies[chapterNumber].updated_at = new Date().toISOString();

    this.saveDependencies(deps);
    console.log(`   ✅ 记录第 ${chapterNumber} 章的依赖: ${effectIds.length} 个 Effects, ${factIds.length} 个 Facts`);
  }

  /**
   * 获取依赖指定 Effect 的章节
   * 
   * @param {string} effectId - Effect ID
   * @returns {Array} 章节号数组
   */
  getChaptersDependingOnEffect(effectId) {
    const deps = this.loadDependencies();
    const dependentChapters = [];

    for (const [chapterNum, dep] of Object.entries(deps.dependencies)) {
      if (dep.depends_on_effects && dep.depends_on_effects.includes(effectId)) {
        dependentChapters.push(parseInt(chapterNum));
      }
    }

    return dependentChapters;
  }

  /**
   * 获取依赖指定 Fact 的章节
   * 
   * @param {string} factId - Fact ID
   * @returns {Array} 章节号数组
   */
  getChaptersDependingOnFact(factId) {
    const deps = this.loadDependencies();
    const dependentChapters = [];

    for (const [chapterNum, dep] of Object.entries(deps.dependencies)) {
      if (dep.depends_on_facts && dep.depends_on_facts.includes(factId)) {
        dependentChapters.push(parseInt(chapterNum));
      }
    }

    return dependentChapters;
  }

  /**
   * 标记章节为失效（当依赖的 Effect/Fact 被删除时）
   * 
   * @param {number} chapterNumber - 章节号
   * @param {string} reason - 失效原因
   */
  invalidateChapter(chapterNumber, reason) {
    const deps = this.loadDependencies();
    
    if (!deps.invalidated_chapters) {
      deps.invalidated_chapters = [];
    }

    const existing = deps.invalidated_chapters.find(
      inv => inv.chapter === chapterNumber
    );

    if (!existing) {
      deps.invalidated_chapters.push({
        chapter: chapterNumber,
        reason: reason,
        invalidated_at: new Date().toISOString()
      });
      this.saveDependencies(deps);
      console.log(`   ⚠️  标记第 ${chapterNumber} 章为失效: ${reason}`);
    }
  }

  /**
   * 清除章节的失效标记（重新结算后）
   * 
   * @param {number} chapterNumber - 章节号
   */
  clearInvalidation(chapterNumber) {
    const deps = this.loadDependencies();
    
    if (deps.invalidated_chapters) {
      deps.invalidated_chapters = deps.invalidated_chapters.filter(
        inv => inv.chapter !== chapterNumber
      );
      this.saveDependencies(deps);
      console.log(`   ✅ 清除第 ${chapterNumber} 章的失效标记`);
    }
  }

  /**
   * 获取所有失效的章节
   * 
   * @returns {Array} 失效章节信息数组
   */
  getInvalidatedChapters() {
    const deps = this.loadDependencies();
    return deps.invalidated_chapters || [];
  }

  /**
   * 检查章节是否失效
   * 
   * @param {number} chapterNumber - 章节号
   * @returns {boolean} 是否失效
   */
  isChapterInvalidated(chapterNumber) {
    const deps = this.loadDependencies();
    return deps.invalidated_chapters?.some(
      inv => inv.chapter === chapterNumber
    ) || false;
  }

  /**
   * 获取章节的依赖信息
   * 
   * @param {number} chapterNumber - 章节号
   * @returns {Object} 依赖信息
   */
  getChapterDependencies(chapterNumber) {
    const deps = this.loadDependencies();
    return deps.dependencies[chapterNumber] || null;
  }

  /**
   * 获取依赖图（用于可视化）
   * 
   * @returns {Object} 依赖图数据
   */
  getDependencyGraph() {
    const deps = this.loadDependencies();
    const graph = {
      nodes: [],
      edges: []
    };

    // 添加章节节点
    for (const [chapterNum, dep] of Object.entries(deps.dependencies)) {
      graph.nodes.push({
        id: `chapter-${chapterNum}`,
        type: 'chapter',
        chapter: parseInt(chapterNum),
        invalidated: this.isChapterInvalidated(parseInt(chapterNum))
      });

      // 添加依赖边（Chapter → Effect）
      for (const effectId of dep.depends_on_effects || []) {
        graph.edges.push({
          from: effectId,
          to: `chapter-${chapterNum}`,
          type: 'effect_dependency'
        });
      }

      // 添加依赖边（Chapter → Fact）
      for (const factId of dep.depends_on_facts || []) {
        graph.edges.push({
          from: factId,
          to: `chapter-${chapterNum}`,
          type: 'fact_dependency'
        });
      }
    }

    return graph;
  }
}

module.exports = DependencyTracker;

