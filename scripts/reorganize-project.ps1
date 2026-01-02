# 项目目录重组脚本
# 用于将项目文件移动到新的目录结构

Write-Host "开始重组项目目录结构..." -ForegroundColor Green

$ErrorActionPreference = "Stop"

# 定义文件移动映射
$fileMoves = @(
    # Agent 模块重组
    @{ From = "electron\agent\chapterAnalyzer.js"; To = "electron\agent\modules\analysis\chapterAnalyzer.js" },
    @{ From = "electron\agent\intentAnalyzer.js"; To = "electron\agent\modules\analysis\intentAnalyzer.js" },
    @{ From = "electron\agent\eventExtractor.js"; To = "electron\agent\modules\analysis\eventExtractor.js" },
    
    @{ From = "electron\agent\chapterPlanner.js"; To = "electron\agent\modules\planning\chapterPlanner.js" },
    @{ From = "electron\agent\intentPlanner.js"; To = "electron\agent\modules\planning\intentPlanner.js" },
    @{ From = "electron\agent\sceneStructurePlanner.js"; To = "electron\agent\modules\planning\sceneStructurePlanner.js" },
    
    @{ From = "electron\agent\rewriter.js"; To = "electron\agent\modules\writing\rewriter.js" },
    
    @{ From = "electron\agent\consistencyChecker.js"; To = "electron\agent\modules\checking\consistencyChecker.js" },
    @{ From = "electron\agent\coherenceChecker.js"; To = "electron\agent\modules\checking\coherenceChecker.js" },
    
    @{ From = "electron\agent\pacingController.js"; To = "electron\agent\modules\control\pacingController.js" },
    @{ From = "electron\agent\emotionCurveManager.js"; To = "electron\agent\modules\control\emotionCurveManager.js" },
    @{ From = "electron\agent\densityController.js"; To = "electron\agent\modules\control\densityController.js" },
    
    @{ From = "electron\agent\contextLoader.js"; To = "electron\agent\modules\context\contextLoader.js" },
    @{ From = "electron\agent\fileScanner.js"; To = "electron\agent\modules\context\fileScanner.js" },
    @{ From = "electron\agent\memoryUpdater.js"; To = "electron\agent\modules\context\memoryUpdater.js" },
    
    # Skill 系统重组
    @{ From = "electron\agent\skills\skillDefinitions.json"; To = "electron\agent\skills\definitions\skillDefinitions.json" },
    @{ From = "electron\agent\skills\skillExecutor.js"; To = "electron\agent\skills\core\skillExecutor.js" },
    @{ From = "electron\agent\skills\skillRouter.js"; To = "electron\agent\skills\core\skillRouter.js" },
    
    # 核心模块重组
    @{ From = "electron\database.js"; To = "electron\core\database.js" },
    @{ From = "electron\llm.js"; To = "electron\core\llm.js" },
    
    # 记忆系统重组
    @{ From = "electron\memory\worldMemory.js"; To = "electron\memory\core\worldMemory.js" },
    @{ From = "electron\memory\characterMemory.js"; To = "electron\memory\core\characterMemory.js" },
    @{ From = "electron\memory\plotMemory.js"; To = "electron\memory\core\plotMemory.js" },
    @{ From = "electron\memory\foreshadowMemory.js"; To = "electron\memory\core\foreshadowMemory.js" },
    @{ From = "electron\memory\settingExtractor.js"; To = "electron\memory\extractors\settingExtractor.js" },
    @{ From = "electron\memory\intelligentExtractor.js"; To = "electron\memory\extractors\intelligentExtractor.js" },
    @{ From = "electron\memory\extractWriter.js"; To = "electron\memory\extractors\extractWriter.js" },
    @{ From = "electron\memory\chapterFileManager.js"; To = "electron\memory\managers\chapterFileManager.js" },
    @{ From = "electron\memory\fileStateManager.js"; To = "electron\memory\managers\fileStateManager.js" },
    
    # 配置文件移动
    @{ From = "vite.config.mts"; To = "config\vite.config.mts" },
    @{ From = "clean-release.ps1"; To = "scripts\clean-release.ps1" }
)

# 移动文件
$movedCount = 0
$skippedCount = 0

foreach ($move in $fileMoves) {
    $fromPath = $move.From
    $toPath = $move.To
    
    if (Test-Path $fromPath) {
        $toDir = Split-Path $toPath -Parent
        if (-not (Test-Path $toDir)) {
            New-Item -ItemType Directory -Path $toDir -Force | Out-Null
        }
        
        Move-Item -Path $fromPath -Destination $toPath -Force
        Write-Host "✓ 移动: $fromPath -> $toPath" -ForegroundColor Green
        $movedCount++
    } else {
        Write-Host "⚠ 跳过: $fromPath (文件不存在)" -ForegroundColor Yellow
        $skippedCount++
    }
}

Write-Host ""
Write-Host "完成! 移动了 $movedCount 个文件, 跳过了 $skippedCount 个文件" -ForegroundColor Cyan
Write-Host ""
Write-Host "注意: 请手动更新所有文件中的引用路径!" -ForegroundColor Yellow

