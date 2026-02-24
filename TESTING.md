# Comprehensive Testing Framework

This repository contains a complete testing suite covering unit, integration, backend, and end-to-end (E2E) testing.

## Prerequisites

1.  **Node.js**: Ensure Node.js is installed.
2.  **Python**: Ensure Python 3.10+ is installed.
3.  **Dependencies**:
    -   Frontend: `npm install`
    -   Backend: `pip install -r requirements.txt` (or ensure `pytest`, `httpx`, `pytest-asyncio` are installed)
    -   Playwright Browsers: `npx playwright install`

## Test Types

### 1. Unit Tests (Frontend)
Tests individual React components and utility functions using Vitest.

-   **Run**: `npm test` or `npx vitest`
-   **Coverage**: `npm run test:coverage`
-   **UI Mode**: `npm run test:ui`

### 2. Backend Tests (Python)
Tests the FastAPI backend endpoints (`/refine`, `/ws`) using Pytest.

-   **Run**: `python -m pytest tests/backend`
-   **Structure**:
    -   `tests/backend/conftest.py`: Mocks heavy ML dependencies (`DEEPSEARCH`, `torch`, etc.) for fast execution.
    -   `tests/backend/test_api.py`: Tests API endpoints.

### 3. End-to-End Tests (E2E)
Tests the full application flow in a real browser using Playwright.

-   **Run**: `npx playwright test` (headless)
-   **Run with UI**: `npx playwright test --ui` (interactive debugger)
-   **Report**: `npx playwright show-report`

The E2E tests cover:
-   Page load and navigation.
-   Manual analysis flow (mocking external APIs like OpenAlex).
-   Deep Search flow (mocking backend `/refine` endpoint).
-   Performance metrics (page load time).
-   Error handling and edge cases.

## Reports

-   **HTML Report**: Generated automatically after E2E tests in `playwright-report/index.html`.
-   **Screenshots**: Captured automatically on failure (or always if configured).
-   **Videos**: Retained on failure for debugging.
-   **Traces**: Captured on retry for detailed debugging.

## Running All Tests

To run all tests in sequence, use the provided script or run manually:

```bash
# 1. Frontend Unit Tests
npm test run

# 2. Backend Tests
python -m pytest tests/backend

# 3. E2E Tests (requires running app on port 3000)
# Start app in one terminal: npm run dev
# Run tests in another:
npx playwright test
```

## Continuous Integration

The testing framework is designed to run in CI/CD pipelines (GitHub Actions, etc.).
Ensure the environment has both Node.js and Python set up.
