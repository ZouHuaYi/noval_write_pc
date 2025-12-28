/**
 * Density Controller - 密度控制器
 * 控制信息密度、事件密度，平衡描写与叙事
 */

class DensityController {
  constructor() {
    // 事件关键词（用于检测事件）
    this.eventKeywords = [
      '发生', '出现', '发现', '遇到', '遭遇', '遇到', '遇到',
      '战斗', '攻击', '防御', '逃跑', '追击', '救援',
      '突破', '升级', '获得', '失去', '找到', '丢失',
      '对话', '交谈', '讨论', '争吵', '和解',
      '死亡', '受伤', '恢复', '治疗', '治愈'
    ];
  }

  /**
   * 分析文本密度
   * @param {string} text - 文本内容
   * @param {number} segmentCount - 分段数量
   */
  analyzeDensity(text, segmentCount = 10) {
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

      // 计算整体密度
      const overallScore = segmentAnalyses.reduce((sum, s) => sum + s.score, 0) / segmentAnalyses.length;
      const overall = this.scoreToDensity(overallScore);

      // 生成密度曲线
      const curve = segmentAnalyses.map((analysis, index) => ({
        position: index / (segmentCount - 1),
        density: analysis.density,
        score: analysis.score
      }));

      return {
        overall,
        score: overallScore,
        curve,
        metrics: this.calculateMetrics(text),
        segmentAnalyses
      };

    } catch (error) {
      console.error('分析密度失败:', error);
      return {
        overall: 'medium',
        score: 0.5,
        curve: this.generateDefaultCurve(segmentCount)
      };
    }
  }

  /**
   * 分析单个段落密度
   */
  analyzeSegment(segment) {
    const metrics = this.calculateSegmentMetrics(segment);
    const score = this.calculateDensityScore(metrics);
    const density = this.scoreToDensity(score);

    return {
      density,
      score,
      metrics
    };
  }

  /**
   * 计算段落指标
   */
  calculateSegmentMetrics(segment) {
    const wordCount = segment.length;
    
    // 事件数量
    const eventCount = this.countEvents(segment);
    const eventDensity = wordCount > 0 ? eventCount / (wordCount / 100) : 0;

    // 新信息数量（简化：新名词、新动词）
    const newInfoCount = this.countNewInfo(segment);
    const infoDensity = wordCount > 0 ? newInfoCount / (wordCount / 100) : 0;

    // 描写比例（环境描写、心理描写等）
    const descriptionRatio = this.calculateDescriptionRatio(segment);

    // 对话比例
    const dialogueRatio = this.calculateDialogueRatio(segment);

    return {
      wordCount,
      eventCount,
      eventDensity,
      newInfoCount,
      infoDensity,
      descriptionRatio,
      dialogueRatio
    };
  }

  /**
   * 计算整体指标
   */
  calculateMetrics(text) {
    const wordCount = text.length;
    const paragraphCount = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    const sentenceCount = text.split(/[。！？.!?]/).filter(s => s.trim().length > 0).length;

    const eventCount = this.countEvents(text);
    const eventDensity = wordCount > 0 ? eventCount / (wordCount / 1000) : 0;

    const newInfoCount = this.countNewInfo(text);
    const infoDensity = wordCount > 0 ? newInfoCount / (wordCount / 1000) : 0;

    return {
      wordCount,
      paragraphCount,
      sentenceCount,
      eventCount,
      eventDensity,
      newInfoCount,
      infoDensity,
      avgWordsPerParagraph: paragraphCount > 0 ? wordCount / paragraphCount : 0,
      avgWordsPerSentence: sentenceCount > 0 ? wordCount / sentenceCount : 0
    };
  }

  /**
   * 计算密度分数（0-1）
   */
  calculateDensityScore(metrics) {
    let score = 0;

    // 事件密度：高 = 高密度
    if (metrics.eventDensity > 3) {
      score += 0.4; // 高密度
    } else if (metrics.eventDensity > 1) {
      score += 0.2; // 中密度
    } else {
      score += 0.1; // 低密度
    }

    // 信息密度：高 = 高密度
    if (metrics.infoDensity > 5) {
      score += 0.3;
    } else if (metrics.infoDensity > 2) {
      score += 0.15;
    } else {
      score += 0.05;
    }

    // 描写比例：低 = 高密度（更多事件，更少描写）
    if (metrics.descriptionRatio < 0.3) {
      score += 0.2;
    } else if (metrics.descriptionRatio < 0.6) {
      score += 0.1;
    } else {
      score += 0.05;
    }

    // 对话比例：中等 = 平衡
    if (metrics.dialogueRatio > 0.2 && metrics.dialogueRatio < 0.4) {
      score += 0.1;
    } else {
      score += 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 分数转换为密度类型
   */
  scoreToDensity(score) {
    if (score >= 0.7) {
      return 'high';
    } else if (score >= 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 统计事件数量
   */
  countEvents(text) {
    let count = 0;
    for (const keyword of this.eventKeywords) {
      const regex = new RegExp(keyword, 'g');
      const matches = text.match(regex) || [];
      count += matches.length;
    }
    return count;
  }

  /**
   * 统计新信息数量（简化：统计新名词和动词）
   */
  countNewInfo(text) {
    // 简化处理：统计专有名词、新概念等
    const properNouns = text.match(/[A-Z][a-z]+|[A-Z]+/g) || [];
    const chineseProperNouns = text.match(/[《》「」『』]/g) || [];
    return properNouns.length + chineseProperNouns.length;
  }

  /**
   * 计算描写比例
   */
  calculateDescriptionRatio(text) {
    // 环境描写关键词
    const descriptionKeywords = [
      '看到', '听到', '闻到', '感觉到', '注意到',
      '天空', '地面', '周围', '远处', '近处',
      '美丽', '壮观', '宏伟', '精致', '细腻'
    ];

    let descriptionCount = 0;
    for (const keyword of descriptionKeywords) {
      const regex = new RegExp(keyword, 'g');
      const matches = text.match(regex) || [];
      descriptionCount += matches.length;
    }

    const totalWords = text.length;
    return totalWords > 0 ? descriptionCount / (totalWords / 100) : 0;
  }

  /**
   * 计算对话比例
   */
  calculateDialogueRatio(text) {
    const dialogueMarkers = /[""''「」『』]/g;
    const dialogueCount = (text.match(dialogueMarkers) || []).length;
    const totalWords = text.length;
    return totalWords > 0 ? dialogueCount / totalWords : 0;
  }

  /**
   * 与目标密度曲线对比
   */
  compareWithTarget(actualDensity, targetDensity) {
    if (!targetDensity || !targetDensity.variations) {
      return {
        match: true,
        score: 100,
        issues: []
      };
    }

    const issues = [];
    let totalDiff = 0;
    let matchCount = 0;

    const densityMap = { low: 0, medium: 1, high: 2 };

    for (const targetPoint of targetDensity.variations) {
      const position = targetPoint.position;
      const actualPoint = this.findNearestPoint(actualDensity.curve, position);

      if (actualPoint) {
        const targetValue = densityMap[targetPoint.density] || 1;
        const actualValue = densityMap[actualPoint.density] || 1;
        const diff = Math.abs(targetValue - actualValue);

        totalDiff += diff;

        if (diff === 0) {
          matchCount++;
        } else if (diff >= 2) {
          issues.push({
            position: position.toFixed(2),
            target: targetPoint.density,
            actual: actualPoint.density,
            severity: 'high',
            message: `密度不匹配：目标 ${targetPoint.density}，实际 ${actualPoint.density}`
          });
        }
      }
    }

    const avgDiff = totalDiff / (targetDensity.variations.length || 1);
    const matchScore = Math.max(0, 100 - avgDiff * 30);

    return {
      match: matchScore >= 70,
      score: matchScore,
      issues,
      matchRate: matchCount / (targetDensity.variations.length || 1)
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
        density: 'medium',
        score: 0.5
      });
    }
    return curve;
  }

  /**
   * 检查密度平衡
   */
  checkBalance(actualDensity) {
    const issues = [];
    const curve = actualDensity.curve || [];

    // 检查是否有极端密度（长时间高密度或低密度）
    let highDensityCount = 0;
    let lowDensityCount = 0;

    for (const point of curve) {
      if (point.density === 'high') {
        highDensityCount++;
      } else if (point.density === 'low') {
        lowDensityCount++;
      }
    }

    const highRatio = highDensityCount / curve.length;
    const lowRatio = lowDensityCount / curve.length;

    if (highRatio > 0.7) {
      issues.push({
        severity: 'medium',
        message: '密度长时间保持高水平，可能缺乏缓冲',
        suggestion: '添加低密度段落作为缓冲'
      });
    }

    if (lowRatio > 0.7) {
      issues.push({
        severity: 'medium',
        message: '密度长时间保持低水平，可能缺乏推进',
        suggestion: '增加事件密度，推进情节'
      });
    }

    return {
      balanced: issues.length === 0,
      issues
    };
  }
}

module.exports = DensityController;

