# 检查所有路径引用的脚本

Write-Host "开始检查所有路径引用..." -ForegroundColor Green

$errors = @()

# 定义路径映射（旧路径 -> 新路径）
$pathMappings = @{
    # core 模块
    "require('./database')" = "require('../core/database')"
    "require('../database')" = "require('../core/database')"
    "require('./llm')" = "require('../core/llm')"
    "require('../llm')" = "require('../core/llm')"
    "require('../../llm')" = "require('../../core/llm')"
    
    # memory 模块
    "require('./worldMemory')" = "require('./core/worldMemory')"
    "require('./characterMemory')" = "require('./core/characterMemory')"
    "require('./plotMemory')" = "require('./core/plotMemory')"
    "require('./foreshadowMemory')" = "require('./core/foreshadowMemory')"
    "require('./settingExtractor')" = "require('./extractors/settingExtractor')"
    "require('./intelligentExtractor')" = "require('./extractors/intelligentExtractor')"
    "require('./extractWriter')" = "require('./extractors/extractWriter')"
    "require('./chapterFileManager')" = "require('./managers/chapterFileManager')"
    "require('./fileStateManager')" = "require('./managers/fileStateManager')"
    
    # agent 模块
    "require('./chapterAnalyzer')" = "require('./modules/analysis/chapterAnalyzer')"
    "require('./intentAnalyzer')" = "require('./modules/analysis/intentAnalyzer')"
    "require('./eventExtractor')" = "require('./modules/analysis/eventExtractor')"
    "require('./chapterPlanner')" = "require('./modules/planning/chapterPlanner')"
    "require('./intentPlanner')" = "require('./modules/planning/intentPlanner')"
    "require('./sceneStructurePlanner')" = "require('./modules/planning/sceneStructurePlanner')"
    "require('./rewriter')" = "require('./modules/writing/rewriter')"
    "require('./consistencyChecker')" = "require('./modules/checking/consistencyChecker')"
    "require('./coherenceChecker')" = "require('./modules/checking/coherenceChecker')"
    "require('./pacingController')" = "require('./modules/control/pacingController')"
    "require('./emotionCurveManager')" = "require('./modules/control/emotionCurveManager')"
    "require('./densityController')" = "require('./modules/control/densityController')"
    "require('./contextLoader')" = "require('./modules/context/contextLoader')"
    "require('./fileScanner')" = "require('./modules/context/fileScanner')"
    "require('./memoryUpdater')" = "require('./modules/context/memoryUpdater')"
    
    # skill 模块
    "require('./skillDefinitions.json')" = "require('../definitions/skillDefinitions.json')"
    "require('./skillExecutor')" = "require('../core/skillExecutor')"
    "require('./skillRouter')" = "require('../core/skillRouter')"
    
    # utils 路径
    "require('../utils/logger')" = "require('../../utils/logger')"  # 从 agent/modules 或 agent/skills
    "require('../utils/jsonParser')" = "require('../../utils/jsonParser')"
    "require('./utils/logger')" = "require('../utils/logger')"  # 从 core
    "require('./utils/jsonParser')" = "require('../utils/jsonParser')"
    
    # finalizer 路径（从 extractors）
    "require('./finalizer/extractCleaner')" = "require('../finalizer/extractCleaner')"
}

# 检查 electron 目录下的所有 JS 文件
$jsFiles = Get-ChildItem -Path "electron" -Recurse -Filter "*.js" | Where-Object { $_.FullName -notmatch "node_modules" }

foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    $lines = Get-Content $file.FullName
    
    foreach ($lineNum in 1..$lines.Count) {
        $line = $lines[$lineNum - 1]
        
        # 检查是否有 require 语句
        if ($line -match "require\(['""]([^'""]+)['""]\)") {
            $requirePath = $matches[1]
            
            # 检查是否是相对路径
            if ($requirePath -match "^\.\.?/") {
                # 检查文件是否存在
                $fileDir = Split-Path $file.FullName -Parent
                $resolvedPath = Join-Path $fileDir $requirePath
                
                # 尝试添加 .js 扩展名
                if (-not (Test-Path $resolvedPath)) {
                    $resolvedPath = "$resolvedPath.js"
                }
                
                # 如果文件不存在，记录错误
                if (-not (Test-Path $resolvedPath)) {
                    $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
                    $errors += "❌ $relativePath : $lineNum - require('$requirePath') - 文件不存在"
                }
            }
        }
    }
}

if ($errors.Count -eq 0) {
    Write-Host "✅ 所有路径引用检查通过！" -ForegroundColor Green
} else {
    Write-Host "`n发现 $($errors.Count) 个路径问题：" -ForegroundColor Yellow
    foreach ($error in $errors) {
        Write-Host $error -ForegroundColor Red
    }
}

Write-Host "`n检查完成！" -ForegroundColor Cyan

