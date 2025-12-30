/**
 * Fact Conflict Detector - 事实冲突检测器
 * 检测新事实与已有事实之间的矛盾
 */

const SemanticSimilarity = require('./semanticSimilarity');

class FactConflictDetector {
  constructor(workspaceRoot, llmConfig = null) {
    this.workspaceRoot = workspaceRoot;
    this.semanticSimilarity = new SemanticSimilarity(llmConfig);
  }

  /**
   * 设置 LLM 配置（用于语义相似度判断）
   */
  setLLMConfig(llmConfig) {
    this.semanticSimilarity.setLLMConfig(llmConfig);
  }

  /**
   * 检测事实冲突
   * @param {Object} newFact - 新事实 { statement, type, ... }
   * @param {Array} existingFacts - 已有事实列表
   * @returns {Promise<{hasConflict: boolean, conflicts: Array, warnings: Array}>}
   */
  async detectConflict(newFact, existingFacts) {
    const conflicts = [];
    const warnings = [];

    if (!existingFacts || existingFacts.length === 0) {
      return { hasConflict: false, conflicts: [], warnings: [] };
    }

    // 1. 精确匹配检测（完全相同的事实）
    const exactMatch = existingFacts.find(
      f => f.statement === newFact.statement
    );
    if (exactMatch) {
      return {
        hasConflict: false,
        conflicts: [],
        warnings: [{
          type: 'duplicate',
          message: `事实已存在: ${newFact.statement}`,
          existingFact: exactMatch
        }]
      };
    }

    // 2. 语义相似度检测（如果配置了 LLM）
    if (this.semanticSimilarity.llmConfig) {
      try {
        for (const existingFact of existingFacts) {
          // 只检查相同类型的事实
          if (existingFact.type !== newFact.type) {
            continue;
          }

          const similarity = await this.semanticSimilarity.isSimilar(
            newFact.statement,
            existingFact.statement
          );

          if (similarity.similar && similarity.similarity > 0.9) {
            // 高相似度，可能是重复
            warnings.push({
              type: 'similar',
              message: `发现相似事实 (相似度: ${similarity.similarity.toFixed(3)})`,
              newFact: newFact.statement,
              existingFact: existingFact.statement,
              similarity: similarity.similarity
            });
          }
        }
      } catch (error) {
        console.warn('⚠️ 语义冲突检测失败:', error.message);
      }
    }

    // 3. 关键词冲突检测（简单规则）
    const conflictsByKeywords = this.detectKeywordConflicts(newFact, existingFacts);
    conflicts.push(...conflictsByKeywords);

    // 4. 逻辑冲突检测（基于类型和内容）
    const logicalConflicts = this.detectLogicalConflicts(newFact, existingFacts);
    conflicts.push(...logicalConflicts);

    return {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts,
      warnings: warnings
    };
  }

  /**
   * 关键词冲突检测
   */
  detectKeywordConflicts(newFact, existingFacts) {
    const conflicts = [];
    
    // 提取关键词（简单实现）
    const newKeywords = this.extractKeywords(newFact.statement);
    
    for (const existingFact of existingFacts) {
      if (existingFact.type !== newFact.type) {
        continue;
      }

      const existingKeywords = this.extractKeywords(existingFact.statement);
      
      // 检查是否有相反的关键词
      const hasOpposite = this.hasOppositeKeywords(newKeywords, existingKeywords);
      
      if (hasOpposite) {
        conflicts.push({
          type: 'keyword_opposite',
          severity: 'medium',
          message: `检测到相反的关键词`,
          newFact: newFact.statement,
          existingFact: existingFact.statement,
          newKeywords: newKeywords,
          existingKeywords: existingKeywords
        });
      }
    }

    return conflicts;
  }

  /**
   * 逻辑冲突检测
   */
  detectLogicalConflicts(newFact, existingFacts) {
    const conflicts = [];

    // 检查死亡相关的冲突
    if (newFact.type === 'irreversible_event' && newFact.statement.includes('死亡')) {
      // 检查是否已有死亡记录
      const hasDeath = existingFacts.some(f => 
        f.type === 'irreversible_event' && 
        f.statement.includes('死亡') &&
        this.extractCharacterName(f.statement) === this.extractCharacterName(newFact.statement)
      );
      
      if (hasDeath) {
        conflicts.push({
          type: 'logical_duplicate',
          severity: 'high',
          message: `角色死亡记录已存在`,
          newFact: newFact.statement
        });
      }
    }

    // 检查境界冲突（如果新境界低于已有境界）
    if (newFact.type === 'irreversible_event' && newFact.statement.includes('突破')) {
      const characterName = this.extractCharacterName(newFact.statement);
      const newLevel = this.extractLevel(newFact.statement);
      
      if (characterName && newLevel) {
        const existingLevels = existingFacts
          .filter(f => 
            f.type === 'irreversible_event' && 
            f.statement.includes('突破') &&
            this.extractCharacterName(f.statement) === characterName
          )
          .map(f => this.extractLevel(f.statement))
          .filter(l => l);

        // 简单检查：如果新境界明显低于已有境界，可能是冲突
        // 这里需要根据实际的境界体系来判断，暂时只做警告
        if (existingLevels.length > 0) {
          warnings.push({
            type: 'level_check',
            message: `检测到角色 ${characterName} 的境界变化，请确认是否正确`,
            newLevel: newLevel,
            existingLevels: existingLevels
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    // 简单的关键词提取（中文）
    const keywords = [];
    
    // 提取角色名、地点、境界等
    const patterns = [
      /([\u4e00-\u9fa5]{2,4})(?:死亡|突破|觉醒|获得)/g,
      /(第[\d]+章|第[\d]+回)/g,
      /([\u4e00-\u9fa5]+境界|[\u4e00-\u9fa5]+期)/g
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        keywords.push(...matches);
      }
    }

    return keywords;
  }

  /**
   * 检查是否有相反的关键词
   */
  hasOppositeKeywords(keywords1, keywords2) {
    const opposites = [
      ['死亡', '活着', '生存'],
      ['突破', '跌落', '下降'],
      ['获得', '失去', '丢失'],
      ['增加', '减少', '降低'],
      ['开启', '关闭', '封闭']
    ];

    for (const [word1, word2] of opposites) {
      if (
        (keywords1.some(k => k.includes(word1)) && keywords2.some(k => k.includes(word2))) ||
        (keywords1.some(k => k.includes(word2)) && keywords2.some(k => k.includes(word1)))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 提取角色名（简单实现）
   */
  extractCharacterName(text) {
    // 尝试提取角色名（假设在句首或"角色名+动作"格式）
    const match = text.match(/^([\u4e00-\u9fa5]{2,4})(?:死亡|突破|觉醒|获得|失去)/);
    return match ? match[1] : null;
  }

  /**
   * 提取境界（简单实现）
   */
  extractLevel(text) {
    const match = text.match(/([\u4e00-\u9fa5]+境界|[\u4e00-\u9fa5]+期)/);
    return match ? match[1] : null;
  }

  /**
   * 批量检测冲突
   * @param {Array} newFacts - 新事实列表
   * @param {Array} existingFacts - 已有事实列表
   */
  async detectBatchConflicts(newFacts, existingFacts) {
    const results = [];

    for (const newFact of newFacts) {
      const result = await this.detectConflict(newFact, existingFacts);
      results.push({
        fact: newFact,
        ...result
      });
    }

    return results;
  }
}

module.exports = FactConflictDetector;

