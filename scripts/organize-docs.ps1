# 文档整理脚本
# 将文档分类移动到对应的子目录

Write-Host "开始整理文档目录..." -ForegroundColor Green

$ErrorActionPreference = "Continue"

# 定义文档分类映射
$docCategories = @{
    # 架构文档
    "architecture" = @(
        "Skill架构说明.md",
        "Skill架构迁移完成说明.md",
        "项目目录结构规划.md",
        "Agent架构升级说明.md",
        "职业级写作系统架构方案.md",
        "系统集成优化方案.md"
    )
    
    # 使用指南
    "guides" = @(
        "使用说明.md",
        "用户使用指南.md",
        "快速开始指南.md",
        "Agent快速入门.md",
        "Novel-Agent-使用指南.md",
        "Novel-Agent-快速行动指南.md",
        "DeepSeek使用指南.md",
        "功能测试指南.md",
        "常见问题与解决方案.md",
        "@文件功能使用说明.md"
    )
    
    # 更新日志
    "changelog" = @(
        "版本更新说明.md",
        "更新说明-DeepSeek优化.md",
        "更新说明-Phase2完成.md",
        "更新说明-Phase3完成-系统集成.md",
        "更新说明-UI集成完成.md",
        "更新说明-文件创建功能修复.md",
        "Novel-Agent-Phase2-完成.md",
        "Novel-Agent-Phase3-完成.md",
        "职业级写作系统Phase1完成.md"
    )
    
    # 其他文档（保留在根目录）
    "other" = @(
        "项目优化总结.md",
        "项目功能分析与完善建议.md",
        "项目功能清单与差距分析.md",
        "系统优化完成报告.md",
        "系统集成优化完成报告.md",
        "系统集成优化进度.md",
        "职业级写作系统实现进度.md",
        "Novel-Agent-实现方案.md",
        "Novel-Agent-实现进度.md",
        "Novel-Agent-性能优化建议.md",
        "Novel-Agent-项目完成总结.md",
        "Agent功能说明.md",
        "Agent效果问题诊断与改进方案.md",
        "Agent文件创建功能修复说明.md",
        "Agent流程优化说明.md",
        "Agent能力增强说明.md",
        "Agent重构说明.md",
        "Agent错误修复说明.md",
        "Agent问题修复说明.md",
        "DeepSeek-JSON解析优化完成.md",
        "DeepSeek优化说明.md",
        "Agent-DeepSeek优化总结.md",
        "UI完善说明.md",
        "任务拆分总结.md",
        "前面几章上下文修复说明.md",
        "功能完善度与联动分析报告.md",
        "快速改进清单.md",
        "提示-示例.md",
        "新功能实现总结.md",
        "日志系统使用说明.md",
        "日志系统改进总结.md",
        "智能上下文与记忆优化说明.md",
        "智能提取优化说明.md",
        "智能提取功能说明.md",
        "自动结算与性能优化实现说明.md",
        "规则文件路径修复说明.md",
        "记忆系统修复说明.md",
        "记忆系统初始化问题排查.md",
        "记忆系统自动初始化修复说明.md",
        "立即打包.md"
    )
}

$movedCount = 0
$skippedCount = 0

foreach ($category in $docCategories.Keys) {
    $targetDir = "docs\$category"
    
    # 确保目标目录存在
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    
    foreach ($filename in $docCategories[$category]) {
        $sourcePath = "docs\$filename"
        $targetPath = "$targetDir\$filename"
        
        if (Test-Path $sourcePath) {
            Move-Item -Path $sourcePath -Destination $targetPath -Force
            Write-Host "✓ 移动: $filename -> $category/" -ForegroundColor Green
            $movedCount++
        } else {
            Write-Host "⚠ 跳过: $filename (文件不存在)" -ForegroundColor Yellow
            $skippedCount++
        }
    }
}

Write-Host ""
Write-Host "完成! 移动了 $movedCount 个文档, 跳过了 $skippedCount 个文档" -ForegroundColor Cyan

