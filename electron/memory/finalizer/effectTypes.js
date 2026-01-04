/**
 * Effect Types - Effect 类型定义
 * 统一的 Effect 模型，所有章节影响都通过 Effect 声明
 */

/**
 * Effect 类型枚举
 */
const EffectType = {
  ADD_FACT: 'ADD_FACT',
  UPDATE_CHARACTER_STATE: 'UPDATE_CHARACTER_STATE',
  ADD_FORESHADOW: 'ADD_FORESHADOW',
  REVEAL_FORESHADOW: 'REVEAL_FORESHADOW',
  RESOLVE_FORESHADOW: 'RESOLVE_FORESHADOW',
  ADD_PLOT_EVENT: 'ADD_PLOT_EVENT',
  UPDATE_STORY_STATE: 'UPDATE_STORY_STATE',
  TEMPORARY_DEBUFF: 'TEMPORARY_DEBUFF'
};

/**
 * Effect 基础结构
 */
class BaseEffect {
  constructor(type, chapter, payload, reversible = true) {
    this.effect_id = `eff_${chapter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.chapter = chapter;
    this.type = type;
    this.payload = payload;
    this.reversible = reversible;
    this.created_at = new Date().toISOString();
  }
}

/**
 * AddFactEffect - 添加事实
 */
class AddFactEffect extends BaseEffect {
  constructor(chapter, fact) {
    super(EffectType.ADD_FACT, chapter, { fact }, true);
  }
}

/**
 * UpdateCharacterStateEffect - 更新角色状态
 */
class UpdateCharacterStateEffect extends BaseEffect {
  constructor(chapter, character, field, from, to) {
    super(EffectType.UPDATE_CHARACTER_STATE, chapter, {
      character,
      field,
      from, // 结算前的真实值
      to    // 新值
    }, true);
  }
}

/**
 * AddForeshadowEffect - 添加伏笔
 */
class AddForeshadowEffect extends BaseEffect {
  constructor(chapter, foreshadow) {
    super(EffectType.ADD_FORESHADOW, chapter, { foreshadow }, true);
  }
}

/**
 * RevealForeshadowEffect - 揭示伏笔
 */
class RevealForeshadowEffect extends BaseEffect {
  constructor(chapter, foreshadowId, revealInfo) {
    super(EffectType.REVEAL_FORESHADOW, chapter, {
      foreshadow_id: foreshadowId,
      reveal_info: revealInfo
    }, true);
  }
}

/**
 * ResolveForeshadowEffect - 解决伏笔
 */
class ResolveForeshadowEffect extends BaseEffect {
  constructor(chapter, foreshadowId, resolveInfo) {
    super(EffectType.RESOLVE_FORESHADOW, chapter, {
      foreshadow_id: foreshadowId,
      resolve_info: resolveInfo
    }, true);
  }
}

/**
 * AddPlotEventEffect - 添加剧情事件
 */
class AddPlotEventEffect extends BaseEffect {
  constructor(chapter, event) {
    super(EffectType.ADD_PLOT_EVENT, chapter, { event }, true);
  }
}

/**
 * UpdateStoryStateEffect - 更新故事状态
 */
class UpdateStoryStateEffect extends BaseEffect {
  constructor(chapter, state) {
    super(EffectType.UPDATE_STORY_STATE, chapter, { state }, true);
  }
}

/**
 * TemporaryDebuffEffect - 临时 debuff
 */
class TemporaryDebuffEffect extends BaseEffect {
  constructor(chapter, character, debuffType, durationChapters, description) {
    super(EffectType.TEMPORARY_DEBUFF, chapter, {
      character,
      debuff_type: debuffType,
      duration_chapters: durationChapters,
      description: description || ''
    }, true);
  }
}

/**
 * Effect 工厂函数
 */
const EffectFactory = {
  createAddFact(chapter, fact) {
    return new AddFactEffect(chapter, fact);
  },

  createUpdateCharacterState(chapter, character, field, from, to) {
    return new UpdateCharacterStateEffect(chapter, character, field, from, to);
  },

  createAddForeshadow(chapter, foreshadow) {
    return new AddForeshadowEffect(chapter, foreshadow);
  },

  createRevealForeshadow(chapter, foreshadowId, revealInfo) {
    return new RevealForeshadowEffect(chapter, foreshadowId, revealInfo);
  },

  createResolveForeshadow(chapter, foreshadowId, resolveInfo) {
    return new ResolveForeshadowEffect(chapter, foreshadowId, resolveInfo);
  },

  createAddPlotEvent(chapter, event) {
    return new AddPlotEventEffect(chapter, event);
  },

  createUpdateStoryState(chapter, state) {
    return new UpdateStoryStateEffect(chapter, state);
  },

  createTemporaryDebuff(chapter, character, debuffType, durationChapters, description) {
    return new TemporaryDebuffEffect(chapter, character, debuffType, durationChapters, description);
  }
};

module.exports = {
  EffectType,
  BaseEffect,
  AddFactEffect,
  UpdateCharacterStateEffect,
  AddForeshadowEffect,
  RevealForeshadowEffect,
  ResolveForeshadowEffect,
  AddPlotEventEffect,
  UpdateStoryStateEffect,
  TemporaryDebuffEffect,
  EffectFactory
};

