/**
 * Event Effect Resolver - Event → Effect 结算器（封顶核心）
 * 
 * 核心原则：
 * 1. 只问 3 个问题：是否产生 Effect？是什么 Effect？是否写入 Core？
 * 2. 世界只在 Effect 层被改变
 * 3. Event = 本章发生，但不保证影响未来
 */

const { EffectFactory, EffectType } = require('./effectTypes');

class EventEffectResolver {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * 解析 event_claim，决定是否产生 Effect（封顶核心）
   * 
   * Q1: 这个 Event 会产生 Effect 吗？
   * Q2: 如果产生，是什么 Effect？
   * Q3: 这个 Effect 是否写入 Core？
   * 
   * @param {Object} eventClaim - 事件主张
   * @param {number} chapter - 章节号
   * @returns {Array} Effects 数组
   */
  resolveEvent(eventClaim, chapter) {
    const effects = [];

    // Q1: 这个 Event 会产生 Effect 吗？
    if (!this.shouldGenerateEffect(eventClaim)) {
      return effects; // 不产生 Effect，直接返回
    }

    // Q2: 如果产生，是什么 Effect？
    const effectType = this.determineEffectType(eventClaim);
    
    if (!effectType) {
      return effects; // 无法确定 Effect 类型
    }

    // Q3: 生成 Effect（根据类型）
    const effect = this.createEffect(eventClaim, effectType, chapter);
    
    if (effect) {
      effects.push(effect);
    }

    return effects;
  }

  /**
   * Q1: 这个 Event 会产生 Effect 吗？
   */
  shouldGenerateEffect(eventClaim) {
    const { type, result } = eventClaim;

    // 突破尝试失败 → 产生临时状态
    if (type === 'breakthrough_attempt' && result === 'failed') {
      return true;
    }

    // 突破尝试成功 → 可能产生状态（但通常由 state_claims 处理）
    if (type === 'breakthrough_attempt' && result === 'success') {
      return false; // 由 state_claims 处理，不在这里生成
    }

    // 修炼中断 → 可能产生临时状态
    if (type === 'cultivation_interrupt') {
      return true;
    }

    // narrative_claim → 不产生 Effect（只记录，由 Finalizer 对比 Core 后裁决）
    if (type === 'narrative_claim') {
      return false; // 不产生 Effect，但会记录到日志
    }

    // combat_exchange / combat_outcome → 可能产生 reputational effect
    if (type === 'combat_exchange' || type === 'combat_outcome') {
      // 暂时不产生 Effect，只记录日志
      return false;
    }

    // 其他事件 → 默认不产生 Effect（只记录日志）
    return false;
  }

  /**
   * Q2: 如果产生，是什么 Effect？
   */
  determineEffectType(eventClaim) {
    const { type, result } = eventClaim;

    if (type === 'breakthrough_attempt' && result === 'failed') {
      return 'ADD_TEMP_STATE';
    }

    if (type === 'cultivation_interrupt') {
      return 'ADD_TEMP_STATE';
    }

    return null;
  }

  /**
   * Q3: 创建 Effect
   */
  createEffect(eventClaim, effectType, chapter) {
    const { type, subject, result, evidence } = eventClaim;

    switch (effectType) {
      case 'ADD_TEMP_STATE':
        return this.createTempStateEffect(eventClaim, chapter);

      default:
        return null;
    }
  }

  /**
   * 创建临时状态 Effect
   */
  createTempStateEffect(eventClaim, chapter) {
    const { type, subject, result } = eventClaim;

    // 突破失败 → 灵力紊乱（持续 3 章）
    if (type === 'breakthrough_attempt' && result === 'failed') {
      return EffectFactory.createTemporaryDebuff(
        chapter,
        subject,
        'qi_instability',
        3, // TTL: 3 章
        '突破失败导致的灵力紊乱'
      );
    }

    // 修炼中断 → 轻微紊乱（持续 1 章）
    if (type === 'cultivation_interrupt') {
      return EffectFactory.createTemporaryDebuff(
        chapter,
        subject,
        'cultivation_interrupted',
        1, // TTL: 1 章
        '修炼中断导致的轻微紊乱'
      );
    }

    return null;
  }

  /**
   * 判断 Effect 是否写入 Core
   * 
   * @param {Object} effect - Effect 对象
   * @returns {boolean} 是否写入 Core
   */
  shouldWriteToCore(effect) {
    const coreWritingTypes = [
      EffectType.ADD_FACT,
      EffectType.UPDATE_CHARACTER_STATE,
      EffectType.ADD_FORESHADOW
    ];

    // 临时状态带 TTL，写入 Core 但标记为临时
    if (effect.type === EffectType.TEMPORARY_DEBUFF) {
      return true; // 写入 Core，但带 TTL
    }

    return coreWritingTypes.includes(effect.type);
  }

  /**
   * 获取 Effect 的 TTL（如果适用）
   */
  getEffectTTL(effect) {
    if (effect.type === EffectType.TEMPORARY_DEBUFF) {
      return effect.payload.duration_chapters || null;
    }
    return null;
  }
}

module.exports = EventEffectResolver;
