/**
 * Novel Agent 测试脚本
 * 用于在浏览器 Console 中测试 Novel Agent 功能
 * 
 * 使用方法：
 * 1. 打开应用并打开 DevTools Console
 * 2. 将此文件内容复制到 Console
 * 3. 运行测试函数
 */

// ==================== 测试配置 ====================
const TEST_WORKSPACE = 'E:\\aiApi\\write_plat_edit'; // 修改为你的工作区路径

// ==================== 测试工具函数 ====================
const testLogger = {
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  info: (msg) => console.log(`ℹ️ ${msg}`),
  section: (msg) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`)
};

// ==================== 测试 1: 记忆系统 ====================
async function testMemorySystem() {
  testLogger.section('测试 1: 记忆系统');
  
  try {
    // 1. 初始化记忆系统
    testLogger.info('初始化记忆系统...');
    const initResult = await window.api.memory.init(TEST_WORKSPACE);
    if (!initResult.success) {
      testLogger.error(`初始化失败: ${initResult.error}`);
      return false;
    }
    testLogger.success('记忆系统初始化成功');
    
    // 2. 获取记忆摘要
    testLogger.info('获取记忆摘要...');
    const summaryResult = await window.api.memory.getSummary();
    if (!summaryResult.success) {
      testLogger.error(`获取摘要失败: ${summaryResult.error}`);
      return false;
    }
    testLogger.success('记忆摘要获取成功');
    console.log('摘要内容:', summaryResult.summary);
    
    // 3. 添加测试角色
    testLogger.info('添加测试角色...');
    const charResult = await window.api.memory.addCharacter({
      name: '测试角色_' + Date.now(),
      role: 'protagonist',
      personality: {
        traits: ['勇敢', '智慧'],
        forbidden_traits: ['懦弱']
      },
      current_state: {
        level: '练气初期',
        location: '测试地点'
      }
    });
    if (!charResult.success) {
      testLogger.error(`添加角色失败: ${charResult.error}`);
      return false;
    }
    testLogger.success(`角色添加成功，ID: ${charResult.id}`);
    
    // 4. 获取所有角色
    testLogger.info('获取所有角色...');
    const charsResult = await window.api.memory.getAllCharacters();
    if (!charsResult.success) {
      testLogger.error(`获取角色列表失败: ${charsResult.error}`);
      return false;
    }
    testLogger.success(`获取到 ${charsResult.characters.length} 个角色`);
    console.log('角色列表:', charsResult.characters);
    
    // 5. 添加测试伏笔
    testLogger.info('添加测试伏笔...');
    const foreshadowResult = await window.api.memory.addForeshadow({
      title: '测试伏笔_' + Date.now(),
      content: '这是一个测试伏笔的内容',
      importance: 'normal',
      introduced_at: {
        chapter: 1,
        paragraph: '测试段落'
      }
    });
    if (!foreshadowResult.success) {
      testLogger.error(`添加伏笔失败: ${foreshadowResult.error}`);
      return false;
    }
    testLogger.success(`伏笔添加成功，ID: ${foreshadowResult.id}`);
    
    // 6. 查询记忆
    testLogger.info('查询记忆...');
    const queryResult = await window.api.memory.query('测试');
    if (!queryResult.success) {
      testLogger.error(`查询失败: ${queryResult.error}`);
      return false;
    }
    testLogger.success('查询成功');
    console.log('查询结果:', queryResult.results);
    
    testLogger.success('记忆系统测试通过！');
    return true;
  } catch (err) {
    testLogger.error(`记忆系统测试失败: ${err.message}`);
    console.error(err);
    return false;
  }
}

// ==================== 测试 2: Novel Agent ====================
async function testNovelAgent() {
  testLogger.section('测试 2: Novel Agent');
  
  try {
    // 1. 初始化 Agent
    testLogger.info('初始化 Novel Agent...');
    const initResult = await window.api.novelAgent.init(TEST_WORKSPACE);
    if (!initResult.success) {
      testLogger.error(`初始化失败: ${initResult.error}`);
      return false;
    }
    testLogger.success('Agent 初始化成功');
    
    // 2. 获取 Agent 状态
    testLogger.info('获取 Agent 状态...');
    const stateResult = await window.api.novelAgent.getState();
    if (!stateResult.success) {
      testLogger.error(`获取状态失败: ${stateResult.error}`);
      return false;
    }
    testLogger.success(`当前状态: ${stateResult.state}`);
    
    // 3. 执行简单任务（注意：这会调用 LLM，确保已配置）
    testLogger.info('执行测试任务...');
    testLogger.info('⚠️ 此步骤会调用 LLM，如果未配置 LLM 可能会失败');
    
    const executeResult = await window.api.novelAgent.execute({
      userRequest: '这是一个测试请求，请简单回复确认收到'
    });
    
    if (!executeResult.success) {
      testLogger.error(`执行失败: ${executeResult.error}`);
      // Agent 执行失败不算整体测试失败（可能是 LLM 未配置）
      testLogger.info('Agent 执行失败，可能是 LLM 未配置，跳过此测试');
    } else {
      testLogger.success('Agent 执行成功');
      console.log('执行结果:', {
        hasText: !!executeResult.text,
        textLength: executeResult.text?.length,
        rewriteCount: executeResult.rewriteCount,
        checkStatus: executeResult.checkResult?.status
      });
    }
    
    // 4. 获取执行日志
    testLogger.info('获取执行日志...');
    const logResult = await window.api.novelAgent.getLog(5);
    if (!logResult.success) {
      testLogger.error(`获取日志失败: ${logResult.error}`);
      return false;
    }
    testLogger.success(`获取到 ${logResult.log.length} 条日志`);
    console.log('执行日志:', logResult.log);
    
    testLogger.success('Novel Agent 测试通过！');
    return true;
  } catch (err) {
    testLogger.error(`Novel Agent 测试失败: ${err.message}`);
    console.error(err);
    return false;
  }
}

// ==================== 测试 3: 规则系统 ====================
async function testRulesSystem() {
  testLogger.section('测试 3: 规则系统');
  
  try {
    // 1. 获取所有规则
    testLogger.info('获取所有规则...');
    const rulesResult = await window.api.rules.getAll();
    if (!rulesResult.success) {
      testLogger.error(`获取规则失败: ${rulesResult.error}`);
      return false;
    }
    testLogger.success(`获取到 ${rulesResult.rules.length} 条规则`);
    console.log('规则列表:', rulesResult.rules);
    
    // 2. 获取规则统计
    testLogger.info('获取规则统计...');
    const statsResult = await window.api.rules.getStats();
    if (!statsResult.success) {
      testLogger.error(`获取统计失败: ${statsResult.error}`);
      return false;
    }
    testLogger.success('规则统计获取成功');
    console.log('统计信息:', statsResult.stats);
    
    // 3. 重新加载规则
    testLogger.info('重新加载规则...');
    const reloadResult = await window.api.rules.reload();
    if (!reloadResult.success) {
      testLogger.error(`重新加载失败: ${reloadResult.error}`);
      return false;
    }
    testLogger.success('规则重新加载成功');
    
    testLogger.success('规则系统测试通过！');
    return true;
  } catch (err) {
    testLogger.error(`规则系统测试失败: ${err.message}`);
    console.error(err);
    return false;
  }
}

// ==================== 运行所有测试 ====================
async function runAllTests() {
  console.clear();
  testLogger.section('🚀 Novel Agent 完整测试');
  
  testLogger.info(`工作区路径: ${TEST_WORKSPACE}`);
  testLogger.info('开始测试...\n');
  
  const results = {
    memory: false,
    agent: false,
    rules: false
  };
  
  // 测试 1: 记忆系统
  results.memory = await testMemorySystem();
  await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
  
  // 测试 2: Novel Agent
  results.agent = await testNovelAgent();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试 3: 规则系统
  results.rules = await testRulesSystem();
  
  // 总结
  testLogger.section('📊 测试总结');
  console.log('测试结果:');
  console.log(`  记忆系统: ${results.memory ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  Novel Agent: ${results.agent ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  规则系统: ${results.rules ? '✅ 通过' : '❌ 失败'}`);
  
  const allPassed = results.memory && results.agent && results.rules;
  
  if (allPassed) {
    testLogger.success('\n🎉 所有测试通过！Novel Agent 系统运行正常！');
  } else {
    testLogger.error('\n⚠️ 部分测试失败，请检查错误信息');
  }
  
  return results;
}

// ==================== 快速测试函数 ====================
async function quickTest() {
  testLogger.section('⚡ 快速测试');
  
  try {
    // 只测试基本功能
    testLogger.info('测试记忆系统初始化...');
    const memResult = await window.api.memory.init(TEST_WORKSPACE);
    testLogger.success(`记忆系统: ${memResult.success ? '✅' : '❌'}`);
    
    testLogger.info('测试 Agent 初始化...');
    const agentResult = await window.api.novelAgent.init(TEST_WORKSPACE);
    testLogger.success(`Agent: ${agentResult.success ? '✅' : '❌'}`);
    
    testLogger.info('测试规则系统...');
    const rulesResult = await window.api.rules.getAll();
    testLogger.success(`规则系统: ${rulesResult.success ? '✅' : '❌'}`);
    
    if (memResult.success && agentResult.success && rulesResult.success) {
      testLogger.success('\n✅ 快速测试通过！系统基本功能正常');
    } else {
      testLogger.error('\n❌ 快速测试失败，请运行 runAllTests() 获取详细信息');
    }
  } catch (err) {
    testLogger.error(`快速测试失败: ${err.message}`);
    console.error(err);
  }
}

// ==================== 导出测试函数 ====================
console.log(`
╔════════════════════════════════════════════════════════════╗
║           Novel Agent 测试工具已加载                       ║
╚════════════════════════════════════════════════════════════╝

可用的测试函数：

1. quickTest()           - 快速测试（推荐先运行）
2. runAllTests()         - 完整测试（包含所有功能）
3. testMemorySystem()    - 单独测试记忆系统
4. testNovelAgent()      - 单独测试 Novel Agent
5. testRulesSystem()     - 单独测试规则系统

使用方法：
  在 Console 中输入函数名并回车，例如：
  > quickTest()

注意：
  - 请先修改 TEST_WORKSPACE 为你的实际工作区路径
  - Agent 执行测试需要配置 LLM，否则会跳过
`);

