import type { Locator, Page } from '@playwright/test';

// An SVG path's bounding-box centre is not necessarily on the path, especially
// when an obstacle forces a detour. Click a visible point on the real stroke.
export async function clickEdge(page: Page, path: Locator) {
  await path.waitFor({ state: 'attached' });
  await page.waitForTimeout(400);
  const point = await path.evaluate(element => {
    const line = element as SVGPathElement;
    for (const fraction of [0.5, 0.2, 0.8, 0.3, 0.7, 0.1, 0.9]) {
      const p = line.getPointAtLength(line.getTotalLength() * fraction).matrixTransform(line.getScreenCTM()!);
      if (document.elementFromPoint(p.x, p.y)?.closest('.react-flow__edge') === line.closest('.react-flow__edge')) return { x: p.x, y: p.y };
    }
    throw new Error('No exposed connector segment');
  });
  await page.mouse.click(point.x, point.y);
}
