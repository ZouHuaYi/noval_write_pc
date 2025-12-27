/**
 * useRules - 规则系统管理 Composable
 * 管理一致性校验规则
 */

import { ref, computed } from 'vue';

declare global {
  interface Window {
    api?: any;
  }
}

interface Rule {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  condition: any;
  error_message: string;
  suggestion: string;
}

interface RuleStats {
  total: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
}

export function useRules() {
  const rules = ref<Rule[]>([]);
  const stats = ref<RuleStats | null>(null);
  const isLoading = ref(false);
  const error = ref<string>('');

  // 获取所有规则
  const getAllRules = async () => {
    if (!window.api?.rules) {
      error.value = 'Rules API 不可用';
      return [];
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.rules.getAll();
      
      if (result.success) {
        rules.value = result.rules || [];
      } else {
        error.value = result.error || '获取规则失败';
      }

      return rules.value;
    } catch (err: any) {
      error.value = err.message || '获取规则失败';
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // 重新加载规则
  const reloadRules = async () => {
    if (!window.api?.rules) {
      error.value = 'Rules API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.rules.reload();
      
      if (result.success) {
        // 重新获取规则列表
        await getAllRules();
        await getStats();
      } else {
        error.value = result.error || '重新加载规则失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '重新加载规则失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 获取规则统计
  const getStats = async () => {
    if (!window.api?.rules) {
      error.value = 'Rules API 不可用';
      return null;
    }

    try {
      const result = await window.api.rules.getStats();
      
      if (result.success) {
        stats.value = result.stats;
      } else {
        error.value = result.error || '获取统计失败';
      }

      return stats.value;
    } catch (err: any) {
      error.value = err.message || '获取规则统计失败';
      return null;
    }
  };

  // Computed
  const ruleCount = computed(() => rules.value.length);
  
  const enabledRules = computed(() => 
    rules.value.filter(r => r.enabled)
  );
  
  const rulesByType = computed(() => {
    const grouped: Record<string, Rule[]> = {};
    for (const rule of rules.value) {
      if (!grouped[rule.type]) {
        grouped[rule.type] = [];
      }
      grouped[rule.type].push(rule);
    }
    return grouped;
  });

  const rulesBySeverity = computed(() => {
    const grouped: Record<string, Rule[]> = {};
    for (const rule of rules.value) {
      if (!grouped[rule.severity]) {
        grouped[rule.severity] = [];
      }
      grouped[rule.severity].push(rule);
    }
    return grouped;
  });

  const criticalRules = computed(() => 
    rules.value.filter(r => r.severity === 'critical')
  );

  const highRules = computed(() => 
    rules.value.filter(r => r.severity === 'high')
  );

  return {
    // State
    rules,
    stats,
    isLoading,
    error,

    // Computed
    ruleCount,
    enabledRules,
    rulesByType,
    rulesBySeverity,
    criticalRules,
    highRules,

    // Methods
    getAllRules,
    reloadRules,
    getStats
  };
}

