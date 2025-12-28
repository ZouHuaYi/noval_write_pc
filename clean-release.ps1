# 清理 release 目录的 PowerShell 脚本
# 使用方法：在 PowerShell（管理员）中运行：.\clean-release.ps1

$ErrorActionPreference = "Continue"

Write-Host "正在关闭相关进程..." -ForegroundColor Yellow

# 关闭所有相关进程
$processes = Get-Process | Where-Object {
    $_.ProcessName -like "*electron*" -or 
    $_.ProcessName -like "*node*" -or 
    $_.ProcessName -like "*小说*"
}

if ($processes) {
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "已关闭 $($processes.Count) 个相关进程" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "没有发现相关进程" -ForegroundColor Green
}

Write-Host "正在清理 release 目录..." -ForegroundColor Yellow

$releasePath = Join-Path $PSScriptRoot "release"
$releaseCleaned = $false

if (Test-Path $releasePath) {
    try {
        # 取消所有文件的只读属性
        Get-ChildItem -Path $releasePath -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                if ($_.PSIsContainer -eq $false) {
                    $_.Attributes = 'Normal'
                }
            } catch {
                # 忽略无法修改属性的文件
            }
        }
        
        # 尝试删除
        Remove-Item -Path $releasePath -Recurse -Force -ErrorAction Stop
        Write-Host "release 目录清理完成！" -ForegroundColor Green
        $releaseCleaned = $true
    } catch {
        Write-Host "警告：无法完全删除 release 目录，某些文件可能被占用" -ForegroundColor Yellow
        Write-Host "错误信息: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "建议：如果打包失败，请手动删除 release 目录后重试" -ForegroundColor Yellow
        $releaseCleaned = $false
    }
} else {
    Write-Host "release 目录不存在，无需清理" -ForegroundColor Green
    $releaseCleaned = $true
}

Write-Host "正在清理 dist 目录..." -ForegroundColor Yellow

$distPath = Join-Path $PSScriptRoot "dist"
$distCleaned = $false

if (Test-Path $distPath) {
    try {
        # 取消只读属性
        Get-ChildItem -Path $distPath -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                if ($_.PSIsContainer -eq $false) {
                    $_.Attributes = 'Normal'
                }
            } catch {
                # 忽略
            }
        }
        
        Remove-Item -Path $distPath -Recurse -Force -ErrorAction Stop
        Write-Host "dist 目录清理完成！" -ForegroundColor Green
        $distCleaned = $true
    } catch {
        Write-Host "警告：无法删除 dist 目录（不影响打包，build 会重新生成）" -ForegroundColor Yellow
        $distCleaned = $false
    }
} else {
    Write-Host "dist 目录不存在，无需清理" -ForegroundColor Green
    $distCleaned = $true
}

Write-Host ""
if ($releaseCleaned -and $distCleaned) {
    Write-Host "清理完成！可以开始打包了。" -ForegroundColor Green
} else {
    Write-Host "清理部分完成。如果打包时遇到文件占用错误，请手动删除相应目录。" -ForegroundColor Yellow
}

