# 记忆系统重构测试指南

## 已完成的重构内容

### 1. 核心架构
- ✅ 创建了新的三层架构：
  - Knowledge Core（facts.json, concepts.json）
  - Narrative State（story_state.json, foreshadows.json）
  - Derived/Cache（extracts/ 目录）

### 2. 核心组件
- ✅ ConceptResolver（概念语义归一化）
- ✅ ChapterFinalizer（章节结算器）
- ✅ ExtractWriter（ChapterExtract 写入器）

### 3. Agent 修改
- ✅ MemoryUpdater 改为写入 ChapterExtract
- ✅ IntelligentExtractor 改为写入 ChapterExtract

### 4. 后端接口
- ✅ MemoryManager 添加新架构支持方法
- ✅ IPC 接口更新（finalizeChapter, getAllConcepts, getAllFacts 等）
- ✅ preload.js 更新

### 5. UI 更新
- ✅ MemoryViewer.vue 添加新标签页：
  - 知识核心（显示概念、事实、故事状态、伏笔）
  - 章节提取（显示待结算章节，支持结算功能）

## 测试步骤

### 1. 初始化测试
1. 打开应用
2. 打开工作区
3. 检查记忆系统是否正常初始化
4. 查看控制台是否有错误

### 2. 章节提取测试
1. 使用 Agent 生成或修改章节内容
2. 检查 `.novel-agent/extracts/` 目录是否生成了 `chapter_X.json` 文件
3. 在 UI 的"章节提取"标签页查看待结算章节列表

### 3. 章节结算测试
1. 在"章节提取"标签页点击"结算"按钮
2. 检查控制台输出，确认结算成功
3. 检查 `.novel-agent/core/` 目录下的文件是否更新：
   - `facts.json` - 应该包含新的事实
   - `concepts.json` - 应该包含新的概念
   - `foreshadows.json` - 应该包含新的伏笔
   - `story_state.json` - 应该更新故事状态

### 4. 知识核心查看测试
1. 切换到"知识核心"标签页
2. 查看概念列表（应该显示所有归一化的概念）
3. 查看事实列表（应该显示所有不可逆事实）
4. 查看故事状态（应该显示当前章节和状态）
5. 查看伏笔列表（应该显示所有伏笔及其状态）

### 5. 概念归一化测试
1. 生成包含相同概念不同表述的章节（如"地磁异常"、"磁场偏移"、"保护层减弱"）
2. 结算章节
3. 检查 `concepts.json`，确认这些表述被归一到同一个概念 ID
4. 检查概念的 aliases 数组是否包含所有表述

### 6. 伏笔状态机测试
1. 创建新伏笔（状态：pending）
2. 在后续章节中确认伏笔（状态：confirmed）
3. 揭示伏笔（状态：revealed）
4. 归档伏笔（状态：archived）
5. 检查状态迁移是否正确，不允许回退

### 7. 事实不可逆测试
1. 创建事实
2. 尝试更新事实（应该失败或忽略）
3. 检查 `facts.json`，确认事实没有被修改

### 8. 批量结算测试
1. 生成多个章节的 ChapterExtract
2. 点击"全部结算"按钮
3. 检查所有章节是否都成功结算

## 预期行为

### Agent 行为
- Agent 不再直接写入长期记忆
- Agent 只写入 ChapterExtract（临时账本）
- 控制台会显示"ChapterExtract 已写入"而不是"记忆更新完成"

### 数据流向
```
Agent → ChapterExtract（临时）
         ↓
   ChapterFinalizer（结算）
         ↓
   Knowledge Core（长期记忆）
```

### 概念归一化
- 同一概念的不同表述会被归一到同一个 concept_id
- 新表述会被添加到 aliases 数组
- 不会创建重复的概念

### 伏笔管理
- 每个概念只对应一个伏笔记录
- 状态只能向前迁移：pending → confirmed → revealed → archived
- 不允许回退或重复创建

## 常见问题排查

### 问题1：ChapterExtract 没有生成
- 检查 Agent 是否成功执行
- 检查章节号是否正确提取
- 查看控制台错误信息

### 问题2：结算失败
- 检查 ChapterExtract 文件格式是否正确
- 检查目录权限
- 查看控制台错误信息

### 问题3：概念没有归一化
- 检查 ConceptResolver 是否正确工作
- 检查概念的 aliases 是否包含所有表述
- 查看控制台日志

### 问题4：UI 没有显示新数据
- 检查 IPC 接口是否正确调用
- 检查数据格式是否正确
- 刷新页面或重新加载数据

## 下一步优化

1. ✅ 添加语义相似度判断（使用 embedding）- **已完成**
   - 文件: `electron/memory/finalizer/semanticSimilarity.js`
   - 已集成到 `ConceptResolver`，自动使用语义相似度匹配概念

2. ✅ 添加冲突检测（新事实与旧事实矛盾）- **已完成**
   - 文件: `electron/memory/finalizer/factConflictDetector.js`
   - 已集成到 `ChapterFinalizer.mergeFacts()`，自动检测并阻止冲突事实

3. ✅ 添加自动清理 extracts 功能 - **已完成**
   - 文件: `electron/memory/finalizer/extractCleaner.js`
   - 支持清理已结算的 extracts、过期的 extracts
   - IPC 接口: `memory:cleanFinalizedExtracts`, `memory:cleanOldExtracts`, `memory:getExtractCleanupStats`

4. ⏭️ 优化 UI 显示效果 - **待实现**
   - 需要根据实际 UI 需求进行优化

5. ✅ 添加数据迁移工具（从旧架构迁移到新架构）- **已完成**
   - 文件: `electron/memory/migration/oldToNewMigrator.js`
   - 支持从旧记忆系统迁移概念、事实、伏笔、人物状态
   - IPC 接口: `memory:migrateFromOldArchitecture`, `memory:previewMigration`

