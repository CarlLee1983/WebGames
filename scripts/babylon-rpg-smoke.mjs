import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/games/babylon-rpg";
const screenshotPath = process.argv[3] ?? "/tmp/babylon-rpg-smoke.png";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readSnapshot(page, label) {
  const snapshot = await page.evaluate(async () => {
    const render = window.render_game_to_text;
    return typeof render === "function" ? render() : null;
  });

  console.log(`SNAPSHOT:${label}:${snapshot ?? "null"}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(120000);
const consoleMessages = [];
const pageErrors = [];

page.on("console", (message) => {
  consoleMessages.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => {
  pageErrors.push(String(error));
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30000 });
  await wait(1500);
  await readSnapshot(page, "initial");

  await page.keyboard.press("KeyW");
  await wait(500);
  await page.keyboard.press("Space");
  await wait(500);
  await page.keyboard.press("KeyE");
  await wait(500);
  await page.keyboard.press("KeyF");
  await wait(400);
  await page.keyboard.press("Escape");
  await wait(400);

  await readSnapshot(page, "after-input");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`SCREENSHOT:${screenshotPath}`);
  console.log(`CONSOLE_COUNT:${consoleMessages.length}`);
  for (const message of consoleMessages) {
    console.log(`CONSOLE:${message}`);
  }
  console.log(`PAGEERROR_COUNT:${pageErrors.length}`);
  for (const message of pageErrors) {
    console.log(`PAGEERROR:${message}`);
  }
} finally {
  await browser.close();
}
