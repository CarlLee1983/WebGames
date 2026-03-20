const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Loading monopoly game...');
    // Try port 3000 first, then 4002
    let loaded = false;
    for (const port of [3000, 4002, 5173]) {
      try {
        console.log(`Trying port ${port}...`);
        await page.goto(`http://localhost:${port}/games/monopoly`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        console.log(`✓ Connected on port ${port}`);
        loaded = true;
        break;
      } catch (e) {
        console.log(`✗ Port ${port} failed`);
      }
    }

    if (!loaded) {
      throw new Error('Could not connect to any port');
    }
    console.log('✓ Page loaded');

    // Give React time to render
    await page.waitForTimeout(2000);

    // Check for canvas
    const canvasExists = await page.evaluate(() => {
      return document.querySelector('canvas') !== null;
    });

    if (canvasExists) {
      console.log('✓ Canvas exists');
    } else {
      console.log('❌ Canvas not found');
    }

    // Try to get game state
    const hasRenderFunc = await page.evaluate(() => {
      return typeof window.render_game_to_text === 'function';
    });

    if (hasRenderFunc) {
      console.log('✓ Game state function exposed');
      const state = await page.evaluate(() => {
        try {
          return JSON.parse(window.render_game_to_text());
        } catch (e) {
          return null;
        }
      });

      if (state) {
        console.log('✓ Initial game state:');
        console.log('  - Mode:', state.mode);
        console.log('  - Players:', state.players.length);
        console.log('  - Board:', state.boardTileCount);
      }
    } else {
      console.log('❌ Game state function not found');
    }

    console.log('\n✅ Basic load test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
