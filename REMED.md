一、整体架构图（Mermaid）

👉 你可以直接复制到 Cursor / Markdown / Mermaid Viewer
```
flowchart TD
    UI[Novel IDE UI<br/>编辑器 / 文件树 / Agent 面板]

    subgraph AgentCore[Novel Agent Core]
        Orchestrator[Agent Orchestrator<br/>状态机调度]
        
        ContextLoader[Context Loader<br/>上下文加载]
        IntentPlanner[Intent Planner<br/>写作意图规划]
        Writer[Writer Agent<br/>初稿生成]
        Checker[Consistency Checker<br/>一致性校验]
        Rewriter[Rewrite Agent<br/>约束式重写]
        MemoryUpdater[Memory Updater<br/>记忆更新]
    end

    subgraph MemoryLayer[Memory Layer]
        WorldMemory[(World Memory<br/>世界观 / 规则)]
        PlotMemory[(Plot Memory<br/>剧情状态)]
        CharacterMemory[(Character Memory<br/>人物状态)]
        ForeshadowMemory[(Foreshadow Memory<br/>伏笔)]
        VectorStore[(Vector DB<br/>章节文本)]
    end

    subgraph RuleLayer[Rule & Validation Layer]
        RuleDSL[Consistency Rule DSL<br/>JSON / Schema]
        Validator[Rule Engine]
    end

    UI --> Orchestrator

    Orchestrator --> ContextLoader
    ContextLoader --> IntentPlanner
    IntentPlanner --> Writer
    Writer --> Checker
    Checker -->|Fail| Rewriter
    Rewriter --> Checker
    Checker -->|Pass| MemoryUpdater

    ContextLoader --> MemoryLayer
    Checker --> Validator
    Validator --> RuleDSL

    MemoryUpdater --> MemoryLayer
    VectorStore --> ContextLoader
```
二、需求文档（PRD + 技术说明）

文档定位：
给 Cursor / 工程 Agent / 开发者

不是市场 PRD，是“工程可执行 PRD”

1. 项目概述
1.1 项目名称

Novel Agent IDE

1.2 项目目标

构建一个具备 长期记忆、世界观约束、自我校验与重写能力 的小说 IDE Agent，用于辅助长篇小说（尤其是玄幻 / 科幻）创作。

1.3 核心能力

理解并存储世界观、人物、剧情状态

基于当前情节规划写作意图

自动生成剧情文本

对生成内容进行一致性校验

在校验失败时进行约束式重写

持续更新记忆，保证长期一致性

2. 核心流程（Agent 状态机）
2.1 状态机定义
IDLE
 → LOAD_CONTEXT
 → PLAN_INTENT
 → WRITE_DRAFT
 → CHECK_CONSISTENCY
    → FAIL → REWRITE → CHECK_CONSISTENCY
    → PASS → UPDATE_MEMORY
 → DONE

2.2 状态说明
状态	描述
LOAD_CONTEXT	加载世界 / 剧情 / 人物 / 相关章节
PLAN_INTENT	生成本次写作目标与约束
WRITE_DRAFT	生成初稿文本
CHECK_CONSISTENCY	校验一致性
REWRITE	在约束条件下重写
UPDATE_MEMORY	更新长期 / 中期记忆
3. 记忆系统设计（核心）
3.1 记忆分层
3.1.1 World Memory（长期）

内容

世界规则

修炼体系

元素规则

境界限制

特点

稳定

低频更新

强约束

3.1.2 Character Memory（中期）

内容

人物性格

当前状态（伤势 / 立场）

关系网

3.1.3 Plot Memory（中期）

内容

主线进度

已发生关键事件

未完成目标

3.1.4 Foreshadow Memory（长期）
{
  "id": "thunder_seed_001",
  "introduced_at": "chapter_12",
  "status": "pending",
  "trigger_condition": "reach_jindan"
}

3.1.5 Vector Memory（短期）

最近章节文本

相似语义召回

4. 写作意图模块（Intent Planner）
4.1 输出结构
{
  "goal": "推进主角完成筑基",
  "narrative_role": ["战斗推进", "情绪爆发"],
  "tone": "紧张 → 爆发 → 稳定",
  "viewpoint": "第三人称近景",
  "constraints": {
    "forbidden": ["引入新人物", "解释新世界规则"],
    "required": ["体现代价", "保留失败风险"]
  }
}

4.2 说明

Writer Agent 只能基于 Intent 输出文本

Rewrite 阶段也必须遵守 Intent

5. 一致性校验系统
5.1 校验类型
类型	说明
World Rule	是否违反世界规则
Power Level	是否越级
Character	是否性格冲突
Timeline	时间线是否错乱
POV	视角是否混乱
5.2 校验输出格式（强制）
{
  "status": "fail",
  "errors": [
    {
      "type": "world_rule",
      "message": "筑基期无法直接操控雷元素",
      "location": "paragraph_3"
    }
  ]
}

6. Rewrite Agent（约束式重写）
6.1 重写原则

只修改错误相关内容

保留情绪、节奏、结论

不引入新设定

6.2 输入

原文

Intent

校验错误列表

7. Memory Updater
7.1 写入规则

✔ 写入：

新发生事实

状态变化

✘ 不写入：

修辞

比喻

临时描写

8. 技术实现建议（Node.js）
8.1 核心类设计
```
class NovelAgent {
  loadContext()
  planIntent()
  writeDraft()
  checkConsistency()
  rewrite()
  updateMemory()
}

```IDLE
8.2 存储建议
类型	技术
结构化记忆	SQLite / JSON
向量	Chroma / LanceDB
规则	JSON Schema / DSL
9. 非功能性需求
可回溯 Agent 执行日志
支持用户强制约束（不可死亡 / 不可改名）
支持失败回滚
可视化当前世界 / 人物状态

一致性校验 DSL（Consistency DSL v1）

目标：
让“规则”从 Prompt 中剥离，成为可维护系统

1️⃣ DSL 设计目标

可读

可扩展

可被 LLM 和程序双用

支持逐条错误定位

2️⃣ DSL 总体结构（JSON）
{
  "version": "1.0",
  "rules": [
    {
      "id": "no_thunder_before_foundation",
      "type": "power_level",
      "description": "筑基期之前不可操控雷元素",
      "condition": {
        "character_level": "< 筑基",
        "text_contains": ["雷光", "雷霆", "雷电"]
      },
      "error": {
        "message": "当前境界无法操控雷元素",
        "severity": "high"
      }
    }
  ]
}

3️⃣ Rule 字段说明
rule.type（固定枚举）
world_rule
power_level
character
timeline
pov
logic

rule.condition（MVP 可解析）
{
  "character_level": "< 筑基",
  "text_contains": ["关键词1", "关键词2"],
  "forbidden_actions": ["瞬移", "时间回溯"]
}

rule.error
{
  "message": "错误提示",
  "severity": "low | medium | high"
}

4️⃣ 多规则示例
{
  "rules": [
    {
      "id": "pov_consistency",
      "type": "pov",
      "description": "同一段落内不可切换人称",
      "condition": {
        "detect_pov_switch": true
      },
      "error": {
        "message": "段落内视角发生切换",
        "severity": "medium"
      }
    },
    {
      "id": "no_instant_heal",
      "type": "logic",
      "description": "重伤不可瞬间恢复",
      "condition": {
        "text_contains": ["瞬间痊愈", "立刻恢复如初"]
      },
      "error": {
        "message": "伤势恢复不合理",
        "severity": "high"
      }
    }
  ]
}

5️⃣ DSL 在系统中的位置
DSL(JSON)
  ↓
ConsistencyChecker
  ↓
LLM Checker Prompt
  ↓
结构化 errors
  ↓
Rewrite Agent

三、你现在已经具备的能力（非常关键）

到这一步，你的系统已经：

✅ 不是“补全文本”
✅ 有 写作规划能力
✅ 有 规则外化能力
✅ 有 自我修正闭环
✅ 可被工程化、测试、扩展