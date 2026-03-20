const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('Loading monopoly game...');
    await page.goto('http://localhost:3000/games/monopoly', { waitUntil: 'networkidle' });

    // Wait for canvas to be rendered
    await page.waitForSelector('canvas', { timeout: 5000 });
    console.log('✓ Canvas loaded');

    // Check if game state is exposed
    const gameState = await page.evaluate(() => {
      return window.render_game_to_text ? JSON.parse(window.render_game_to_text()) : null;
    });

    if (gameState) {
      console.log('✓ Game state accessible:');
      console.log('  - Mode:', gameState.mode);
      console.log('  - Current Player:', gameState.currentPlayer.name);
      console.log('  - Players:', gameState.players.length);
      console.log('  - Board Tiles:', gameState.boardTileCount);
    }

    // Test dice roll by pressing 'D'
    console.log('\nTesting dice roll...');
    await page.press('body', 'd');
    await page.waitForTimeout(500);

    const stateAfterDice = await page.evaluate(() => {
      return JSON.parse(window.render_game_to_text());
    });

    console.log('✓ Dice rolled:');
    console.log('  - Dice Value:', stateAfterDice.diceValue);
    console.log('  - Player Position:', stateAfterDice.currentPlayer.position);
    console.log('  - Player Money:', stateAfterDice.currentPlayer.money);

    // Take a screenshot
    await page.screenshot({ path: '/tmp/monopoly-test.png', fullPage: true });
    console.log('✓ Screenshot saved to /tmp/monopoly-test.png');

    console.log('\n✅ All basic tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
