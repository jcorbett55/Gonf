param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRepoPath,

    [Parameter(Mandatory = $true)]
    [string]$ProjectName,

    [Parameter(Mandatory = $true)]
    [string]$BackendPath,

    [Parameter(Mandatory = $true)]
    [string]$FrontendPath
)

$templateRoot = Join-Path $PSScriptRoot "workspace-template"
$sourceGithubPath = Join-Path $templateRoot ".github"
$targetGithubPath = Join-Path $TargetRepoPath ".github"

if (-not (Test-Path $TargetRepoPath)) {
    throw "Target repository path does not exist: $TargetRepoPath"
}

if (-not (Test-Path $sourceGithubPath)) {
    throw "Template .github folder not found: $sourceGithubPath"
}

New-Item -ItemType Directory -Path $targetGithubPath -Force | Out-Null
Copy-Item -Path (Join-Path $sourceGithubPath "*") -Destination $targetGithubPath -Recurse -Force

$tokenMap = @{
    "{{PROJECT_NAME}}" = $ProjectName
    "{{BACKEND_PATH}}" = $BackendPath
    "{{FRONTEND_PATH}}" = $FrontendPath
}

$markdownFiles = Get-ChildItem -Path $targetGithubPath -Recurse -File -Include *.md

foreach ($file in $markdownFiles) {
    $content = Get-Content -Path $file.FullName -Raw

    foreach ($token in $tokenMap.Keys) {
        $content = $content.Replace($token, $tokenMap[$token])
    }

    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "Agent kit installed to $targetGithubPath"
