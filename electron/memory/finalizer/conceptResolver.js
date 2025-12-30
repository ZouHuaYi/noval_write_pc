/**
 * Concept Resolver - 概念语义归一化核心
 * 负责将不同表述的同一概念归一到统一 ID
 */

const fs = require('fs');
const path = require('path');
const SemanticSimilarity = require('./semanticSimilarity');

class ConceptResolver {
  constructor(workspaceRoot, llmConfig = null) {
    this.workspaceRoot = workspaceRoot;
    this.conceptPath = path.join(workspaceRoot, '.novel-agent', 'core', 'concepts.json');
    this.semanticSimilarity = new SemanticSimilarity(llmConfig);
  }

  /**
   * 设置 LLM 配置（用于语义相似度判断）
   */
  setLLMConfig(llmConfig) {
    this.semanticSimilarity.setLLMConfig(llmConfig);
  }

  /**
   * 加载概念注册表
   */
  loadConcepts() {
    try {
      if (!fs.existsSync(this.conceptPath)) {
        // 确保目录存在
        const dir = path.dirname(this.conceptPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        return {};
      }
      const content = fs.readFileSync(this.conceptPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('⚠️ 加载概念注册表失败:', error.message);
      return {};
    }
  }

  /**
   * 保存概念注册表
   */
  saveConcepts(concepts) {
    try {
      const dir = path.dirname(this.conceptPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.conceptPath, JSON.stringify(concepts, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ 保存概念注册表失败:', error.message);
      throw error;
    }
  }

  /**
   * 尝试把 surfaceText 归一到已有 concept
   * @param {string} surfaceText - 表面文本
   * @param {boolean} useSemanticSimilarity - 是否使用语义相似度（默认 true）
   * @returns {Promise<{id: string|null, isNew: boolean, similarity?: number}>} - 概念ID和是否为新概念
   */
  async resolveConcept(surfaceText, useSemanticSimilarity = true) {
    const concepts = this.loadConcepts();
    
    // 1. 精确匹配 alias
    for (const [id, concept] of Object.entries(concepts)) {
      if (concept.aliases && concept.aliases.includes(surfaceText)) {
        return { id, isNew: false, similarity: 1.0 };
      }
    }

    // 2. 语义相似度匹配（如果启用且配置了 LLM）
    if (useSemanticSimilarity && this.semanticSimilarity.llmConfig) {
      try {
        // 收集所有候选 alias
        const allAliases = [];
        const aliasToConceptId = new Map();

        for (const [id, concept] of Object.entries(concepts)) {
          if (concept.aliases && concept.aliases.length > 0) {
            for (const alias of concept.aliases) {
              allAliases.push(alias);
              aliasToConceptId.set(alias, id);
            }
          }
        }

        if (allAliases.length > 0) {
          // 查找最相似的 alias
          const result = await this.semanticSimilarity.findMostSimilar(
            surfaceText,
            allAliases
          );

          if (result.index !== null && result.similarity >= 0.75) {
            const matchedAlias = allAliases[result.index];
            const conceptId = aliasToConceptId.get(matchedAlias);
            console.log(`   🔗 语义匹配: "${surfaceText}" ≈ "${matchedAlias}" (相似度: ${result.similarity.toFixed(3)})`);
            return {
              id: conceptId,
              isNew: false,
              similarity: result.similarity
            };
          }
        }
      } catch (error) {
        console.warn('⚠️ 语义相似度判断失败，回退到精确匹配:', error.message);
      }
    }

    return { id: null, isNew: true, similarity: 0 };
  }

  /**
   * 创建新 concept
   * @param {string} surfaceText - 表面文本
   * @param {number} chapter - 首次出现的章节
   * @param {string} description - 描述（可选）
   * @returns {string} - 新概念ID
   */
  createConcept(surfaceText, chapter, description = '') {
    const concepts = this.loadConcepts();
    const id = `concept_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    concepts[id] = {
      aliases: [surfaceText],
      description: description || '',
      first_seen: chapter
    };

    this.saveConcepts(concepts);
    return id;
  }

  /**
   * 给已有 concept 增加 alias
   * @param {string} conceptId - 概念ID
   * @param {string} surfaceText - 新的别名
   */
  addAlias(conceptId, surfaceText) {
    const concepts = this.loadConcepts();
    const concept = concepts[conceptId];

    if (!concept) {
      throw new Error(`概念不存在: ${conceptId}`);
    }

    if (!concept.aliases) {
      concept.aliases = [];
    }

    if (!concept.aliases.includes(surfaceText)) {
      concept.aliases.push(surfaceText);
      this.saveConcepts(concepts);
    }
  }

  /**
   * 更新概念描述
   * @param {string} conceptId - 概念ID
   * @param {string} description - 新描述
   */
  updateDescription(conceptId, description) {
    const concepts = this.loadConcepts();
    const concept = concepts[conceptId];

    if (!concept) {
      throw new Error(`概念不存在: ${conceptId}`);
    }

    // 只有当新描述更清晰时才更新
    if (description && description.length > (concept.description || '').length) {
      concept.description = description;
      this.saveConcepts(concepts);
    }
  }

  /**
   * 获取所有概念
   */
  getAllConcepts() {
    return this.loadConcepts();
  }

  /**
   * 根据ID获取概念
   */
  getConcept(conceptId) {
    const concepts = this.loadConcepts();
    return concepts[conceptId] || null;
  }
}

module.exports = ConceptResolver;

