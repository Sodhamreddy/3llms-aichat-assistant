// Run this once per client to login to all 3 LLMs.
// Sessions are saved in profiles/<client_id>/ and reused automatically.
//
// Usage:  node login.js client_123

const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');
const { getProfilePath, sanitizeClientId } = require('./session-manager');

const CLIENT_ID = sanitizeClientId(process.argv[2] || process.env.CLIENT_ID);
const PROFILE_DIR = getProfilePath(CLIENT_ID);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pause = (msg) => new Promise(res => rl.question(msg, res));

function getExecutablePath() {
  const candidates = [
    process.env.CHROME_EXE,
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '',
    process.platform === 'linux' ? '/usr/bin/google-chrome' : '',
    process.platform === 'linux' ? '/usr/bin/google-chrome-stable' : '',
    process.platform === 'linux' ? '/usr/bin/chromium-browser' : '',
    process.platform === 'linux' ? '/usr/bin/chromium' : '',
    process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '',
  ].filter(Boolean);

  return candidates.find(candidate => fs.existsSync(candidate));
}

async function main() {
  console.log(`\n Opening Chrome for first-time login: ${CLIENT_ID}\n`);

  const executablePath = getExecutablePath();
  if (!executablePath) {
    console.log('No system Chrome path found. Falling back to Playwright bundled Chromium.');
  }

  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--start-maximized',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: null,
  });

  const page = await browser.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  // ── Step 1: ChatGPT ──
  console.log('Step 1/3 — Login to ChatGPT');
  await page.goto('https://chatgpt.com/');
  await pause('   Login to ChatGPT in the browser, then press ENTER here... ');

  // ── Step 2: Claude ──
  console.log('\nStep 2/3 — Login to Claude');
  await page.goto('https://claude.ai/');
  await pause('   Login to Claude in the browser, then press ENTER here... ');

  // ── Step 3: Gemini ──
  console.log('\nStep 3/3 — Login to Gemini');
  await page.goto('https://gemini.google.com/');
  await pause('   Login to Gemini in the browser, then press ENTER here... ');

  await browser.close();
  rl.close();

  console.log(`\n All sessions saved for ${CLIENT_ID}! You can now run:  node server.js\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
