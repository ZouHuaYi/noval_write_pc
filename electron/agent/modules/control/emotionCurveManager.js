/**
 * Emotion Curve Manager - 情绪曲线管理器
 * 监控情绪变化，绘制实际情绪曲线，与目标曲线对比
 */

class EmotionCurveManager {
  constructor() {
    // 情绪关键词映射
    this.emotionKeywords = {
      tension: ['紧张', '危险', '威胁', '危机', '恐惧', '不安', '焦虑', '担忧'],
      excitement: ['兴奋', '激动', '热血', '沸腾', '激昂', '振奋', '刺激'],
      sadness: ['悲伤', '痛苦', '绝望', '失落', '哀伤', '难过', '沮丧'],
      joy: ['高兴', '快乐', '喜悦', '开心', '兴奋', '愉快', '欢乐'],
      calm: ['平静', '安宁', '放松', '舒缓', '宁静', '安详'],
      anger: ['愤怒', '生气', '恼火', '暴怒', '愤恨'],
      fear: ['恐惧', '害怕', '惊恐', '畏惧', '胆怯'],
      surprise: ['惊讶', '震惊', '意外', '吃惊', '诧异']
    };

    // 情绪值映射（0-1）
    this.emotionValues = {
      calm: 0.3,
      sadness: 0.3,
      tension: 0.6,
      fear: 0.6,
      joy: 0.7,
      excitement: 0.8,
      anger: 0.7,
      surprise: 0.7
    };
  }

  /**
   * 分析文本情绪曲线
   * @param {string} text - 文本内容
   * @param {number} segmentCount - 分段数量
   */
  analyzeEmotionCurve(text, segmentCount = 10) {
    try {
      if (!text || text.trim().length === 0) {
        return {
          start: 0.5,
          peak: 0.5,
          end: 0.5,
          points: this.generateDefaultPoints(segmentCount)
        };
      }

      // 分段分析
      const segments = this.segmentText(text, segmentCount);
      const emotionPoints = segments.map((segment, index) => {
        const emotion = this.analyzeSegmentEmotion(segment);
        return {
          position: index / (segmentCount - 1),
          emotion: emotion.value,
          type: emotion.type
        };
      });

      // 计算关键值
      const values = emotionPoints.map(p => p.emotion);
      const start = values[0] || 0.5;
      const end = values[values.length - 1] || 0.5;
      const peak = Math.max(...values);

      return {
        start,
        peak,
        end,
        points: emotionPoints,
        dominantEmotions: this.extractDominantEmotions(text)
      };

    } catch (error) {
      console.error('分析情绪曲线失败:', error);
      return {
        start: 0.5,
        peak: 0.5,
        end: 0.5,
        points: this.generateDefaultPoints(segmentCount)
      };
    }
  }

  /**
   * 分析段落情绪
   */
  analyzeSegmentEmotion(segment) {
    // 计算每种情绪的出现次数
    const emotionScores = {};
    
    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(keyword, 'g');
        const matches = segment.match(regex) || [];
        score += matches.length;
      }
      emotionScores[emotion] = score;
    }

    // 找到主导情绪
    let dominantEmotion = 'calm';
    let maxScore = 0;
    
    for (const [emotion, score] of Object.entries(emotionScores)) {
      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    }

    // 计算情绪值（基于主导情绪和强度）
    const baseValue = this.emotionValues[dominantEmotion] || 0.5;
    const intensity = Math.min(1, maxScore / 5); // 强度系数
    const value = baseValue * (0.7 + 0.3 * intensity);

    return {
      type: dominantEmotion,
      value: Math.max(0, Math.min(1, value)),
      intensity
    };
  }

  /**
   * 提取主导情绪
   */
  extractDominantEmotions(text) {
    const emotionScores = {};
    
    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(keyword, 'g');
        const matches = text.match(regex) || [];
        score += matches.length;
      }
      emotionScores[emotion] = score;
    }

    // 排序，返回前3个
    const sorted = Object.entries(emotionScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion, score]) => ({ emotion, score }));

    return sorted;
  }

  /**
   * 与目标情绪曲线对比
   * @param {Object} actualEmotion - 实际情绪曲线
   * @param {Object} targetEmotion - 目标情绪曲线
   */
  compareWithTarget(actualEmotion, targetEmotion) {
    if (!targetEmotion || !targetEmotion.points) {
      return {
        match: true,
        score: 100,
        issues: []
      };
    }

    const issues = [];
    let totalDiff = 0;
    let matchCount = 0;

    // 对比关键点
    const keyPositions = [0, 0.25, 0.5, 0.75, 1.0];
    
    for (const position of keyPositions) {
      const targetPoint = this.findNearestPoint(targetEmotion.points, position);
      const actualPoint = this.findNearestPoint(actualEmotion.points, position);

      if (targetPoint && actualPoint) {
        const diff = Math.abs(targetPoint.emotion - actualPoint.emotion);
        totalDiff += diff;

        if (diff < 0.1) {
          matchCount++;
        } else if (diff > 0.3) {
          issues.push({
            position: position.toFixed(2),
            target: targetPoint.emotion.toFixed(2),
            actual: actualPoint.emotion.toFixed(2),
            severity: 'high',
            message: `情绪偏差较大：目标 ${targetPoint.emotion.toFixed(2)}，实际 ${actualPoint.emotion.toFixed(2)}`
          });
        } else {
          issues.push({
            position: position.toFixed(2),
            target: targetPoint.emotion.toFixed(2),
            actual: actualPoint.emotion.toFixed(2),
            severity: 'medium',
            message: `情绪轻微偏差：目标 ${targetPoint.emotion.toFixed(2)}，实际 ${actualPoint.emotion.toFixed(2)}`
          });
        }
      }
    }

    // 检查起点和终点
    const startDiff = Math.abs(actualEmotion.start - targetEmotion.start);
    const endDiff = Math.abs(actualEmotion.end - targetEmotion.end);
    const peakDiff = Math.abs(actualEmotion.peak - targetEmotion.peak);

    if (startDiff > 0.2) {
      issues.push({
        position: '0.0',
        target: targetEmotion.start.toFixed(2),
        actual: actualEmotion.start.toFixed(2),
        severity: 'high',
        message: `开头情绪不匹配：目标 ${targetEmotion.start.toFixed(2)}，实际 ${actualEmotion.start.toFixed(2)}`
      });
    }

    if (endDiff > 0.2) {
      issues.push({
        position: '1.0',
        target: targetEmotion.end.toFixed(2),
        actual: actualEmotion.end.toFixed(2),
        severity: 'high',
        message: `结尾情绪不匹配：目标 ${targetEmotion.end.toFixed(2)}，实际 ${actualEmotion.end.toFixed(2)}`
      });
    }

    // 计算匹配分数
    const avgDiff = totalDiff / keyPositions.length;
    const matchScore = Math.max(0, 100 - avgDiff * 100);

    return {
      match: matchScore >= 70,
      score: matchScore,
      issues,
      matchRate: matchCount / keyPositions.length,
      startDiff,
      endDiff,
      peakDiff
    };
  }

  /**
   * 检查情绪曲线平滑度
   */
  checkSmoothness(emotionCurve) {
    const issues = [];
    const points = emotionCurve.points || [];

    if (points.length < 2) {
      return { smooth: true, issues: [] };
    }

    // 检查相邻点之间的跳跃
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const jump = Math.abs(curr.emotion - prev.emotion);

      if (jump > 0.4) {
        issues.push({
          position: curr.position.toFixed(2),
          severity: 'high',
          message: `情绪跳跃过大：从 ${prev.emotion.toFixed(2)} 到 ${curr.emotion.toFixed(2)}（差值 ${jump.toFixed(2)}）`,
          suggestion: '添加过渡段落，平滑情绪转换'
        });
      } else if (jump > 0.25) {
        issues.push({
          position: curr.position.toFixed(2),
          severity: 'medium',
          message: `情绪转换不够平滑：从 ${prev.emotion.toFixed(2)} 到 ${curr.emotion.toFixed(2)}`,
          suggestion: '考虑添加过渡，使情绪转换更自然'
        });
      }
    }

    return {
      smooth: issues.length === 0,
      issues
    };
  }

  /**
   * 查找最近的点
   */
  findNearestPoint(points, position) {
    if (!points || points.length === 0) {
      return null;
    }

    let nearest = points[0];
    let minDiff = Math.abs(nearest.position - position);

    for (const point of points) {
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
   * 生成默认点
   */
  generateDefaultPoints(segmentCount) {
    const points = [];
    for (let i = 0; i < segmentCount; i++) {
      points.push({
        position: i / (segmentCount - 1),
        emotion: 0.5,
        type: 'neutral'
      });
    }
    return points;
  }

  /**
   * 生成情绪调整建议
   */
  generateSuggestions(comparison, targetEmotion) {
    const suggestions = [];

    if (comparison.score < 70) {
      suggestions.push({
        type: 'emotion_mismatch',
        message: '情绪曲线与目标不匹配',
        action: '调整文本情绪以匹配目标曲线'
      });
    }

    for (const issue of comparison.issues) {
      if (issue.severity === 'high') {
        suggestions.push({
          type: 'emotion_adjustment',
          position: issue.position,
          message: issue.message,
          action: `在位置 ${issue.position} 调整情绪从 ${issue.actual} 到 ${issue.target}`
        });
      }
    }

    // 平滑度建议
    const smoothness = this.checkSmoothness({ points: comparison.actualPoints || [] });
    if (!smoothness.smooth) {
      suggestions.push({
        type: 'emotion_smoothness',
        message: '情绪曲线不够平滑',
        action: '添加过渡段落，平滑情绪转换'
      });
    }

    return suggestions;
  }
}

module.exports = EmotionCurveManager;

