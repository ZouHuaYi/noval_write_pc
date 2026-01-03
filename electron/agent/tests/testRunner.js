/**
 * Test Runner - 测试运行器
 * 自动化执行所有测试并生成报告
 */

const SkillValidator = require('./skillValidator');
const PlannerValidator = require('./plannerValidator');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class TestRunner {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || path.join(__dirname, '../../test-results'),
      verbose: options.verbose || false,
      ...options
    };
    this.results = {
      skillValidation: null,
      plannerValidation: null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 运行所有测试
   */
  async runAll() {
    console.log('🧪 开始运行测试套件...\n');

    try {
      // 1. Skill 验证
      console.log('📋 验证 Skill 定义和状态契约...');
      const skillValidator = new SkillValidator();
      this.results.skillValidation = skillValidator.generateReport();
      this.logResult('Skill 验证', this.results.skillValidation);

      // 2. Planner 验证（需要模拟 LLM）
      console.log('\n🧠 验证 Planner 规划逻辑...');
      const plannerValidator = new PlannerValidator();
      const mockLLMCaller = this.createMockLLMCaller();
      this.results.plannerValidation = await plannerValidator.validateAllIntents(mockLLMCaller);
      this.logResult('Planner 验证', this.results.plannerValidation);

      // 3. 生成报告
      await this.generateReport();

      // 4. 返回总结
      const summary = this.getSummary();
      console.log('\n' + '='.repeat(60));
      console.log('📊 测试总结');
      console.log('='.repeat(60));
      console.log(`总测试数: ${summary.total}`);
      console.log(`通过: ${summary.passed} ✅`);
      console.log(`失败: ${summary.failed} ❌`);
      console.log(`警告: ${summary.warnings} ⚠️`);
      console.log('='.repeat(60));

      return {
        success: summary.failed === 0,
        summary,
        results: this.results
      };

    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      throw error;
    }
  }

  /**
   * 运行快速测试（只验证 Skill）
   */
  async runQuick() {
    console.log('⚡ 运行快速测试...\n');

    const skillValidator = new SkillValidator();
    const result = skillValidator.generateReport();

    this.logResult('Skill 验证', result);

    return {
      success: result.errors.length === 0,
      result
    };
  }

  /**
   * 记录测试结果
   */
  logResult(name, result) {
    if (result.errors && result.errors.length > 0) {
      console.log(`❌ ${name}: ${result.errors.length} 个错误`);
      if (this.options.verbose) {
        result.errors.forEach(err => {
          console.log(`   - ${err.message || err.type}`);
        });
      }
    } else {
      console.log(`✅ ${name}: 通过`);
    }

    if (result.warnings && result.warnings.length > 0) {
      console.log(`⚠️  ${name}: ${result.warnings.length} 个警告`);
      if (this.options.verbose) {
        result.warnings.forEach(warn => {
          console.log(`   - ${warn.message || warn.type}`);
        });
      }
    }
  }

  /**
   * 生成测试报告
   */
  async generateReport() {
    const reportPath = path.join(
      this.options.outputDir,
      `test-report-${Date.now()}.json`
    );

    // 确保输出目录存在
    await fs.mkdir(this.options.outputDir, { recursive: true });

    // 生成 JSON 报告
    const report = {
      timestamp: this.results.timestamp,
      summary: this.getSummary(),
      results: this.results
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`\n📄 测试报告已保存: ${reportPath}`);

    // 生成 Markdown 报告
    const mdReportPath = reportPath.replace('.json', '.md');
    const mdReport = this.generateMarkdownReport(report);
    await fs.writeFile(mdReportPath, mdReport, 'utf-8');

    console.log(`📄 Markdown 报告已保存: ${mdReportPath}`);

    return { json: reportPath, markdown: mdReportPath };
  }

  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(report) {
    const { summary, results } = report;

    let md = `# 测试报告\n\n`;
    md += `**生成时间**: ${report.timestamp}\n\n`;
    md += `## 总结\n\n`;
    md += `- 总测试数: ${summary.total}\n`;
    md += `- 通过: ${summary.passed} ✅\n`;
    md += `- 失败: ${summary.failed} ❌\n`;
    md += `- 警告: ${summary.warnings} ⚠️\n\n`;

    // Skill 验证结果
    if (results.skillValidation) {
      md += `## Skill 验证\n\n`;
      md += `- 总 Skill 数: ${results.skillValidation.summary?.total || 0}\n`;
      md += `- 错误: ${results.skillValidation.errors?.length || 0}\n`;
      md += `- 警告: ${results.skillValidation.warnings?.length || 0}\n\n`;

      if (results.skillValidation.errors?.length > 0) {
        md += `### 错误列表\n\n`;
        results.skillValidation.errors.forEach(err => {
          md += `- **${err.skill || '全局'}**: ${err.message}\n`;
        });
        md += `\n`;
      }
    }

    // Planner 验证结果
    if (results.plannerValidation) {
      md += `## Planner 验证\n\n`;
      md += `- 验证的 Intent: ${Object.keys(results.plannerValidation.results || {}).length}\n`;
      md += `- 错误: ${results.plannerValidation.errors?.length || 0}\n\n`;

      if (results.plannerValidation.results) {
        md += `### Intent 验证结果\n\n`;
        for (const [intent, result] of Object.entries(results.plannerValidation.results)) {
          md += `#### ${intent}\n\n`;
          md += `- 状态: ${result.valid ? '✅ 通过' : '❌ 失败'}\n`;
          if (result.error) {
            md += `- 错误: ${result.error}\n`;
          }
          md += `\n`;
        }
      }
    }

    return md;
  }

  /**
   * 获取测试总结
   */
  getSummary() {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    // Skill 验证
    if (this.results.skillValidation) {
      total += this.results.skillValidation.summary?.total || 0;
      failed += this.results.skillValidation.errors?.length || 0;
      warnings += this.results.skillValidation.warnings?.length || 0;
      if (this.results.skillValidation.errors?.length === 0) {
        passed += 1;
      }
    }

    // Planner 验证
    if (this.results.plannerValidation) {
      const intentCount = Object.keys(this.results.plannerValidation.results || {}).length;
      total += intentCount;
      failed += this.results.plannerValidation.errors?.length || 0;
      const validIntents = Object.values(this.results.plannerValidation.results || {})
        .filter(r => r.valid).length;
      passed += validIntents;
    }

    return { total, passed, failed, warnings };
  }

  /**
   * 创建模拟 LLM 调用器
   */
  createMockLLMCaller() {
    return async (prompt) => {
      // 简单的模拟：返回一个基础规划
      return {
        response: JSON.stringify({
          steps: [
            {
              skill: 'load_story_context',
              produces: 'worldRules',
              reason: '模拟测试：加载上下文'
            }
          ]
        })
      };
    };
  }
}

module.exports = TestRunner;

