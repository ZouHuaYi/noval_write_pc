/**
 * Pacing Controller - 节奏控制器
 * 分析文本节奏，计算节奏值，与目标节奏曲线对比
 */

class PacingController {
  constructor() {
    // 节奏特征权重
    this.weights = {
      sentenceLength: 0.3,    // 句子长度权重
      verbDensity: 0.25,      // 动词密度权重
      dialogueRatio: 0.2,     // 对话比例权重
      actionVerbCount: 0.15,  // 动作动词数量权重
      paragraphLength: 0.1    // 段落长度权重
    };
  }

  /**
   * 分析文本节奏
   * @param {string} text - 文本内容
   * @param {number} segmentCount - 分段数量（用于生成曲线）
   */
  analyzePacing(text, segmentCount = 10) {
    try {
      if (!text || text.trim().length === 0) {
        return {
          overall: 'medium',
          score: 0.5,
          curve: this.generateDefaultCurve(segmentCount)
        };
      }

      // 分段分析
      const segments = this.segmentText(text, segmentCount);
      const segmentAnalyses = segments.map(segment => this.analyzeSegment(segment));

      // 计算整体节奏
      const overallScore = segmentAnalyses.reduce((sum, s) => sum + s.score, 0) / segmentAnalyses.length;
      const overall = this.scoreToPacing(overallScore);

      // 生成节奏曲线
      const curve = segmentAnalyses.map((analysis, index) => ({
        position: index / (segmentCount - 1),
        pacing: analysis.pacing,
        score: analysis.score
      }));

      return {
        overall,
        score: overallScore,
        curve,
        features: this.extractFeatures(text),
        segmentAnalyses
      };

    } catch (error) {
      console.error('分析节奏失败:', error);
      return {
        overall: 'medium',
        score: 0.5,
        curve: this.generateDefaultCurve(segmentCount)
      };
    }
  }

  /**
   * 分析单个段落
   */
  analyzeSegment(segment) {
    const features = this.extractFeatures(segment);
    const score = this.calculatePacingScore(features);
    const pacing = this.scoreToPacing(score);

    return {
      pacing,
      score,
      features
    };
  }

  /**
   * 提取节奏特征
   */
  extractFeatures(text) {
    // 句子
    const sentences = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
      : 0;

    // 动词（简化：匹配常见动词模式）
    const verbPatterns = /[打|跑|跳|走|说|看|听|想|做|来|去|回|出|进|上|下|开|关|拿|放|给|取|送|接|送|推|拉|抓|放|扔|投|射|击|砍|切|杀|救|帮|教|学|练|修|建|造|制|做|写|画|唱|跳|玩|吃|喝|睡|醒|起|坐|站|躺|睡|醒|起|坐|站|躺]/g;
    const verbMatches = text.match(verbPatterns) || [];
    const verbDensity = text.length > 0 ? verbMatches.length / text.length : 0;

    // 对话
    const dialogueMarkers = /[""''「」『』]/g;
    const dialogueCount = (text.match(dialogueMarkers) || []).length;
    const dialogueRatio = text.length > 0 ? dialogueCount / text.length : 0;

    // 动作动词（更具体的动作词）
    const actionVerbs = /[打|跑|跳|走|砍|切|杀|救|推|拉|抓|放|扔|投|射|击]/g;
    const actionVerbCount = (text.match(actionVerbs) || []).length;

    // 段落
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const avgParagraphLength = paragraphs.length > 0
      ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length
      : 0;

    return {
      avgSentenceLength,
      verbDensity,
      dialogueRatio,
      actionVerbCount,
      avgParagraphLength,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length
    };
  }

  /**
   * 计算节奏分数（0-1）
   */
  calculatePacingScore(features) {
    let score = 0;

    // 句子长度：短句子 = 快节奏
    if (features.avgSentenceLength < 15) {
      score += this.weights.sentenceLength * 0.8; // 快
    } else if (features.avgSentenceLength < 25) {
      score += this.weights.sentenceLength * 0.5; // 中
    } else {
      score += this.weights.sentenceLength * 0.2; // 慢
    }

    // 动词密度：高密度 = 快节奏
    if (features.verbDensity > 0.15) {
      score += this.weights.verbDensity * 0.8;
    } else if (features.verbDensity > 0.08) {
      score += this.weights.verbDensity * 0.5;
    } else {
      score += this.weights.verbDensity * 0.2;
    }

    // 对话比例：低比例 = 快节奏（对话通常较慢）
    if (features.dialogueRatio < 0.1) {
      score += this.weights.dialogueRatio * 0.8;
    } else if (features.dialogueRatio < 0.3) {
      score += this.weights.dialogueRatio * 0.5;
    } else {
      score += this.weights.dialogueRatio * 0.2;
    }

    // 动作动词数量：多 = 快节奏
    if (features.actionVerbCount > 5) {
      score += this.weights.actionVerbCount * 0.8;
    } else if (features.actionVerbCount > 2) {
      score += this.weights.actionVerbCount * 0.5;
    } else {
      score += this.weights.actionVerbCount * 0.2;
    }

    // 段落长度：短段落 = 快节奏
    if (features.avgParagraphLength < 200) {
      score += this.weights.paragraphLength * 0.8;
    } else if (features.avgParagraphLength < 400) {
      score += this.weights.paragraphLength * 0.5;
    } else {
      score += this.weights.paragraphLength * 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 分数转换为节奏类型
   */
  scoreToPacing(score) {
    if (score >= 0.7) {
      return 'fast';
    } else if (score >= 0.4) {
      return 'medium';
    } else {
      return 'slow';
    }
  }

  /**
   * 与目标节奏曲线对比
   * @param {Object} actualPacing - 实际节奏分析结果
   * @param {Object} targetPacing - 目标节奏曲线
   */
  compareWithTarget(actualPacing, targetPacing) {
    if (!targetPacing || !targetPacing.variations) {
      return {
        match: true,
        score: 100,
        issues: []
      };
    }

    const issues = [];
    let totalDiff = 0;
    let matchCount = 0;

    const pacingMap = { slow: 0, medium: 1, fast: 2 };

    // 对比每个位置
    for (const targetPoint of targetPacing.variations) {
      const position = targetPoint.position;
      
      // 找到实际曲线中最近的点
      const actualPoint = this.findNearestPoint(actualPacing.curve, position);
      
      if (actualPoint) {
        const targetValue = pacingMap[targetPoint.pacing] || 1;
        const actualValue = pacingMap[actualPoint.pacing] || 1;
        const diff = Math.abs(targetValue - actualValue);
        
        totalDiff += diff;
        
        if (diff === 0) {
          matchCount++;
        } else if (diff >= 2) {
          issues.push({
            position: position.toFixed(2),
            target: targetPoint.pacing,
            actual: actualPoint.pacing,
            severity: 'high',
            message: `节奏不匹配：目标 ${targetPoint.pacing}，实际 ${actualPoint.pacing}`
          });
        } else {
          issues.push({
            position: position.toFixed(2),
            target: targetPoint.pacing,
            actual: actualPoint.pacing,
            severity: 'low',
            message: `节奏轻微偏差：目标 ${targetPoint.pacing}，实际 ${actualPoint.pacing}`
          });
        }
      }
    }

    // 计算匹配分数
    const avgDiff = totalDiff / (targetPacing.variations.length || 1);
    const matchScore = Math.max(0, 100 - avgDiff * 30);

    return {
      match: matchScore >= 70,
      score: matchScore,
      issues,
      matchRate: matchCount / (targetPacing.variations.length || 1)
    };
  }

  /**
   * 查找最近的点
   */
  findNearestPoint(curve, position) {
    if (!curve || curve.length === 0) {
      return null;
    }

    let nearest = curve[0];
    let minDiff = Math.abs(nearest.position - position);

    for (const point of curve) {
      const diff = Math.abs(point.position - position);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = point;
      }
    }

    return nearest;
  }

  /**
   * 分段文本
   */
  segmentText(text, segmentCount) {
    const totalLength = text.length;
    const segmentLength = Math.floor(totalLength / segmentCount);
    const segments = [];

    for (let i = 0; i < segmentCount; i++) {
      const start = i * segmentLength;
      const end = i === segmentCount - 1 ? totalLength : (i + 1) * segmentLength;
      segments.push(text.substring(start, end));
    }

    return segments;
  }

  /**
   * 生成默认曲线
   */
  generateDefaultCurve(segmentCount) {
    const curve = [];
    for (let i = 0; i < segmentCount; i++) {
      curve.push({
        position: i / (segmentCount - 1),
        pacing: 'medium',
        score: 0.5
      });
    }
    return curve;
  }

  /**
   * 生成节奏调整建议
   */
  generateSuggestions(comparison, targetPacing) {
    const suggestions = [];

    if (comparison.score < 70) {
      suggestions.push({
        type: 'pacing_mismatch',
        message: '节奏与目标曲线不匹配',
        action: '调整文本节奏以匹配目标曲线'
      });
    }

    for (const issue of comparison.issues) {
      if (issue.severity === 'high') {
        suggestions.push({
          type: 'pacing_adjustment',
          position: issue.position,
          message: issue.message,
          action: `在位置 ${issue.position} 调整节奏从 ${issue.actual} 到 ${issue.target}`
        });
      }
    }

    return suggestions;
  }
}

module.exports = PacingController;

