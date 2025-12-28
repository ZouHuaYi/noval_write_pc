/**
 * Scene Structure Planner - 场景结构规划器
 * 规划单个场景的结构、节奏、情绪
 */

class SceneStructurePlanner {
  constructor() {
    this.sceneTemplates = this.buildSceneTemplates();
  }

  /**
   * 构建场景模板
   */
  buildSceneTemplates() {
    return {
      setup: {
        structure: {
          opening: { purpose: '建立场景', word_count: 100, pacing: 'medium', emotion: 'neutral' },
          development: { purpose: '引入信息', word_count: 200, pacing: 'medium', emotion: 'neutral' },
          resolution: { purpose: '过渡或设置', word_count: 100, pacing: 'slow', emotion: 'neutral' }
        },
        plot_beats: [
          { beat: 'establishment', position: 0.2, description: '建立场景' },
          { beat: 'information', position: 0.6, description: '引入信息' }
        ]
      },
      conflict: {
        structure: {
          opening: { purpose: '冲突开始', word_count: 150, pacing: 'medium', emotion: 'tension' },
          development: { purpose: '冲突升级', word_count: 300, pacing: 'fast', emotion: 'tension' },
          climax: { purpose: '冲突高潮', word_count: 200, pacing: 'fast', emotion: 'excitement' },
          resolution: { purpose: '暂时解决或过渡', word_count: 100, pacing: 'medium', emotion: 'relief' }
        },
        plot_beats: [
          { beat: 'confrontation', position: 0.3, description: '对抗开始' },
          { beat: 'escalation', position: 0.6, description: '冲突升级' },
          { beat: 'resolution', position: 0.9, description: '暂时解决或留下悬念' }
        ]
      },
      climax: {
        structure: {
          opening: { purpose: '高潮前奏', word_count: 150, pacing: 'fast', emotion: 'tension' },
          development: { purpose: '高潮爆发', word_count: 400, pacing: 'fast', emotion: 'excitement' },
          resolution: { purpose: '高潮结束', word_count: 150, pacing: 'slow', emotion: 'relief' }
        },
        plot_beats: [
          { beat: 'build_up', position: 0.2, description: '情绪积累' },
          { beat: 'climax', position: 0.5, description: '高潮爆发' },
          { beat: 'release', position: 0.8, description: '情绪释放' }
        ]
      },
      resolution: {
        structure: {
          opening: { purpose: '解决开始', word_count: 150, pacing: 'slow', emotion: 'relief' },
          development: { purpose: '解决过程', word_count: 250, pacing: 'medium', emotion: 'calm' },
          resolution: { purpose: '总结收尾', word_count: 100, pacing: 'slow', emotion: 'calm' }
        },
        plot_beats: [
          { beat: 'resolution', position: 0.4, description: '解决问题' },
          { beat: 'conclusion', position: 0.8, description: '总结收尾' }
        ]
      }
    };
  }

  /**
   * 规划场景结构
   * @param {string} sceneType - 场景类型（setup/conflict/climax/resolution）
   * @param {Object} context - 上下文（目标情绪、节奏等）
   */
  planScene(sceneType, context = {}) {
    const template = this.sceneTemplates[sceneType] || this.sceneTemplates.conflict;

    // 复制模板
    const structure = JSON.parse(JSON.stringify(template.structure));
    const plotBeats = JSON.parse(JSON.stringify(template.plot_beats));

    // 根据上下文调整
    if (context.targetEmotion !== undefined) {
      // 调整情绪
      for (const section of Object.values(structure)) {
        if (context.targetEmotion > 0.7) {
          section.emotion = 'excitement';
        } else if (context.targetEmotion > 0.5) {
          section.emotion = 'tension';
        } else {
          section.emotion = 'neutral';
        }
      }
    }

    if (context.targetPacing) {
      // 调整节奏
      for (const section of Object.values(structure)) {
        if (context.targetPacing === 'fast') {
          section.pacing = 'fast';
          section.word_count = Math.floor(section.word_count * 0.8); // 快节奏，字数减少
        } else if (context.targetPacing === 'slow') {
          section.pacing = 'slow';
          section.word_count = Math.floor(section.word_count * 1.2); // 慢节奏，字数增加
        }
      }
    }

    if (context.targetWordCount) {
      // 调整总字数
      const currentTotal = Object.values(structure).reduce((sum, s) => sum + s.word_count, 0);
      const ratio = context.targetWordCount / currentTotal;
      for (const section of Object.values(structure)) {
        section.word_count = Math.floor(section.word_count * ratio);
      }
    }

    return {
      type: sceneType,
      structure,
      plot_beats: plotBeats,
      total_word_count: Object.values(structure).reduce((sum, s) => sum + s.word_count, 0),
      pacing: context.targetPacing || structure.development?.pacing || 'medium',
      emotion: {
        start: this.getEmotionValue(structure.opening?.emotion || 'neutral'),
        peak: this.getEmotionValue(structure.development?.emotion || structure.climax?.emotion || 'neutral'),
        end: this.getEmotionValue(structure.resolution?.emotion || 'neutral')
      }
    };
  }

  /**
   * 获取情绪值
   */
  getEmotionValue(emotionType) {
    const map = {
      neutral: 0.5,
      tension: 0.6,
      excitement: 0.8,
      relief: 0.4,
      calm: 0.3
    };
    return map[emotionType] || 0.5;
  }

  /**
   * 规划多个场景（用于章节）
   * @param {Array} sceneTypes - 场景类型列表
   * @param {Object} chapterContext - 章节上下文
   */
  planScenes(sceneTypes, chapterContext = {}) {
    const scenes = [];
    let currentPosition = 0;

    for (let i = 0; i < sceneTypes.length; i++) {
      const sceneType = sceneTypes[i];
      
      // 从章节规划中获取场景上下文
      const sceneContext = {
        targetPacing: chapterContext.pacing_curve?.variations?.[i]?.pacing,
        targetEmotion: chapterContext.emotion_curve?.points?.[i]?.emotion,
        targetWordCount: chapterContext.chapter_structure?.scenes?.[i]?.word_count
      };

      const scenePlan = this.planScene(sceneType, sceneContext);
      
      scenes.push({
        id: `scene_${i + 1}`,
        ...scenePlan,
        position: currentPosition,
        position_end: currentPosition + (scenePlan.total_word_count / (chapterContext.targetWordCount || 2000))
      });

      currentPosition = scenes[scenes.length - 1].position_end;
    }

    return scenes;
  }

  /**
   * 验证场景结构
   */
  validateSceneStructure(scenePlan) {
    const issues = [];

    // 检查结构完整性
    if (!scenePlan.structure || Object.keys(scenePlan.structure).length === 0) {
      issues.push({
        severity: 'high',
        message: '场景结构不完整',
        suggestion: '确保场景包含 opening、development、resolution 等部分'
      });
    }

    // 检查字数分配
    const totalWords = Object.values(scenePlan.structure || {}).reduce(
      (sum, s) => sum + (s.word_count || 0),
      0
    );

    if (totalWords < 200) {
      issues.push({
        severity: 'low',
        message: '场景字数过少，可能缺乏细节',
        suggestion: '增加场景描写和细节'
      });
    }

    if (totalWords > 1500) {
      issues.push({
        severity: 'low',
        message: '场景字数过多，可能过于冗长',
        suggestion: '考虑拆分场景或精简内容'
      });
    }

    // 检查情节节点
    if (!scenePlan.plot_beats || scenePlan.plot_beats.length === 0) {
      issues.push({
        severity: 'medium',
        message: '场景缺少情节节点',
        suggestion: '添加关键情节节点'
      });
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = SceneStructurePlanner;

