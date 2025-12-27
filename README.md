# 小说写作IDE

🎉 **AI驱动的本地小说写作工具** - 支持智能润色、扩写、续写和一致性校验

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

## ✨ 核心特性

### 🤖 AI写作助手
- **智能润色**：提升文本流畅度和文学性
- **内容扩写**：丰富细节描写和情节
- **精简优化**：删除冗余，保留核心
- **智能续写**：基于上文自然延续故事
- **错误修正**：人工指定问题，AI自动修正
- **实时对话**：与AI助手交流创作思路

### 🔍 一致性校验
- **智能校验**：检查时间线、人物、世界观的一致性
- **向量检索**：自动查找相关段落，发现矛盾
- **一键修正**：校验后可直接调用LLM修正问题

### 📝 专业编辑器
- **Monaco编辑器**：VS Code同款编辑体验
- **文件管理**：完整的文件树和工作区管理
- **自动保存**：实时保存提示，避免丢失
- **快捷操作**：支持拖拽、重命名、删除等

### 🎯 世界观管理
- **设定文件**：支持Markdown格式的世界观设定
- **自动识别**：AI自动遵守设定文件中的规则
- **上下文感知**：所有AI操作都保留500字前后文

## 🚀 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **桌面框架**：Electron 31
- **UI样式**：Tailwind CSS
- **编辑器**：Monaco Editor
- **数据库**：SQLite (better-sqlite3)
- **AI集成**：支持OpenAI兼容API

## 📦 快速开始

### 开发环境

```cmd
# 安装依赖
npm install

# 启动前端开发服务器
npm run dev

# 启动Electron（新终端）
npm run dev:el
```

### 打包发布

```cmd
# 安装electron-builder（如果还未安装）
npm install

# 构建前端 + 打包Windows安装程序
npm run dist:win

# 构建前端 + 打包macOS应用
npm run dist:mac

# 快速测试打包（不创建安装程序）
npm run pack
```

打包后的文件位于 `release/` 目录。

**详细打包说明**：请查看 [打包发布指南.md](./打包发布指南.md)

## 📖 文档

- [打包发布指南](./打包发布指南.md) - 开发者打包说明
- [用户使用指南](./用户使用指南.md) - 最终用户使用说明
- [图标准备说明](./build/icon-readme.md) - 应用图标制作指南

## 🗂️ 项目结构

```
write_plat_edit/
├── electron/              # Electron主进程
│   ├── main.js           # 主进程入口
│   ├── preload.js        # 预加载脚本
│   ├── database.js       # SQLite数据库管理
│   └── llm.js            # LLM API调用
├── src/                  # Vue前端代码
│   ├── App.vue           # 主应用组件
│   ├── components/       # Vue组件
│   ├── utils/            # 工具函数
│   └── main.ts           # 前端入口
├── build/                # 打包资源
│   ├── icon.ico          # Windows图标（需自行准备）
│   ├── icon.icns         # macOS图标（需自行准备）
│   └── entitlements.mac.plist  # macOS权限配置
├── dist/                 # 构建输出（自动生成）
├── release/              # 打包输出（自动生成）
├── package.json          # 项目配置
├── vite.config.mts       # Vite配置
├── tailwind.config.cjs   # Tailwind配置
└── README.md             # 本文件
```

## 🔧 配置说明

### 数据库

应用使用SQLite数据库存储配置：

- **Windows**: `%APPDATA%\novel-ide\novel-ide.db`
- **macOS**: `~/Library/Application Support/novel-ide/novel-ide.db`

存储内容：
- LLM模型配置
- Embedding模型配置
- 工作区历史
- 向量索引数据

### AI模型配置

支持任何兼容OpenAI API格式的服务：

- OpenAI (GPT-4, GPT-3.5-turbo)
- Azure OpenAI
- DeepSeek
- 智谱AI (GLM)
- 通义千问
- 本地部署的LLM (如：Ollama, LocalAI等)

## 🎨 应用图标

打包前请准备应用图标并放置在 `build/` 目录：

- Windows: `icon.ico` (256x256px)
- macOS: `icon.icns` (512x512px + 1024x1024px)

详见：[build/icon-readme.md](./build/icon-readme.md)

## 📝 版本更新说明

### v1.0.0 (2024-12-24)

**新功能**：
- ✅ 修正错误功能增加人工输入框
- ✅ 一致性校验增加二次确认修正功能
- ✅ 支持Windows和macOS打包
- ✅ 完整的用户使用指南

**核心功能**：
- AI文本优化（润色、扩写、精简、续写、修正）
- AI对话助手
- 一致性校验与自动修正
- 向量索引和智能检索
- 世界观设定文件支持
- 工作区历史记录

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License - 详见 [LICENSE.txt](./LICENSE.txt)

## 💬 联系方式

- 作者：Your Name
- 邮箱：your-email@example.com
- GitHub：https://github.com/your-repo

---

**⭐ 如果这个项目对您有帮助，请给个Star！**

祝您写作愉快！✨

