#requires -Version 7.0
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $PSScriptRoot '浩哥工作台-AI交接包.zip'
$manifestPath = Join-Path $PSScriptRoot '文件清单及校验值.txt'
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$buildRoot = Join-Path $tempBase ('haoge-ai-handoff-' + [guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $buildRoot 'haoge-workspace-ai-handoff'

$files = @(
    'index.html',
    'README.md',
    'tests/tax-integration.test.cjs',
    'haoge-src/浩哥工作台.html',
    'haoge-src/tests/workbench.test.cjs',
    'docs/superpowers/specs/2026-09-19-tax-exam-integration-design.md',
    'docs/superpowers/specs/2026-09-19-tax-law-two-practice-study-design.md',
    'docs/superpowers/specs/2026-09-19-tax-subject-switch-and-ai-handoff-design.md'
)
$directories = @('tax-law-one', 'tax-law-two', 'tax-service-practice', 'study')
$handoffDocs = @('从这里开始.md', '给其他AI的接手提示.md', '项目状态与架构.md', '测试与部署清单.md')

function Copy-RelativeFile([string]$relativePath) {
    $source = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "缺少交接文件：$relativePath" }
    $destination = Join-Path $packageRoot $relativePath
    $destinationDirectory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
}

try {
    New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
    foreach ($file in $files) { Copy-RelativeFile $file }

    foreach ($directory in $directories) {
        $source = Join-Path $repoRoot $directory
        if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "缺少交接目录：$directory" }
        Copy-Item -LiteralPath $source -Destination $packageRoot -Recurse
    }

    $handoffDestination = Join-Path $packageRoot 'handoff-docs'
    New-Item -ItemType Directory -Path $handoffDestination -Force | Out-Null
    foreach ($doc in $handoffDocs) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $doc) -Destination (Join-Path $handoffDestination $doc)
    }

    $rows = Get-ChildItem -LiteralPath $packageRoot -File -Recurse | Sort-Object FullName | ForEach-Object {
        $relative = [IO.Path]::GetRelativePath($packageRoot, $_.FullName).Replace('\', '/')
        $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        '{0}  {1}  {2} bytes' -f $hash, $relative, $_.Length
    }
    $packageManifest = @(
        '浩哥工作台 AI 交接包文件清单',
        'SHA-256  相对路径  大小',
        ''
    ) + $rows
    Set-Content -LiteralPath (Join-Path $packageRoot 'PACKAGE-CONTENTS.txt') -Value $packageManifest -Encoding utf8

    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Compress-Archive -LiteralPath $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal
    $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $outerManifest = @(
        '浩哥工作台 AI 交接包校验清单',
        ('生成时间：' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')),
        ('ZIP SHA-256：' + $zipHash),
        ('ZIP 大小：' + (Get-Item -LiteralPath $zipPath).Length + ' bytes'),
        '',
        'ZIP 内源码文件：',
        'SHA-256  相对路径  大小',
        ''
    ) + $rows
    Set-Content -LiteralPath $manifestPath -Value $outerManifest -Encoding utf8
    Write-Output "已生成：$zipPath"
    Write-Output "SHA-256：$zipHash"
}
finally {
    $resolvedBuildRoot = [IO.Path]::GetFullPath($buildRoot)
    if ((Test-Path -LiteralPath $resolvedBuildRoot) -and $resolvedBuildRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedBuildRoot -Recurse -Force
    }
}
