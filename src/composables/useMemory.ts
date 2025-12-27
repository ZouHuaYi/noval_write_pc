/**
 * useMemory - 记忆系统管理 Composable
 * 管理 Novel Agent 的5层记忆系统
 */

import { ref, computed } from 'vue';

declare global {
  interface Window {
    api?: any;
  }
}

interface MemorySummary {
  world: {
    has_cultivation_system: boolean;
    has_magic_system: boolean;
    custom_rules_count: number;
  };
  character: {
    total_characters: number;
    main_characters: number;
  };
  plot: {
    current_stage: string;
    completed_events_count: number;
    pending_goals_count: number;
  };
  foreshadow: {
    total: number;
    pending: number;
    revealed: number;
    resolved: number;
  };
}

interface Character {
  id?: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting';
  personality?: {
    traits?: string[];
    forbidden_traits?: string[];
    description?: string;
  };
  current_state?: {
    level?: string;
    location?: string;
    injuries?: string[];
    possessions?: string[];
    skills?: string[];
    emotional_state?: string;
  };
  relationships?: Record<string, any>;
  history?: any[];
}

interface Foreshadow {
  id?: string;
  title: string;
  content: string;
  importance: 'minor' | 'normal' | 'major' | 'critical';
  introduced_at?: {
    chapter: number;
    paragraph: string;
  };
}

interface PlotEvent {
  name: string;
  chapter: number;
  description: string;
  significance: 'minor' | 'normal' | 'major' | 'critical';
}

export function useMemory() {
  const memorySummary = ref<MemorySummary | null>(null);
  const characters = ref<Character[]>([]);
  const foreshadows = ref<Foreshadow[]>([]);
  const isLoading = ref(false);
  const error = ref<string>('');
  const initialized = ref(false);

  // 初始化记忆系统
  const initMemory = async (workspaceRoot: string) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.init(workspaceRoot);
      
      if (result.success) {
        initialized.value = true;
        // 初始化后立即加载摘要
        await getSummary();
      } else {
        error.value = result.error || '初始化失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '初始化记忆系统失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 获取记忆摘要
  const getSummary = async () => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return null;
    }

    try {
      const result = await window.api.memory.getSummary();
      
      if (result.success) {
        memorySummary.value = result.summary;
      } else {
        error.value = result.error || '获取摘要失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '获取记忆摘要失败';
      return null;
    }
  };

  // 查询记忆
  const queryMemory = async (query: string) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return null;
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.query(query);
      
      if (!result.success) {
        error.value = result.error || '查询失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '查询记忆失败';
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // 添加角色
  const addCharacter = async (character: Character) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.addCharacter(character);
      
      if (result.success) {
        // 重新加载角色列表
        await getAllCharacters();
        await getSummary();
      } else {
        error.value = result.error || '添加角色失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '添加角色失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 更新角色状态
  const updateCharacter = async (charName: string, updates: any) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.updateCharacter(charName, updates);
      
      if (result.success) {
        // 重新加载角色列表
        await getAllCharacters();
        await getSummary();
      } else {
        error.value = result.error || '更新角色失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '更新角色失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 获取所有角色
  const getAllCharacters = async () => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return [];
    }

    try {
      const result = await window.api.memory.getAllCharacters();
      
      if (result.success) {
        characters.value = result.characters || [];
      } else {
        error.value = result.error || '获取角色列表失败';
      }

      return characters.value;
    } catch (err: any) {
      error.value = err.message || '获取角色列表失败';
      return [];
    }
  };

  // 添加伏笔
  const addForeshadow = async (foreshadow: Foreshadow) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.addForeshadow(foreshadow);
      
      if (result.success) {
        // 重新加载伏笔列表
        await getPendingForeshadows();
        await getSummary();
      } else {
        error.value = result.error || '添加伏笔失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '添加伏笔失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 获取待处理的伏笔
  const getPendingForeshadows = async () => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return [];
    }

    try {
      const result = await window.api.memory.getPendingForeshadows();
      
      if (result.success) {
        foreshadows.value = result.foreshadows || [];
      } else {
        error.value = result.error || '获取伏笔列表失败';
      }

      return foreshadows.value;
    } catch (err: any) {
      error.value = err.message || '获取伏笔列表失败';
      return [];
    }
  };

  // 添加剧情事件
  const addPlotEvent = async (eventData: PlotEvent) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.addPlotEvent(eventData);
      
      if (result.success) {
        await getSummary();
      } else {
        error.value = result.error || '添加剧情事件失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '添加剧情事件失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 更新世界规则
  const updateWorldRules = async (rules: any) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.updateWorldRules(rules);
      
      if (result.success) {
        await getSummary();
      } else {
        error.value = result.error || '更新世界规则失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '更新世界规则失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 导出记忆
  const exportMemory = async () => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return null;
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.export();
      
      if (!result.success) {
        error.value = result.error || '导出失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '导出记忆失败';
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // 导入记忆
  const importMemory = async (data: any) => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.import(data);
      
      if (result.success) {
        await getSummary();
        await getAllCharacters();
        await getPendingForeshadows();
      } else {
        error.value = result.error || '导入失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '导入记忆失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 重置记忆
  const resetMemory = async () => {
    if (!window.api?.memory) {
      error.value = 'Memory API 不可用';
      return { success: false, error: error.value };
    }

    isLoading.value = true;
    error.value = '';

    try {
      const result = await window.api.memory.reset();
      
      if (result.success) {
        memorySummary.value = null;
        characters.value = [];
        foreshadows.value = [];
        await getSummary();
      } else {
        error.value = result.error || '重置失败';
      }

      return result;
    } catch (err: any) {
      error.value = err.message || '重置记忆失败';
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // Computed
  const hasMemory = computed(() => memorySummary.value !== null);
  const characterCount = computed(() => characters.value.length);
  const foreshadowCount = computed(() => foreshadows.value.length);

  return {
    // State
    memorySummary,
    characters,
    foreshadows,
    isLoading,
    error,
    initialized,

    // Computed
    hasMemory,
    characterCount,
    foreshadowCount,

    // Methods
    initMemory,
    getSummary,
    queryMemory,
    addCharacter,
    updateCharacter,
    getAllCharacters,
    addForeshadow,
    getPendingForeshadows,
    addPlotEvent,
    updateWorldRules,
    exportMemory,
    importMemory,
    resetMemory
  };
}

