/**
 * Semantic Similarity - 语义相似度判断
 * 使用 embedding 和余弦相似度来判断两个文本是否表达同一概念
 */

const axios = require('axios');

class SemanticSimilarity {
  constructor(llmConfig = null) {
    this.llmConfig = llmConfig;
    this.embeddingCache = new Map(); // 缓存 embedding，避免重复计算
    this.similarityThreshold = 0.75; // 相似度阈值，超过此值认为是同一概念
  }

  /**
   * 设置 LLM 配置（用于获取 embedding）
   */
  setLLMConfig(llmConfig) {
    this.llmConfig = llmConfig;
    this.embeddingCache.clear(); // 清除缓存
  }

  /**
   * 获取文本的 embedding 向量
   * @param {string} text - 文本
   * @returns {Promise<number[]>} - embedding 向量
   */
  async getEmbedding(text) {
    // 检查缓存
    const cacheKey = text.trim().toLowerCase();
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    if (!this.llmConfig) {
      throw new Error('LLM 配置未设置，无法获取 embedding');
    }

    try {
      // 使用 OpenAI 兼容的 embedding API
      const response = await axios.post(
        `${this.llmConfig.baseUrl}/embeddings`,
        {
          input: text,
          model: this.llmConfig.embeddingModel || 'text-embedding-ada-002'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.llmConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30秒超时
        }
      );

      if (response.data && response.data.data && response.data.data[0]) {
        const embedding = response.data.data[0].embedding;
        // 缓存结果
        this.embeddingCache.set(cacheKey, embedding);
        return embedding;
      }

      throw new Error('Invalid embedding response');
    } catch (error) {
      console.error('获取 embedding 失败:', error.message);
      throw new Error(`Embedding API 调用失败: ${error.message}`);
    }
  }

  /**
   * 计算两个向量的余弦相似度
   * @param {number[]} vecA - 向量A
   * @param {number[]} vecB - 向量B
   * @returns {number} - 相似度（0-1）
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 判断两个文本是否语义相似
   * @param {string} textA - 文本A
   * @param {string} textB - 文本B
   * @returns {Promise<{similar: boolean, similarity: number}>} - 是否相似和相似度
   */
  async isSimilar(textA, textB) {
    try {
      // 如果文本完全相同，直接返回
      if (textA.trim().toLowerCase() === textB.trim().toLowerCase()) {
        return { similar: true, similarity: 1.0 };
      }

      // 获取两个文本的 embedding
      const [embeddingA, embeddingB] = await Promise.all([
        this.getEmbedding(textA),
        this.getEmbedding(textB)
      ]);

      // 计算相似度
      const similarity = this.cosineSimilarity(embeddingA, embeddingB);

      return {
        similar: similarity >= this.similarityThreshold,
        similarity: similarity
      };
    } catch (error) {
      console.warn('语义相似度判断失败，回退到精确匹配:', error.message);
      // 如果 embedding 失败，回退到精确匹配
      return {
        similar: false,
        similarity: 0,
        error: error.message
      };
    }
  }

  /**
   * 在候选列表中查找最相似的概念
   * @param {string} text - 待匹配文本
   * @param {string[]} candidates - 候选文本列表
   * @returns {Promise<{index: number|null, similarity: number, text: string|null}>} - 最相似的候选
   */
  async findMostSimilar(text, candidates) {
    if (!candidates || candidates.length === 0) {
      return { index: null, similarity: 0, text: null };
    }

    try {
      // 先尝试精确匹配
      const exactMatchIndex = candidates.findIndex(
        c => c.trim().toLowerCase() === text.trim().toLowerCase()
      );
      if (exactMatchIndex !== -1) {
        return {
          index: exactMatchIndex,
          similarity: 1.0,
          text: candidates[exactMatchIndex]
        };
      }

      // 获取待匹配文本的 embedding
      const textEmbedding = await this.getEmbedding(text);

      // 批量获取候选文本的 embedding
      const candidateEmbeddings = await Promise.all(
        candidates.map(c => this.getEmbedding(c))
      );

      // 计算所有相似度
      let maxSimilarity = 0;
      let maxIndex = null;

      for (let i = 0; i < candidateEmbeddings.length; i++) {
        const similarity = this.cosineSimilarity(textEmbedding, candidateEmbeddings[i]);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          maxIndex = i;
        }
      }

      // 如果相似度超过阈值，返回结果
      if (maxSimilarity >= this.similarityThreshold) {
        return {
          index: maxIndex,
          similarity: maxSimilarity,
          text: candidates[maxIndex]
        };
      }

      return { index: null, similarity: maxSimilarity, text: null };
    } catch (error) {
      console.warn('查找最相似概念失败:', error.message);
      return { index: null, similarity: 0, text: null, error: error.message };
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.embeddingCache.clear();
  }

  /**
   * 设置相似度阈值
   * @param {number} threshold - 阈值（0-1）
   */
  setThreshold(threshold) {
    this.similarityThreshold = Math.max(0, Math.min(1, threshold));
  }
}

module.exports = SemanticSimilarity;

