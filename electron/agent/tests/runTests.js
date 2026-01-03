/**
 * 测试入口文件
 * 可以直接运行: node electron/agent/tests/runTests.js
 */

const TestRunner = require('./testRunner');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const quick = args.includes('--quick') || args.includes('-q');
  const verbose = args.includes('--verbose') || args.includes('-v');

  const runner = new TestRunner({
    outputDir: path.join(__dirname, '../../test-results'),
    verbose
  });

  try {
    let result;
    if (quick) {
      result = await runner.runQuick();
    } else {
      result = await runner.runAll();
    }

    // 设置退出码
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = { main };

