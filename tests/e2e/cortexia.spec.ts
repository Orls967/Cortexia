import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('CORTEXIA Full Application E2E, 3D Studios, UCES, Workers & Accessibility', () => {
  test('visits all 12 modules with zero console errors or failed essential requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        failedResponses.push(`${res.status()} ${res.url()}`);
      }
    });

    const routes: [string, RegExp][] = [
      ['explore/observatory', /Multi-Scale Brain/i],
      ['explore/anatomy', /Neuroanatomy/i],
      ['explore/cellular', /Neuronal Morphologies/i],
      ['explore/molecular', /Ion Channels, Receptors/i],
      ['explore/synapses', /Chemical & Electrical Synapses/i],
      ['explore/circuits', /Microcircuits, Structural\/Functional/i],
      ['explore/physiology', /Membrane Biophysics/i],
      ['lab', /Hodgkin–Huxley/i],
      ['explore/systems', /Sensory, Motor/i],
      ['explore/cognition', /Distributed Cognitive Networks/i],
      ['analytics/signals', /Signal Processing/i],
      ['knowledge', /Searchable Neuroscience Encyclopedia/i],
      ['research', /Experiment History/i],
    ];

    for (const [path, heading] of routes) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toContainText(heading);
    }

    expect(consoleErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test('verifies UCES hover tooltip, click inspector, dedicated page, and ?inspect persistence', async ({ page }) => {
    await page.goto('explore/observatory', { waitUntil: 'networkidle' });

    // Hover over a known EntityRef chip -> wait >180ms for Tier A tooltip
    const chip = page.locator('[data-entity-id="ANAT-HIPPOCAMPUS"]').first();
    await expect(chip).toBeVisible();
    await chip.hover();
    await expect(page.getByTestId('uces-tooltip')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('uces-tooltip')).toContainText('ANAT-HIPPOCAMPUS');

    // Click opens Tier B Inspector with 12 sections
    await chip.click();
    const inspector = page.getByTestId('uces-inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText('Hippocampus');
    await expect(inspector).toContainText('Detailed Mechanism');
    await expect(inspector).toContainText('Verified Scientific References');

    // Refresh preserves ?inspect=ANAT-HIPPOCAMPUS
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('uces-inspector')).toBeVisible();
    await expect(page.getByTestId('uces-inspector')).toContainText('Hippocampus');

    // Navigate to Tier C Dedicated Scientific Page
    await page.getByRole('link', { name: /Open Full Scientific Page/i }).click();
    await expect(page.locator('h1').first()).toContainText(/Hippocampus/i);
    // An anatomical structure is not governed by equations itself: the section names the associated models instead.
    await expect(page.locator('article')).toContainText('Equations of Associated Models');
    await expect(page.locator('article')).not.toContainText('Governing Equations');
    await page.goto('knowledge/MODEL-001', { waitUntil: 'networkidle' });
    await expect(page.locator('article')).toContainText('Governing Equations');
  });

  test('verifies all 4 3D Visualization Studios render canvases or accessible fallbacks and allow interaction', async ({ page }) => {
    const studioRoutes = [
      'explore/anatomy',
      'explore/cellular',
      'explore/synapses',
      'explore/circuits',
    ];
    for (const r of studioRoutes) {
      await page.goto(r, { waitUntil: 'networkidle' });
      // Either WebGL canvas renders or 2D Schematic toggle works cleanly
      const canvasCount = await page.locator('canvas').count();
      expect(canvasCount).toBeGreaterThan(0);
    }

    // Studio A interaction: switch to 2D Schematic and select Hippocampus
    await page.goto('explore/anatomy', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /2D Schematic/i }).click();
    await page.getByRole('button', { name: /Hippocampus Proper/i }).first().click();
    await expect(page.getByTestId('uces-inspector')).toContainText('ANAT-HIPPOCAMPUS');
  });

  test('runs simulation and validation in Computational Lab (MOD-08) and Digital Twin (EXP-040)', async ({ page }) => {
    await page.goto('lab/MODEL-001', { waitUntil: 'networkidle' });
    await expect(page.locator('h1').first()).toContainText('Hodgkin–Huxley');
    await page.getByRole('button', { name: /▶ Run Simulation/i }).click();
    await expect(page.locator('body')).toContainText(/Panel 4 · Quantitative Metrics/i);
    await expect(page.locator('canvas').first()).toBeVisible();

    // Run VAL-HH-001 validation case inside Panel 5
    await page.getByRole('button', { name: /Run Validation/i }).first().click();
    await expect(page.locator('body')).toContainText(/PASSED/i, { timeout: 20000 });

    // Switch to Digital Twin EXP-040
    await page.goto('lab/digital-twin/EXP-040', { waitUntil: 'networkidle' });
    await expect(page.locator('h1').first()).toContainText('EXP-040');
    await page.getByRole('button', { name: /Execute Cross-Scale Pipeline/i }).click();
    await expect(page.locator('table')).toContainText('Single-cell rheobase', { timeout: 25000 });

    // Check Research Environment recorded the run
    await page.goto('research', { waitUntil: 'networkidle' });
    await expect(page.locator('table')).toContainText('MODEL-001');
  });

  test('runs Neural Signal Analytics (MOD-11) and CSV dataset import', async ({ page }) => {
    await page.goto('analytics/signals', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText('Dominant Spectral Peak');
    await expect(page.locator('canvas').first()).toBeVisible();

    await page.goto('analytics/import', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Validate & Import CSV/i }).click();
    await expect(page.locator('body')).toContainText(/Imported sample_oscillation\.csv/i);
  });

  test('checks WCAG 2.1 AA accessibility (axe-core) and mobile responsive layout', async ({ page }) => {
    for (const r of ['explore/observatory', 'lab/MODEL-001', 'analytics/signals', 'knowledge/ANAT-HIPPOCAMPUS']) {
      await page.goto(r, { waitUntil: 'networkidle' });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const seriousOrCritical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(seriousOrCritical, `Axe violations on ${r}: ${JSON.stringify(seriousOrCritical, null, 2)}`).toEqual([]);
    }
  });

  test('mobile layout: content uses the full width, nothing is clipped, navigation is reachable', async ({ page }) => {
    const width = 390;
    await page.setViewportSize({ width, height: 844 });
    for (const r of ['explore/observatory', 'explore/anatomy', 'explore/cellular', 'explore/synapses', 'lab/MODEL-001', 'lab/digital-twin', 'analytics/signals', 'knowledge/ANAT-HIPPOCAMPUS', 'research']) {
      await page.goto(r, { waitUntil: 'networkidle' });
      await expect(page.locator('h1').first()).toBeVisible();
      // The module rail must not take layout space until it is opened.
      await expect(page.locator('#module-rail')).toBeHidden();
      const main = await page.locator('#main-content').boundingBox();
      expect(main!.width, `main content width on ${r}`).toBeGreaterThanOrEqual(width - 2);
      // No content may extend past the right edge of the scroll container (it would be clipped, not scrollable).
      const overflow = await page.evaluate(() => {
        const m = document.getElementById('main-content')!;
        const limit = m.getBoundingClientRect().right + 1;
        const offenders: string[] = [];
        for (const el of Array.from(m.querySelectorAll<HTMLElement>('*'))) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.right <= limit) continue;
          // Content inside its own horizontal scroller is reachable and therefore allowed.
          let scrollable = false;
          for (let a = el.parentElement; a && a !== m; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { scrollable = true; break; }
          }
          if (!scrollable) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(rect.right)}`);
        }
        return offenders.slice(0, 5);
      });
      expect(overflow, `clipped content on ${r}`).toEqual([]);
      // All five environments stay reachable from the top bar.
      for (const env of ['Explore', 'Laboratory', 'Analytics', 'Knowledge', 'Research']) {
        await expect(page.getByRole('navigation', { name: 'Work Environments' }).getByRole('link', { name: env, exact: true })).toBeAttached();
      }
    }

    // Drawer: opens from the toggle, closes on Escape, and closes after following a link.
    await page.goto('explore/observatory', { waitUntil: 'networkidle' });
    const toggle = page.getByRole('button', { name: /Toggle module navigation/i });
    await toggle.click();
    await expect(page.locator('#module-rail')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#module-rail')).toBeHidden();
    await toggle.click();
    await page.locator('#module-rail').getByRole('link', { name: /Cellular/ }).click();
    await expect(page).toHaveURL(/explore\/cellular/);
    await expect(page.locator('#module-rail')).toBeHidden();
  });

  test('desktop layout keeps the module rail visible and hides its toggle', async ({ page }) => {
    await page.goto('explore/observatory', { waitUntil: 'networkidle' });
    await expect(page.locator('#module-rail')).toBeVisible();
    await expect(page.getByRole('button', { name: /Toggle module navigation/i })).toBeHidden();
  });

  test('switching a studio to its 2D schematic does not report a lost graphics context', async ({ page }) => {
    await page.goto('explore/synapses', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '2D Schematic' }).click();
    await expect(page.getByText('Nanoscale Synaptic & Molecular Components')).toBeVisible();
    // React Three Fiber releases the WebGL context shortly after the canvas unmounts.
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Graphics Context Interrupted/i)).toHaveCount(0);
    // The schematic heading must not be covered by the studio header.
    const heading = await page.getByText('Nanoscale Synaptic & Molecular Components').boundingBox();
    const badge = await page.getByText('STUDIO C · L1–L4 (nm)').boundingBox();
    const presets = await page.getByRole('button', { name: '3D View' }).boundingBox();
    expect(heading!.y).toBeGreaterThanOrEqual(Math.max(badge!.y + badge!.height, presets!.y + presets!.height));
    await page.getByRole('button', { name: '3D View' }).click();
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
