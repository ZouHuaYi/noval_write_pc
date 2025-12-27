/**
 * Plot Memory - 剧情记忆
 * 存储主线进度、已发生事件、待完成目标等
 */

const fs = require('fs').promises;
const path = require('path');

class PlotMemory {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.memoryDir = path.join(workspaceRoot, '.novel-agent');
    this.memoryFile = path.join(this.memoryDir, 'plot-memory.json');
    this.data = null;
  }

  /**
   * 初始化记忆
   */
  async initialize() {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });

      try {
        const content = await fs.readFile(this.memoryFile, 'utf-8');
        this.data = JSON.parse(content);
        console.log('✅ 加载剧情记忆成功');
      } catch (e) {
        console.log('📝 创建新的剧情记忆');
        this.data = this.getDefaultMemory();
        await this.save();
      }
    } catch (error) {
      console.error('❌ 初始化剧情记忆失败:', error);
      this.data = this.getDefaultMemory();
    }
  }

  /**
   * 获取默认记忆
   */
  getDefaultMemory() {
    return {
      version: '1.0',
      last_updated: new Date().toISOString(),
      main_plotline: {
        title: '',
        current_stage: '',
        stages: [],
        completed_events: [],
        pending_goals: []
      },
      subplots: [],
      timeline: []
    };
  }

  /**
   * 设置主线信息
   */
  async setMainPlotline(plotInfo) {
    this.data.main_plotline = {
      ...this.data.main_plotline,
      ...plotInfo,
      updated_at: new Date().toISOString()
    };
    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log('✅ 主线信息已更新');
  }

  /**
   * 添加阶段
   */
  async addStage(stage) {
    if (!this.data.main_plotline.stages) {
      this.data.main_plotline.stages = [];
    }

    this.data.main_plotline.stages.push({
      name: stage.name,
      chapters: stage.chapters,
      status: stage.status || 'pending',
      description: stage.description || '',
      added_at: new Date().toISOString()
    });

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 添加阶段: ${stage.name}`);
  }

  /**
   * 更新当前阶段
   */
  async updateCurrentStage(stageName) {
    this.data.main_plotline.current_stage = stageName;
    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 当前阶段: ${stageName}`);
  }

  /**
   * 添加已完成事件
   */
  async addCompletedEvent(event) {
    if (!this.data.main_plotline.completed_events) {
      this.data.main_plotline.completed_events = [];
    }

    const eventData = {
      id: event.id || `evt_${Date.now()}`,
      name: event.name,
      chapter: event.chapter,
      description: event.description || '',
      significance: event.significance || 'normal', // minor, normal, major, critical
      completed_at: new Date().toISOString()
    };

    this.data.main_plotline.completed_events.push(eventData);
    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 事件已完成: ${event.name}`);

    return eventData.id;
  }

  /**
   * 添加待完成目标
   */
  async addPendingGoal(goal) {
    if (!this.data.main_plotline.pending_goals) {
      this.data.main_plotline.pending_goals = [];
    }

    const goalData = {
      id: goal.id || `goal_${Date.now()}`,
      name: goal.name,
      priority: goal.priority || 'medium', // low, medium, high, critical
      description: goal.description || '',
      deadline: goal.deadline || null,
      added_at: new Date().toISOString()
    };

    this.data.main_plotline.pending_goals.push(goalData);
    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 添加目标: ${goal.name}`);

    return goalData.id;
  }

  /**
   * 完成目标
   */
  async completeGoal(goalId, completionDetails) {
    const goalIndex = this.data.main_plotline.pending_goals.findIndex(
      g => g.id === goalId
    );

    if (goalIndex === -1) {
      throw new Error(`目标不存在: ${goalId}`);
    }

    const goal = this.data.main_plotline.pending_goals[goalIndex];
    
    // 从待完成列表移除
    this.data.main_plotline.pending_goals.splice(goalIndex, 1);

    // 添加到已完成事件
    await this.addCompletedEvent({
      name: goal.name,
      chapter: completionDetails?.chapter,
      description: completionDetails?.description || goal.description,
      significance: goal.priority === 'critical' ? 'critical' : 'major'
    });

    console.log(`✅ 目标已完成: ${goal.name}`);
  }

  /**
   * 添加时间线事件
   */
  async addTimelineEvent(event) {
    if (!this.data.timeline) {
      this.data.timeline = [];
    }

    this.data.timeline.push({
      chapter: event.chapter,
      time: event.time,
      event: event.event,
      description: event.description || '',
      added_at: new Date().toISOString()
    });

    // 按章节排序
    this.data.timeline.sort((a, b) => a.chapter - b.chapter);

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 时间线事件: 第${event.chapter}章 - ${event.event}`);
  }

  /**
   * 添加支线剧情
   */
  async addSubplot(subplot) {
    if (!this.data.subplots) {
      this.data.subplots = [];
    }

    this.data.subplots.push({
      id: subplot.id || `subplot_${Date.now()}`,
      title: subplot.title,
      chapters: subplot.chapters,
      status: subplot.status || 'active', // active, paused, completed
      related_characters: subplot.related_characters || [],
      description: subplot.description || '',
      added_at: new Date().toISOString()
    });

    this.data.last_updated = new Date().toISOString();
    await this.save();
    console.log(`✅ 添加支线: ${subplot.title}`);
  }

  /**
   * 获取当前剧情状态
   */
  getCurrentState() {
    return {
      current_stage: this.data.main_plotline.current_stage,
      recent_events: this.data.main_plotline.completed_events.slice(-5),
      pending_goals: this.data.main_plotline.pending_goals,
      recent_timeline: this.data.timeline.slice(-10)
    };
  }

  /**
   * 获取章节相关剧情
   */
  getChapterPlot(chapterNum) {
    const timelineEvents = this.data.timeline.filter(e => e.chapter === chapterNum);
    const completedEvents = this.data.main_plotline.completed_events.filter(
      e => e.chapter === chapterNum
    );

    return {
      timeline: timelineEvents,
      events: completedEvents
    };
  }

  /**
   * 查询剧情
   */
  queryPlot(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // 搜索事件
    for (const event of this.data.main_plotline.completed_events) {
      if (JSON.stringify(event).toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'event', data: event });
      }
    }

    // 搜索目标
    for (const goal of this.data.main_plotline.pending_goals) {
      if (JSON.stringify(goal).toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'goal', data: goal });
      }
    }

    // 搜索时间线
    for (const timeEvent of this.data.timeline) {
      if (JSON.stringify(timeEvent).toLowerCase().includes(lowerQuery)) {
        results.push({ type: 'timeline', data: timeEvent });
      }
    }

    return results;
  }

  /**
   * 保存记忆
   */
  async save() {
    try {
      await fs.writeFile(
        this.memoryFile,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('❌ 保存剧情记忆失败:', error);
      throw error;
    }
  }

  /**
   * 获取完整记忆数据
   */
  getData() {
    return this.data;
  }

  /**
   * 重置记忆
   */
  async reset() {
    this.data = this.getDefaultMemory();
    await this.save();
    console.log('🔄 剧情记忆已重置');
  }
}

module.exports = PlotMemory;

