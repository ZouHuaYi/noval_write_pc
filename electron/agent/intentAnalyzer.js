/**
 * Intent Analyzer - 意图分析器
 * 先理解用户输入的意图，然后规划执行流程
 */

const { safeParseJSON } = require('../utils/jsonParser');

class IntentAnalyzer {
  constructor() {
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词
   */
  buildSystemPrompt() {
    return `你是一个【小说写作意图分析程序】。

⚠️ 系统规则（必须遵守）：
1. 你只能输出 JSON
2. JSON 必须是完整、可解析的
3. 不要输出任何解释、说明、注释
4. 不要使用 Markdown
5. 不要在 JSON 外输出任何字符

你必须且只能在 <json> 和 </json> 之间输出内容。

# 核心任务
分析用户的写作需求，识别其真实意图，并规划执行流程。

# 意图类型定义

## 1. 续写（CONTINUE）
- 用户想要继续写新的章节
- 关键词：续写、继续、接下来、下一章、新章节
- 示例：
  - "续写第11章"
  - "继续写下一章"
  - "接下来会发生什么"

## 2. 重写（REWRITE）
- 用户想要修改已有的章节内容
- 关键词：重写、修改、改写、优化、修正、调整、改进
- 示例：
  - "重写第5章"
  - "修改第3章的人物性格描写"
  - "优化第8章的对话"
  - "修正第10章中的世界观冲突"

## 3. 校验（CHECK）
- 用户想要检查一致性或质量
- 关键词：校验、检查、审核、评估、分析
- 示例：
  - "检查第5章的一致性"
  - "校验人物性格是否一致"
  - "分析第10章的质量"

## 4. 创建（CREATE）
- 用户想要创建新的章节或内容
- 关键词：创建、新建、写、开始
- 示例：
  - "创建第1章"
  - "新建一个章节"
  - "开始写第一章"

# 输出格式
<json>
{
  "intent_type": "CONTINUE" | "REWRITE" | "CHECK" | "CREATE",
  "target_chapter": 章节号（数字，如果没有则为 null）,
  "target_file": "文件名（如果有 @文件名 引用）",
  "operation_scope": "full" | "partial",
  "focus_areas": ["要关注的重点领域"],
  "requirements": {
    "must_do": ["必须执行的操作"],
    "must_not_do": ["禁止执行的操作"]
  },
  "execution_plan": {
    "steps": ["执行步骤1", "执行步骤2", ...],
    "needs_existing_content": true/false,
    "needs_context_analysis": true/false,
    "needs_consistency_check": true/false
  },
  "reasoning": "分析理由（简短）"
}
</json>

# 关键规则
1. **准确识别意图**：仔细分析用户需求，区分续写、重写、校验、创建
2. **提取目标信息**：准确提取章节号、文件名等目标信息
3. **规划执行流程**：根据意图类型规划合理的执行步骤
4. **明确约束条件**：识别用户明确要求的操作和禁止的操作

# 输出示例

示例1：续写
<json>
{
  "intent_type": "CONTINUE",
  "target_chapter": 11,
  "target_file": null,
  "operation_scope": "full",
  "focus_areas": ["情节推进", "人物发展"],
  "requirements": {
    "must_do": ["续写新章节", "保持与前文连贯"],
    "must_not_do": ["修改已有章节"]
  },
  "execution_plan": {
    "steps": ["加载上下文", "分析前文", "规划新章节", "生成初稿", "校验", "更新记忆"],
    "needs_existing_content": false,
    "needs_context_analysis": true,
    "needs_consistency_check": true
  },
  "reasoning": "用户要求续写第11章，需要分析前文并创建新内容"
}
</json>

示例2：重写
<json>
{
  "intent_type": "REWRITE",
  "target_chapter": 5,
  "target_file": "第005章.txt",
  "operation_scope": "partial",
  "focus_areas": ["人物性格", "对话优化"],
  "requirements": {
    "must_do": ["读取现有内容", "修改指定部分", "保持整体结构"],
    "must_not_do": ["创建新章节", "删除现有内容"]
  },
  "execution_plan": {
    "steps": ["加载上下文", "读取目标文件", "分析现有内容", "规划修改", "生成修改版本", "校验", "更新记忆"],
    "needs_existing_content": true,
    "needs_context_analysis": true,
    "needs_consistency_check": true
  },
  "reasoning": "用户要求重写第5章，需要先读取现有内容再进行修改"
}
</json>

示例3：校验
<json>
{
  "intent_type": "CHECK",
  "target_chapter": 10,
  "target_file": "第010章.txt",
  "operation_scope": "full",
  "focus_areas": ["一致性", "人物性格", "世界观"],
  "requirements": {
    "must_do": ["读取文件", "执行校验", "生成报告"],
    "must_not_do": ["修改内容", "创建新内容"]
  },
  "execution_plan": {
    "steps": ["读取目标文件", "加载上下文", "执行一致性校验", "生成校验报告"],
    "needs_existing_content": true,
    "needs_context_analysis": true,
    "needs_consistency_check": true
  },
  "reasoning": "用户要求校验第10章，只需要检查不需要修改"
}
</json>`;
  }

  /**
   * 分析用户意图
   * @param {string} userRequest - 用户需求
   * @param {string} targetFile - 目标文件（如果有 @文件名 引用）
   * @param {Function} llmCaller - LLM 调用函数
   */
  async analyze(userRequest, targetFile, llmCaller) {
    try {
      console.log('🔍 开始分析用户意图...');

      // 构建用户提示词
      const userPrompt = this.buildUserPrompt(userRequest, targetFile);

      // 调用 LLM 分析意图
      const result = await llmCaller({
        systemPrompt: this.systemPrompt,
        userPrompt,
        temperature: 0.2, // 低温度，保证准确性
        maxTokens: 1500
      });

      if (!result.success || !result.response) {
        throw new Error('LLM 调用失败: ' + (result.error || '无响应'));
      }

      // 解析意图
      const intent = this.parseIntent(result.response);

      // 验证意图
      this.validateIntent(intent);

      // 如果用户指定了 @文件名，优先使用
      if (targetFile && !intent.target_file) {
        intent.target_file = targetFile;
      }

      console.log('✅ 意图分析完成:', intent.intent_type);
      return intent;

    } catch (error) {
      console.error('❌ 意图分析失败:', error);
      // 返回默认意图（基于关键词匹配）
      return this.getDefaultIntent(userRequest, targetFile);
    }
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(userRequest, targetFile) {
    let prompt = `# 用户需求\n${userRequest}\n\n`;

    if (targetFile) {
      prompt += `# 目标文件\n用户通过 @文件名 指定了目标文件：${targetFile}\n\n`;
    }

    // 提取章节号（如果存在）
    const chapterMatch = userRequest.match(/第\s*(\d+)(?:[-到]\s*(\d+))?\s*章/);
    if (chapterMatch) {
      prompt += `# 章节信息\n检测到章节号：第${chapterMatch[1]}章\n\n`;
    }

    prompt += `# 任务\n请分析用户的真实意图，识别是续写、重写、校验还是创建，并规划执行流程。返回纯 JSON 格式。`;

    return prompt;
  }

  /**
   * 解析意图
   */
  parseIntent(response) {
    try {
      const intent = safeParseJSON(response, {
        useSentinel: true,
        sentinelStart: '<json>',
        sentinelEnd: '</json>',
        fallbackExtract: true
      });
      
      console.log('✅ 意图解析成功');
      return intent;
    } catch (e) {
      console.error('❌ 意图解析失败:', e.message);
      console.error('原始响应:', response.substring(0, 500));
      throw new Error(`无法解析意图 JSON: ${e.message}`);
    }
  }

  /**
   * 验证意图
   */
  validateIntent(intent) {
    // 检查必需字段
    const requiredFields = ['intent_type', 'execution_plan'];
    for (const field of requiredFields) {
      if (!intent[field]) {
        throw new Error(`意图缺少必需字段: ${field}`);
      }
    }

    // 验证意图类型
    const validTypes = ['CONTINUE', 'REWRITE', 'CHECK', 'CREATE'];
    if (!validTypes.includes(intent.intent_type)) {
      throw new Error(`无效的意图类型: ${intent.intent_type}`);
    }

    // 确保 execution_plan 结构完整
    if (!intent.execution_plan.steps || !Array.isArray(intent.execution_plan.steps)) {
      intent.execution_plan.steps = [];
    }
    if (typeof intent.execution_plan.needs_existing_content !== 'boolean') {
      intent.execution_plan.needs_existing_content = false;
    }
    if (typeof intent.execution_plan.needs_context_analysis !== 'boolean') {
      intent.execution_plan.needs_context_analysis = true;
    }
    if (typeof intent.execution_plan.needs_consistency_check !== 'boolean') {
      intent.execution_plan.needs_consistency_check = true;
    }

    console.log('✅ 意图验证通过');
  }

  /**
   * 获取默认意图（基于关键词匹配）
   */
  getDefaultIntent(userRequest, targetFile) {
    console.log('⚠️ 使用默认意图（关键词匹配）');

    const lowerRequest = userRequest.toLowerCase();
    
    // 提取章节号
    let targetChapter = null;
    const chapterMatch = userRequest.match(/第\s*(\d+)(?:[-到]\s*(\d+))?\s*章/);
    if (chapterMatch) {
      targetChapter = parseInt(chapterMatch[1]);
    }

    // 判断意图类型
    let intentType = 'CONTINUE';
    if (lowerRequest.includes('重写') || lowerRequest.includes('改写') || 
        lowerRequest.includes('修改') || lowerRequest.includes('优化') || 
        lowerRequest.includes('修正') || lowerRequest.includes('调整') || 
        lowerRequest.includes('改进')) {
      intentType = 'REWRITE';
    } else if (lowerRequest.includes('校验') || lowerRequest.includes('检查') || 
               lowerRequest.includes('审核') || lowerRequest.includes('评估') || 
               lowerRequest.includes('分析')) {
      intentType = 'CHECK';
    } else if (lowerRequest.includes('创建') || lowerRequest.includes('新建') || 
               lowerRequest.includes('开始写')) {
      intentType = 'CREATE';
    }

    // 判断是否需要现有内容
    const needsExistingContent = intentType === 'REWRITE' || intentType === 'CHECK';

    return {
      intent_type: intentType,
      target_chapter: targetChapter,
      target_file: targetFile || null,
      operation_scope: needsExistingContent ? 'partial' : 'full',
      focus_areas: [],
      requirements: {
        must_do: [],
        must_not_do: []
      },
      execution_plan: {
        steps: needsExistingContent 
          ? ['加载上下文', '读取目标文件', '分析现有内容', '执行操作', '校验', '更新记忆']
          : ['加载上下文', '分析前文', '规划新章节', '生成初稿', '校验', '更新记忆'],
        needs_existing_content: needsExistingContent,
        needs_context_analysis: true,
        needs_consistency_check: true
      },
      reasoning: `基于关键词匹配，识别为${intentType}操作`
    };
  }
}

module.exports = IntentAnalyzer;

