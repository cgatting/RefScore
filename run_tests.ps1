Write-Host "Starting Comprehensive Test Suite..." -ForegroundColor Cyan

# Prepare artifacts folder
if (Test-Path "artifacts") { Remove-Item -Recurse -Force "artifacts" }
New-Item -ItemType Directory -Path "artifacts" | Out-Null
New-Item -ItemType Directory -Path "artifacts\backend-report" | Out-Null

# 1. Run Frontend Unit Tests (Coverage)
Write-Host "`nRunning Frontend Unit Tests..." -ForegroundColor Yellow
# Using npm run test:coverage to use the script in package.json
# We'll ignore exit code here to allow the report to be generated even if tests fail
cmd /c "npm run test:coverage" 
if (Test-Path "coverage") {
    Copy-Item -Recurse -Force "coverage" "artifacts\unit-coverage"
} else {
    Write-Host "No coverage report generated." -ForegroundColor Yellow
}

# 2. Run Backend Tests
Write-Host "`nRunning Backend Tests..." -ForegroundColor Yellow
# Install reporting plugins if missing (quietly)
python -m pip install pytest-html pytest-cov > $null 2>&1

# Run tests with HTML and JUnit XML output
# Using --color=no to avoid encoding issues in some environments
# Using -s to avoid capture errors on Windows/Python 3.13
python -m pytest tests/backend --junitxml="artifacts/backend-junit.xml" --html="artifacts/backend-report/index.html" --self-contained-html --color=no -s

# 3. Run E2E Tests
Write-Host "`nRunning E2E Tests (Playwright)..." -ForegroundColor Yellow
# Playwright config handles webServer start/stop, but we can ensure clean state
# Running with cmd /c to ensure npx is found correctly
cmd /c "npx playwright test"

if (Test-Path "playwright-report") {
    Copy-Item -Recurse -Force "playwright-report" "artifacts\e2e-report"
}

# 4. Build Static Report
Write-Host "`nBuilding Static Report..." -ForegroundColor Yellow
node "scripts/build-static-report.js"

Write-Host "`nArtifacts generated in .\artifacts" -ForegroundColor Green
try {
    Start-Process "artifacts\index.html"
} catch {
    Write-Host "Could not open report automatically. Please open artifacts\index.html manually." -ForegroundColor Yellow
}
