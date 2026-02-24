import { test, expect } from '@playwright/test';

test.describe('RefScore App', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock external APIs to ensure consistent tests
    await page.route('https://api.openalex.org/**', async route => {
      const json = {
        meta: { count: 1, db_response_time_ms: 10, page: 1, per_page: 1 },
        results: [
          {
            id: 'https://openalex.org/W123456789',
            doi: 'https://doi.org/10.1234/5678', // Added DOI to match request
            display_name: 'Mocked Paper Title',
            publication_year: 2023,
            authorships: [{ author: { display_name: 'Mock Author' } }],
            primary_location: { source: { display_name: 'Mock Venue' } },
            cited_by_count: 42,
            abstract_inverted_index: { 'Mock': [0], 'abstract': [1] } 
          }
        ]
      };
      await route.fulfill({ json });
    });

    await page.route('https://api.crossref.org/**', async route => {
      const json = {
        message: {
          items: []
        }
      };
      await route.fulfill({ json });
    });

    // Mock Backend Endpoints globally to prevent network hangs on missing backend
    await page.route('**/refine', async route => {
        await route.fulfill({ status: 503, body: JSON.stringify({ error: "Backend Mocked Default" }) });
    });
    
    // Mock WebSocket upgrade request if possible, or just fail fast
    // Playwright doesn't intercept WS upgrade via page.route easily, but we can block the URL pattern
    // However, if the client uses 'ws://', page.route handles HTTP/HTTPS only usually.
    // But since we proxy /ws via http, maybe?
    // Let's just mock the /ws endpoint if it's hit via HTTP upgrade
    // If the client does `new WebSocket('ws://...')`, Playwright can't intercept easily without CDP.
    // But we can route the HTTP request that initiates it if it goes through fetch/xhr (it doesn't).
    
    // Instead, we can override the WebSocket constructor in the page to a dummy
    // ONLY if we want to suppress errors.
    // But let's just let it fail fast or mock the HTTP upgrade endpoint if applicable.
    
    await page.goto('/', { waitUntil: 'domcontentloaded' }); // Wait for DOM, not full network idle
    
    // Skip landing page if present
    const startButton = page.getByRole('button', { name: 'Start Analyzing Now' });
    if (await startButton.isVisible()) {
      await startButton.click();
    } else {
        const launchButton = page.getByRole('button', { name: 'Launch App' });
        if (await launchButton.isVisible()) {
            await launchButton.click();
        }
    }
    
    // Wait for the main app to load
    await expect(page.getByRole('heading', { name: 'Academic Reference Analysis' })).toBeVisible({ timeout: 20000 });
  });

  test('should load the application and show input fields', async ({ page }) => {
    const startTime = Date.now();
    await expect(page).toHaveTitle(/RefScore/);
    await expect(page.getByRole('heading', { name: 'Academic Reference Analysis' })).toBeVisible();
    await expect(page.getByText('Manuscript', { exact: true })).toBeVisible();
    await expect(page.getByText('Bibliography', { exact: true })).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    console.log(`Page load interaction time: ${loadTime}ms`);
    
    // Capture performance metrics
    const performanceTiming = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domComplete: navigation.domComplete,
        loadEventEnd: navigation.loadEventEnd,
        duration: navigation.duration
      };
    });
    console.log('Performance Metrics:', performanceTiming);
  });

  test('should run analysis with manual input', async ({ page }) => {
    // Fill manuscript
    const manuscriptInput = page.getByRole('textbox', { name: /Manuscript/i }); // Adjust selector if needed
    // If the FileUpload component uses a textarea, we can find it.
    // Based on code, it likely has a textarea or similar. 
    // Let's try finding by placeholder or label.
    // The FileUpload component usually has a textarea.
    
    // We can use a more specific selector strategy based on the component structure
    // Note: The textarea disappears after filling and is replaced by a success message.
    await page.locator('textarea').first().fill(`
      Introduction
      This is a claim that needs a citation \\cite{ref1}.
      This is another claim.
    `);
    
    // Wait for the first input to be processed and show success message
    await expect(page.getByText('Content Added Successfully').first()).toBeVisible();

    // Fill bibliography
    // Since the first textarea is now gone/replaced, the bibliography textarea is now the first visible one
    await page.locator('textarea').first().fill(`
      @article{ref1,
        title={A Great Paper},
        author={Smith, John},
        year={2023},
        journal={Journal of Testing},
        doi={10.1234/5678}
      }
    `);

    // Click Analyze
    await page.getByText('Analyze Documents').click();

    // Wait for processing
    await expect(page.getByText('Processing Content')).toBeVisible();

    // Check for success or error
    try {
        await expect(page.getByText('Overview')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('RefScore Index')).toBeVisible();
    } catch (e) {
        // If failed, check if error message is visible
        if (await page.getByText('Analysis Failed').isVisible()) {
            const errorMsg = await page.locator('.text-red-400, .text-slate-600').textContent();
            console.error(`Analysis failed with message: ${errorMsg}`);
            throw new Error(`Analysis failed: ${errorMsg}`);
        }
        throw e;
    }
  });

  test('should run deep search with backend mock', async ({ page }) => {
    // Mock backend /refine endpoint
    await page.route('**/refine', async route => {
      await route.fulfill({
        json: {
          processedText: 'Refined manuscript with citations \\cite{generated1}.',
          bibliographyText: '@article{generated1, title={Generated Paper}, author={AI, Bot}, year={2024}}',
          bibtex: '@article{generated1, title={Generated Paper}, author={AI, Bot}, year={2024}}'
        }
      });
    });

    // Let's toggle the switch
    const switchBtn = page.getByRole('switch', { name: 'Toggle auto-generate references' });
    await switchBtn.click();
    await expect(switchBtn).toHaveAttribute('aria-checked', 'true');

    // Fill manuscript only
    // Wait for textarea to be ready
    const manuscriptInput = page.getByRole('textbox', { name: /Manuscript/i }).or(page.locator('textarea').first());
    await expect(manuscriptInput).toBeVisible();
    await manuscriptInput.fill('This is a text that needs citations.');

    // Click Analyze
    await page.getByText('Analyze Documents').click();

    // Should show refining status
    await expect(page.getByText('Initializing DeepSearch refinement...')).toBeVisible();

    // Should eventually show results
    await expect(page.getByText('Overview')).toBeVisible({ timeout: 15000 });
    
    // Check if the refined text is used (in Document tab)
    await page.getByText('Review Manuscript').click();
    await expect(page.getByText('Refined manuscript with citations')).toBeVisible();
  });

});
