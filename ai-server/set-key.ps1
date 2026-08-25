<#
.SYNOPSIS
    AI-server API 키 등록 (해빙)

.DESCRIPTION
    PowerShell에서 바로 실행할 수 있는 런처입니다. 가상환경을 찾거나 만들고,
    필요한 패키지를 확인한 뒤 키 등록 화면을 띄웁니다.

    키는 ai-server\.env 에 저장되며 저장소에 올라가지 않습니다.

.EXAMPLE
    .\set-key.ps1
    키를 등록합니다.

.EXAMPLE
    .\set-key.ps1 -Show
    등록된 항목을 마스킹해서 보여줍니다 (입력받지 않음).
#>
param([switch]$Show)

$ErrorActionPreference = "Stop"

# 한글이 깨지지 않도록 콘솔 출력을 UTF-8로 맞춥니다.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$env:PYTHONIOENCODING = "utf-8"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "해빙 AI-server - 키 등록" -ForegroundColor Cyan
Write-Host ("-" * 46)

# 1) 파이썬 찾기: 가상환경 우선, 없으면 만든다
$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "가상환경이 없어 새로 만듭니다 (.venv) ..." -ForegroundColor Yellow

    $basePython = $null
    foreach ($candidate in @("py", "python")) {
        $found = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($found) { $basePython = $found.Source; break }
    }
    if (-not $basePython) {
        Write-Host ""
        Write-Host "[중단] 파이썬을 찾지 못했습니다." -ForegroundColor Red
        Write-Host "       https://www.python.org/downloads/ 에서 설치한 뒤 다시 실행하세요."
        Write-Host "       설치할 때 'Add python.exe to PATH'를 반드시 체크하세요."
        exit 1
    }

    & $basePython -m venv (Join-Path $PSScriptRoot ".venv")
    if (-not (Test-Path $venvPython)) {
        Write-Host "[중단] 가상환경 생성에 실패했습니다." -ForegroundColor Red
        exit 1
    }
}

# 2) 필요한 패키지 확인 (python-dotenv 하나면 키 등록에 충분합니다)
& $venvPython -c "import dotenv" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "필요한 패키지를 설치합니다 ..." -ForegroundColor Yellow
    & $venvPython -m pip install --quiet --disable-pip-version-check -r (Join-Path $PSScriptRoot "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[중단] 패키지 설치에 실패했습니다." -ForegroundColor Red
        exit 1
    }
}

# 3) 실행
if ($Show) {
    & $venvPython (Join-Path $PSScriptRoot "scripts\set_key.py") --show
} else {
    & $venvPython (Join-Path $PSScriptRoot "scripts\set_key.py")
}

$code = $LASTEXITCODE
Write-Host ""
if ($code -eq 0) {
    Write-Host "끝났습니다. 등록된 값 확인:" -ForegroundColor Green
    Write-Host "  powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Show"
}
exit $code
