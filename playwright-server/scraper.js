const { chromium } = require('playwright');

const CDP_URL = 'http://localhost:9222';
const TIMEOUT  = 120_000;
const DR_TIMEOUT = 600_000; // 10 min — deep research can take a long time

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

function cleanClaudeResponse(rawText) {
  if (!rawText) return '';

  let text = String(rawText)
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();

  const claudeRespondedMatches = [...text.matchAll(/Claude responded:\s*([\s\S]*?)(?=\n(?:\d{1,2}:\d{2}\s*(?:AM|PM)?|Claude responded:|Share|Show more|Sonnet|Claude is AI)|$)/gi)];
  if (claudeRespondedMatches.length) {
    text = claudeRespondedMatches[claudeRespondedMatches.length - 1][1].trim();
  }

  const leakedFollowUpPrompt = text.match(/Answer the follow-up using the previous Claude answer as context\.[\s\S]*?(?:necessary\.)\s*([\s\S]*)$/i);
  if (leakedFollowUpPrompt) {
    text = leakedFollowUpPrompt[1].trim();
  }

  const cleaned = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      if (/^active node$/i.test(line)) return false;
      if (/^Claude finished the response$/i.test(line)) return false;
      if (/^You said:/i.test(line)) return false;
      if (/^Question:\s*"/i.test(line)) return false;
      if (/^Original question:$/i.test(line)) return false;
      if (/^Previous Claude answer:$/i.test(line)) return false;
      if (/^Follow-up question:$/i.test(line)) return false;
      if (/^Answer the follow-up using/i.test(line)) return false;
      if (/^\[(ChatGPT|Gemini|Your initial response|Claude)\]$/i.test(line)) return false;
      if (/^Synthesize the above into one clear/i.test(line)) return false;
      if (/^Show more$/i.test(line)) return false;
      if (/^Share$/i.test(line)) return false;
      if (/^Sonnet\s/i.test(line)) return false;
      if (/^Claude is AI and can make mistakes/i.test(line)) return false;
      if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(line)) return false;
      if (/^["']$/.test(line)) return false;
      return true;
    });

  return cleaned.join('\n').trim();
}

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

// ── ChatGPT Deep Research ─────────────────────────────────────────────────

async function runChatGPTDeepResearch(context, prompt) {
  const page = await context.newPage();
  try {
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('#prompt-textarea', { timeout: 30_000 });
    await page.waitForTimeout(1000);

    // Click the "+" button to open the tools/attach menu
    let menuOpened = false;
    const plusSelectors = [
      'button[aria-label="Attach files"]',
      'button[aria-label="Add attachment"]',
      'button[aria-label="Add files and more"]',
      '[data-testid="composer-button"]',
    ];
    for (const sel of plusSelectors) {
      try {
        await page.click(sel, { timeout: 3_000 });
        menuOpened = true;
        console.log('[ChatGPT-DR] Opened menu via:', sel);
        break;
      } catch {}
    }

    if (menuOpened) {
      await page.waitForTimeout(600);
      try {
        await page.click('text=Deep research', { timeout: 4_000 });
        console.log('[ChatGPT-DR] Deep research selected');
        await page.waitForTimeout(500);
      } catch {
        console.log('[ChatGPT-DR] Deep research option not found in menu, using normal mode');
      }
    } else {
      console.log('[ChatGPT-DR] + button not found, using normal mode');
    }

    // Type the prompt
    await page.click('#prompt-textarea');
    await page.waitForTimeout(300);
    await page.evaluate(({ content }) => {
      const el = document.querySelector('#prompt-textarea');
      if (!el) return;
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, content);
    }, { content: prompt });
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');

    // ChatGPT shows a research plan card with Edit / Cancel / Start buttons.
    // Wait up to 15s for it, then click the exact "Start" button.
    try {
      await page.waitForFunction(
        () => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Start'),
        { timeout: 15_000 }
      );
      const clicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Start');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (clicked) {
        console.log('[ChatGPT-DR] Clicked Start on research plan');
        await page.waitForTimeout(1000);
      }
    } catch {
      console.log('[ChatGPT-DR] No research plan card detected, proceeding directly');
    }

    // Wait for generation (deep research can take many minutes)
    await page.waitForSelector('[data-testid="stop-button"]', { timeout: 30_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="stop-button"]', { state: 'hidden', timeout: DR_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(1500);

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

// ── Gemini Deep Research ──────────────────────────────────────────────────

async function runGeminiDeepResearch(context, prompt) {
  const page = await context.newPage();
  try {
    await page.goto('https://gemini.google.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const inputSel = 'rich-textarea .ql-editor, .input-area-container [contenteditable="true"]';
    await page.waitForSelector(inputSel, { timeout: 30_000 });
    await page.waitForTimeout(1000);

    // Click the "Tools" button to open the tools menu
    let menuOpened = false;
    const toolsSelectors = [
      'button[aria-label="Tools"]',
      'button[data-test-id="tools-button"]',
      '[aria-label="More options"]',
    ];
    for (const sel of toolsSelectors) {
      try {
        await page.click(sel, { timeout: 3_000 });
        menuOpened = true;
        console.log('[Gemini-DR] Opened tools menu via:', sel);
        break;
      } catch {}
    }
    if (!menuOpened) {
      try {
        await page.click('text=Tools', { timeout: 3_000 });
        menuOpened = true;
        console.log('[Gemini-DR] Opened tools menu via text=Tools');
      } catch {}
    }

    if (menuOpened) {
      await page.waitForTimeout(600);
      try {
        await page.click('text=Deep Research', { timeout: 4_000 });
        console.log('[Gemini-DR] Deep Research selected');
        await page.waitForTimeout(500);
      } catch {
        console.log('[Gemini-DR] Deep Research option not found in menu, using normal mode');
      }
    } else {
      console.log('[Gemini-DR] Tools button not found, using normal mode');
    }

    // Type the prompt
    await pasteIntoEditor(page, inputSel, prompt);
    await page.keyboard.press('Enter');

    // Gemini shows a research plan card with "Edit plan" / "Start research" buttons.
    // Wait up to 15s for it, then click the exact "Start research" button.
    try {
      await page.waitForFunction(
        () => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Start research'),
        { timeout: 15_000 }
      );
      const clicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Start research');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (clicked) {
        console.log('[Gemini-DR] Clicked Start research on research plan');
        await page.waitForTimeout(1000);
      }
    } catch {
      console.log('[Gemini-DR] No research plan card detected, proceeding directly');
    }

    // Wait for generation (deep research can take many minutes)
    const loadingSel = 'model-response [aria-label="loading"], .loading-indicator, mat-spinner';
    await page.waitForSelector(loadingSel, { timeout: 30_000 }).catch(() => {});
    await page.waitForSelector(loadingSel, { state: 'hidden', timeout: DR_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(1500);

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

    const copiedTextRaw = await page.evaluate(async () => {
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };
      const copyButtons = [...document.querySelectorAll('button')]
        .filter(btn => isVisible(btn) && /copy/i.test(`${btn.innerText} ${btn.getAttribute('aria-label') || ''} ${btn.title || ''}`));
      const lastCopyButton = copyButtons[copyButtons.length - 1];
      if (!lastCopyButton) return '';
      lastCopyButton.click();
      await new Promise(resolve => setTimeout(resolve, 300));
      return navigator.clipboard.readText().catch(() => '');
    }).catch(() => '');
    const copiedText = copiedTextRaw.trim() && copiedTextRaw.trim() !== text.trim() ? copiedTextRaw : '';

    // Extract only the last Claude assistant response
    const responseText = copiedText || await page.evaluate(() => {
      // 1. Specific assistant message containers (most reliable)
      const specificSelectors = [
        '[data-testid="assistant-message"]',
        '[data-testid="message-content"]',
        '.font-claude-message',
        '[class*="AssistantMessage"]',
        '[class*="assistant-message"]',
      ];
      for (const sel of specificSelectors) {
        const els = [...document.querySelectorAll(sel)];
        if (els.length) return els[els.length - 1].innerText.trim();
      }

      // 2. Prose/content selectors — take the LAST one only (not the longest)
      const proseSelectors = ['.prose', '[class*="prose"]', '[class*="message-content"]'];
      for (const sel of proseSelectors) {
        const els = [...document.querySelectorAll(sel)].filter(el => el.innerText.trim().length > 10);
        if (els.length) return els[els.length - 1].innerText.trim();
      }

      return '';
    });

    const cleanText = cleanClaudeResponse(responseText);
    console.log('[Claude] Response:', cleanText.length, 'chars');
    return cleanText || 'No response received.';
  } catch (e) {
    console.error('[Claude] Error:', e.message);
    return `Error: ${e.message}`;
  } finally {
    await page.close();
  }
}

// ── Synthesis ─────────────────────────────────────────────────────────────

function buildFollowUpPrompt(originalPrompt, previousAnswer, followUpQuestion) {
  return `Original question:
${originalPrompt}

Previous Claude answer:
${previousAnswer}

Follow-up question:
${followUpQuestion}

Answer the follow-up using the previous Claude answer as context. Return only the answer to the follow-up. Do not repeat the full previous answer unless it is necessary.`;
}

function buildFollowUpSourcePrompt(originalPrompt, previousAnswer, followUpQuestion) {
  return `Original question:
${originalPrompt}

Current conversation context:
${previousAnswer}

Follow-up question:
${followUpQuestion}

Answer only the follow-up question using the conversation context.`;
}

async function runSelectedSources(context, prompt, selectedModels, onProgress, deepResearch = false) {
  const selected = new Set(selectedModels && selectedModels.length ? selectedModels : ['openai', 'gemini', 'claude']);
  const startGate = new Promise(resolve => setImmediate(resolve));
  const start = (key, runner) => selected.has(key)
    ? startGate.then(runner)
    : Promise.resolve('');

  const chatGPTRunner = deepResearch ? runChatGPTDeepResearch : runChatGPT;
  const geminiRunner  = deepResearch ? runGeminiDeepResearch  : runGemini;

  const openaiTask = start('openai', () => chatGPTRunner(context, prompt).then(r => {
    onProgress && onProgress('partial', { openai: r });
    return r;
  }));
  const claudeTask = start('claude', () => runClaude(context, prompt).then(r => {
    onProgress && onProgress('partial', { claude: 'Synthesizing selected responses...' });
    return r;
  }));
  const geminiTask = start('gemini', () => geminiRunner(context, prompt).then(r => {
    onProgress && onProgress('partial', { gemini: r });
    return r;
  }));

  return Promise.all([openaiTask, claudeTask, geminiTask]);
}

function buildSynthesisPrompt(originalPrompt, gptText, claudeText, geminiText) {
  const hasGPT    = gptText    && !gptText.startsWith('Error')    && gptText    !== 'No response received.';
  const hasClaude = claudeText && !claudeText.startsWith('Error') && claudeText !== 'No response received.';
  const hasGemini = geminiText && !geminiText.startsWith('Error') && geminiText !== 'No response received.';

  const sections = [];
  if (hasGPT)    sections.push(`[ChatGPT]\n${gptText}`);
  if (hasGemini) sections.push(`[Gemini]\n${geminiText}`);
  if (hasClaude) sections.push(`[Claude]\n${claudeText}`);

  if (sections.length === 0) {
    return `Answer this question directly with your best response:\n\n${originalPrompt}`;
  }

  return `Question: "${originalPrompt}"

${sections.join('\n\n')}

Synthesize the above into one clear, comprehensive final answer. Return only the final answer content. Do not include source labels, UI text, timestamps, or repeated prompt text.`;
}

// ── Main export ───────────────────────────────────────────────────────────

async function runPromptOnAllLLMs(prompt, onProgress, selectedModels = ['openai', 'gemini', 'claude'], deepResearch = false) {
  const { context } = await getContext();

  onProgress && onProgress('running', {});
  const t0 = Date.now();

  // Step 1: Queue every selected source first, then release all runners together.
  const [gptText, claudeInitial, geminiText] = await runSelectedSources(context, prompt, selectedModels, onProgress, deepResearch);

  // Step 2: Claude synthesizes all 3 into final answer
  const synthesisPrompt = buildSynthesisPrompt(prompt, gptText, claudeInitial, geminiText);
  const claudeFinal = await runClaude(context, synthesisPrompt);

  onProgress && onProgress('partial', { claude: claudeFinal });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  return { openai: gptText, claude: claudeFinal, gemini: geminiText, elapsed };
}

async function runClaudeFollowUp({ originalPrompt, previousAnswer, followUpQuestion, selectedModels = ['openai', 'gemini', 'claude'] }) {
  const { context } = await getContext();
  const selected = new Set(selectedModels && selectedModels.length ? selectedModels : ['openai', 'gemini', 'claude']);
  const sourcePrompt = buildFollowUpSourcePrompt(originalPrompt, previousAnswer, followUpQuestion);
  const t0 = Date.now();

  const [gptText, claudeText, geminiText] = await runSelectedSources(context, sourcePrompt, [...selected], null);

  const synthesisPrompt = buildSynthesisPrompt(followUpQuestion, gptText, claudeText, geminiText);
  const answer = await runClaude(context, synthesisPrompt);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  return { claude: answer, elapsed };
}

module.exports = { runPromptOnAllLLMs, runClaudeFollowUp };
