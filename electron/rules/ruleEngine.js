/**
 * Rule Engine - 规则引擎
 * 加载、匹配和应用一致性规则
 */

const fs = require('fs').promises;
const path = require('path');

class RuleEngine {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.defaultRulesPath = path.join(__dirname, '../../rules/default-rules.json');
    this.customRulesPath = path.join(workspaceRoot, 'rules/consistency-rules.json');
    this.rules = [];
    this.loaded = false;
  }

  /**
   * 加载规则
   */
  async loadRules() {
    try {
      console.log('📋 加载一致性规则...');

      // 加载默认规则
      const defaultRulesContent = await fs.readFile(this.defaultRulesPath, 'utf-8');
      const defaultRules = JSON.parse(defaultRulesContent);
      
      let customRules = { rules: [] };
      
      // 尝试加载自定义规则
      try {
        const customRulesContent = await fs.readFile(this.customRulesPath, 'utf-8');
        customRules = JSON.parse(customRulesContent);
      } catch (e) {
        console.log('📝 未找到自定义规则，使用默认规则');
      }

      // 合并规则（自定义规则优先级更高）
      this.rules = [
        ...defaultRules.rules.filter(r => r.enabled !== false),
        ...customRules.rules.filter(r => r.enabled === true)
      ];

      this.loaded = true;
      console.log(`✅ 已加载 ${this.rules.length} 条规则`);

      return { success: true, count: this.rules.length };

    } catch (error) {
      console.error('❌ 加载规则失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查文本是否违反规则
   * @param {string} text - 待检查的文本
   * @param {Object} context - 上下文信息（角色、剧情等）
   */
  async checkRules(text, context = {}) {
    if (!this.loaded) {
      await this.loadRules();
    }

    const violations = [];

    for (const rule of this.rules) {
      const violation = this.evaluateRule(rule, text, context);
      if (violation) {
        violations.push({
          rule_id: rule.id,
          rule_name: rule.name,
          type: rule.type,
          severity: rule.severity,
          message: rule.error_message,
          suggestion: rule.suggestion,
          matched_condition: violation.matched_condition
        });
      }
    }

    return violations;
  }

  /**
   * 评估单条规则
   * @param {Object} rule - 规则对象
   * @param {string} text - 待检查的文本
   * @param {Object} context - 上下文信息
   */
  evaluateRule(rule, text, context) {
    const condition = rule.condition;

    // 检查文本包含关键词
    if (condition.text_contains) {
      for (const keyword of condition.text_contains) {
        if (text.includes(keyword)) {
          return {
            matched_condition: 'text_contains',
            matched_value: keyword
          };
        }
      }
    }

    // 检查角色境界
    if (condition.character_level_below && context.character) {
      const currentLevel = context.character.current_state?.level;
      const requiredLevel = condition.character_level_below;
      
      if (currentLevel && this.isLevelBelow(currentLevel, requiredLevel)) {
        // 检查是否使用了不允许的能力
        if (condition.text_contains) {
          for (const keyword of condition.text_contains) {
            if (text.includes(keyword)) {
              return {
                matched_condition: 'character_level_below',
                matched_value: `${currentLevel} < ${requiredLevel}`
              };
            }
          }
        }
      }
    }

    // 检测视角切换（简化版）
    if (condition.detect_pov_switch) {
      if (this.detectPOVSwitch(text)) {
        return {
          matched_condition: 'detect_pov_switch',
          matched_value: true
        };
      }
    }

    // 检查性格一致性（需要结合 LLM）
    if (condition.check_personality_match && context.character) {
      // 这部分需要结合 LLM 进行智能判断
      // 暂时返回 null，由 LLM 层处理
    }

    return null;
  }

  /**
   * 判断境界高低（简化版）
   * 实际应该根据 WorldMemory 中的修炼体系判断
   */
  isLevelBelow(currentLevel, requiredLevel) {
    const levels = ['练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'];
    const currentIndex = levels.findIndex(l => currentLevel.includes(l));
    const requiredIndex = levels.findIndex(l => requiredLevel.includes(l));
    
    if (currentIndex === -1 || requiredIndex === -1) {
      return false; // 无法判断
    }
    
    return currentIndex < requiredIndex;
  }

  /**
   * 检测视角切换（简化版）
   */
  detectPOVSwitch(text) {
    // 检查是否同时存在第一人称和第三人称
    const firstPerson = /我|我们|我的|我们的/g;
    const thirdPerson = /他|她|它|他们|她们|它们|他的|她的/g;

    const hasFirst = firstPerson.test(text);
    const hasThird = thirdPerson.test(text);

    // 简化判断：如果同时存在且文本较短，可能是视角混乱
    return hasFirst && hasThird && text.length < 500;
  }

  /**
   * 根据类型获取规则
   */
  getRulesByType(type) {
    return this.rules.filter(r => r.type === type);
  }

  /**
   * 根据严重性获取规则
   */
  getRulesBySeverity(severity) {
    return this.rules.filter(r => r.severity === severity);
  }

  /**
   * 获取所有规则
   */
  getAllRules() {
    return this.rules;
  }

  /**
   * 获取规则统计
   */
  getStatistics() {
    const stats = {
      total: this.rules.length,
      by_type: {},
      by_severity: {}
    };

    for (const rule of this.rules) {
      // 按类型统计
      stats.by_type[rule.type] = (stats.by_type[rule.type] || 0) + 1;
      
      // 按严重性统计
      stats.by_severity[rule.severity] = (stats.by_severity[rule.severity] || 0) + 1;
    }

    return stats;
  }

  /**
   * 启用规则
   */
  async enableRule(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
      console.log(`✅ 规则已启用: ${rule.name}`);
    }
  }

  /**
   * 禁用规则
   */
  async disableRule(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
      console.log(`⏸️ 规则已禁用: ${rule.name}`);
    }
  }

  /**
   * 重新加载规则
   */
  async reload() {
    this.rules = [];
    this.loaded = false;
    return await this.loadRules();
  }
}

module.exports = RuleEngine;

