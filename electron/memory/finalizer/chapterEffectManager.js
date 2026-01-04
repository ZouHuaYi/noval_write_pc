/**
 * Chapter Effect Manager - 章节效果管理器
 * 追踪每章对核心记忆的影响，支持回滚
 */

const fs = require('fs');
const path = require('path');

class ChapterEffectManager {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.corePath = path.join(workspaceRoot, '.novel-agent', 'core');
    this.effectsPath = path.join(this.corePath, 'chapter_effects');
  }

  /**
   * 确保目录存在
   */
  ensureDirectories() {
    if (!fs.existsSync(this.effectsPath)) {
      fs.mkdirSync(this.effectsPath, { recursive: true });
    }
  }

  /**
   * 获取章节效果文件路径
   */
  getEffectFilePath(chapterNumber) {
    return path.join(this.effectsPath, `chapter-${chapterNumber}.json`);
  }

  /**
   * 加载章节效果
   */
  loadEffect(chapterNumber) {
    const filePath = this.getEffectFilePath(chapterNumber);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ 加载章节效果失败: ${filePath}`, error.message);
      return null;
    }
  }

  /**
   * 保存章节效果
   */
  saveEffect(chapterNumber, effect) {
    this.ensureDirectories();
    const filePath = this.getEffectFilePath(chapterNumber);
    try {
      fs.writeFileSync(filePath, JSON.stringify(effect, null, 2), 'utf-8');
      console.log(`   ✅ 已保存章节效果: chapter-${chapterNumber}.json`);
    } catch (error) {
      console.error(`❌ 保存章节效果失败: ${filePath}`, error.message);
      throw error;
    }
  }

  /**
   * 删除章节效果（回滚时使用）
   */
  deleteEffect(chapterNumber) {
    const filePath = this.getEffectFilePath(chapterNumber);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`   ✅ 已删除章节效果: chapter-${chapterNumber}.json`);
        return true;
      } catch (error) {
        console.error(`❌ 删除章节效果失败: ${filePath}`, error.message);
        return false;
      }
    }
    return false;
  }

  /**
   * 创建新的章节效果对象
   */
  createEffect(chapterNumber) {
    return {
      chapter: chapterNumber,
      created_at: new Date().toISOString(),
      effects: {
        facts_added: [],
        facts_updated: [],
        character_state_updates: [],
        foreshadows_added: [],
        foreshadows_revealed: [],
        foreshadows_resolved: [],
        plot_events_added: []
      },
      dependencies: {
        used_facts: [],
        used_foreshadows: [],
        used_character_states: []
      }
    };
  }

  /**
   * 记录添加的事实
   */
  recordFactAdded(effect, factId) {
    if (!effect.effects.facts_added.includes(factId)) {
      effect.effects.facts_added.push(factId);
    }
  }

  /**
   * 记录角色状态更新
   */
  recordCharacterStateUpdate(effect, characterName, field, fromValue, toValue) {
    effect.effects.character_state_updates.push({
      character: characterName,
      field: field,
      from: fromValue || null,
      to: toValue
    });
  }

  /**
   * 记录添加的伏笔
   */
  recordForeshadowAdded(effect, foreshadowId) {
    if (!effect.effects.foreshadows_added.includes(foreshadowId)) {
      effect.effects.foreshadows_added.push(foreshadowId);
    }
  }

  /**
   * 记录揭示的伏笔
   */
  recordForeshadowRevealed(effect, foreshadowId) {
    if (!effect.effects.foreshadows_revealed.includes(foreshadowId)) {
      effect.effects.foreshadows_revealed.push(foreshadowId);
    }
  }

  /**
   * 记录使用的依赖
   */
  recordDependency(effect, type, id) {
    if (type === 'fact' && !effect.dependencies.used_facts.includes(id)) {
      effect.dependencies.used_facts.push(id);
    } else if (type === 'foreshadow' && !effect.dependencies.used_foreshadows.includes(id)) {
      effect.dependencies.used_foreshadows.push(id);
    } else if (type === 'character_state' && !effect.dependencies.used_character_states.includes(id)) {
      effect.dependencies.used_character_states.push(id);
    }
  }

  /**
   * 获取所有章节效果
   */
  getAllEffects() {
    this.ensureDirectories();
    const effects = [];
    
    if (!fs.existsSync(this.effectsPath)) {
      return effects;
    }

    const files = fs.readdirSync(this.effectsPath);
    for (const file of files) {
      if (file.startsWith('chapter-') && file.endsWith('.json')) {
        const chapterNum = parseInt(file.match(/chapter-(\d+)\.json/)?.[1]);
        if (chapterNum) {
          const effect = this.loadEffect(chapterNum);
          if (effect) {
            effects.push(effect);
          }
        }
      }
    }

    return effects.sort((a, b) => a.chapter - b.chapter);
  }

  /**
   * 检查后续章节是否依赖此章节
   */
  getDependentChapters(chapterNumber) {
    const allEffects = this.getAllEffects();
    const effect = this.loadEffect(chapterNumber);
    
    if (!effect) {
      return [];
    }

    const dependent = [];
    const factIds = effect.effects.facts_added;
    const foreshadowIds = effect.effects.foreshadows_added;

    for (const laterEffect of allEffects) {
      if (laterEffect.chapter <= chapterNumber) {
        continue;
      }

      // 检查是否使用了此章节的事实
      const usesFacts = laterEffect.dependencies.used_facts.some(id => factIds.includes(id));
      // 检查是否使用了此章节的伏笔
      const usesForeshadows = laterEffect.dependencies.used_foreshadows.some(id => foreshadowIds.includes(id));

      if (usesFacts || usesForeshadows) {
        dependent.push(laterEffect.chapter);
      }
    }

    return dependent;
  }
}

module.exports = ChapterEffectManager;

