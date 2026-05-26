const { getClientContext, validateClientSessions } = require('./session-manager');

const TIMEOUT    = 120_000;
const DR_TIMEOUT = 600_000;

// ── Connect to already-running Chrome ─────────────────────────────────────

async function getContext(clientId) {
  let session;
  try {
    session = await getClientContext(clientId, { visible: false });
  } catch (e) {
    throw new Error(`Cannot launch Chrome for this client profile. ${e.message}`);
  }
  const { context } = session;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  // Hide Chrome: move it off-screen (-32000,-32000) at 1×1 px, then minimize.
  // The off-screen position ensures Chrome is invisible even if Windows
  // decides to un-minimize it during navigation. CDP events work fine
  // regardless of window state or position.
  try {
    const pages = context.pages();
    const refPage = pages.length > 0 ? pages[0] : await context.newPage();
    const cdp = await context.newCDPSession(refPage);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    // First restore to 'normal' so we can reposition, then move off-screen
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal', left: -32000, top: -32000, width: 1280, height: 900 },
    });
    // Then minimize — window is both off-screen AND minimized
    await cdp.detach();
    console.log('[Chrome] Window hidden off-screen');
  } catch (e) {
    console.log('[Chrome] Could not hide window (non-fatal):', e.message);
  }

  return { context, clientId: session.clientId, profilePath: session.profilePath };
}

// ── Hide Chrome window (off-screen + minimized) ───────────────────────────

async function hideChrome(context) {
  try {
    const pages = context.pages();
    if (!pages.length) return;
    const cdp = await context.newCDPSession(pages[0]);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', {
      windowId, bounds: { windowState: 'normal', left: -32000, top: -32000, width: 1280, height: 900 },
    });
    await cdp.detach();
  } catch { /* non-fatal */ }
}

// ── Shared: type into any contenteditable ─────────────────────────────────

async function pasteIntoEditor(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 30_000 });
  // Use evaluate to focus — page.click() fails when window is off-screen/minimized (element outside viewport)
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) { el.focus(); el.click(); }
  }, selector);
  await page.waitForTimeout(500);
  await page.evaluate(({ sel, content }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, content);
  }, { sel: selector, content: text });
  await page.waitForTimeout(300);
}

// ── Clean Claude.ai UI chrome from scraped text ───────────────────────────

function cleanClaudeResponse(rawText) {
  if (!rawText) return '';

  let text = String(rawText)
    .replace(/\r\n/g, '\n')
    .replace(/ /g, ' ')
    .trim();

  // If the synthesis prompt leaked in (clipboard contamination), truncate at our known instruction markers
  const instructionMarkers = [
    /\nSynthesize the above into one clear/i,
    /\nReturn ONLY the final synthesized answer/i,
    /\nUse ## for section headings/i,
    /\nAnswer this question directly with your best response:/i,
  ];
  for (const marker of instructionMarkers) {
    const idx = text.search(marker);
    if (idx > 100) { text = text.slice(0, idx).trim(); break; }
  }

  // Strip knowledge-cutoff disclaimers Claude sometimes appends
  text = text
    .replace(/\n{1,2}(?:However[,—–]?\s*)?(?:my|My) (?:reliable )?knowledge (?:cuts? off|cutoff)[\s\S]{0,400}/gi, '')
    .replace(/\n{1,2}(?:For what(?:'s| is) actually|For the (?:real-time|latest|freshest|actual) picture)[\s\S]{0,300}/gi, '')
    .replace(/\n{1,2}(?:You could also|Want me to do|I(?:'d|'d) recommend checking)[\s\S]{0,200}/gi, '')
    .trim();

  const claudeRespondedMatches = [...text.matchAll(/Claude responded:\s*([\s\S]*?)(?=\n(?:\d{1,2}:\d{2}\s*(?:AM|PM)?|Claude responded:|Share|Show more|Sonnet|Opus|Haiku|Claude is AI)|$)/gi)];
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
      if (/^(Sonnet|Opus|Haiku)\s/i.test(line)) return false;
      if (/^Claude is AI and can make mistakes/i.test(line)) return false;
      if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(line)) return false;
      if (/^["']$/.test(line)) return false;
      if (/^Export to (Sheets|CSV|PDF)$/i.test(line)) return false;
      if (/^Copy (table|link|code)$/i.test(line)) return false;
      if (/^(Like|Dislike|Report|Thumbs (up|down))$/i.test(line)) return false;
      return true;
    });

  return cleaned.join('\n').trim();
}

// ── ChatGPT ───────────────────────────────────────────────────────────────
// existingPage: pre-created page passed in for true parallelism

async function runChatGPT(context, prompt, existingPage = null) {
  const page = existingPage || await context.newPage();
  try {
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    hideChrome(context);

    // Find input — try multiple selectors in case ChatGPT updates its DOM
    const INPUT_SELECTORS = [
      '#prompt-textarea',
      '[data-testid="prompt-textarea"]',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-id]',
      'div[contenteditable="true"]',
      'textarea',
    ];
    let inputSel = null;
    for (const sel of INPUT_SELECTORS) {
      const found = await page.waitForSelector(sel, { timeout: 10_000 }).then(() => true).catch(() => false);
      if (found) { inputSel = sel; console.log('[ChatGPT] Input found:', sel); break; }
    }
    if (!inputSel) return 'Error: ChatGPT input area not found. Please make sure you are logged in to ChatGPT.';

    // Focus via evaluate — page.click() fails when window is off-screen/minimized
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) { el.focus(); el.click(); }
    }, inputSel);
    await page.waitForTimeout(400);

    // Method 1: clipboard paste — most reliable for React contenteditable (fires native paste event)
    await page.evaluate(async (text) => {
      try { await navigator.clipboard.writeText(text); } catch {}
    }, prompt);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(500);

    let inputLen = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? (el.innerText || el.value || '').trim().length : 0;
    }, inputSel).catch(() => 0);

    // Method 2: keyboard.type — character-by-character, always triggers key events
    if (inputLen < 3) {
      console.log('[ChatGPT] Clipboard paste failed — using keyboard.type');
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) { el.focus(); el.click(); }
      }, inputSel);
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Delete');
      await page.waitForTimeout(100);
      await page.keyboard.type(prompt.slice(0, 800), { delay: 10 });
      await page.waitForTimeout(300);
      inputLen = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? (el.innerText || el.value || '').trim().length : 0;
      }, inputSel).catch(() => 0);
    }

    console.log('[ChatGPT] Input length after typing:', inputLen, '/ prompt:', prompt.length);
    if (inputLen < 3) return 'Error: Could not type into ChatGPT. Make sure you are logged in.';

    // Submit via send button, fall back to Enter
    const submitted = await page.evaluate(() => {
      const SEND_SELECTORS = [
        'button[data-testid="send-button"]',
        'button[aria-label="Send message"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label*="send" i]',
        'button[type="submit"]',
      ];
      for (const sel of SEND_SELECTORS) {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled && !btn.getAttribute('aria-disabled')) { btn.click(); return sel; }
      }
      return null;
    });
    if (submitted) {
      console.log('[ChatGPT] Sent via button:', submitted);
    } else {
      await page.keyboard.press('Enter');
      console.log('[ChatGPT] Sent via Enter key');
    }

    // Wait for stop button (generation started) then for it to disappear (generation done)
    const STOP_SELECTORS = [
      '[data-testid="stop-button"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label="Stop streaming"]',
      'button[aria-label="Stop"]',
      'button[aria-label*="stop" i]',
    ];
    let stopFound = false;
    for (const sel of STOP_SELECTORS) {
      const found = await page.waitForSelector(sel, { timeout: 15_000 }).then(() => true).catch(() => false);
      if (found) {
        console.log('[ChatGPT] Stop button:', sel);
        await page.waitForSelector(sel, { state: 'hidden', timeout: TIMEOUT }).catch(() => {});
        stopFound = true;
        break;
      }
    }

    // Fallback: stability poll — works even when stop-button selector changes
    if (!stopFound) {
      console.log('[ChatGPT] No stop button found — using stability poll');
      await page.evaluate(() => { window.__gptStable = 0; window.__gptLast = -1; });
      await page.waitForFunction(() => {
        const sels = [
          '[data-message-author-role="assistant"]',
          '[data-testid="conversation-turn-assistant"]',
          '.agent-turn',
        ];
        let len = 0;
        for (const sel of sels) {
          const els = document.querySelectorAll(sel);
          if (els.length) { len = els[els.length - 1].innerText.length; break; }
        }
        if (len > 30 && len === window.__gptLast) return ++window.__gptStable >= 3;
        window.__gptStable = 0;
        window.__gptLast = len;
        return false;
      }, { timeout: TIMEOUT, polling: 700 }).catch(() => {});
    }

    await page.waitForTimeout(800);

    // Read response — try selectors from most specific to broadest
    const RESPONSE_SELECTORS = [
      '[data-message-author-role="assistant"]',
      '[data-testid="conversation-turn-assistant"] .markdown',
      '[data-testid="conversation-turn-assistant"]',
      '.agent-turn .markdown',
      '.agent-turn',
    ];
    for (const sel of RESPONSE_SELECTORS) {
      const msgs = await page.$$eval(sel, els => els.map(el => el.innerText.trim())).catch(() => []);
      const valid = msgs.filter(t => t.length > 20);
      if (valid.length) {
        console.log('[ChatGPT] Response read via:', sel, '| chars:', valid[valid.length - 1].length);
        return valid[valid.length - 1];
      }
    }

    return 'No response received.';
  } catch (e) {
    console.error('[ChatGPT] Error:', e.message);
    return `Error: ${e.message}`;
  } finally {
    await page.close();
  }
}

// ── Gemini ────────────────────────────────────────────────────────────────

function normalizeGeminiText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGeminiNoResponseText(text) {
  return !String(text || '').trim() ||
    /^No response(?: received)?(?: from Gemini)?\.?$/i.test(String(text || '').trim());
}

function isGeminiUiLine(line, prompt = '') {
  const t = line.trim();
  const normalized = normalizeGeminiText(t);
  const normalizedPrompt = normalizeGeminiText(prompt);
  if (!t) return true;
  if (normalizedPrompt && normalized === normalizedPrompt) return true;
  if (/^(Gemini|Gemini said|You said|Gemini Apps|Conversation with Gemini|Temporary chats|Welcome, stranger|Copy|Copied|Share|Export|Reload|More|Settings|Help)$/i.test(t)) return true;
  if (/^(Flash|Flash-Lite|Pro|Advanced|Deep Research)$/i.test(t)) return true;
  if (/^(Opens in a new window|don't appear in recent chats|and aren't used to improve Google AI\.?|Stored for \d+ hours for safety\.?)$/i.test(t)) return true;
  if (/^(Export to (Sheets|CSV|PDF)|Like|Dislike|Report|Thumbs (up|down)|Copy table|Regenerate|Listen)$/i.test(t)) return true;
  if (/^(Google apps|Google Account|Sign in|Try Gemini Advanced|Upgrade|New chat|Recent|Extensions)$/i.test(t)) return true;
  // Citation chips: "Source Name + N"
  if (/^.{2,80}\s\+\s\d+$/.test(t)) return true;
  // Follow-up suggestion chips & closing remarks
  if (/^(Yes|No|Tell me more|Learn more|Explain more|Show me|Give me|What about)$/i.test(t)) return true;
  if (/^Would you like to\b/i.test(t)) return true;
  if (/^Gemini (is AI|can make)/i.test(t)) return true;
  return false;
}

function extractGeminiText(raw, prompt = '') {
  if (!raw) return '';
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => !isGeminiUiLine(line, prompt))
    .join('\n')
    .replace(/^Gemini said\s*/gim, '')
    .replace(/^You said\s*/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scoreGeminiCandidate(text, prompt = '') {
  const clean = extractGeminiText(text, prompt);
  if (!clean) return 0;

  const normalized = normalizeGeminiText(clean);
  const normalizedPrompt = normalizeGeminiText(prompt);
  if (normalizedPrompt && normalized === normalizedPrompt) return 0;
  if (clean.length < 60) return Math.min(clean.length, 30);

  let score = Math.min(clean.length, 120);
  if (/[.!?]\s/.test(clean)) score += 20;
  if (/\n\s*(\d+\.|-|\*)\s+\S/.test(clean)) score += 20;
  if (/\b(because|for example|important|trend|design|AI|users?|teams?|data|model|response)\b/i.test(clean)) score += 10;
  if (/^(Gemini|Flash-Lite|Conversation with Gemini|Temporary chats)/im.test(clean)) score -= 60;
  if (/Opens in a new window|Stored for \d+ hours for safety|Welcome, stranger/i.test(clean)) score -= 60;
  return Math.max(0, score);
}

function isStrictGeminiAnswerSelector(selector = '') {
  return /message-content|model-response/i.test(selector) &&
    !/chat-turn|response-container/i.test(selector);
}

async function getGeminiResponseSnapshot(page, prompt = '') {
  return await page.evaluate(() => {
    const sels = [
      'model-response',
      'message-content',
      'ms-chat-turn',
      '[class*="model-response"]',
      '[class*="response-container"]',
      '[class*="chat-turn"]',
    ];
    const seen = new Set();
    const nodes = [];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (!seen.has(el)) {
          seen.add(el);
          nodes.push(el);
        }
      }
    }
    return {
      count: nodes.length,
      maxTextLength: nodes.reduce((max, el) => Math.max(max, (el.innerText || '').trim().length), 0),
      bodyLength: (document.body.innerText || '').trim().length,
    };
  }).catch(() => ({ count: 0, maxTextLength: 0, bodyLength: 0 }));
}

// ── Input: try 3 methods in order until text appears in the editor ─────────

async function typeIntoGemini(page, prompt) {
  await page.waitForTimeout(1500); // let Gemini's Angular components fully initialise

  // Ordered from most specific to broadest
  const INPUT_SELECTORS = [
    'rich-textarea .ql-editor',
    'div.ql-editor[contenteditable="true"]',
    '.input-area-container [contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
    'p-textarea textarea, mat-form-field textarea',
    'div[contenteditable="true"]',
    'textarea',
  ];

  let inputSel = null;
  for (const sel of INPUT_SELECTORS) {
    try {
      const el = await page.$(sel);
      if (el && await el.isVisible().catch(() => false)) {
        inputSel = sel;
        console.log('[Gemini] Input found:', sel);
        break;
      }
    } catch {}
  }

  // Second pass with waitForSelector in case components are still mounting
  if (!inputSel) {
    for (const sel of INPUT_SELECTORS) {
      const found = await page.waitForSelector(sel, { timeout: 5_000 }).then(() => true).catch(() => false);
      if (found) { inputSel = sel; break; }
    }
  }

  if (!inputSel) throw new Error(`Gemini: no input field found. Page URL: ${page.url()}`);

  const focus = async () => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) { el.focus(); el.click(); }
  }, inputSel);

  // ── Method 1: clipboard paste (most reliable for Quill — fires proper paste events) ──
  await focus();
  await page.waitForTimeout(200);
  await page.evaluate(async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* non-fatal */ }
  }, prompt);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(400);

  // Verify text landed in the input
  let inputLen = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? (el.innerText || el.value || '').trim().length : 0;
  }, inputSel).catch(() => 0);

  if (inputLen >= 3) {
    await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return;
      const text = (el.innerText || el.value || '').trim();
      el.focus();
      el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      el.dispatchEvent(new Event('keyup', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.closest('rich-textarea, .input-area-container, form')?.dispatchEvent(new Event('input', { bubbles: true }));
    }, inputSel);
    await page.waitForTimeout(700);
  }

  // ── Method 2: execCommand insertText (fires input events manually) ─────────
  if (inputLen < 3) {
    console.log('[Gemini] Clipboard paste failed — trying execCommand');
    await focus();
    await page.waitForTimeout(200);
    await page.evaluate(({ s, text }) => {
      const el = document.querySelector(s);
      if (!el) return;
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      // Manually fire input + change events so Quill/Angular picks it up
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, { s: inputSel, text: prompt });
    await page.waitForTimeout(400);

    inputLen = await page.evaluate((s) => {
      const el = document.querySelector(s);
      return el ? (el.innerText || el.value || '').trim().length : 0;
    }, inputSel).catch(() => 0);
  }

  // ── Method 3: keyboard.type — character-by-character, always triggers key events ──
  if (inputLen < 3) {
    console.log('[Gemini] execCommand failed — using keyboard.type');
    await focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(100);
    // Type at most 800 chars to avoid timeouts on very long prompts
    await page.keyboard.type(prompt.slice(0, 800), { delay: 8 });
    await page.waitForTimeout(300);
  }

  console.log('[Gemini] Input length after typing:', inputLen, '/ prompt:', prompt.length);
}

// ── Submit Gemini prompt (click send button or fall back to Enter) ─────────
// After clipboard paste focus leaves the Quill editor, so bare keyboard.press('Enter')
// goes nowhere. We find and click the send button explicitly; Enter is only used
// as a last resort after re-focusing the editor.

async function submitGeminiPrompt(page) {
  // Try clicking the send button directly (most reliable)
  const clicked = await page.evaluate(() => {
    const SEND_SELECTORS = [
      'button[aria-label="Send message"]',
      'button[aria-label="Submit"]',
      'button[aria-label="Submit prompt"]',
      'button[aria-label*="send" i]',
      'button[aria-label*="submit" i]',
      'button[data-test-id="send-button"]',
      'button[jsname="Qxfate"]',   // Google's internal name sometimes used for send
      '.send-button',
    ];
    for (const sel of SEND_SELECTORS) {
      try {
        const buttons = [...document.querySelectorAll(sel)];
        const btn = buttons.find(b => !b.disabled && !b.getAttribute('aria-disabled'));
        if (btn) {
          btn.scrollIntoView?.({ block: 'center', inline: 'center' });
          btn.click();
          return sel;
        }
      } catch {}
    }
    // Broad fallback: only inspect buttons inside/near the composer so page
    // menus, voice controls, and sidebar actions are never clicked as "send".
    const footer = document.querySelector('.input-area-container, rich-textarea, [class*="input-area"]');
    if (footer) {
      const root = footer.closest('form, .input-wrapper, [class*="input"]') || footer.parentElement;
      const btns = [...root?.querySelectorAll('button:not([disabled])') || []]
        .filter(btn => {
          const label = `${btn.getAttribute('aria-label') || ''} ${btn.textContent || ''}`;
          return !btn.getAttribute('aria-disabled') && /send|submit/i.test(label);
        });
      if (btns.length) {
        btns[btns.length - 1].scrollIntoView?.({ block: 'center', inline: 'center' });
        btns[btns.length - 1].click();
        return 'composer-send-button';
      }
    }
    return null;
  });

  if (clicked) {
    console.log('[Gemini] Sent via button:', clicked);
    return;
  }

  // Fallback: re-focus editor then press Enter
  console.log('[Gemini] No send button found — re-focusing editor and pressing Enter');
  await page.evaluate(() => {
    const el = document.querySelector('rich-textarea .ql-editor, div.ql-editor[contenteditable="true"], div[contenteditable="true"]');
    if (el) { el.focus(); el.click(); }
  });
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
}

async function ensureGeminiPromptSubmitted(page, prompt) {
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const expected = normalize(prompt);
  if (!expected) return;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.waitForTimeout(900);
    const state = await page.evaluate((expectedPrompt) => {
      const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const editor = document.querySelector(
        'rich-textarea .ql-editor, div.ql-editor[contenteditable="true"], .input-area-container [contenteditable="true"], div[contenteditable="true"][data-placeholder], textarea'
      );
      const editorText = normalizeText(editor?.innerText || editor?.value || '');
      const promptStillInEditor = editorText.includes(expectedPrompt);
      const hasStopButton = [...document.querySelectorAll('button')]
        .some(btn => /stop|cancel/i.test(btn.getAttribute('aria-label') || btn.textContent || ''));
      const userTurnHasPrompt = [...document.querySelectorAll('user-query, user-query-content, [class*="user-query"], [class*="user-message"], [class*="query-text"]')]
        .some(el => normalizeText(el.innerText || el.textContent || '').includes(expectedPrompt));
      return { promptStillInEditor, hasStopButton, userTurnHasPrompt };
    }, expected).catch(() => ({ promptStillInEditor: false, hasStopButton: false, userTurnHasPrompt: false }));

    if (state.hasStopButton || state.userTurnHasPrompt || !state.promptStillInEditor) {
      return;
    }

    console.log(`[Gemini] Prompt still in editor after submit attempt ${attempt} - retrying send`);
    await submitGeminiPrompt(page);

    if (attempt === 2) {
      await page.evaluate(() => {
        const el = document.querySelector(
          'rich-textarea .ql-editor, div.ql-editor[contenteditable="true"], .input-area-container [contenteditable="true"], div[contenteditable="true"][data-placeholder], textarea'
        );
        if (el) { el.focus(); el.click(); }
      }).catch(() => {});
      await page.keyboard.press('Control+Enter').catch(() => {});
    }
  }
}

// ── Wait until Gemini finishes generating ─────────────────────────────────

async function waitForGeminiResponse(page, timeoutMs, baseline = {}, prompt = '') {
  // Step 1: confirm a response element appeared — wait up to 20s for any response container.
  // Cast a wide net: custom elements, class fragments, and role/data attributes.
  const RESPONSE_PRESENCE = [
    'model-response',
    'message-content',
    'ms-chat-turn',
    '[class*="model-response"]',
    '[class*="chat-turn"]',
    '[class*="response-container"]',
    '[data-response]',
    '.response-container',
    '[class*="response"]',
  ];
  const beforeCount = Number(baseline.count || 0);
  const beforeMaxTextLength = Number(baseline.maxTextLength || 0);

  await page.waitForFunction(
    ({ selectors, beforeCount, beforeMaxTextLength }) => {
      const nodes = [];
      const seen = new Set();
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) {
          if (!seen.has(el)) {
            seen.add(el);
            nodes.push(el);
          }
        }
      }
      const maxTextLength = nodes.reduce((max, el) => Math.max(max, (el.innerText || '').trim().length), 0);
      return nodes.length > beforeCount || maxTextLength > beforeMaxTextLength + 80;
    },
    { selectors: RESPONSE_PRESENCE, beforeCount, beforeMaxTextLength },
    { timeout: 35_000, polling: 500 }
  ).then(() => console.log('[Gemini] New/updated response element detected'))
    .catch(() => console.log('[Gemini] No new response element detected yet - continuing to stability wait'));

  // Step 2: watch for the stop button (■) and wait for it to disappear.
  // Also check for a "generating" / loading indicator in case the stop button name changed.
  const STOP_SELS = [
    'button[aria-label="Stop response"]',
    'button[aria-label="Stop streaming"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label="Stop"]',
    'button[aria-label*="stop" i]',
    'button[aria-label*="cancel" i]',
    '.stop-button',
    '[data-test-id="stop-button"]',
  ];
  let stopDetected = false;
  for (const sel of STOP_SELS) {
    const found = await page.waitForSelector(sel, { timeout: 8_000 }).then(() => true).catch(() => false);
    if (found) {
      console.log('[Gemini] Stop button:', sel);
      await page.waitForSelector(sel, { state: 'hidden', timeout: timeoutMs }).catch(() => {});
      stopDetected = true;
      break;
    }
  }

  // Step 3: stability poll — works regardless of custom-element naming
  // Polls ALL large text blocks on the page, not just model-response.
  if (!stopDetected) {
    await page.evaluate(() => { window.__gStable = 0; window.__gLast = -1; });
    await page.waitForFunction(({ beforeCount, beforeMaxTextLength }) => {
      // Gather text from any known response container OR fallback to body
      const candidates = [
        ...document.querySelectorAll('model-response, message-content, .response-container, [class*="response-text"], [class*="model-response"]'),
      ];
      const len = candidates.length
        ? Math.max(...candidates.map(el => el.innerText.length))
        : document.body.innerText.length;
      const hasNewNode = candidates.length > beforeCount;
      const hasLongGrowth = len > Math.max(80, beforeMaxTextLength + 40);
      const hasShortAnswer = hasNewNode && len > 3;
      if ((hasLongGrowth || hasShortAnswer) && len === window.__gLast) return ++window.__gStable >= 3;
      window.__gStable = 0;
      window.__gLast = len;
      return false;
    }, { beforeCount, beforeMaxTextLength }, { timeout: timeoutMs, polling: 700 }).catch(() => {});
  }

  await page.waitForTimeout(1000);
}

// ── Read the finished response ─────────────────────────────────────────────

async function readGeminiResponse(page, prompt = '') {
  const candidates = await page.evaluate(() => {
    const selectors = [
      'model-response .markdown',
      'model-response .markdown-main-panel',
      'model-response message-content .markdown',
      'model-response message-content',
      'message-content .markdown',
      'ms-chat-turn .markdown',
      'ms-chat-turn message-content',
      '[class*="model-response"] .markdown',
      '[class*="chat-turn"] .markdown',
      '.model-response-text',
      '.response-content',
      'model-response',
      'ms-chat-turn',
      '[class*="model-response"]',
    ];
    const removable = [
      'button', 'input', 'textarea', 'svg', 'mat-icon',
      'response-actions', '.response-actions',
      'follow-up-suggestions', '.follow-up-suggestions',
      'suggestion-chips', '.suggestion-chips',
      'response-sources', '.response-sources',
      '[role="button"]',
      '[aria-label*="Copy"]',
      '[aria-label*="Share"]',
    ];
    const out = [];
    const seen = new Set();
    for (const selector of selectors) {
      for (const [index, el] of [...document.querySelectorAll(selector)].entries()) {
        if (seen.has(el)) continue;
        seen.add(el);
        const clone = el.cloneNode(true);
        removable.forEach(sel => clone.querySelectorAll(sel).forEach(node => node.remove()));
        const text = (clone.innerText || clone.textContent || '').trim();
        if (text.length > 20) out.push({ selector, index, text });
      }
    }
    return out;
  }).catch(() => []);

  let best = null;
  for (const candidate of candidates) {
    const clean = extractGeminiText(candidate.text, prompt);
    const score = scoreGeminiCandidate(candidate.text, prompt);
    const strictShortAnswer = isStrictGeminiAnswerSelector(candidate.selector) && clean.length >= 3;
    if (!clean || (!strictShortAnswer && score < 40)) continue;
    if (!best || score >= best.score) {
      best = { ...candidate, clean, score };
    }
  }

  if (best) {
    console.log('[Gemini] Response read via:', best.selector, '| chars:', best.clean.length, '| score:', best.score);
    return best.clean;
  }
  // Progressively broader selectors — ordered from most specific to most general.
  // Covers the current Gemini Angular DOM and likely near-future variants.
  const SELECTORS = [
    'model-response .markdown',
    'model-response .markdown-main-panel',
    'model-response message-content .markdown',
    'model-response message-content',
    'message-content .markdown',
    'ms-chat-turn .markdown',
    'ms-chat-turn message-content',
    '[class*="model-response"] .markdown',
    '[class*="chat-turn"] .markdown',
    '.model-response-text',
    '.response-content',
    'model-response',
    'ms-chat-turn',
    '[class*="model-response"]',
  ];

  for (const sel of SELECTORS) {
    const msgs = await page.$$eval(sel, els =>
      els.map(el => el.innerText.trim()).filter(t => t.length > 30)
    ).catch(() => []);
    if (msgs.length) {
      const clean = extractGeminiText(msgs[msgs.length - 1], prompt);
      if ((isStrictGeminiAnswerSelector(sel) && clean.length >= 3) || scoreGeminiCandidate(clean, prompt) >= 60) {
        console.log('[Gemini] Response read via:', sel, '| chars:', clean.length);
        return clean;
      }
    }
  }

  // Fallback: clone response container and strip UI chrome elements
  const stripped = await page.evaluate(() => {
    const all = document.querySelectorAll('model-response, ms-chat-turn, message-content, [class*="model-response"], [class*="response-container"]');
    if (!all.length) return '';
    const last = all[all.length - 1].cloneNode(true);
    ['response-actions', '.response-actions', 'follow-up-suggestions',
      '.follow-up-suggestions', 'suggestion-chips', '.suggestion-chips',
      'response-sources', '.response-sources', 'button', 'input',
    ].forEach(s => last.querySelectorAll(s).forEach(el => el.remove()));
    return last.innerText.trim();
  }).catch(() => '');

  if (stripped.length > 30) {
    const clean = extractGeminiText(stripped, prompt);
    if (scoreGeminiCandidate(clean, prompt) >= 60) {
      console.log('[Gemini] Response read via stripped fallback | chars:', clean.length);
      return clean;
    }
  }

  // Last resort: scan whole page for the largest text block that isn't the input area
  const pageText = await page.evaluate(() => {
    const ignore = new Set();
    document.querySelectorAll('header, nav, footer, [role="navigation"], rich-textarea, textarea, input').forEach(el => ignore.add(el));
    const blocks = [...document.querySelectorAll('div, section, article, main')]
      .filter(el => !ignore.has(el) && ![...ignore].some(ign => ign.contains(el)))
      .map(el => el.innerText.trim())
      .filter(t => t.length > 100);
    if (!blocks.length) return '';
    return blocks.reduce((a, b) => a.length >= b.length ? a : b, '');
  }).catch(() => '');

  if (pageText.length > 50) {
    const clean = extractGeminiText(pageText, prompt);
    const containsAnswerMarker = /Gemini said|model-response|message-content/i.test(pageText);
    if (containsAnswerMarker && scoreGeminiCandidate(clean, prompt) >= 60) {
      console.log('[Gemini] Response read via page-text fallback | chars:', clean.length);
      return clean;
    }
  }

  console.log('[Gemini] No valid Gemini answer found');
  return 'No response received from Gemini.';
}

async function isGeminiLoggedIn(page) {
  // Definitive: redirected to Google's auth flow = not logged in
  if (page.url().includes('accounts.google.com')) return false;

  const initialAuthState = await page.evaluate(() => {
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const controls = [...document.querySelectorAll('a[href], button')];
    const hasVisibleSignIn = controls.some(el => isVisible(el) && /^sign\s*in$/i.test((el.textContent || '').trim()));
    const hasAccountControl = !!document.querySelector(
      'button[aria-label*="Google Account"], a[aria-label*="Google Account"], [data-ogsr-up], a[href*="SignOutOptions"]'
    );
    const pageText = document.body.innerText || '';
    const guestMode = /Welcome,\s*stranger|Meet Gemini,\s*your personal AI assistant/i.test(pageText);
    return { hasVisibleSignIn, hasAccountControl, guestMode };
  }).catch(() => ({ hasVisibleSignIn: false, hasAccountControl: false, guestMode: false }));

  if (initialAuthState.hasVisibleSignIn || initialAuthState.guestMode) return false;
  if (initialAuthState.hasAccountControl) return true;

  // Positive indicators — any one is sufficient.
  // Profile photos always load from googleusercontent.com when signed in.
  // Gemini puts the account section at the bottom-left sidebar (not top-right like other Google apps),
  // so we can't rely solely on button[aria-label*="Google Account"].
  const loggedIn = await page.evaluate(() => {
    if (document.querySelector('img[src*="googleusercontent.com"]')) return true;
    if (document.querySelector('button[aria-label*="Google Account"], a[aria-label*="Google Account"], [data-ogsr-up]')) return true;
    return false;
  }).catch(() => false);

  if (loggedIn) return true;

  // Wait a bit for lazy-loaded auth elements, then re-check
  await page.waitForTimeout(3000);
  const delayedAuthState = await page.evaluate(() => {
    const isVisible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const controls = [...document.querySelectorAll('a[href], button')];
    const hasVisibleSignIn = controls.some(el => isVisible(el) && /^sign\s*in$/i.test((el.textContent || '').trim()));
    const hasAccountControl = !!document.querySelector(
      'button[aria-label*="Google Account"], a[aria-label*="Google Account"], [data-ogsr-up], a[href*="SignOutOptions"]'
    );
    const pageText = document.body.innerText || '';
    const guestMode = /Welcome,\s*stranger|Meet Gemini,\s*your personal AI assistant/i.test(pageText);
    return { hasVisibleSignIn, hasAccountControl, guestMode };
  }).catch(() => ({ hasVisibleSignIn: false, hasAccountControl: false, guestMode: false }));
  if (delayedAuthState.hasVisibleSignIn || delayedAuthState.guestMode) return false;
  if (delayedAuthState.hasAccountControl) return true;
  const loggedInAfterWait = await page.evaluate(() => {
    if (document.querySelector('img[src*="googleusercontent.com"]')) return true;
    if (document.querySelector('button[aria-label*="Google Account"], a[aria-label*="Google Account"], [data-ogsr-up]')) return true;
    return false;
  }).catch(() => false);

  if (loggedInAfterWait) return true;

  // Only block if we positively detect a sign-in prompt — avoids false negatives on UI changes
  const hasSignInPrompt = await page.evaluate(() => {
    return !![...document.querySelectorAll('a[href], button')]
      .find(el => /^sign\s*in$/i.test(el.textContent.trim()));
  }).catch(() => false);

  return !hasSignInPrompt;
}

async function runGemini(context, prompt, existingPage = null) {
  const page = existingPage || await context.newPage();
  try {
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    hideChrome(context);

    // Guard: Gemini renders the text editor for guest/unauthenticated users too.
    // Detect sign-in state before attempting to submit a prompt.
    const loggedIn = await isGeminiLoggedIn(page);
    if (!loggedIn) {
      console.log('[Gemini] Not authenticated — aborting. Open Settings and log in to Google.');
      return 'Error: Gemini is not logged in. Open Settings → click "Show Chrome" → log in to your Google account, then click "Hide Chrome".';
    }

    const beforeSubmit = await getGeminiResponseSnapshot(page, prompt);
    await typeIntoGemini(page, prompt);
    await submitGeminiPrompt(page);
    await ensureGeminiPromptSubmitted(page, prompt);
    console.log('[Gemini] Prompt submitted, waiting for response...');
    await waitForGeminiResponse(page, TIMEOUT, beforeSubmit, prompt);
    return await readGeminiResponse(page, prompt);
  } catch (e) {
    console.error('[Gemini] Error:', e.message);
    return `Error: ${e.message}`;
  } finally {
    await page.close();
  }
}

// ── ChatGPT Deep Research ─────────────────────────────────────────────────

async function runChatGPTDeepResearch(context, prompt, existingPage = null) {
  const page = existingPage || await context.newPage();
  try {
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    hideChrome(context);
    await page.waitForSelector('#prompt-textarea', { timeout: 30_000 });
    await page.waitForTimeout(1000);

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
        console.log('[ChatGPT-DR] Deep research option not found, using normal mode');
      }
    } else {
      console.log('[ChatGPT-DR] + button not found, using normal mode');
    }

    // Focus via evaluate — page.click() fails when window is off-screen/minimized
    await page.evaluate(() => {
      const el = document.querySelector('#prompt-textarea');
      if (el) { el.focus(); el.click(); }
    });
    await page.waitForTimeout(400);

    // Method 1: clipboard paste (most reliable for React contenteditable)
    await page.evaluate(async (text) => {
      try { await navigator.clipboard.writeText(text); } catch {}
    }, prompt);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(500);

    let drInputLen = await page.evaluate(() => {
      const el = document.querySelector('#prompt-textarea');
      return el ? (el.innerText || el.value || '').trim().length : 0;
    }).catch(() => 0);

    // Method 2: keyboard.type fallback
    if (drInputLen < 3) {
      console.log('[ChatGPT-DR] Clipboard paste failed — using keyboard.type');
      await page.evaluate(() => {
        const el = document.querySelector('#prompt-textarea');
        if (el) { el.focus(); el.click(); }
      });
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Delete');
      await page.waitForTimeout(100);
      await page.keyboard.type(prompt.slice(0, 800), { delay: 10 });
      await page.waitForTimeout(300);
    }

    // Submit via send button, fall back to Enter
    const drSubmitted = await page.evaluate(() => {
      const sels = ['button[data-testid="send-button"]', 'button[aria-label="Send message"]', 'button[aria-label*="send" i]'];
      for (const sel of sels) {
        const btn = document.querySelector(sel);
        if (btn && !btn.disabled) { btn.click(); return sel; }
      }
      return null;
    });
    if (!drSubmitted) await page.keyboard.press('Enter');

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

async function runGeminiDeepResearch(context, prompt, existingPage = null) {
  const page = existingPage || await context.newPage();
  try {
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    hideChrome(context);

    const loggedIn = await isGeminiLoggedIn(page);
    if (!loggedIn) {
      console.log('[Gemini-DR] Not authenticated — aborting.');
      return 'Error: Gemini is not logged in. Open Settings → click "Show Chrome" → log in to your Google account, then click "Hide Chrome".';
    }

    await page.waitForTimeout(1000);

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
        console.log('[Gemini-DR] Deep Research option not found, using normal mode');
      }
    } else {
      console.log('[Gemini-DR] Tools button not found, using normal mode');
    }

    const beforeSubmit = await getGeminiResponseSnapshot(page, prompt);
    await typeIntoGemini(page, prompt);
    await submitGeminiPrompt(page);
    await ensureGeminiPromptSubmitted(page, prompt);

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

    await waitForGeminiResponse(page, DR_TIMEOUT, beforeSubmit, prompt);
    await page.waitForTimeout(700);
    return await readGeminiResponse(page, prompt);
  } catch (e) {
    return `Error: ${e.message}`;
  } finally {
    await page.close();
  }
}

// ── Claude ────────────────────────────────────────────────────────────────

async function runClaude(context, text, existingPage = null) {
  const page = existingPage || await context.newPage();
  try {
    console.log('[Claude] Loading page...');
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    hideChrome(context);
    await page.waitForTimeout(2000);

    const editorSel = await page.evaluate(() => {
      if (document.querySelector('.ProseMirror')) return '.ProseMirror';
      const ces = document.querySelectorAll('[contenteditable="true"]');
      return ces.length ? '[contenteditable="true"]' : null;
    });
    console.log('[Claude] Editor selector:', editorSel);
    if (!editorSel) return 'Error: Not logged in or editor not found on claude.ai';

    // Focus via evaluate — page.click() fails when window is off-screen/minimized
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) { el.focus(); el.click(); }
    }, editorSel);
    await page.waitForTimeout(400);

    // Use execCommand to paste (avoids polluting the clipboard with the prompt,
    // which would cause the later clipboard-read to return the prompt instead of Claude's response)
    await page.evaluate((content) => {
      const el = document.querySelector('.ProseMirror, [contenteditable="true"]');
      if (!el) return;
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, content);
    }, text);
    await page.waitForTimeout(600);

    const editorContent = await page.$eval(editorSel, el => el.innerText.trim()).catch(() => '');
    console.log('[Claude] Editor content after paste:', editorContent.length, 'chars');

    if (editorContent.length < 3) {
      // execCommand failed — fall back to clipboard paste but clear clipboard afterwards
      console.log('[Claude] execCommand paste failed, trying clipboard paste...');
      await page.evaluate(async (content) => {
        await navigator.clipboard.writeText(content);
      }, text);
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Control+v');
      await page.waitForTimeout(600);
      // Clear clipboard so it doesn't contaminate the response-read step
      await page.evaluate(async () => { await navigator.clipboard.writeText('').catch(() => {}); });
    }

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

    // ── Wait for generation to complete ──────────────────────────────────
    // Strategy A: race ALL known stop-button selectors simultaneously.
    // The first one that appears in the DOM wins; total wait = time to first
    // match (not 10 s × 4 selectors sequentially).
    const stopSelectors = [
      'button[aria-label="Stop"]',
      'button[aria-label="Stop generating"]',
      'button[aria-label="Stop response"]',
      '[data-testid="stop-button"]',
    ];
    const foundStopSel = await Promise.any(
      stopSelectors.map(sel =>
        page.waitForSelector(sel, { timeout: 12_000 }).then(() => sel)
      )
    ).catch(() => null);

    if (foundStopSel) {
      console.log('[Claude] Generating… stop button:', foundStopSel);
      await page.waitForSelector(foundStopSel, { state: 'hidden', timeout: TIMEOUT })
        .then(() => console.log('[Claude] Stop button gone — generation complete'))
        .catch(() => console.log('[Claude] Stop-button hidden timeout (continuing)'));
      // Brief settle so the very last rendered tokens are in the DOM
      await page.waitForTimeout(800);
    } else {
      // Strategy B (fallback): no stop button found — poll until the last
      // assistant message stops growing for 3 consecutive 700 ms ticks (~2.1 s).
      console.log('[Claude] No stop button detected — stability poll fallback');
      await page.evaluate(() => { window.__stableCount = 0; window.__lastLen = -1; });
      await page.waitForFunction(() => {
        const candidateSelectors = [
          '[data-testid="assistant-message"]',
          '[data-message-role="assistant"]',
          '.font-claude-message',
          '[data-role="assistant"]',
        ];
        let len = 0;
        for (const sel of candidateSelectors) {
          const els = document.querySelectorAll(sel);
          if (els.length) { len = els[els.length - 1].innerText.length; break; }
        }
        if (len > 30 && len === window.__lastLen) {
          return ++window.__stableCount >= 3;
        }
        window.__stableCount = 0;
        window.__lastLen = len;
        return false;
      }, { timeout: TIMEOUT, polling: 700 })
        .catch(() => console.log('[Claude] Stability poll timeout (continuing)'));
      await page.waitForTimeout(600);
    }
    console.log('[Claude] Response ready — reading now');

    // Strategy 1: Click the "Copy" button on Claude's last response — gives clean markdown
    const copiedTextRaw = await page.evaluate(async () => {
      const isVisible = (el) => {
        const s = window.getComputedStyle(el), r = el.getBoundingClientRect();
        return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
      };
      const copyBtns = [...document.querySelectorAll('button')]
        .filter(b => isVisible(b) && /copy/i.test(`${b.innerText} ${b.getAttribute('aria-label') || ''} ${b.title || ''}`));
      if (!copyBtns.length) return '';
      copyBtns[copyBtns.length - 1].click();
      await new Promise(r => setTimeout(r, 150));
      return navigator.clipboard.readText().catch(() => '');
    }).catch(() => '');

    // Validate: clipboard must have content AND must NOT be our own input text
    const inputSignatures = ['Question:', '[ChatGPT]', '[Gemini]', 'Synthesize the above', 'Return ONLY the final'];
    const clipboardIsInput = inputSignatures.some(sig => (copiedTextRaw || '').includes(sig));
    const copiedText = copiedTextRaw.trim() && !clipboardIsInput ? copiedTextRaw.trim() : '';

    // Strategy 2: DOM extraction — explicitly exclude human-turn/user-message containers
    const responseText = copiedText || await page.evaluate((inputText) => {
      const USER_SIGNALS = ['Question:', '[ChatGPT]', '[Gemini]', 'Synthesize the above', 'Return ONLY the final'];
      const looksLikeInput = (t) => USER_SIGNALS.some(s => t.includes(s));

      // 2a: Role/testid-specific assistant selectors (most reliable when they exist)
      const strictSelectors = [
        '[data-testid="assistant-message"]',
        '[data-message-role="assistant"]',
        '[data-role="assistant"]',
        '.font-claude-message',
        '[class*="AssistantMessage"]',
        '[class*="assistant-message"]',
      ];
      for (const sel of strictSelectors) {
        const els = [...document.querySelectorAll(sel)].filter(el => !looksLikeInput(el.innerText));
        if (els.length) return els[els.length - 1].innerText.trim();
      }

      // 2b: Collect ALL prose/message elements, filter out ones that look like our input
      const allBlocks = [
        ...document.querySelectorAll('.prose, [class*="prose"], [class*="message-content"]'),
      ].map(el => el.innerText.trim()).filter(t => t.length > 50);

      const assistantBlocks = allBlocks.filter(t => !looksLikeInput(t));
      if (assistantBlocks.length) return assistantBlocks[assistantBlocks.length - 1];

      // 2c: Last resort — join all blocks and extract everything AFTER the instruction end-marker
      const joined = allBlocks.join('\n\n');
      const splitPoint = joined.search(/Return ONLY the final synthesized answer[^\n]*\n/i);
      if (splitPoint > -1) {
        const after = joined.slice(splitPoint).replace(/^Return ONLY[^\n]+\n/i, '').trim();
        if (after.length > 50) return after;
      }

      return allBlocks[allBlocks.length - 1] || '';
    }, text);

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

// ── Prompt builders ───────────────────────────────────────────────────────

function buildSynthesisPrompt(originalPrompt, gptText, claudeText, geminiText) {
  const hasGPT    = gptText    && !gptText.startsWith('Error')    && gptText    !== 'No response received.';
  const hasClaude = claudeText && !claudeText.startsWith('Error') && claudeText !== 'No response received.';
  const hasGemini = geminiText && !geminiText.startsWith('Error') && !isGeminiNoResponseText(geminiText);

  const sections = [];
  if (hasGPT)    sections.push(`<response source="A">\n${gptText}\n</response>`);
  if (hasGemini) sections.push(`<response source="B">\n${geminiText}\n</response>`);
  if (hasClaude) sections.push(`<response source="C">\n${claudeText}\n</response>`);

  if (sections.length === 0) {
    return `Answer this question directly with your best response:\n\n${originalPrompt}`;
  }

  return `<role>
You are a master synthesis engine. Multiple AI assistants have independently answered the same question. Your job is to produce ONE definitive response that surpasses every individual source in accuracy, clarity, depth, and usefulness. You are not a summarizer or a concatenator — you are an editor-in-chief making decisive judgments about what is true, what matters, and how it should be said.
</role>

<inputs>
<question>${originalPrompt}</question>

${sections.join('\n\n')}
</inputs>

<methodology>
Execute these phases internally before writing a single word of output.

## Phase 1: Decode the question
- What is the asker's actual goal? (information, decision support, instructions, comparison, opinion, creative work, debugging)
- What is their implied expertise level? (beginner, intermediate, expert)
- What format would best serve them? (prose, list, table, code, step-by-step, comparison)
- What is the minimum and maximum useful length?

## Phase 2: Audit the sources
For each claim across all three sources, classify it:
- **CONFIRMED** — multiple sources agree → include with confidence
- **UNIQUE-STRONG** — one source, but specific, verifiable, valuable → include
- **UNIQUE-WEAK** — one source, vague, speculative, or unsupported → discard
- **CONFLICTING** — sources disagree → reconcile via reasoning, OR present both with context, OR prefer the more specific/evidence-backed claim
- **MISSING** — none of the sources address something essential → note the gap honestly; never fabricate

## Phase 3: Architect the answer
- Determine the optimal structure FROM SCRATCH based on the question, not by averaging source structures
- Lead with the **direct answer** if one exists; defer nuance and caveats
- Order content by **value to the asker**, not by source order or alphabetical convenience
- Decide where tables, lists, and prose each serve best — do not default to bullets

## Phase 4: Write with intention
- Use the clearest phrasing available across sources; rewrite where none is good enough
- Eliminate every word that doesn't earn its place
- Cut hedges ("it's worth noting", "essentially", "generally speaking", "in many cases") unless they convey real epistemic uncertainty
- Prefer concrete examples, specific numbers, named entities over vague generalizations
- Match register to the question: technical when technical, conversational when casual, warm when emotional

## Phase 5: Self-critique before finalizing
Ask yourself:
- Is every factual claim defensible?
- Have I covered what a domain expert would consider essential?
- Is there any redundancy I missed?
- Would a knowledgeable reader find this BETTER than any single source response?
- Have I avoided every item in the exclusion list?
If any answer is "no," revise before outputting.
</methodology>

<quality_bar>
The final answer MUST be:
- **Accurate** — every factual claim defensible against scrutiny
- **Decisive** — takes clear positions where evidence supports them; doesn't waffle
- **Comprehensive** — covers what a thoughtful expert would address, nothing critical missing
- **Lean** — no sentence repeats another; no word is filler
- **Self-contained** — fully readable without reference to the source responses
- **Superior** — measurably better than any individual source. If it isn't, the task has failed.
</quality_bar>

<formatting>
## Headings
- \`##\` for primary sections, \`###\` for subsections
- Sentence case only — never Title Case, never ALL CAPS
- Skip headings entirely for short answers (under ~150 words)

## Emphasis
- \`**bold**\` for key terms, names, or critical concepts ONLY — never entire sentences, never for emphasis-as-decoration
- \`*italics*\` sparingly, for genuine emphasis or titles of works
- Inline \`code\` for technical terms, commands, filenames, functions, variable names

## Lists
- \`-\` for unordered lists; \`1.\` for ordered/sequential lists
- Keep bullets parallel in grammatical structure and length
- Use lists only when content is genuinely enumerable; default to prose otherwise
- Never nest bullets more than two levels deep

## Tables
- For ANY comparative, tabular, or structured data, use proper markdown tables:

  | Column A | Column B | Column C |
  |----------|----------|----------|
  | value    | value    | value    |

- NEVER use space-aligned or plain-text tables
- Include header separator row with hyphens and pipes
- Align columns left by default; use \`:---:\` for centered, \`---:\` for right-aligned numbers

## Code
- Inline \`code\` for short technical references
- Fenced code blocks with language hints for multi-line code: \`\`\`python, \`\`\`javascript, \`\`\`bash
- Never wrap prose in code blocks

## Structure
- NEVER use horizontal rules (\`---\`) as section dividers — use headings instead
- Use blank lines between paragraphs, lists, and sections
- Quotes use \`>\` for genuine quotations only, not for emphasis
</formatting>

<exclusions>
The output MUST NOT contain:
- Source labels or attributions: [ChatGPT], [Gemini], [Claude], "According to one response...", "Source A says...", "the assistants suggest..."
- The original question, restated or paraphrased
- Meta-commentary: "Here is the synthesis", "Based on the responses", "After analyzing", "Combining the perspectives"
- Preambles, postscripts, sign-offs: "Hope this helps", "Let me know if...", "Feel free to ask"
- Knowledge-cutoff disclaimers or suggestions to enable web search
- Apologies for limitations or hedging about completeness
- UI artifacts, timestamps, or formatting noise from the sources
- Emojis, unless the question explicitly calls for them
- Self-references: "I think", "In my view", "As an AI" (unless the question genuinely asks for opinion)
- Filler transitions: "Moreover", "Furthermore", "It is important to note", "That being said"
</exclusions>

<output>
Begin directly with the answer's first heading or sentence. No preamble. No framing. No throat-clearing.

The first character of your response is the first character of the answer.
</output>`;
}

function buildFollowUpSourcePrompt(originalPrompt, previousAnswer, followUpQuestion) {
  return `Original question:
${originalPrompt}

Current conversation context:
${previousAnswer}

Follow-up question:
${followUpQuestion}

Answer only the follow-up question using the conversation context. Format using markdown (## headings, **bold**, - bullets where appropriate).`;
}

// ── Core parallel runner ──────────────────────────────────────────────────
// Pre-creates ALL pages upfront so every tab starts navigating at the same time.

async function runSelectedSources(context, prompt, selectedModels, onProgress, deepResearch = false) {
  const selected = new Set(selectedModels && selectedModels.length ? selectedModels : ['openai', 'gemini', 'claude']);

  const chatGPTRunner = deepResearch ? runChatGPTDeepResearch : runChatGPT;
  const geminiRunner  = deepResearch ? runGeminiDeepResearch  : runGemini;

  // Pre-create all pages sequentially (fast — just opens a blank tab).
  // This lets Playwright finish its internal setup for each page before we
  // fire off all three navigations simultaneously.
  const gptPage    = selected.has('openai') ? await context.newPage() : null;
  const geminiPage = selected.has('gemini') ? await context.newPage() : null;
  const claudePage = selected.has('claude') ? await context.newPage() : null;

  console.log('[Parallel] Launching all 3 browsers simultaneously...');

  // All three runners start at exactly the same time with pre-created pages
  const gptTask = gptPage
    ? chatGPTRunner(context, prompt, gptPage).then(r => { onProgress?.('partial', { openai: r }); return r; })
    : Promise.resolve('');

  const geminiTask = geminiPage
    ? geminiRunner(context, prompt, geminiPage).then(r => { onProgress?.('partial', { gemini: r }); return r; })
    : Promise.resolve('');

  const claudeTask = claudePage
    ? runClaude(context, prompt, claudePage).then(r => {
        // Send raw Claude response to the card immediately
        onProgress?.('partial', { claudeRaw: r });
        // If other models are running, Claude will synthesize next — mark it
        if (gptPage || geminiPage) onProgress?.('partial', { claude: 'Synthesizing responses…' });
        return r;
      })
    : Promise.resolve('');

  const [gptText, firstGeminiText, claudeInitial] = await Promise.all([gptTask, geminiTask, claudeTask]);
  let geminiText = firstGeminiText;

  if (geminiPage && isGeminiNoResponseText(geminiText)) {
    console.log('[Gemini] Empty response during parallel run - retrying once in a fresh tab');
    geminiText = await geminiRunner(context, prompt);
    onProgress?.('partial', { gemini: geminiText });
  }

  return [gptText, claudeInitial, geminiText];
}

// ── Main export ───────────────────────────────────────────────────────────

async function runPromptOnAllLLMs(prompt, onProgress, selectedModels = ['openai', 'gemini', 'claude'], deepResearch = false, clientId) {
  const { context, clientId: safeClientId } = await getContext(clientId);
  const selected = new Set(selectedModels && selectedModels.length ? selectedModels : ['openai', 'gemini', 'claude']);

  onProgress && onProgress('running', {});
  const t0 = Date.now();

  await validateClientSessions(context, safeClientId, selectedModels);

  // Step 1: All selected browsers open and search simultaneously
  const [gptText, claudeInitial, geminiText] = await runSelectedSources(
    context, prompt, selectedModels, onProgress, deepResearch
  );

  // Step 2: Synthesize only when multiple models contributed — skip if Claude is the sole model
  const otherModelsHaveContent =
    (selected.has('openai') && gptText    && !gptText.startsWith('Error')    && gptText    !== 'No response received.') ||
    (selected.has('gemini') && geminiText && !geminiText.startsWith('Error') && !isGeminiNoResponseText(geminiText));

  let claudeFinal = claudeInitial;
  if (selected.has('claude') && otherModelsHaveContent) {
    onProgress && onProgress('partial', { claude: 'Synthesizing…' });
    const synthesisPrompt = buildSynthesisPrompt(prompt, gptText, claudeInitial, geminiText);
    claudeFinal = await runClaude(context, synthesisPrompt);
  }

  onProgress && onProgress('partial', { claude: claudeFinal });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  // claudeRaw = Claude's direct answer to the prompt (for the card)
  // claude    = final synthesis (for the synthesis bubble)
  return { openai: gptText, claude: claudeFinal, claudeRaw: claudeInitial, gemini: geminiText, elapsed };
}

// Follow-up: run all selected models with full conversation context, then synthesize
async function runFollowUpOnAllLLMs({ originalPrompt, previousAnswer, followUpQuestion, selectedModels = ['openai', 'gemini', 'claude'], clientId }) {
  const { context, clientId: safeClientId } = await getContext(clientId);
  const selected = new Set(selectedModels.length ? selectedModels : ['openai', 'gemini', 'claude']);
  const t0 = Date.now();

  await validateClientSessions(context, safeClientId, selectedModels);

  // Every model gets the full conversation context so their answers are relevant
  const contextPrompt = buildFollowUpSourcePrompt(originalPrompt, previousAnswer, followUpQuestion);

  const gptPage    = selected.has('openai') ? await context.newPage() : null;
  const geminiPage = selected.has('gemini') ? await context.newPage() : null;
  const claudePage = selected.has('claude') ? await context.newPage() : null;

  console.log('[FollowUp] Running on selected models:', [...selected].join(', '));

  const [gptText, geminiText, claudeText] = await Promise.all([
    gptPage    ? runChatGPT(context, contextPrompt, gptPage)   : Promise.resolve(''),
    geminiPage ? runGemini(context, contextPrompt, geminiPage) : Promise.resolve(''),
    claudePage ? runClaude(context, contextPrompt, claudePage) : Promise.resolve(''),
  ]);

  // Synthesize only when multiple models have content
  const otherModelsHaveContent =
    (selected.has('openai') && gptText    && !gptText.startsWith('Error')    && gptText    !== 'No response received.') ||
    (selected.has('gemini') && geminiText && !geminiText.startsWith('Error') && !isGeminiNoResponseText(geminiText));

  let finalAnswer = claudeText || gptText || geminiText;
  if (selected.has('claude') && otherModelsHaveContent) {
    const synthPrompt = buildSynthesisPrompt(followUpQuestion, gptText, claudeText, geminiText);
    finalAnswer = await runClaude(context, synthPrompt);
    console.log('[FollowUp] Synthesis complete');
  } else {
    console.log('[FollowUp] Single-model response — skipping synthesis');
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log('[FollowUp] Done in', elapsed, 's');
  // Return the final answer in `claude` — that is what the client reads.
  // Raw per-model responses are included for potential future use.
  return { openai: gptText, claude: finalAnswer, gemini: geminiText, elapsed };
}

module.exports = { runPromptOnAllLLMs, runFollowUpOnAllLLMs };
