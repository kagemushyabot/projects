# Splattic ARExperiences — local folder setup (Windows)
# Target: D:\Cursor\Splattic_ARExperiences

$Target = "D:\Cursor\Splattic_ARExperiences"
$Repo = "https://github.com/kagemushyabot/projects.git"

New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null

if (Test-Path (Join-Path $Target ".git")) {
    Write-Host "Already cloned: $Target"
    Set-Location $Target
    git pull
} else {
    git clone $Repo $Target
    Set-Location $Target
}

Write-Host "Project root: $Target"
Write-Host "PDF: $Target\output\AR_Experience_QR_Guide.pdf"
Write-Host ""
Write-Host "Optional — regenerate PDF:"
Write-Host "  python -m pip install -r requirements.txt"
Write-Host "  python scripts\generate_ar_pdf.py"
