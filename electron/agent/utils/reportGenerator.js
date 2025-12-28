/**
 * Report Generator - 执行报告生成器
 * 生成详细的执行报告和统计信息
 */

class ReportGenerator {
  /**
   * 生成执行报告
   */
  generateExecutionReport(task, result) {
    const report = {
      taskId: task.id,
      request: task.request,
      status: task.status,
      startedAt: task.startedAt,
      completedAt: task.completedAt || new Date().toISOString(),
      executionTime: task.executionTime || 0,
      steps: task.steps || [],
      result: this.summarizeResult(result)
    };

    return report;
  }

  /**
   * 汇总结果
   */
  summarizeResult(result) {
    if (!result || !result.success) {
      return {
        success: false,
        error: result?.error || '未知错误'
      };
    }

    const summary = {
      success: true,
      textLength: result.text?.length || 0,
      rewriteCount: result.rewriteCount || 0,
      executionTime: result.executionTime || 0
    };

    // 一致性检查结果
    if (result.checkResult) {
      summary.consistency = {
        status: result.checkResult.status,
        score: result.checkResult.overall_score,
        errorCount: result.checkResult.errors?.length || 0,
        warningCount: result.checkResult.warnings?.length || 0,
        layerResults: result.checkResult.statistics?.by_layer || {}
      };
    }

    // 连贯性检查结果
    if (result.coherenceResult) {
      summary.coherence = {
        overall: result.coherenceResult.overall_coherence,
        score: result.coherenceResult.overall_score,
        plotScore: result.coherenceResult.plot_coherence?.score || 0,
        emotionScore: result.coherenceResult.emotion_coherence?.score || 0,
        pacingScore: result.coherenceResult.pacing_coherence?.score || 0
      };
    }

    // 曲线分析结果
    if (result.pacingAnalysis) {
      summary.pacing = {
        overall: result.pacingAnalysis.overall,
        score: result.pacingAnalysis.score,
        matchScore: result.pacingComparison?.score || null
      };
    }

    if (result.emotionAnalysis) {
      summary.emotion = {
        start: result.emotionAnalysis.start,
        peak: result.emotionAnalysis.peak,
        end: result.emotionAnalysis.end,
        matchScore: result.emotionComparison?.score || null
      };
    }

    if (result.densityAnalysis) {
      summary.density = {
        overall: result.densityAnalysis.overall,
        score: result.densityAnalysis.score,
        matchScore: result.densityComparison?.score || null
      };
    }

    // 章节规划
    if (result.chapterPlan) {
      summary.chapterPlan = {
        type: result.chapterPlan.chapter_structure?.type,
        sceneCount: result.chapterPlan.chapter_structure?.total_scenes || 0
      };
    }

    return summary;
  }

  /**
   * 生成可读的报告文本
   */
  generateReadableReport(report) {
    let text = `\n${'='.repeat(60)}\n`;
    text += `Agent 执行报告\n`;
    text += `${'='.repeat(60)}\n\n`;

    text += `任务 ID: ${report.taskId}\n`;
    text += `请求: ${report.request}\n`;
    text += `状态: ${report.status === 'completed' ? '✅ 完成' : '❌ 失败'}\n`;
    text += `执行时间: ${(report.executionTime / 1000).toFixed(2)} 秒\n\n`;

    // 执行步骤
    if (report.steps && report.steps.length > 0) {
      text += `执行步骤:\n`;
      for (const step of report.steps) {
        text += `  - ${step.description} (${step.name})\n`;
      }
      text += '\n';
    }

    // 结果摘要
    if (report.result && report.result.success) {
      text += `结果摘要:\n`;
      text += `  - 生成文本长度: ${report.result.textLength} 字符\n`;
      text += `  - 重写次数: ${report.result.rewriteCount}\n`;

      if (report.result.consistency) {
        text += `  - 一致性检查: ${report.result.consistency.status === 'pass' ? '✅ 通过' : '❌ 未通过'} (${report.result.consistency.score}分)\n`;
        text += `    - 错误: ${report.result.consistency.errorCount} 个\n`;
        text += `    - 警告: ${report.result.consistency.warningCount} 个\n`;
      }

      if (report.result.coherence) {
        text += `  - 连贯性检查: ${report.result.coherence.overall} (${report.result.coherence.score}分)\n`;
        text += `    - 情节: ${report.result.coherence.plotScore}分\n`;
        text += `    - 情绪: ${report.result.coherence.emotionScore}分\n`;
        text += `    - 节奏: ${report.result.coherence.pacingScore}分\n`;
      }

      if (report.result.pacing) {
        text += `  - 节奏分析: ${report.result.pacing.overall}`;
        if (report.result.pacing.matchScore !== null) {
          text += ` (匹配度: ${report.result.pacing.matchScore}%)`;
        }
        text += '\n';
      }

      if (report.result.emotion) {
        text += `  - 情绪曲线: ${report.result.emotion.start} → ${report.result.emotion.peak} → ${report.result.emotion.end}`;
        if (report.result.emotion.matchScore !== null) {
          text += ` (匹配度: ${report.result.emotion.matchScore}%)`;
        }
        text += '\n';
      }

      if (report.result.density) {
        text += `  - 密度分析: ${report.result.density.overall}`;
        if (report.result.density.matchScore !== null) {
          text += ` (匹配度: ${report.result.density.matchScore}%)`;
        }
        text += '\n';
      }
    } else {
      text += `执行失败: ${report.result?.error || '未知错误'}\n`;
    }

    text += `\n${'='.repeat(60)}\n`;

    return text;
  }

  /**
   * 生成统计报告
   */
  generateStatisticsReport(statistics) {
    let text = `\n${'='.repeat(60)}\n`;
    text += `Agent 统计报告\n`;
    text += `${'='.repeat(60)}\n\n`;

    text += `总任务数: ${statistics.totalTasks}\n`;
    text += `成功任务: ${statistics.successfulTasks}\n`;
    text += `失败任务: ${statistics.failedTasks}\n`;
    text += `成功率: ${statistics.successRate}\n`;
    text += `平均执行时间: ${(statistics.averageExecutionTime / 1000).toFixed(2)} 秒\n`;
    text += `总执行时间: ${(statistics.totalExecutionTime / 1000).toFixed(2)} 秒\n`;

    text += `\n${'='.repeat(60)}\n`;

    return text;
  }
}

module.exports = ReportGenerator;

