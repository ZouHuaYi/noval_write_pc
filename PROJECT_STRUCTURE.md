# 项目目录结构

## 📁 完整目录结构

```
write_plat_edit/
├── build/                    # 构建资源
│   ├── icon.ico
│   ├── entitlements.mac.plist
│   └── icon-readme.md
│
├── config/                   # 配置文件（预留）
│
├── dist/                     # 构建输出
│
├── docs/                     # 文档
│   ├── architecture/         # 架构文档
│   ├── guides/              # 使用指南
│   ├── changelog/           # 更新日志
│   └── other/               # 其他文档
│
├── electron/                 # Electron 后端
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   │
│   ├── core/                # 核心功能
│   │   ├── database.js     # 数据库管理
│   │   └── llm.js          # LLM 调用
│   │
│   ├── agent/               # Agent 系统
│   │   ├── orchestrator.js # Agent 调度器
│   │   │
│   │   ├── skills/          # Skill 系统
│   │   │   ├── definitions/   # Skill 定义
│   │   │   │   └── skillDefinitions.json
│   │   │   ├── core/         # Skill 核心
│   │   │   │   ├── skillExecutor.js
│   │   │   │   └── skillRouter.js
│   │   │   └── impl/         # Skill 实现
│   │   │       ├── contextSkills.js
│   │   │       ├── cognitiveSkills.js
│   │   │       ├── writeSkills.js
│   │   │       ├── checkSkills.js
│   │   │       └── actionSkills.js
│   │   │
│   │   ├── modules/         # Agent 功能模块
│   │   │   ├── analysis/     # 分析模块
│   │   │   │   ├── chapterAnalyzer.js
│   │   │   │   ├── intentAnalyzer.js
│   │   │   │   └── eventExtractor.js
│   │   │   │
│   │   │   ├── planning/    # 规划模块
│   │   │   │   ├── chapterPlanner.js
│   │   │   │   ├── intentPlanner.js
│   │   │   │   └── sceneStructurePlanner.js
│   │   │   │
│   │   │   ├── writing/     # 写作模块
│   │   │   │   └── rewriter.js
│   │   │   │
│   │   │   ├── checking/    # 检查模块
│   │   │   │   ├── consistencyChecker.js
│   │   │   │   └── coherenceChecker.js
│   │   │   │
│   │   │   ├── control/     # 控制模块
│   │   │   │   ├── pacingController.js
│   │   │   │   ├── emotionCurveManager.js
│   │   │   │   └── densityController.js
│   │   │   │
│   │   │   └── context/      # 上下文模块
│   │   │       ├── contextLoader.js
│   │   │       ├── fileScanner.js
│   │   │       └── memoryUpdater.js
│   │   │
│   │   └── utils/           # Agent 工具
│   │       ├── errorHandler.js
│   │       ├── performanceOptimizer.js
│   │       └── reportGenerator.js
│   │
│   ├── memory/              # 记忆系统
│   │   ├── index.js         # 记忆管理器入口
│   │   ├── types.js         # 类型定义
│   │   │
│   │   ├── core/            # 核心记忆
│   │   │   ├── worldMemory.js
│   │   │   ├── characterMemory.js
│   │   │   ├── plotMemory.js
│   │   │   └── foreshadowMemory.js
│   │   │
│   │   ├── extractors/      # 提取器
│   │   │   ├── settingExtractor.js
│   │   │   ├── intelligentExtractor.js
│   │   │   └── extractWriter.js
│   │   │
│   │   ├── finalizer/       # 最终化模块
│   │   │   ├── chapterFinalizer.js
│   │   │   ├── conceptResolver.js
│   │   │   ├── characterStateKnowledge.js
│   │   │   ├── foreshadowPanel.js
│   │   │   ├── factConflictDetector.js
│   │   │   ├── semanticSimilarity.js
│   │   │   └── extractCleaner.js
│   │   │
│   │   ├── managers/        # 管理器
│   │   │   ├── chapterFileManager.js
│   │   │   └── fileStateManager.js
│   │   │
│   │   └── migration/       # 迁移工具
│   │       └── oldToNewMigrator.js
│   │
│   ├── rules/               # 规则引擎
│   │   ├── ruleEngine.js    # 旧规则引擎（兼容）
│   │   └── dslRuleEngine.js # DSL 规则引擎
│   │
│   └── utils/               # 通用工具
│       ├── logger.js
│       └── jsonParser.js
│
├── release/                  # 发布输出
│
├── rules/                    # 规则文件（用户配置）
│   ├── default-rules.json
│   ├── default-dsl-rules.json
│   └── consistency-rules.json
│
├── scripts/                  # 构建脚本
│   ├── clean-release.ps1
│   ├── reorganize-project.ps1
│   └── organize-docs.ps1
│
├── src/                      # 前端代码
│   ├── main.ts              # 前端入口
│   ├── App.vue              # 根组件
│   │
│   ├── assets/              # 静态资源
│   │   └── tailwind.css
│   │
│   ├── components/          # Vue 组件
│   │   ├── common/          # 通用组件
│   │   ├── agent/           # Agent 组件
│   │   ├── editor/          # 编辑器组件
│   │   ├── memory/          # 记忆组件
│   │   ├── rules/           # 规则组件
│   │   └── settings/        # 设置组件
│   │
│   ├── composables/         # Composables
│   │   ├── useAgent.ts
│   │   ├── useAI.ts
│   │   ├── useEditor.ts
│   │   ├── useFileSystem.ts
│   │   ├── useMemory.ts
│   │   ├── useNovelAgent.ts
│   │   ├── useRules.ts
│   │   └── useDialogs.ts
│   │
│   └── utils/               # 前端工具
│       └── fileTree.ts
│
├── .gitignore
├── LICENSE.txt
├── package.json
├── package-lock.json
├── postcss.config.cjs
├── tailwind.config.cjs
├── vite.config.mts
├── README.md
├── REMED.md
└── index.html
```

## 🎯 目录组织原则

### 1. 按功能模块组织
- **core/** - 核心功能（数据库、LLM）
- **agent/** - Agent 系统（按功能分类）
- **memory/** - 记忆系统（按类型分类）
- **rules/** - 规则引擎

### 2. 清晰的层次结构
- 每个模块都有明确的职责
- 相关文件放在同一目录
- 工具类统一管理

### 3. 易于扩展
- 新功能可以轻松添加到对应模块
- Skill 系统独立，易于添加新 Skill
- 组件按功能分类，易于维护

## 📝 命名规范

- **文件名**: camelCase（如 `chapterAnalyzer.js`）
- **目录名**: 小写（如 `modules/`, `analysis/`）
- **类名**: PascalCase（如 `ChapterAnalyzer`）

## 🔄 引用路径规范

### 同级模块引用
```javascript
const OtherModule = require('./otherModule');
```

### 跨目录引用
```javascript
// 引用 memory
const MemoryManager = require('../../memory');

// 引用 rules
const RuleEngine = require('../../rules/ruleEngine');

// 引用 utils
const Logger = require('../../../utils/logger');
```

## 📚 相关文档

- [目录结构说明](docs/architecture/目录结构说明.md)
- [Skill 架构说明](docs/architecture/Skill架构说明.md)
- [项目重组完成说明](docs/architecture/项目重组完成说明.md)

