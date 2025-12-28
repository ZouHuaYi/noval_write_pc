好，那我**直接替你选最关键、最能“质变”的一步**来继续：

> **X = ① 把 CHECK_CONSISTENCY 升级为「规则引擎 DSL + 状态机校验」**

这是**你现有系统的“分水岭”**：
从「靠 prompt + 模型判断」➡️「像编译器一样判定小说是否合法」。

下面我会**完全贴合你已有 6 步流程**，不是另起炉灶。

---

## 一、先给你一句总定义（很重要）

> **CHECK_CONSISTENCY 不再“检查文本”**
>
> 而是：
> **验证「文本 + Intent + 状态迁移」是否满足一组可执行规则**

规则 = 小说的“类型系统 + 约束系统”。

---

## 二、CHECK_CONSISTENCY 的新职责拆分（从 1 层 → 4 层）

你现在的 CHECK_CONSISTENCY 是一坨，我们拆成 4 个明确阶段：

```
CHECK_CONSISTENCY
├─ 1. TextRuleCheck        （文本层）
├─ 2. StateRuleCheck       （状态层）
├─ 3. IntentContractCheck  （契约层）
└─ 4. ArcProgressCheck     （叙事推进层）
```

只要 **任一层失败 → REWRITE**。

---

## 三、核心升级：规则引擎 DSL（重点）

### 1️⃣ 规则不是 prompt，而是“可执行结构”

#### ❌ 旧方式

```txt
请确保人物性格一致，不要复活角色
```

#### ✅ 新方式（DSL）

```json
{
  "id": "NO_REVIVE",
  "type": "STATE_RULE",
  "when": "AFTER_CHAPTER",
  "assert": {
    "forbid": {
      "character.state_transition": "Dead -> Alive"
    }
  },
  "level": "FATAL"
}
```

---

## 四、完整规则分类（直接可落地）

### 🧱 1. 世界观规则（World Rules）

**永远强制**

```json
{
  "id": "NO_TIME_REVERSAL",
  "scope": "WORLD",
  "assert": "event.type != TIME_REVERSE",
  "level": "FATAL"
}
```

---

### 👤 2. 人物规则（Character Rules）

```json
{
  "id": "CHARACTER_TRAIT_LOCK",
  "scope": "CHARACTER",
  "assert": {
    "if": "character.traits.contains('冷静')",
    "then": "text.emotion != '失控咆哮'"
  },
  "level": "ERROR"
}
```

---

### 📜 3. 历史一致性规则（History Rules）

```json
{
  "id": "NO_RETCON",
  "scope": "HISTORY",
  "assert": "event.must_not_contradict(history)",
  "level": "FATAL"
}
```

---

### 🎯 4. Intent 契约规则（这是你系统的独特优势）

```json
{
  "id": "INTENT_CONTRACT",
  "scope": "INTENT",
  "assert": {
    "must_fulfill": [
      "intent.goal"
    ],
    "must_not_violate": [
      "intent.constraints"
    ]
  },
  "level": "FATAL"
}
```

👉 **这是普通小说 Agent 完全没有的能力**

---

### 🔥 5. Arc 推进规则（防水文神器）

```json
{
  "id": "ARC_MUST_PROGRESS",
  "scope": "ARC",
  "assert": {
    "arc.phase": "must_change_or_intensify"
  },
  "level": "ERROR"
}
```

---

## 五、CHECK_CONSISTENCY 的真实执行顺序（非常重要）

```
WRITE_DRAFT 完成
   │
   ▼
事件抽取（临时，不写回）
   │
   ▼
规则引擎（Dry Run）
   │
   ├─ FATAL → REWRITE（强制）
   ├─ ERROR → REWRITE（可解释）
   └─ WARN  → 记录但允许
```

👉 **记忆仍然是“未污染态”**

---

## 六、规则引擎与状态机的配合（关键）

### 状态机只关心一件事：

```ts
if (ruleEngine.hasFatalError()) {
  state = ChapterDrafted
} else {
  state = ChapterValidated
}
```

模型 **永远不能直接进入 UPDATE_MEMORY**。

---

## 七、REWRITE 不再是“重写全文”，而是“定向修复”

你现在可以升级为：

```json
{
  "rewrite_reason": [
    {
      "rule": "NO_REVIVE",
      "message": "角色已死亡，不允许复活"
    }
  ],
  "rewrite_scope": "scene_3",
  "rewrite_goal": "保留紧张感，但移除复活情节"
}
```

👉 **REWRITE 变成可控工具，而不是赌博**

---

## 八、你现在系统的“真实形态”

到这一步，你的系统已经是：

> **小说 = 一段文本
>
> * 一次 Intent 契约
> * 一次状态迁移
> * 一次规则验证**

这已经**非常接近“文学编译器”**了。

---

## 九、下一步（这次我仍然给你选项，但层级更高）

接下来有 3 条**同等级、不同方向**的进化路线：

1️⃣ **章节级 Planner + 段落级 Writer（分层 Agent）**
2️⃣ **多状态机并行（主线 / 支线 / 人物线）**
3️⃣ **可视化规则编辑器（IDE 核心卖点）**

你还是只回一个字母即可：
👉 **“下一步，做 1 / 2 / 3”**

我会继续**直接帮你往“能卖、能吹、能跑百万字”的方向推进**。
