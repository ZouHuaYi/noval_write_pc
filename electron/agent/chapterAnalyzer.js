/**
 * Chapter Analyzer - 章节分析器
 * 分析已有章节的结构、情绪曲线、节奏曲线、密度曲线
 * 用于续写场景，提取前章状态
 */

class ChapterAnalyzer {
  constructor(memoryManager = null) {
    this.systemPrompt = this.buildSystemPrompt();
    this.memoryManager = memoryManager; // 记忆管理器
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个【小说章节分析程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符

你必须且只能在 <json> 和 </json> 之间输出内容。

# 核心任务
分析章节文本，提取结构、情绪曲线、节奏曲线、密度曲线和连贯性连接点。

# 输出结构
\`\`\`json
{
  "structure": {
    "type": "setup" | "conflict" | "climax" | "resolution",
    "scenes": [
      {
        "id": "scene_1",
        "type": "setup" | "conflict" | "climax" | "resolution",
        "purpose": "场景目的",
        "word_count": 400,
        "position": 0.2
      }
    ],
    "plot_beats": [
      {
        "beat": "inciting_incident" | "rising_action" | "climax" | "resolution",
        "description": "情节节点描述",
        "position": 0.3
      }
    ]
  },
  "emotion_curve": {
    "start": 0.3,
    "peak": 0.8,
    "end": 0.5,
    "points": [
      {"position": 0.0, "emotion": 0.3, "type": "tension"},
      {"position": 0.5, "emotion": 0.7, "type": "rising"},
      {"position": 1.0, "emotion": 0.5, "type": "resolution"}
    ]
  },
  "pacing_curve": {
    "overall": "fast",
    "variations": [
      {"position": 0.0, "pacing": "medium"},
      {"position": 0.4, "pacing": "fast"},
      {"position": 0.8, "pacing": "slow"}
    ]
  },
  "density_curve": {
    "overall": "medium",
    "variations": [
      {"position": 0.0, "density": "low"},
      {"position": 0.5, "density": "high"},
      {"position": 1.0, "density": "medium"}
    ]
  },
  "coherence_points": {
    "opening": {
      "emotion": 0.3,
      "pacing": "medium",
      "events": ["事件描述"],
      "characters": ["角色名"],
      "location": "地点"
    },
    "ending": {
      "emotion": 0.6,
      "pacing": "fast",
      "events": ["事件描述"],
      "characters": ["角色名"],
      "location": "地点",
      "cliffhanger": "悬念描述（如果有）"
    }
  }
}
\`\`\`
`;

  }

  /**
   * 分析章节
   * @param {number} chapterNumber - 章节编号
   * @param {string} content - 章节内容
   * @param {Function} llmCaller - LLM 调用函数
   */
  async analyzeChapter(chapterNumber, content, llmCaller) {
    try {
      console.log(`🔍 开始分析第 ${chapterNumber} 章...`);

      if (!content || content.trim().length === 0) {
        throw new Error('章节内容为空');
      }

      // 快速分析（不依赖 LLM）
      const quickAnalysis = this.quickAnalyze(content);

      // LLM 深度分析
      let deepAnalysis = null;
      if (llmCaller) {
        try {
          deepAnalysis = await this.deepAnalyze(content, llmCaller);
        } catch (error) {
          console.warn('LLM 分析失败，使用快速分析结果:', error.message);
        }
      }

      // 合并结果
      const analysis = this.mergeAnalysis(quickAnalysis, deepAnalysis);

      // 从记忆系统获取上下文（新增）
      if (this.memoryManager) {
        const memoryContext = await this.loadMemoryContext();
        analysis.memory_context = memoryContext;
      }

      console.log(`✅ 章节分析完成：类型=${analysis.structure.type}, 情绪=${analysis.emotion_curve.end.toFixed(2)}`);

      return {
        success: true,
        chapterNumber,
        ...analysis
      };

    } catch (error) {
      console.error(`❌ 分析章节失败: 第${chapterNumber}章`, error);
      return {
        success: false,
        chapterNumber,
        error: error.message
      };
    }
  }

  /**
   * 快速分析（不依赖 LLM）
   */
  quickAnalyze(content) {
    const wordCount = content.length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sentences = content.split(/[。！？]/).filter(s => s.trim().length > 0);

    // 计算平均句子长度
    const avgSentenceLength = sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
      : 0;

    // 计算对话比例
    const dialogueCount = (content.match(/[""''「」『』]/g) || []).length;
    const dialogueRatio = wordCount > 0 ? dialogueCount / wordCount : 0;

    // 估算节奏（基于句子长度和对话比例）
    let pacing = 'medium';
    if (avgSentenceLength < 15 && dialogueRatio < 0.1) {
      pacing = 'fast';
    } else if (avgSentenceLength > 30 && dialogueRatio > 0.3) {
      pacing = 'slow';
    }

    // 估算情绪（简化：基于关键词）
    const emotion = this.estimateEmotion(content);

    // 估算密度（基于段落数和字数）
    const paragraphDensity = wordCount > 0 ? paragraphs.length / (wordCount / 1000) : 0;
    let density = 'medium';
    if (paragraphDensity > 10) {
      density = 'high';
    } else if (paragraphDensity < 3) {
      density = 'low';
    }

    // 确定章节类型（简化）
    const type = this.determineChapterType(content);

    return {
      structure: {
        type,
        scenes: this.extractScenesQuick(content, paragraphs),
        plot_beats: []
      },
      emotion_curve: {
        start: emotion,
        peak: emotion,
        end: emotion,
        points: [
          { position: 0.0, emotion, type: 'neutral' },
          { position: 1.0, emotion, type: 'neutral' }
        ]
      },
      pacing_curve: {
        overall: pacing,
        variations: [
          { position: 0.0, pacing },
          { position: 1.0, pacing }
        ]
      },
      density_curve: {
        overall: density,
        variations: [
          { position: 0.0, density },
          { position: 1.0, density }
        ]
      },
      coherence_points: {
        opening: {
          emotion,
          pacing,
          events: [],
          characters: [],
          location: ''
        },
        ending: {
          emotion,
          pacing,
          events: [],
          characters: [],
          location: '',
          cliffhanger: this.extractCliffhangerQuick(content)
        }
      }
    };
  }

  /**
   * 深度分析（使用 LLM）
   */
  async deepAnalyze(content, llmCaller) {
    const userPrompt = this.buildAnalysisPrompt(content);

    const result = await llmCaller({
      systemPrompt: this.systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 3000
    });

    if (!result.success || !result.response) {
      throw new Error('LLM 调用失败');
    }

    return this.parseAnalysisResult(result.response);
  }

  /**
   * 构建分析提示词
   */
  buildAnalysisPrompt(content) {
    return `# 待分析的章节文本

${content.substring(0, 8000)}${content.length > 8000 ? '\n\n[文本已截断]' : ''}

# 任务
请仔细分析上述章节，提取：
1. 章节结构（类型、场景、情节节点）
2. 情绪曲线（0-1 值，标注关键点）
3. 节奏曲线（slow/medium/fast，标注变化点）
4. 密度曲线（low/medium/high，标注变化点）
5. 连贯性连接点（开头和结尾的状态）

返回纯 JSON 格式。`;
  }

  /**
   * 解析分析结果
   */
  parseAnalysisResult(response) {
    const { safeParseJSON } = require('../utils/jsonParser');
    
    try {
      const result = safeParseJSON(response, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });

      // 验证和规范化
      if (!result.structure) result.structure = { type: 'unknown', scenes: [], plot_beats: [] };
      if (!result.emotion_curve) result.emotion_curve = { start: 0.5, peak: 0.5, end: 0.5, points: [] };
      if (!result.pacing_curve) result.pacing_curve = { overall: 'medium', variations: [] };
      if (!result.density_curve) result.density_curve = { overall: 'medium', variations: [] };
      if (!result.coherence_points) {
        result.coherence_points = {
          opening: { emotion: 0.5, pacing: 'medium', events: [], characters: [], location: '' },
          ending: { emotion: 0.5, pacing: 'medium', events: [], characters: [], location: '', cliffhanger: '' }
        };
      }

      return result;
    } catch (e) {
      console.error('解析分析结果失败:', e.message);
      throw new Error('解析分析结果失败');
    }
  }

  /**
   * 合并快速分析和深度分析结果
   */
  mergeAnalysis(quickAnalysis, deepAnalysis) {
    if (!deepAnalysis) {
      return quickAnalysis;
    }

    // 优先使用深度分析，快速分析作为补充
    return {
      structure: deepAnalysis.structure || quickAnalysis.structure,
      emotion_curve: deepAnalysis.emotion_curve || quickAnalysis.emotion_curve,
      pacing_curve: deepAnalysis.pacing_curve || quickAnalysis.pacing_curve,
      density_curve: deepAnalysis.density_curve || quickAnalysis.density_curve,
      coherence_points: deepAnalysis.coherence_points || quickAnalysis.coherence_points
    };
  }

  /**
   * 估算情绪（基于关键词）
   */
  estimateEmotion(content) {
    const emotionKeywords = {
      tension: ['紧张', '危险', '威胁', '危机', '恐惧', '不安'],
      excitement: ['兴奋', '激动', '热血', '沸腾', '激昂'],
      sadness: ['悲伤', '痛苦', '绝望', '失落', '哀伤'],
      joy: ['高兴', '快乐', '喜悦', '开心', '兴奋'],
      calm: ['平静', '安宁', '放松', '舒缓']
    };

    let maxScore = 0;
    let dominantEmotion = 'neutral';
    let emotionValue = 0.5;

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      const score = keywords.reduce((sum, keyword) => {
        const regex = new RegExp(keyword, 'g');
        return sum + (content.match(regex) || []).length;
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        dominantEmotion = emotion;
      }
    }

    // 映射到 0-1 值
    const emotionMap = {
      tension: 0.7,
      excitement: 0.8,
      sadness: 0.3,
      joy: 0.7,
      calm: 0.4,
      neutral: 0.5
    };

    emotionValue = emotionMap[dominantEmotion] || 0.5;

    return emotionValue;
  }

  /**
   * 确定章节类型
   */
  determineChapterType(content) {
    // 基于关键词判断
    const typeKeywords = {
      setup: ['开始', '准备', '介绍', '引入'],
      conflict: ['冲突', '对抗', '战斗', '争执', '矛盾'],
      climax: ['高潮', '突破', '爆发', '关键', '转折'],
      resolution: ['结束', '解决', '完成', '总结', '收尾']
    };

    let maxScore = 0;
    let chapterType = 'unknown';

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      const score = keywords.reduce((sum, keyword) => {
        const regex = new RegExp(keyword, 'g');
        return sum + (content.match(regex) || []).length;
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        chapterType = type;
      }
    }

    return chapterType === 'unknown' ? 'conflict' : chapterType;
  }

  /**
   * 快速提取场景
   */
  extractScenesQuick(content, paragraphs) {
    // 简化：每个段落作为一个场景
    return paragraphs.slice(0, 10).map((para, index) => ({
      id: `scene_${index + 1}`,
      type: 'unknown',
      purpose: para.substring(0, 50) + '...',
      word_count: para.length,
      position: index / paragraphs.length
    }));
  }

  /**
   * 快速提取悬念
   */
  extractCliffhangerQuick(content) {
    // 检查结尾是否有疑问句或未完成的情节
    const lastParagraph = content.split(/\n\s*\n/).pop() || '';
    const lastSentence = lastParagraph.split(/[。！？]/).pop() || '';

    if (lastSentence.includes('？') || lastSentence.includes('?')) {
      return lastSentence.trim();
    }

    // 检查是否有未完成的动作
    if (lastSentence.length > 0 && lastSentence.length < 50) {
      return lastSentence.trim();
    }

    return '';
  }

  /**
   * 分析最近 N 章
   */
  async analyzeRecentChapters(chapterNumbers, fileScanner, llmCaller) {
    const analyses = [];

    for (const chapterNum of chapterNumbers) {
      const content = await fileScanner.readChapterContent(chapterNum);
      if (content) {
        const analysis = await this.analyzeChapter(chapterNum, content, llmCaller);
        if (analysis.success) {
          analyses.push(analysis);
        }
      }
    }

    return analyses;
  }

  /**
   * 从记忆系统加载上下文（新增）
   */
  async loadMemoryContext() {
    if (!this.memoryManager) {
      return null;
    }

    try {
      const characters = this.memoryManager.character.getAllCharacters();
      const plot = this.memoryManager.plot.getData();
      const foreshadows = this.memoryManager.foreshadow.getData();
      const world = this.memoryManager.world.getData();

      return {
        characters: characters.map(char => ({
          name: char.name,
          role: char.role,
          personality: char.personality,
          current_state: char.current_state,
          recent_history: char.history?.slice(-3) || []
        })),
        plot: {
          current_stage: plot.main_plotline?.current_stage,
          completed_events: plot.main_plotline?.completed_events?.slice(-5) || [],
          pending_goals: plot.main_plotline?.pending_goals || []
        },
        foreshadows: {
          pending: foreshadows.foreshadows?.filter(f => f.status === 'pending') || [],
          revealed: foreshadows.foreshadows?.filter(f => f.status === 'revealed')?.slice(-3) || []
        },
        world_rules: world.world_rules || {}
      };
    } catch (error) {
      console.error('加载记忆上下文失败:', error);
      return null;
    }
  }
}

module.exports = ChapterAnalyzer;

