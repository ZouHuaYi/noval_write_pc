# 小说写作 IDE

AI 驱动的本地小说写作 IDE - 支持智能润色、扩写、续写和一致性校验

## 📁 项目结构

```
write_plat_edit/
├── electron/           # Electron 后端
│   ├── core/          # 核心功能（数据库、LLM）
│   ├── agent/         # Agent 系统
│   │   ├── skills/    # Skill 系统
│   │   └── modules/   # Agent 功能模块
│   ├── memory/        # 记忆系统
│   ├── rules/         # 规则引擎
│   └── utils/         # 通用工具
│
├── src/               # 前端代码
│   ├── components/    # Vue 组件
│   ├── composables/   # Composables
│   └── utils/         # 前端工具
│
├── docs/              # 文档
│   ├── architecture/  # 架构文档
│   ├── guides/        # 使用指南
│   └── changelog/     # 更新日志
│
└── rules/             # 规则文件（用户配置）
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev:el
```

### 构建

```bash
npm run build
npm run dist:win
```

## 📚 文档

- [Skill 架构说明](docs/architecture/Skill架构说明.md)
- [目录结构说明](docs/architecture/目录结构说明.md)
- [使用指南](docs/guides/)

## 🏗️ 架构

### Skill 架构

项目采用 Skill 架构，将 Agent 功能模块化为独立的 Skill：

- **Context Skills** - 上下文加载
- **Cognitive Skills** - 认知处理
- **Write Skills** - 写作生成
- **Check Skills** - 一致性检查
- **Action Skills** - 动作执行

详见 [Skill 架构说明](docs/architecture/Skill架构说明.md)

## 📝 开发规范

### 目录组织

- 按功能模块组织代码
- 相关文件放在同一目录
- 工具类统一管理

### 命名规范

- 文件名: camelCase（如 `chapterAnalyzer.js`）
- 目录名: 小写（如 `modules/`, `analysis/`）
- 类名: PascalCase（如 `ChapterAnalyzer`）

## 🔧 技术栈

- **前端**: Vue 3 + TypeScript + Tailwind CSS
- **后端**: Electron + Node.js
- **数据库**: SQLite (better-sqlite3)
- **AI**: OpenAI 兼容 API

## 📄 许可证

详见 [LICENSE.txt](LICENSE.txt)
