const { chromium } = require('playwright');

const CDP_URL = 'http://localhost:9222';
const TIMEOUT  = 120_000;

// ── Connect to already-running Chrome ─────────────────────────────────────

async function getContext() {
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch {
    throw new Error('Cannot connect to Chrome. Run start-chrome.bat first.');
  }
  const context = browser.contexts()[0];
  // Grant clipboard so navigator.clipboard.writeText works inside page.evaluate
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  return { browser, context };
}

// ── Shared: type into any contenteditable using execCommand ───────────────
// Much more reliable than keyboard.type() for long/special text

async function pasteIntoEditor(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 30_000 });
  await page.click(selector);
  await page.waitForTimeout(500);
  await page.evaluate(({ sel, content }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.focus();
    // Clear existing content first
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, content);
  }, { sel: selector, content: text });
  await page.waitForTimeout(300);
}

// ── ChatGPT ───────────────────────────────────────────────────────────────

async function runChatGPT(context, prompt) {
  const page = await context.newPage();
  try {
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('#prompt-textarea', { timeout: 30_000 });
    await page.click('#prompt-textarea');
    await page.waitForTimeout(300);
    await page.evaluate(({ content }) => {
      const el = document.querySelector('#prompt-textarea');
      if (!el) return;
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, content);
    }, { content: prompt });
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');

    await page.waitForSelector('[data-testid="stop-button"]', { timeout: 15_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="stop-button"]', { state: 'hidden', timeout: TIMEOUT }).catch(() => {});
    await page.waitForTimeout(800);

    const msgs = await page.$$eval(
      '[data-message-author-role="assistant"]',
      els => els.map(el => el.innerText.trim())
    );
    return msgs[msgs.length - 1] || 'No response received.';
  } catch (e) {
    return `Error: ${e.message}`;
  } finally {
    await page.close();
  }
}

// ── Gemini ────────────────────────────────────────────────────────────────

async function runGemini(context, prompt) {
  const page = await context.newPage();
  try {
    await page.goto('https://gemini.google.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const inputSel = 'rich-textarea .ql-editor, .input-area-container [contenteditable="true"]';
    await pasteIntoEditor(page, inputSel, prompt);
    await page.keyboard.press('Enter');

    const loadingSel = 'model-response [aria-label="loading"], .loading-indicator, mat-spinner';
    await page.waitForSelector(loadingSel, { timeout: 15_000 }).catch(() => {});
    await page.waitForSelector(loadingSel, { state: 'hidden', timeout: TIMEOUT }).catch(() => {});
    await page.waitForTimeout(800);

    const msgs = await page.$$eval(
      'model-response .markdown, .response-content',
      els => els.map(el => el.innerText.trim())
    );
    return msgs[msgs.length - 1] || 'No response received.';
  } catch (e) {
    return `Error: ${e.message}`;
  } finally {
    await page.close();
  }
}

// ── Claude ────────────────────────────────────────────────────────────────

async function runClaude(context, text) {
  const page = await context.newPage();
  try {
    console.log('[Claude] Loading page...');
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000);

    // Find editor (ProseMirror or any contenteditable)
    const editorSel = await page.evaluate(() => {
      if (document.querySelector('.ProseMirror')) return '.ProseMirror';
      const ces = document.querySelectorAll('[contenteditable="true"]');
      return ces.length ? '[contenteditable="true"]' : null;
    });
    console.log('[Claude] Editor selector:', editorSel);
    if (!editorSel) return 'Error: Not logged in or editor not found on claude.ai';

    await page.click(editorSel);
    await page.waitForTimeout(400);

    // Write to clipboard then Ctrl+V — handles any length and newlines correctly
    await page.evaluate(async (content) => {
      await navigator.clipboard.writeText(content);
    }, text);
    await page.keyboard.press('Control+a'); // clear any existing text
    await page.keyboard.press('Control+v'); // paste
    await page.waitForTimeout(800);

    // Verify text was pasted
    const editorContent = await page.$eval(editorSel, el => el.innerText.trim()).catch(() => '');
    console.log('[Claude] Editor content after paste:', editorContent.length, 'chars');

    // If paste failed, fall back to execCommand
    if (editorContent.length < 3) {
      console.log('[Claude] Clipboard paste failed, using execCommand fallback...');
      await page.evaluate((content) => {
        const el = document.querySelector('.ProseMirror, [contenteditable="true"]');
        if (!el) return;
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, content);
      }, text);
      await page.waitForTimeout(500);
    }

    // Click Send button
    const sent = await page.evaluate(() => {
      const btns = ['button[aria-label="Send Message"]', 'button[data-testid="send-button"]',
                    'button[aria-label="Send message"]', 'button[type="submit"]'];
      for (const sel of btns) {
        const b = document.querySelector(sel);
        if (b && !b.disabled) { b.click(); return sel; }
      }
      return null;
    });
    if (sent) {
      console.log('[Claude] Sent via:', sent);
    } else {
      await page.keyboard.press('Enter');
      console.log('[Claude] Sent via Enter');
    }

    // Wait for generation
    await page.waitForSelector('button[aria-label="Stop"]', { timeout: 15_000 })
      .then(() => console.log('[Claude] Generating...'))
      .catch(() => console.log('[Claude] Stop button not seen'));
    await page.waitForSelector('button[aria-label="Stop"]', { state: 'hidden', timeout: TIMEOUT })
      .then(() => console.log('[Claude] Done generating'))
      .catch(() => console.log('[Claude] Stop button timeout'));
    await page.waitForTimeout(1500);

    // Extract response — structural approach, no brittle class names
    const responseText = await page.evaluate(() => {
      // 1. Try known class names (may change over time)
      const classSelectors = ['.font-claude-message', '.prose', '[class*="prose"]', '[class*="message-content"]'];
      for (const sel of classSelectors) {
        const els = [...document.querySelectorAll(sel)];
        const texts = els.map(el => el.innerText.trim()).filter(t => t.length > 30);
        if (texts.length) return texts[texts.length - 1];
      }
      // 2. Structural fallback: grab all text blocks in main, pick the longest one
      const main = document.querySelector('main, [role="main"], #main-content');
      if (main) {
        const blocks = [...main.querySelectorAll('div, p, section, article')]
          .map(el => el.innerText.trim())
          .filter(t => t.length > 80);
        if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0];
      }
      return '';
    });

    console.log('[Claude] Response:', responseText.length, 'chars');
    return responseText || 'No response received.';
  } catch (e) {
    console.error('[Claude] Error:', e.message);
    return `Error: ${e.message}`;
  } finally {
    await page.close();
  }
}

// ── Synthesis ─────────────────────────────────────────────────────────────

function buildSynthesisPrompt(originalPrompt, gptText, claudeText, geminiText) {
  const hasGPT    = gptText    && !gptText.startsWith('Error')    && gptText    !== 'No response received.';
  const hasClaude = claudeText && !claudeText.startsWith('Error') && claudeText !== 'No response received.';
  const hasGemini = geminiText && !geminiText.startsWith('Error') && geminiText !== 'No response received.';

  const sections = [];
  if (hasGPT)    sections.push(`[ChatGPT]\n${gptText}`);
  if (hasGemini) sections.push(`[Gemini]\n${geminiText}`);
  if (hasClaude) sections.push(`[Your initial response]\n${claudeText}`);

  if (sections.length === 0) {
    return `Answer this question directly with your best response:\n\n${originalPrompt}`;
  }

  return `Question: "${originalPrompt}"

${sections.join('\n\n')}

Synthesize the above into one clear, comprehensive final answer. Combine the best points from each response without repeating yourself.`;
}

// ── Main export ───────────────────────────────────────────────────────────

async function runPromptOnAllLLMs(prompt, onProgress) {
  const { context } = await getContext();

  onProgress && onProgress('running', {});
  const t0 = Date.now();

  // Step 1: Run all 3 in parallel
  const [gptText, claudeInitial, geminiText] = await Promise.all([
    runChatGPT(context, prompt).then(r => {
      onProgress && onProgress('partial', { openai: r });
      return r;
    }),
    runClaude(context, prompt).then(r => {
      onProgress && onProgress('partial', { claude: 'Synthesizing all 3 responses...' });
      return r;
    }),
    runGemini(context, prompt).then(r => {
      onProgress && onProgress('partial', { gemini: r });
      return r;
    }),
  ]);

  // Step 2: Claude synthesizes all 3 into final answer
  const synthesisPrompt = buildSynthesisPrompt(prompt, gptText, claudeInitial, geminiText);
  const claudeFinal = await runClaude(context, synthesisPrompt);

  onProgress && onProgress('partial', { claude: claudeFinal });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  return { openai: gptText, claude: claudeFinal, gemini: geminiText, elapsed };
}

module.exports = { runPromptOnAllLLMs };
