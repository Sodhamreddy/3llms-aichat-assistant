// Font Pair Extension - Popup Script

const FONTPAIR_URL = 'https://www.fontpair.co';
let authPollingInterval = null;
let emergencyActionsBound = false;

function bindEmergencyActions() {
  if (emergencyActionsBound) return;
  emergencyActionsBound = true;

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#login-btn')) {
      event.preventDefault();
      try {
        openLogin();
      } catch (e) {
        console.error('Emergency login handler failed:', e);
      }
      return;
    }

    if (target.closest('#close-btn, .sub-close-btn')) {
      event.preventDefault();
      window.close();
    }
  }, true);
}

async function initPopup() {
  // Clear first-visit tooltip flag when popup opens
  chrome.storage.local.set({ showFirstVisitTooltip: false });

  // Auth - fire and forget, don't block page data loading
  try {
    updateAuthUI().catch(e => console.error('Auth init failed:', e));
  } catch (e) {
    console.error('Auth init failed:', e);
  }

  // Event listeners - always attach regardless of other failures
  document.getElementById('login-btn')?.addEventListener('click', openLogin);
  document.getElementById('library-btn')?.addEventListener('click', handleLibraryClick);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('settings-auth-btn')?.addEventListener('click', handleSettingsAuth);
  document.getElementById('save-btn')?.addEventListener('click', handleSave);
  document.getElementById('copy-ai-btn')?.addEventListener('click', toggleAIToolMenu);
  document.querySelectorAll('.ai-tool-item').forEach(btn => {
    btn.addEventListener('click', () => handleCopyForAI(btn.getAttribute('data-tool')));
  });
  document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.ai-prompt-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      document.getElementById('ai-tool-menu')?.classList.add('hidden');
    }
  });
  document.getElementById('download-screenshot-btn')?.addEventListener('click', downloadScreenshot);
  document.getElementById('copy-screenshot-btn')?.addEventListener('click', copyScreenshot);
  
  document.getElementById('close-btn')?.addEventListener('click', () => window.close());
  document.querySelectorAll('.sub-close-btn').forEach(btn => btn.addEventListener('click', () => window.close()));
  document.getElementById('settings-btn')?.addEventListener('click', showSettings);
  document.getElementById('settings-back')?.addEventListener('click', hideSettings);
  document.getElementById('dark-mode-toggle')?.addEventListener('change', toggleDarkMode);
  document.getElementById('export-btn')?.addEventListener('click', showExport);
  document.getElementById('export-back')?.addEventListener('click', hideExport);
  document.getElementById('export-copy-btn')?.addEventListener('click', copyExportCode);
  document.getElementById('contrast-btn')?.addEventListener('click', showContrast);
  document.getElementById('contrast-back')?.addEventListener('click', hideContrast);
  document.querySelectorAll('.export-tab').forEach(tab => {
    tab.addEventListener('click', (e) => switchExportTab(e.target.dataset.tab));
  });
  document.getElementById('copy-feedback-email')?.addEventListener('click', () => {
    navigator.clipboard.writeText('hayden@fontpair.co').then(() => {
      showToast('✓ Email copied to clipboard');
    });
  });
  

  // Font inspector removed - will be reimplemented

  // Auto-detect system theme on load
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    chrome.storage.local.get(['fpDarkMode'], (result) => {
      if (result.fpDarkMode === undefined) {
        document.body.classList.toggle('dark', e.matches);
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = e.matches;
      }
    });
  });

  // Restore preferences
  try {
    chrome.storage.local.get(['fpDarkMode', 'fpInspectorMode'], (result) => {
      const shouldBeDark = result.fpDarkMode !== undefined ? result.fpDarkMode : prefersDark;
      if (shouldBeDark) {
        document.body.classList.add('dark');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
      }
      if (result.fpInspectorMode) {
        document.querySelectorAll('#inspector-mode-toggle .seg-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-value') === result.fpInspectorMode);
        });
      }
    });
  } catch (e) {
    console.error('Preferences restore failed:', e);
  }

  // Get current tab - needed by screenshot + page data
  let currentTab;
  try {
    const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
    currentTab = tabs?.[0];
  } catch (e) {
    console.error('Tab query failed:', e);
  }

  if (currentTab) {
    document.getElementById('save-btn')?.setAttribute('data-url', currentTab.url);
    document.getElementById('save-btn')?.setAttribute('data-title', currentTab.title);

    // Screenshot - independent
    try {
      captureScreenshot();
    } catch (e) {
      console.error('Screenshot failed:', e);
    }

    // Page data (fonts/colors) - independent, with timeout fallback
    let pageDataReceived = false;
    const pageDataTimeout = setTimeout(() => {
      if (!pageDataReceived) {
        pageDataReceived = true;
        showSectionError(['all-fonts', 'font-colors', 'bg-colors'], 'This page took too long to analyze. Try refreshing the page and reopening the extension. Some pages (like browser internal or protected pages) can\'t be read.');
      }
    }, 8000);

    try {
      // Inject content script programmatically (no content_scripts in manifest)
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['src/js/script.js']
      }).catch(err => console.warn('[Fontpair] Content script injection failed:', err));

      chrome.tabs.sendMessage(currentTab.id, { from: 'popup', subject: 'DOMInfo' }, (response) => {
        if (pageDataReceived) return;
        pageDataReceived = true;
        clearTimeout(pageDataTimeout);

        if (chrome.runtime.lastError) {
          console.error('Content script error:', chrome.runtime.lastError);
          showSectionError(['all-fonts', 'font-colors', 'bg-colors'], 'Try refreshing the page, then reopen the extension. Some pages (like browser internal pages) can\'t be analyzed.');
          return;
        }
        try {
          const pageData = JSON.parse(response);
          injectPageFonts(pageData);
          displayPageData(pageData);
          displayIconLibrary(pageData.iconLibrary);
        } catch (e) {
          console.error('Parse error:', e);
          showSectionError(['all-fonts', 'font-colors', 'bg-colors'], 'Something went wrong reading this page. Try refreshing and reopening the extension. If it keeps happening, report it via Settings.');
        }
      });
    } catch (e) {
      pageDataReceived = true;
      clearTimeout(pageDataTimeout);
      console.error('Message send failed:', e);
      showSectionError(['all-fonts', 'font-colors', 'bg-colors'], 'Could not connect to this page. Try refreshing the page and reopening the extension.');
    }
  } else {
    showSectionError(['all-fonts', 'font-colors', 'bg-colors'], 'No active tab found. Open a website and try again.');
  }

  // Inspector state sync - independent
  try {
    syncInspectorState();
  } catch (e) {
    console.error('Inspector sync failed:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bindEmergencyActions();
    initPopup().catch((e) => {
      console.error('Popup init failed:', e);
      showSectionError(['all-fonts', 'font-colors', 'bg-colors'], 'Something broke in the popup. Try closing and reopening the extension, or refresh this page.');
    });
  });
} else {
  bindEmergencyActions();
  initPopup().catch((e) => {
    console.error('Popup init failed:', e);
    showSectionError(['all-fonts', 'font-colors', 'bg-colors'], 'Something broke in the popup. Try closing and reopening the extension, or refresh this page.');
  });
}

async function updateAuthUI() {
  return new Promise((resolve) => {
    // Timeout: if background service worker doesn't respond in 3s, resolve anyway
    const timeout = setTimeout(() => {
      console.warn('[Fontpair] Auth status timeout — showing logged-out state');
      resolve();
    }, 3000);

    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, async (response) => {
      clearTimeout(timeout);
      const loginSection = document.getElementById('login-section');
      const userSection = document.getElementById('user-section');
      const saveBtn = document.getElementById('save-btn');
      const saveBar = document.getElementById('save-bar');
      const userEmail = document.getElementById('user-email');
      const proStatus = document.getElementById('pro-status');
      
      const authLabel = document.getElementById('settings-auth-label');
      const authDesc = document.getElementById('settings-auth-desc');
      const authIconLogin = document.getElementById('settings-auth-icon-login');
      const authIconLogout = document.getElementById('settings-auth-icon-logout');
      
      if (response?.isLoggedIn) {
        loginSection.classList.add('hidden');
        userSection.classList.remove('hidden');
        userEmail.textContent = response.user?.email || 'Logged in';
        
        // Update settings auth row to show Log Out
        if (authLabel) authLabel.textContent = 'Log Out';
        if (authDesc) authDesc.textContent = 'Sign out of your Fontpair account';
        authIconLogin?.classList.add('hidden');
        authIconLogout?.classList.remove('hidden');
        
        // Badge — moved save counter into header badge for free users
        if (response.isAdmin) {
          proStatus.textContent = 'Admin';
          proStatus.classList.remove('hidden', 'pro-badge--free', 'pro-badge--upgrade');
          proStatus.removeAttribute('href');
        } else if (response.isPro) {
          proStatus.textContent = 'Pro';
          proStatus.classList.remove('hidden', 'pro-badge--free', 'pro-badge--upgrade');
          proStatus.removeAttribute('href');
        } else {
          // Free user badge — will be updated with count in setupSaveButtonState
          updateFreeBadge(proStatus, response.saveCount || 0);
        }
        
        // Show save bar for all authenticated users
        saveBar.classList.remove('hidden');
        saveBtn.classList.remove('logged-out-login');
        const aiPromptWrapper = document.querySelector('.ai-prompt-wrapper');
        if (aiPromptWrapper) aiPromptWrapper.classList.remove('hidden');
        
        // Check if current URL is already saved
        const currentUrl = saveBtn.getAttribute('data-url');
        if (currentUrl) {
          chrome.runtime.sendMessage({ type: 'CHECK_DUPLICATE', url: currentUrl }, (dupRes) => {
            if (dupRes?.isDuplicate) {
              saveBtn.textContent = 'Already saved ✓';
              saveBtn.classList.add('saved');
              saveBtn.disabled = true;
              saveBtn.removeAttribute('data-free');
              saveBtn.removeAttribute('data-at-limit');
              saveBtn.removeAttribute('data-not-signed-in');
              return;
            }
            // Not a duplicate — set up proper button state
            setupSaveButtonState(response, saveBtn);
          });
        } else {
          setupSaveButtonState(response, saveBtn);
        }
        
        // Show one-time welcome message
        showWelcomeIfNeeded(response);
        
      } else {
        loginSection.classList.remove('hidden');
        userSection.classList.add('hidden');
        
        // Show save bar with sign-in prompt
        saveBar.classList.remove('hidden');
        saveBtn.textContent = 'Continue with Fontpair';
        saveBtn.disabled = false;
        saveBtn.classList.remove('saved');
        saveBtn.classList.add('logged-out-login');
        saveBtn.setAttribute('data-not-signed-in', 'true');
        saveBtn.removeAttribute('data-free');
        saveBtn.removeAttribute('data-at-limit');
        
        // Hide AI prompt wrapper when signed out
        const aiPromptWrapper = document.querySelector('.ai-prompt-wrapper');
        if (aiPromptWrapper) aiPromptWrapper.classList.add('hidden');
        
        
        // Update settings auth row to show Login
        if (authLabel) authLabel.textContent = 'Login';
        if (authDesc) authDesc.textContent = 'Sign in to your Fontpair account';
        authIconLogin?.classList.remove('hidden');
        authIconLogout?.classList.add('hidden');
      }
      
      resolve();
    });
  });
}

function updateFreeBadge(badge, count) {
  if (!badge) return;
  badge.classList.remove('hidden');
  if (count >= 10) {
    badge.textContent = 'Upgrade to Pro';
    badge.classList.add('pro-badge--upgrade');
    badge.classList.remove('pro-badge--free');
    badge.href = 'https://fontpair.co/pricing';
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';
  } else {
    badge.textContent = `Free · ${count}/10`;
    badge.classList.add('pro-badge--free');
    badge.classList.remove('pro-badge--upgrade');
    badge.removeAttribute('href');
    badge.removeAttribute('target');
  }
}

function setupSaveButtonState(response, saveBtn) {
  saveBtn.classList.remove('saved');
  saveBtn.removeAttribute('data-not-signed-in');
  const proStatus = document.getElementById('pro-status');
  
  if (response.isPro || response.isAdmin) {
    saveBtn.textContent = 'Save to Fontpair';
    saveBtn.disabled = false;
    saveBtn.removeAttribute('data-free');
    saveBtn.removeAttribute('data-at-limit');
  } else {
    const count = response.saveCount || 0;
    updateFreeBadge(proStatus, count);
    if (count >= 10) {
      saveBtn.textContent = 'Upgrade to Pro for unlimited saves →';
      saveBtn.disabled = false;
      saveBtn.setAttribute('data-at-limit', 'true');
      saveBtn.removeAttribute('data-free');
    } else {
      saveBtn.textContent = 'Save to Fontpair';
      saveBtn.disabled = false;
      saveBtn.removeAttribute('data-at-limit');
      saveBtn.removeAttribute('data-free');
    }
  }
}

function showWelcomeIfNeeded(response) {
  // Welcome message removed — onboarding handled by /welcome-extension page
}

function handleLibraryClick() {
  chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
    if (response?.isLoggedIn) {
      chrome.tabs.create({ url: `${FONTPAIR_URL}/favorites/sites` });
    } else {
      const extensionId = chrome.runtime.id;
      const loginUrl = `${FONTPAIR_URL}/extension-login?source=extension&extensionId=${extensionId}&returnTo=/favorites/sites`;
      chrome.tabs.create({ url: loginUrl });
    }
  });
}

function openLogin() {
  const extensionId = chrome.runtime.id;
  const loginUrl = `${FONTPAIR_URL}/extension-login?source=extension&extensionId=${extensionId}`;
  chrome.tabs.create({ url: loginUrl });
  
  // Start polling for auth in case auth-bridge message is missed
  if (!authPollingInterval) {
    let pollCount = 0;
    authPollingInterval = setInterval(() => {
      pollCount++;
      if (pollCount > 100) { // ~5 minutes at 3s intervals
        clearInterval(authPollingInterval);
        authPollingInterval = null;
        return;
      }
      chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
        if (response?.isLoggedIn) {
          clearInterval(authPollingInterval);
          authPollingInterval = null;
          updateAuthUI();
        }
      });
    }, 3000);
  }
}

function captureScreenshot() {
  const section = document.getElementById('screenshot-section');
  const preview = document.getElementById('screenshot-preview');
  
  chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
    if (response?.success && response.dataUrl) {
      preview.src = response.dataUrl;
      section.classList.remove('hidden');
      preview.setAttribute('data-screenshot', response.dataUrl);
    } else {
      console.warn('Screenshot capture failed:', response?.error);
      section.classList.add('hidden');
    }
  });
}

function toggleInspector() {
  const btn = document.getElementById('inspect-btn');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_INSPECTOR' }, (response) => {
      if (chrome.runtime.lastError) {
        showToast('Cannot inspect this page');
        return;
      }
      btn.classList.toggle('active', response?.active);
      showToast(response?.active ? 'Inspector activated' : 'Inspector deactivated');
    });
  });
}

function syncInspectorState() {
  const btn = document.getElementById('inspect-btn');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_INSPECTOR_STATUS' }, (response) => {
      if (!chrome.runtime.lastError && response?.active) {
        btn.classList.add('active');
      }
    });
  });
}

// Listen for auth state changes broadcast from background worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AUTH_STATE_CHANGED') {
    updateAuthUI();
  }
});


function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function showBtnCheck(btn) {
  const origHTML = btn.innerHTML;
  btn.classList.add('copied');
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = origHTML;
  }, 1500);
}

function downloadScreenshot() {
  const btn = document.getElementById('download-screenshot-btn');
  const dataUrl = document.getElementById('screenshot-preview')?.getAttribute('data-screenshot');
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `fontpair-screenshot-${Date.now()}.png`;
  a.click();
  showBtnCheck(btn);
  showToast('Screenshot downloaded');
}

async function copyScreenshot() {
  const btn = document.getElementById('copy-screenshot-btn');
  const dataUrl = document.getElementById('screenshot-preview')?.getAttribute('data-screenshot');
  if (!dataUrl) return;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    showBtnCheck(btn);
    showToast('Copied to clipboard');
  } catch (e) {
    console.error('Copy failed:', e);
    showToast('Copy failed');
  }
}

function handleLogout() {
  chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
    updateAuthUI();
    showToast('✓ Successfully logged out');
  });
}

function handleSettingsAuth() {
  const label = document.getElementById('settings-auth-label');
  if (label?.textContent === 'Log Out') {
    handleLogout();
  } else {
    openLogin();
  }
}

async function handleSave() {
  const saveBtn = document.getElementById('save-btn');
  
  
  // Not signed in: open login
  if (saveBtn.getAttribute('data-not-signed-in') === 'true') {
    openLogin();
    return;
  }
  
  // At limit: open pricing
  if (saveBtn.getAttribute('data-at-limit') === 'true') {
    chrome.tabs.create({ url: `${FONTPAIR_URL}/pricing` });
    return;
  }
  
  const originalText = saveBtn.textContent;
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'Checking...';
  
  const url = saveBtn.getAttribute('data-url');
  const title = saveBtn.getAttribute('data-title');
  
  // Step 1: Check for duplicates
  chrome.runtime.sendMessage({ type: 'CHECK_DUPLICATE', url }, (dupResponse) => {
    if (chrome.runtime.lastError) {
      resetSaveBtn(saveBtn, originalText, 'Failed');
      showError('Extension error. Try again.');
      return;
    }
    
    if (dupResponse?.isDuplicate) {
      saveBtn.textContent = 'Already saved ✓';
      saveBtn.classList.add('saved');
      saveBtn.disabled = true;
      return;
    }
    
    // Step 2: Gather fonts and colors from the displayed data
    saveBtn.textContent = 'Saving...';
    
    const colors = Array.from(document.querySelectorAll('#bg-colors .color-swatch'))
      .map(el => el.getAttribute('data-color'))
      .filter(Boolean);
    
    const fontColors = Array.from(document.querySelectorAll('#font-colors .color-swatch'))
      .map(el => el.getAttribute('data-color'))
      .filter(Boolean);
    
    const allColors = [...new Set([...colors, ...fontColors])];
    
    const fonts = [];
    const fontWeightData = {};
    document.querySelectorAll('#all-fonts .font-item').forEach(el => {
      const fontName = el.getAttribute('data-font');
      if (fontName && !fonts.includes(fontName)) {
        fonts.push(fontName);
        const role = el.getAttribute('data-role') || 'body';
        const pw = parseInt(el.getAttribute('data-primary-weight'), 10) || (role === 'heading' ? 700 : 400);
        fontWeightData[fontName] = { role, primaryWeight: pw };
      }
    });
    
    // Get screenshot data URL if available
    const screenshotPreview = document.getElementById('screenshot-preview');
    const screenshotDataUrl = screenshotPreview?.getAttribute('data-screenshot') || null;
    
    // Step 3: Save
    chrome.runtime.sendMessage({
      type: 'SAVE_INSPIRATION',
      data: { url, title, colors: allColors, fonts, fontWeightData, screenshotDataUrl }
    }, (response) => {
      if (chrome.runtime.lastError) {
        resetSaveBtn(saveBtn, originalText, 'Failed');
        showError('Extension error. Try again.');
        return;
      }
      
      if (response?.success) {
        saveBtn.textContent = 'Saved to your account';
        saveBtn.classList.add('saved');
        saveBtn.disabled = true;
        
        const libraryBtn = document.getElementById('library-btn');

        // Show tooltip pointing to library button
        if (libraryBtn) {
          const tooltip = document.createElement('div');
          tooltip.textContent = 'View in library';
          tooltip.style.cssText = 'position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:6px;background:#1a1a1a;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;white-space:nowrap;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.2s';
          libraryBtn.style.position = 'relative';
          libraryBtn.appendChild(tooltip);
          requestAnimationFrame(() => { tooltip.style.opacity = '1'; });
          setTimeout(() => { tooltip.style.opacity = '0'; setTimeout(() => tooltip.remove(), 200); }, 4000);
        }

        // Update header badge counter
        if (response.saveCount !== undefined) {
          const proStatus = document.getElementById('pro-status');
          updateFreeBadge(proStatus, response.saveCount);
        }

        // Pulse the library icon
        if (libraryBtn) {
          libraryBtn.classList.remove('library-pulse');
          void libraryBtn.offsetWidth;
          libraryBtn.classList.add('library-pulse');
          libraryBtn.addEventListener('animationend', () => {
            libraryBtn.classList.remove('library-pulse');
          }, { once: true });
        }
      } else if (response?.error === 'FREE_LIMIT_REACHED') {
        saveBtn.textContent = 'Upgrade to Pro for unlimited saves →';
        saveBtn.setAttribute('data-at-limit', 'true');
        saveBtn.disabled = false;
        const proStatus = document.getElementById('pro-status');
        updateFreeBadge(proStatus, 10);
      } else if (response?.error?.includes('Session expired')) {
        resetSaveBtn(saveBtn, originalText, 'Session expired');
        showError('Session expired. Sign in again to continue saving.');
      } else {
        resetSaveBtn(saveBtn, originalText, 'Failed');
        showError(response?.error || 'Unknown error');
      }
    });
  });
}

function resetSaveBtn(btn, originalText, tempText) {
  btn.textContent = tempText;
  btn.classList.add('error');
  setTimeout(() => {
    btn.textContent = originalText;
    btn.classList.remove('error');
    btn.disabled = false;
  }, 2000);
}

function injectPageFonts(pageData) {
  const fontFaceRules = pageData.fontFaceRules || [];
  const fontStylesheetUrls = pageData.fontStylesheetUrls || [];

  // Inject extracted @font-face rules (with absolute URLs) as a <style> block
  // Only inject @font-face rules, strip out any other CSS that could bleed
  if (fontFaceRules.length > 0) {
    const style = document.createElement('style');
    // Filter to only keep @font-face blocks
    const safeFontFaces = fontFaceRules.filter(rule => 
      rule.trim().toLowerCase().startsWith('@font-face')
    );
    if (safeFontFaces.length > 0) {
      style.textContent = safeFontFaces.join('\n');
      document.head.appendChild(style);
    }
  }

  // For cross-origin stylesheets (e.g. Typekit, Google Fonts),
  // fetch them, extract only @font-face rules, and inject those
  fontStylesheetUrls.forEach(url => {
    // Google Fonts CSS URLs only contain @font-face rules, safe to inject directly
    if (url.includes('fonts.googleapis.com')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    } else {
      // For other stylesheets (Typekit, etc.), fetch and extract only @font-face
      fetch(url, { mode: 'cors' })
        .then(r => r.text())
        .then(css => {
          const fontFaceMatches = css.match(/@font-face\s*\{[^}]*\}/gi);
          if (fontFaceMatches && fontFaceMatches.length > 0) {
            const style = document.createElement('style');
            style.textContent = fontFaceMatches.join('\n');
            document.head.appendChild(style);
          }
        })
        .catch(() => {
          // Fallback: inject as link but scope in hidden container to limit bleed
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          link.crossOrigin = 'anonymous';
          document.head.appendChild(link);
        });
    }
  });
}

function displayPageData(pageData) {
  // New format: single object with { fonts, colors, background_colors, font_colors }
  const fonts = pageData.fonts || [];
  const bgColors = pageData.background_colors || [];
  const fontColors = pageData.font_colors || [];

  // Deduplicate fonts by name, merge roles
  const seenFonts = new Map();
  fonts.forEach(f => {
    if (!seenFonts.has(f.name)) {
      seenFonts.set(f.name, f);
    }
  });

  // Display background colors
  const bgContainer = document.getElementById('bg-colors');
  bgContainer.innerHTML = '';
  bgColors.filter(c => c).forEach(color => {
    bgContainer.appendChild(createColorSwatch(color));
  });

  // Display font colors
  const fontColorContainer = document.getElementById('font-colors');
  fontColorContainer.innerHTML = '';
  fontColors.filter(c => c).forEach(color => {
    fontColorContainer.appendChild(createColorSwatch(color));
  });

  // Display all fonts in a single list
  const allFontsContainer = document.getElementById('all-fonts');
  allFontsContainer.innerHTML = '';
  seenFonts.forEach(font => {
    allFontsContainer.appendChild(createFontItem(font.name, font.weights, font.role, font.primaryWeight));
  });

  // Identify all fonts: Fontpair DB, Google Fonts, Adobe, commercial
  const allFontNames = fonts.map(f => {
    return f.name.split(',')[0].replace(/["']/g, '').trim();
  });
  const uniqueNames = [...new Set(allFontNames)];

  if (uniqueNames.length > 0) {
    chrome.runtime.sendMessage({ type: 'IDENTIFY_FONTS', fontNames: uniqueNames }, (response) => {
      if (chrome.runtime.lastError || !response?.success) return;
      const results = response.results || {};


      document.querySelectorAll('.font-item').forEach(item => {
        const fontName = item.getAttribute('data-font');
        const info = results[fontName];
        const nameEl = item.querySelector('.font-name');
        const header = item.querySelector('.font-item-header');
        if (!nameEl || !info) return;

        // Use corrected display name from DB or Google API when available
        const displayName = info.displayName || fontName;
        if (displayName !== fontName) {
          item.setAttribute('data-font', displayName);
        }

        if (info.source === 'fontpair') {
          // Fontpair link with logo
          const link = document.createElement('a');
          // Paid/commercial fonts use flat URL: /fonts/slug; free fonts use provider prefix: /fonts/provider/slug
          if (info.isPaid) {
            link.href = `${FONTPAIR_URL}/fonts/${info.slug}`;
          } else {
            const fontTypePrefix = info.fontType || 'google';
            link.href = `${FONTPAIR_URL}/fonts/${fontTypePrefix}/${info.slug}`;
          }
          link.className = 'font-name font-name-link font-name-link--fontpair';
           link.title = `View ${displayName} on Fontpair`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.appendChild(document.createTextNode(displayName));
          link.addEventListener('click', (e) => e.stopPropagation());
          nameEl.replaceWith(link);
          // Add Fontpair icon to the right side of the header row (after link is in DOM)
          const icon = document.createElement('img');
          icon.src = '../images/icon64.png';
          icon.className = 'fp-link-icon';
          icon.alt = 'Fontpair';
          icon.style.marginLeft = 'auto';
          const row = link.closest('.font-item-header');
          if (row) row.appendChild(icon);

        } else if (info.source === 'system') {
          // System font — no link, style in its own face
          nameEl.style.fontFamily = `"${fontName}", sans-serif`;
          nameEl.textContent = displayName;

        } else if (info.source === 'google') {
          // Google Fonts link with badge — font is already loaded by the page
          const link = document.createElement('a');
          link.href = info.url;
          link.className = 'font-name font-name-link font-name-link--google';
          link.style.fontFamily = `"${fontName}", sans-serif`;
          link.title = `View ${displayName} on Google Fonts`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.appendChild(document.createTextNode(displayName));
          link.addEventListener('click', (e) => e.stopPropagation());
          nameEl.replaceWith(link);
          // Add source badge
          if (header) {
            const badge = document.createElement('span');
            badge.className = 'font-source-badge font-source-badge--google';
            badge.textContent = 'Google Fonts';
            header.appendChild(badge);
          }

        } else if (['adobe', 'hoefler', 'klim', 'grilli', 'commercial_type', 'dalton_maag', 'monotype', 'atipo', 'sharp_type', 'pangram'].includes(info.source)) {
          // Known foundry link with badge
          const foundryLabels = {
            adobe: 'Adobe Fonts', hoefler: 'Hoefler&Co', klim: 'Klim Type',
            grilli: 'Grilli Type', commercial_type: 'Commercial Type',
            dalton_maag: 'Dalton Maag', monotype: 'Monotype',
            atipo: 'Atipo Foundry', sharp_type: 'Sharp Type', pangram: 'Pangram'
          };
          const link = document.createElement('a');
          link.href = info.url;
          link.className = 'font-name font-name-link font-name-link--foundry';
          link.style.fontFamily = `"${fontName}", sans-serif`;
          link.title = `View ${displayName} on ${foundryLabels[info.source]}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.appendChild(document.createTextNode(displayName));
          link.addEventListener('click', (e) => e.stopPropagation());
          nameEl.replaceWith(link);
          if (header) {
            const badge = document.createElement('span');
            badge.className = 'font-source-badge font-source-badge--foundry';
            badge.textContent = foundryLabels[info.source];
            header.appendChild(badge);
          }

        } else if (info.source === 'commercial') {
          // Google search for the font name (until we have more fonts in our database)
          const link = document.createElement('a');
          link.href = `https://www.google.com/search?q=${encodeURIComponent(displayName + ' font')}`;
          link.className = 'font-name font-name-link font-name-link--commercial';
          link.style.fontFamily = `"${fontName}", sans-serif`;
          link.title = `Search for ${displayName}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.appendChild(document.createTextNode(displayName));
          link.addEventListener('click', (e) => e.stopPropagation());
          nameEl.replaceWith(link);
        }
      });

      // Make entire font-item clickable — navigate to the font link
      document.querySelectorAll('.font-item').forEach(item => {
        const link = item.querySelector('a.font-name-link');
        if (link) {
          item.addEventListener('click', (e) => {
            // Don't trigger if clicking the link itself or other interactive elements
            if (e.target.closest('a, button')) return;
            window.open(link.href, '_blank');
          });
        }
      });
    });
  }
}

// ── WCAG Contrast Checker ──

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getWCAGLevel(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

function buildContrastResults(fontColors, bgColors) {
  const container = document.getElementById('contrast-results');
  container.innerHTML = '';

  if (!fontColors.length || !bgColors.length) {
    container.innerHTML = '<span class="loading">Not enough colors detected</span>';
    return;
  }

  const pairs = [];
  fontColors.forEach(fc => {
    bgColors.forEach(bc => {
      if (fc.toLowerCase() !== bc.toLowerCase()) {
        const ratio = contrastRatio(fc, bc);
        pairs.push({ fg: fc, bg: bc, ratio, level: getWCAGLevel(ratio) });
      }
    });
  });

  if (!pairs.length) {
    container.innerHTML = '<span class="loading">No color pairs to check</span>';
    return;
  }

  // Sort best contrast first
  pairs.sort((a, b) => b.ratio - a.ratio);

  pairs.forEach(p => {
    const card = document.createElement('div');
    card.className = 'contrast-card';

    const preview = document.createElement('div');
    preview.className = 'contrast-preview';
    preview.style.backgroundColor = p.bg;
    preview.style.color = p.fg;
    preview.textContent = 'Aa';

    const info = document.createElement('div');
    info.className = 'contrast-info';

    const colors = document.createElement('div');
    colors.className = 'contrast-colors';
    colors.innerHTML = `<span class="contrast-swatch" style="background:${p.fg}"></span><span class="contrast-hex">${p.fg}</span>` +
      `<span class="contrast-on">on</span>` +
      `<span class="contrast-swatch" style="background:${p.bg}"></span><span class="contrast-hex">${p.bg}</span>`;

    const meta = document.createElement('div');
    meta.className = 'contrast-meta';

    const ratioEl = document.createElement('span');
    ratioEl.className = 'contrast-ratio-value';
    ratioEl.textContent = p.ratio.toFixed(1) + ':1';

    const badge = document.createElement('span');
    const levelClass = p.level === 'Fail' ? 'fail' : p.level === 'AAA' ? 'aaa' : 'aa';
    badge.className = `contrast-badge contrast-badge--${levelClass}`;
    badge.textContent = p.level;

    meta.appendChild(ratioEl);
    meta.appendChild(badge);
    info.appendChild(colors);
    info.appendChild(meta);
    card.appendChild(preview);
    card.appendChild(info);
    container.appendChild(card);
  });
}

function createColorSwatch(color) {
  const btn = document.createElement('button');
  btn.className = 'color-swatch';
  btn.setAttribute('data-color', color);
  btn.style.backgroundColor = color;
  btn.title = `Copy ${color}`;
  
  const label = document.createElement('span');
  label.className = 'swatch-label';
  label.textContent = color;
  btn.appendChild(label);
  
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(color);
    btn.classList.add('copied');
    showToast(`Copied ${color}`);
    setTimeout(() => btn.classList.remove('copied'), 1000);
  });
  
  return btn;
}

const WEIGHT_NAMES = {
  100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black'
};

const PREVIEW_CHARS = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789$?@&';

function createFontItem(fontFamily, weights, section, primaryWeight) {
  const cleanName = fontFamily
    .split(',')[0]
    .replace(/["']/g, '')
    .trim();
  
  const div = document.createElement('div');
  div.className = 'font-item';
  div.setAttribute('data-font', cleanName);
  div.setAttribute('data-role', section || 'body');
  if (primaryWeight) {
    div.setAttribute('data-primary-weight', String(primaryWeight));
  }
  if (weights && weights.length) {
    div.setAttribute('data-weights', JSON.stringify(weights));
  }
  
  // Header: name + weight label
  const header = document.createElement('div');
  header.className = 'font-item-header';
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'font-name';
  nameSpan.textContent = cleanName;
  header.appendChild(nameSpan);
  
  // Weight labels removed for cleaner UI
  
  div.appendChild(header);
  
  // Character preview - use bold for headings, regular for body (if available)
  let displayWeight = 400;
  if (section === 'heading') {
    displayWeight = (weights && weights.includes(700)) ? 700 : (weights && weights.length > 0 ? weights[weights.length - 1] : 400);
  } else {
    displayWeight = (weights && weights.includes(400)) ? 400 : (weights && weights.length > 0 ? weights[0] : 400);
  }
  const preview = document.createElement('div');
  preview.className = 'font-preview-text';
  preview.style.fontFamily = `"${cleanName}", sans-serif`;
  preview.style.fontWeight = displayWeight;
  preview.textContent = PREVIEW_CHARS;
  div.appendChild(preview);
  
  
  return div;
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
  }
}

function showSectionError(sectionIds, message) {
  // Only show the full error banner in the first section; clear others
  sectionIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (i === 0) {
      el.innerHTML = `
        <div class="section-error-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div class="section-error-text">
            <span class="section-error-title">Couldn't read this page</span>
            <span class="section-error-desc">${message}</span>
          </div>
        </div>`;
    } else {
      el.innerHTML = '';
    }
  });
}

function showSettings() {
  document.getElementById('settings-page')?.classList.remove('hidden');
  // Hide header and main content areas
  document.querySelector('.header')?.classList.add('hidden');
  document.querySelector('.content')?.classList.add('hidden');
  document.querySelector('.footer')?.classList.add('hidden');
  document.querySelector('.action-row')?.classList.add('hidden');
  document.querySelector('.save-bar')?.classList.add('hidden');
  document.getElementById('screenshot-section')?.classList.add('hidden');
  document.getElementById('saves-remaining')?.classList.add('hidden');
  document.getElementById('error-message')?.classList.add('hidden');
}

function hideSettings() {
  document.getElementById('settings-page')?.classList.add('hidden');
  // Restore header and main content
  document.querySelector('.header')?.classList.remove('hidden');
  document.querySelector('.content')?.classList.remove('hidden');
  document.querySelector('.footer')?.classList.remove('hidden');
  document.querySelector('.action-row')?.classList.remove('hidden');
  // Re-show save bar if logged in
  document.getElementById('save-bar')?.classList.remove('hidden');
  // Re-show screenshot if it had data
  const preview = document.getElementById('screenshot-preview');
  if (preview?.getAttribute('data-screenshot')) {
    document.getElementById('screenshot-section')?.classList.remove('hidden');
  }
}

function toggleDarkMode(e) {
  const isDark = e.target.checked;
  document.body.classList.toggle('dark', isDark);
  chrome.storage.local.set({ fpDarkMode: isDark });
}

// ── Export Page ──

let currentExportTab = 'css';
let exportTokens = {};

// Semantic role definitions for mapping detected colors
const SEMANTIC_BG_ROLES = ['bg', 'surface', 'surface2'];
const SEMANTIC_FG_ROLES = ['fg', 'fg-muted', 'fg-inverse'];
const SEMANTIC_ACCENT_ROLES = ['primary', 'accent', 'border', 'border-strong'];

function buildSemanticTokens() {
  const tokens = {};
  const bgColors = Array.from(document.querySelectorAll('#bg-colors .color-swatch'))
    .map(el => el.getAttribute('data-color')).filter(Boolean);
  const fontColors = Array.from(document.querySelectorAll('#font-colors .color-swatch'))
    .map(el => el.getAttribute('data-color')).filter(Boolean);

  // Map background colors to semantic roles
  bgColors.forEach((c, i) => {
    const hex = c.startsWith('#') ? c : rgbToHex(c);
    if (!hex) return;
    if (i < SEMANTIC_BG_ROLES.length) {
      tokens[SEMANTIC_BG_ROLES[i]] = hex;
    } else {
      // Extra bg colors become accent-like tokens
      const role = SEMANTIC_ACCENT_ROLES[i - SEMANTIC_BG_ROLES.length];
      if (role) tokens[role] = hex;
      else tokens[`surface-${i + 1}`] = hex;
    }
  });

  // Map font/text colors to semantic roles
  fontColors.forEach((c, i) => {
    const hex = c.startsWith('#') ? c : rgbToHex(c);
    if (!hex) return;
    if (i < SEMANTIC_FG_ROLES.length) {
      tokens[SEMANTIC_FG_ROLES[i]] = hex;
    } else {
      tokens[`fg-${i + 1}`] = hex;
    }
  });

  // Auto-derive missing tokens from available colors
  if (tokens['bg'] && !tokens['surface']) {
    tokens['surface'] = tokens['bg'];
  }
  if (tokens['fg'] && !tokens['fg-muted']) {
    tokens['fg-muted'] = tokens['fg'];
  }
  if (tokens['bg'] && tokens['fg'] && !tokens['border']) {
    tokens['border'] = blendHex(tokens['bg'], tokens['fg'], 0.2);
  }
  if (tokens['border'] && !tokens['border-strong']) {
    tokens['border-strong'] = blendHex(tokens['border'], tokens['fg'] || '#000000', 0.3);
  }
  // Derive primary/accent from prominent colors if not set
  if (!tokens['primary'] && bgColors.length > 0) {
    // Use a distinct bg color or first font color as primary
    const candidates = [...bgColors.slice(1), ...fontColors].map(c => c.startsWith('#') ? c : rgbToHex(c)).filter(Boolean);
    if (candidates.length) tokens['primary'] = candidates[0];
  }
  if (tokens['primary'] && !tokens['on-primary']) {
    tokens['on-primary'] = getContrastingText(tokens['primary']);
  }
  if (!tokens['accent'] && fontColors.length > 1) {
    tokens['accent'] = fontColors[1].startsWith('#') ? fontColors[1] : rgbToHex(fontColors[1]);
  }
  if (tokens['accent'] && !tokens['on-accent']) {
    tokens['on-accent'] = getContrastingText(tokens['accent']);
  }
  if (tokens['primary'] && !tokens['primary-hover']) {
    tokens['primary-hover'] = adjustBrightness(tokens['primary'], -15);
  }
  if (tokens['primary'] && !tokens['primary-active']) {
    tokens['primary-active'] = adjustBrightness(tokens['primary'], -25);
  }
  // Info/success/warning/danger semantic colors
  if (!tokens['info']) tokens['info'] = '#2868A8';
  if (!tokens['on-info']) tokens['on-info'] = '#FFFFFF';
  if (!tokens['success']) tokens['success'] = '#2F8A5B';
  if (!tokens['on-success']) tokens['on-success'] = '#FFFFFF';
  if (!tokens['warning']) tokens['warning'] = '#9E7422';
  if (!tokens['on-warning']) tokens['on-warning'] = '#FFFFFF';
  if (!tokens['danger']) tokens['danger'] = '#A13D34';
  if (!tokens['on-danger']) tokens['on-danger'] = '#FFFFFF';
  if (!tokens['focus-ring']) tokens['focus-ring'] = tokens['primary'] || '#6366F1';

  return tokens;
}

function getContrastingText(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function adjustBrightness(hex, amount) {
  let r = parseInt(hex.slice(1,3), 16) + amount;
  let g = parseInt(hex.slice(3,5), 16) + amount;
  let b = parseInt(hex.slice(5,7), 16) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function blendHex(hex1, hex2, ratio) {
  const r1 = parseInt(hex1.slice(1,3), 16), g1 = parseInt(hex1.slice(3,5), 16), b1 = parseInt(hex1.slice(5,7), 16);
  const r2 = parseInt(hex2.slice(1,3), 16), g2 = parseInt(hex2.slice(3,5), 16), b2 = parseInt(hex2.slice(5,7), 16);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function showExport() {
  exportTokens = buildSemanticTokens();

  document.getElementById('export-page')?.classList.remove('hidden');
  document.querySelector('.header')?.classList.add('hidden');
  document.querySelector('.content')?.classList.add('hidden');
  document.querySelector('.footer')?.classList.add('hidden');
  document.querySelector('.action-row')?.classList.add('hidden');
  document.querySelector('.save-bar')?.classList.add('hidden');
  document.getElementById('screenshot-section')?.classList.add('hidden');
  document.getElementById('saves-remaining')?.classList.add('hidden');
  document.getElementById('error-message')?.classList.add('hidden');
  
  switchExportTab('css');
}

function hideExport() {
  document.getElementById('export-page')?.classList.add('hidden');
  document.querySelector('.header')?.classList.remove('hidden');
  document.querySelector('.content')?.classList.remove('hidden');
  document.querySelector('.footer')?.classList.remove('hidden');
  document.querySelector('.action-row')?.classList.remove('hidden');
  document.getElementById('save-bar')?.classList.remove('hidden');
  const preview = document.getElementById('screenshot-preview');
  if (preview?.getAttribute('data-screenshot')) {
    document.getElementById('screenshot-section')?.classList.remove('hidden');
  }
}

function showContrast() {
  // Gather colors and build results
  const fontColors = Array.from(document.querySelectorAll('#font-colors .color-swatch'))
    .map(el => el.getAttribute('data-color')).filter(Boolean);
  const bgColors = Array.from(document.querySelectorAll('#bg-colors .color-swatch'))
    .map(el => el.getAttribute('data-color')).filter(Boolean);
  buildContrastResults(fontColors, bgColors);

  document.getElementById('contrast-page')?.classList.remove('hidden');
  document.querySelector('.header')?.classList.add('hidden');
  document.querySelector('.content')?.classList.add('hidden');
  document.querySelector('.footer')?.classList.add('hidden');
  document.querySelector('.action-row')?.classList.add('hidden');
  document.querySelector('.save-bar')?.classList.add('hidden');
  document.getElementById('screenshot-section')?.classList.add('hidden');
  document.getElementById('saves-remaining')?.classList.add('hidden');
  document.getElementById('error-message')?.classList.add('hidden');
}

function hideContrast() {
  document.getElementById('contrast-page')?.classList.add('hidden');
  document.querySelector('.header')?.classList.remove('hidden');
  document.querySelector('.content')?.classList.remove('hidden');
  document.querySelector('.footer')?.classList.remove('hidden');
  document.querySelector('.action-row')?.classList.remove('hidden');
  document.getElementById('save-bar')?.classList.remove('hidden');
  const preview = document.getElementById('screenshot-preview');
  if (preview?.getAttribute('data-screenshot')) {
    document.getElementById('screenshot-section')?.classList.remove('hidden');
  }
}

function switchExportTab(tab) {
  currentExportTab = tab;
  document.querySelectorAll('.export-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  
  const label = document.getElementById('export-code-label');
  const block = document.getElementById('export-code-block');
  const copyText = document.getElementById('export-copy-text');
  copyText.textContent = 'Copy';
  document.getElementById('export-copy-btn')?.classList.remove('copied');
  
  let code = '';
  
  if (tab === 'css') {
    label.textContent = 'CSS custom properties';
    code = generateCSS();
  } else if (tab === 'tailwind') {
    label.textContent = 'Tailwind config colors';
    code = generateTailwind();
  } else if (tab === 'scss') {
    label.textContent = 'SCSS variables';
    code = generateSCSS();
  }
  
  block.textContent = code;
}

function generateCSS() {
  const lines = Object.entries(exportTokens)
    .map(([key, value]) => `  --color-${key}: ${value};`);

  return `:root {
${lines.join('\n')}
}

/* Usage */
.element {
  background-color: var(--color-bg);
  color: var(--color-fg);
}

.button-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

.button-primary:hover {
  background-color: var(--color-primary-hover);
}`;
}

function generateTailwind() {
  const colorEntries = Object.entries(exportTokens)
    .map(([key, value]) => `        '${key}': '${value}',`);

  return `// tailwind.config.js (Tailwind v3)
module.exports = {
  theme: {
    extend: {
      colors: {
${colorEntries.join('\n')}
      }
    }
  }
}

// Usage example:
// <div className="bg-bg text-fg border-border">
// <button className="bg-primary text-on-primary hover:bg-primary-hover">`;
}

function generateSCSS() {
  const variableLines = Object.entries(exportTokens)
    .map(([key, value]) => `$color-${key}: ${value};`);

  const mapEntries = Object.entries(exportTokens)
    .map(([key, value]) => `  '${key}': ${value},`);

  return `// SCSS Color Variables
${variableLines.join('\n')}

// As a map (for loops/functions)
$colors: (
${mapEntries.join('\n')}
);

// Usage example:
// .element {
//   background-color: $color-bg;
//   color: $color-fg;
// }
//
// @each $name, $color in $colors {
//   .text-#{$name} { color: $color; }
// }`;
}

function copyExportCode() {
  const code = document.getElementById('export-code-block')?.textContent;
  if (!code) return;
  
  navigator.clipboard.writeText(code).then(() => {
    const copyText = document.getElementById('export-copy-text');
    const btn = document.getElementById('export-copy-btn');
    copyText.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      copyText.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function rgbToHex(rgb) {
  if (!rgb) return '';
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgb;
  return '#' + [match[1], match[2], match[3]].map(x => 
    parseInt(x).toString(16).padStart(2, '0')
  ).join('');
}

// ── Icon Library Helpers ──

const ICON_LIBRARY_NAMES = {
  feather: 'Feather Icons',
  lucide: 'Lucide Icons',
  bootstrap: 'Bootstrap Icons',
  material: 'Material Icons',
  fontawesome: 'Font Awesome',
  heroicons: 'Heroicons',
  phosphor: 'Phosphor Icons',
  tabler: 'Tabler Icons',
};

const ICON_LIBRARY_URLS = {
  feather: 'https://fontpair.co/icons/feather',
  lucide: 'https://fontpair.co/icons/lucide',
  bootstrap: 'https://fontpair.co/icons/bootstrap-icons',
  material: 'https://fontpair.co/icons/material-symbols',
  fontawesome: 'https://fontawesome.com/icons',
  heroicons: 'https://heroicons.com',
  phosphor: 'https://fontpair.co/icons/phosphor',
  tabler: 'https://fontpair.co/icons/tabler',
};

const ICON_LIBRARY_CDNS = {
  feather: 'https://unpkg.com/feather-icons',
  lucide: 'https://unpkg.com/lucide@latest/dist/umd/lucide.js',
  bootstrap: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  material: 'https://fonts.googleapis.com/icon?family=Material+Icons',
  fontawesome: 'https://use.fontawesome.com/releases/v6.5.1/css/all.css',
  heroicons: 'npm install @heroicons/react',
  phosphor: 'https://unpkg.com/@phosphor-icons/web',
  tabler: 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css',
};

// Store detected icon library for AI prompt
let detectedIconLibrary = null;

function displayIconLibrary(iconData) {
  const section = document.getElementById('icon-library-section');
  const info = document.getElementById('icon-library-info');
  if (!section || !info || !iconData || !iconData.library) {
    detectedIconLibrary = null;
    return;
  }

  detectedIconLibrary = iconData.library;
  const name = ICON_LIBRARY_NAMES[iconData.library] || iconData.library;
  const browseUrl = ICON_LIBRARY_URLS[iconData.library] || 'https://fontpair.co/icons';

  info.innerHTML = `
    <div class="icon-library-row">
      <span class="icon-library-name">${name}</span>
      <a href="${browseUrl}" target="_blank" rel="noopener noreferrer" class="icon-library-link">
        Browse library
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  `;
  section.classList.remove('hidden');
}

// ── Copy for AI ──

// Weight name → numeric value
const WEIGHT_NAME_TO_NUM = {
  'Thin': 100, 'ExtraLight': 200, 'Light': 300, 'Regular': 400,
  'Medium': 500, 'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800, 'Black': 900
};

function weightNamesToNumbers(weights) {
  if (!weights || !weights.length) return [400];
  const nums = weights.map(w => WEIGHT_NAME_TO_NUM[w] || parseInt(w, 10) || 400);
  return [...new Set(nums)].sort((a, b) => a - b);
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function describeColor(hex) {
  const hsl = hexToHsl(hex);
  if (hsl.l > 0.95) return 'near white';
  if (hsl.l < 0.08) return 'near black';
  if (hsl.s < 0.1) {
    if (hsl.l > 0.7) return 'light gray';
    if (hsl.l > 0.4) return 'mid gray';
    return 'dark gray';
  }
  const hue = hsl.h;
  let name = '';
  if (hue < 15 || hue >= 345) name = 'red';
  else if (hue < 45) name = 'orange';
  else if (hue < 70) name = 'yellow';
  else if (hue < 160) name = 'green';
  else if (hue < 200) name = 'cyan';
  else if (hue < 260) name = 'blue';
  else if (hue < 300) name = 'purple';
  else name = 'pink';
  return name;
}

function classifyColors(bgColors, fontColors) {
  const all = [...new Set([...bgColors, ...fontColors])].filter(Boolean);
  const primary = [];
  const supporting = [];

  all.forEach(hex => {
    if (!hex || hex.length !== 7) return;
    const hsl = hexToHsl(hex);
    const desc = describeColor(hex);
    const isPrimary = hsl.s > 0.3 && hsl.l > 0.1 && hsl.l < 0.9;
    const isText = hsl.l < 0.15;
    const isBg = hsl.l > 0.9;

    let label = '';
    if (isText) label = `${hex} (${desc} - likely text color)`;
    else if (isBg) label = `${hex} (${desc} - likely background)`;
    else if (isPrimary) label = `${hex} (${desc} - likely brand/accent color)`;
    else label = `${hex} (${desc})`;

    if (isPrimary) primary.push(label);
    else supporting.push(label);
  });

  return { primary, supporting };
}

function buildGoogleFontsUrl(fontsWithWeights) {
  const googleFonts = fontsWithWeights.filter(f => f.isGoogle);
  if (!googleFonts.length) return null;
  const families = googleFonts.map(f => {
    const name = f.name.replace(/ /g, '+');
    const weights = f.weights.join(';');
    return `family=${name}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

const AI_TOOL_LABELS = {
  'cursor': 'Cursor',
  'lovable': 'Lovable',
  'v0': 'v0',
  'claude-code': 'Claude Code',
  'bolt': 'Bolt',
  'replit': 'Replit',
  'windsurf': 'Windsurf',
  'paper': 'Paper',
  'generic': 'Universal',
};

function toggleAIToolMenu() {
  const menu = document.getElementById('ai-tool-menu');
  if (menu) menu.classList.toggle('hidden');
}

async function handleCopyForAI(tool, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const menu = document.getElementById('ai-tool-menu');
  if (menu) menu.classList.add('hidden');

  try {
    const btn = document.getElementById('copy-ai-btn');
    if (!btn) throw new Error('AI prompt button not found');

    const promptBuilder = typeof buildDesignPrompt === 'function'
      ? buildDesignPrompt
      : (typeof window !== 'undefined' && typeof window.buildDesignPrompt === 'function'
          ? window.buildDesignPrompt
          : null);

    if (!promptBuilder) {
      throw new Error('Prompt builder unavailable');
    }

    const url = document.getElementById('save-btn')?.getAttribute('data-url') || window.location.href;
    const title = document.getElementById('save-btn')?.getAttribute('data-title') || document.title || '';
    const toolLabel = AI_TOOL_LABELS[tool] || 'AI';

    const fontItems = document.querySelectorAll('#all-fonts .font-item');
    const fontsData = [];
    fontItems.forEach((item) => {
      const name = item.getAttribute('data-font');
      if (!name) return;
      const role = item.getAttribute('data-role') || 'body';
      let weights = [400];
      try {
        const raw = item.getAttribute('data-weights');
        if (raw) weights = weightNamesToNumbers(JSON.parse(raw));
      } catch (e) {}
      const badge = item.querySelector('.font-source-badge--google');
      const link = item.querySelector('.font-name-link--google');
      const isGoogle = !!(badge || link);
      fontsData.push({ name, role, weights, isGoogle });
    });

    const fallbackFontName = fontsData[0]?.name || 'Sans-serif';
    const headingFont = fontsData.find((font) => font.role === 'heading');
    const bodyFont = fontsData.find((font) => font.role === 'body') || fontsData[0];
    const headingName = headingFont ? headingFont.name : fallbackFontName;
    const bodyName = bodyFont ? bodyFont.name : fallbackFontName;

    const normalizeHex = (value, fallback = null) => {
      if (typeof value !== 'string') return fallback;
      const hex = value.trim();
      return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : fallback;
    };

    const bgColors = Array.from(document.querySelectorAll('#bg-colors .color-swatch'))
      .map((el) => normalizeHex(el.getAttribute('data-color')))
      .filter(Boolean);
    const fontColors = Array.from(document.querySelectorAll('#font-colors .color-swatch'))
      .map((el) => normalizeHex(el.getAttribute('data-color')))
      .filter(Boolean);

    const allColors = [...new Set([...bgColors, ...fontColors])];
    const bgColor = normalizeHex(bgColors[0], '#FFFFFF');
    const fgColor = normalizeHex(fontColors[0], '#1A1A1A');
    const fgMuted = normalizeHex(fontColors[1], '#6B7280');

    let primaryColor = '#3B82F6';
    let accentColor = '#2563EB';
    let borderColor = '#E5E7EB';
    allColors.forEach((hex) => {
      const hsl = hexToHsl(hex);
      if (hsl.s > 0.3 && hsl.l > 0.15 && hsl.l < 0.85) {
        if (primaryColor === '#3B82F6') primaryColor = hex;
        else if (accentColor === '#2563EB') accentColor = hex;
      }
      if (hsl.s < 0.1 && hsl.l > 0.7 && hsl.l < 0.95) {
        borderColor = hex;
      }
    });

    let iconInfo = null;
    if (detectedIconLibrary) {
      const iconName = ICON_LIBRARY_NAMES[detectedIconLibrary] || detectedIconLibrary;
      const iconUrl = ICON_LIBRARY_URLS[detectedIconLibrary] || 'https://fontpair.co/icons';
      iconInfo = { name: iconName, installUrl: iconUrl };
    }

    const prompt = promptBuilder({
      headingFontName: headingName,
      bodyFontName: bodyName,
      colors: {
        bg: bgColor,
        fg: fgColor,
        fgMuted: fgMuted,
        primary: primaryColor,
        accent: accentColor,
        border: borderColor,
      },
      target: tool,
      sourceUrl: url,
      sourceLabel: title || 'Fontpair Extension',
      icon: iconInfo,
    });

    if (!prompt || !prompt.trim()) {
      throw new Error('Generated prompt was empty');
    }

    // Route clipboard write through background → offscreen for reliability
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'COPY_TO_CLIPBOARD', text: prompt }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve();
        } else {
          reject(new Error(response?.error || 'Clipboard write failed'));
        }
      });
    });

    const origHTML = btn.innerHTML;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    btn.classList.add('copied');
    showToast(`✓ ${toolLabel} prompt copied to clipboard`);
    setTimeout(() => {
      btn.innerHTML = origHTML;
      btn.classList.remove('copied');
    }, 2500);

    try {
      chrome.runtime.sendMessage({ type: 'TRACK_EVENT', event: 'copy_for_ai', data: { url, tool, fontCount: fontsData.length, colorCount: bgColors.length + fontColors.length } });
    } catch (e) { /* silent */ }
  } catch (err) {
    console.error('AI prompt copy failed:', err);
    showToast('Copy failed — reopen and try again');
  }
}
