// Font Pair Extension - Content Script
// Extracts fonts (with weights), colors from the current page

// ── First-Visit Tooltip ──
(function firstVisitTooltip() {
  // Skip fontpair.co pages, chrome://, about:, and Chrome Web Store
  const loc = window.location.href;
  if (/fontpair\.co/i.test(loc) ||
      /^chrome/i.test(loc) ||
      /^about:/i.test(loc) ||
      /chrome\.google\.com\/webstore/i.test(loc) ||
      /chromewebstore\.google\.com/i.test(loc)) {
    return;
  }

  chrome.storage.local.get(['showFirstVisitTooltip'], (data) => {
    if (!data.showFirstVisitTooltip) return;

    // Delay 1.5s to let the page settle
    setTimeout(() => {
      // Re-check in case popup was opened during delay
      chrome.storage.local.get(['showFirstVisitTooltip'], (d) => {
        if (!d.showFirstVisitTooltip) return;
        injectTooltip();
      });
    }, 1500);
  });

  function dismissTooltip(el) {
    if (!el || el.dataset.dismissing) return;
    el.dataset.dismissing = 'true';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => { el.remove(); }, 300);
    chrome.storage.local.set({ showFirstVisitTooltip: false });
  }

  function injectTooltip() {
    const TOOLTIP_ID = 'fontpair-first-visit-tooltip';
    if (document.getElementById(TOOLTIP_ID)) return;

    const wrapper = document.createElement('div');
    wrapper.id = TOOLTIP_ID;

    // Shadow DOM so page styles can't leak in
    const shadow = wrapper.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap');

      :host {
        all: initial;
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        pointer-events: auto;
      }

      .card {
        background: #ffffff;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
        max-width: 320px;
        padding: 16px 18px;
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity 0.4s ease, transform 0.4s ease;
        position: relative;
        color: #1a1a1a;
        line-height: 1.5;
      }

      .card.visible {
        opacity: 1;
        transform: translateY(0);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }

      .logo {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .headline {
        font-size: 14px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0;
      }

      .close-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: #999;
        font-size: 16px;
        line-height: 1;
        padding: 0;
        transition: background 0.15s, color 0.15s;
      }

      .close-btn:hover {
        background: #f0f0f0;
        color: #333;
      }

      .body {
        font-size: 13px;
        color: #444;
        margin: 0 0 8px 0;
        font-weight: 400;
      }

      .tip {
        font-size: 11.5px;
        color: #888;
        margin: 0;
        font-weight: 400;
      }
    `;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <button class="close-btn" aria-label="Dismiss">&#215;</button>
      <div class="header">
        <img class="logo" src="${chrome.runtime.getURL('src/images/icon32.png')}" alt="Fontpair" />
        <p class="headline">Fontpair is installed</p>
      </div>
      <p class="body">Click the Fontpair icon in your toolbar to see this site's fonts and colors.</p>
      <p class="tip">Tip: Click the puzzle piece icon and pin Fontpair for quick access.</p>
    `;

    shadow.appendChild(style);
    shadow.appendChild(card);
    document.documentElement.appendChild(wrapper);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { card.classList.add('visible'); });
    });

    // Close button
    shadow.querySelector('.close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      dismissTooltip(card);
    });

    // Click outside to dismiss
    document.addEventListener('click', function outsideClick(e) {
      if (!wrapper.contains(e.target)) {
        document.removeEventListener('click', outsideClick, true);
        dismissTooltip(card);
      }
    }, true);

    // Auto-dismiss after 30 seconds
    setTimeout(() => { dismissTooltip(card); }, 30000);

    // Listen for popup open clearing the flag
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.showFirstVisitTooltip && !changes.showFirstVisitTooltip.newValue) {
        dismissTooltip(card);
      }
    });
  }
})();

const BROWSER_DEFAULTS = [
  'Times New Roman', 'Times', 'Arial', 'Helvetica',
  'Courier New', 'Courier', 'Verdana', 'Georgia',
  'Palatino', 'Garamond', 'Trebuchet MS', 'Impact',
  'Comic Sans MS', 'Tahoma', 'Geneva', 'Lucida Console',
  'Lucida Sans Unicode', 'Segoe UI', 'Inter'
];

function weightToName(w) {
  const num = parseInt(w, 10);
  const map = {
    100: 'Thin', 200: 'ExtraLight', 300: 'Light',
    400: 'Regular', 500: 'Medium', 600: 'SemiBold',
    700: 'Bold', 800: 'ExtraBold', 900: 'Black'
  };
  return map[num] || 'Regular';
}

function formatFontDisplayName(name) {
  if (!name) return '';
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

chrome.runtime.onMessage.addListener(function (msg, sender, response) {
  if ((msg.from === 'popup') && (msg.subject === 'DOMInfo')) {
    try {
      var pageData = getPageData();
      response(JSON.stringify(pageData));
    } catch (e) {
      console.error('[Fontpair] getPageData error:', e);
      response(JSON.stringify({ fonts: [], colors: [], background_colors: [], font_colors: [], fontFaceRules: [], fontStylesheetUrls: [] }));
    }
  }
});


function rgb2hex(rgb) {
  if (!rgb) return '';
  // Check for transparency — skip fully transparent colors
  const rgbaMatch = rgb.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
  if (!rgbaMatch) return '';
  // If alpha is 0, skip this color entirely
  if (rgbaMatch[4] !== undefined && parseFloat(rgbaMatch[4]) === 0) return '';
  return "#" +
    ("0" + parseInt(rgbaMatch[1], 10).toString(16)).slice(-2) +
    ("0" + parseInt(rgbaMatch[2], 10).toString(16)).slice(-2) +
    ("0" + parseInt(rgbaMatch[3], 10).toString(16)).slice(-2);
}

// Clean font family name
function cleanFontFamily(fontFamily) {
  if (!fontFamily) return null;
  const firstFont = fontFamily.split(',')[0].trim();
  const cleaned = firstFont.replace(/["']/g, '').trim();

  // Skip empty or very short names
  if (!cleaned || cleaned.length < 2) return null;

  // Filter system-internal fonts starting with a dot (e.g. .SFNSDisplay, .AppleSystemUIFont)
  if (cleaned.startsWith('.')) return null;

  // Filter Apple system-internal font names that may appear without the dot prefix
  // e.g. "SFNSDisplay", "SFNSText", "SFNSRounded", "SFProDisplay", "SFProText"
  if (/^SF(NS|Pro|Compact|Mono)?(Display|Text|Rounded)?/i.test(cleaned.replace(/[\s-]/g, ''))) {
    // Allow "SF Pro Display" etc. only if it doesn't look like an internal variant
    // Internal variants have no spaces and contain suffixes like "Semibold", "Regular"
    const hasWeight = /\b(Ultralight|Thin|Light|Regular|Medium|Semibold|Bold|Heavy|Black)\b/i.test(cleaned);
    const isInternal = !cleaned.includes(' ') || cleaned.startsWith('.') || /^\.?SF(NS|Compact)/i.test(cleaned.replace(/[\s-]/g, ''));
    if (isInternal && hasWeight) return null;
    // Filter all SFNS variants (these are never user-facing font names)
    if (/^\.?SFNS/i.test(cleaned.replace(/[\s-]/g, ''))) return null;
  }

  const systemFonts = [
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', '-apple-system', 'BlinkMacSystemFont',
    'Apple Color Emoji', 'Segoe UI Emoji',
    'Segoe UI Symbol', 'Noto Color Emoji', 'ui-sans-serif', 'ui-serif',
    'ui-monospace', 'ui-rounded', '.AppleSystemUIFont',
    'Apple SD Gothic Neo'
  ];

  if (systemFonts.some(sf => cleaned.toLowerCase() === sf.toLowerCase())) {
    return null;
  }

  // Filter icon fonts and non-text font families
  const lower = cleaned.toLowerCase();

  // Filter emoji fonts (e.g. "Noto Color Emoji", "Noto Color Emoji Country Flags", "Apple Color Emoji", "Twemoji")
  if (/emoji|flags/i.test(lower)) return null;

  const iconPatterns = [
    'font awesome', 'fontawesome', 'material icons', 'material symbols',
    'bootstrap-icons', 'bootstrapicons', 'glyphicons', 'ionicons',
    'icomoon', 'typicons', 'octicons', 'feather', 'remixicon',
    'simple-line-icons', 'themify', 'linearicons', 'flaticon',
    'dashicons', 'genericons', 'social-logos', 'noticons',
    'wpcom', 'woocommerce', 'revicons', 'fl-icons', 'fa-',
    'icon', 'icons', 'symbol'
  ];
  if (iconPatterns.some(p => lower === p || lower.startsWith(p + ' ') || lower.includes('icon'))) {
    return null;
  }

  // Filter generic webfont hash names (e.g. "webfont-739", "font-abc123")
  if (/^(web)?font[-_]?\d/i.test(cleaned)) return null;
  // Filter names that are just numbers/hashes
  if (/^[a-f0-9-_]+$/i.test(cleaned) && cleaned.length < 20) return null;

  // Strip trailing hex hash suffixes (e.g. "Libre Baskerville 6f16a0" → "Libre Baskerville")
  // Matches a space, hyphen, or underscore followed by a 4-8 character hex string at the end
  // Filter out trial/demo fonts entirely (e.g. "GT Flexa Mono Trial Rg", "FK Grotesk Neue Trial")
  if (/\btrial\b/i.test(cleaned)) return null;
  if (/\bdemo\b/i.test(cleaned)) return null;

  const noTrial = cleaned;
  // Strip trailing "Variable" / "Var" / "VF" suffixes (e.g. "Gyst Variable" → "Gyst")
  const noVar = noTrial.replace(/[\s_-]*(variable|var|vf)$/i, '');
  // Strip trailing hex hash suffixes (e.g. "Libre Baskerville 6f16a0" → "Libre Baskerville")
  const stripped = (noVar.length >= 2 ? noVar : noTrial).replace(/[\s_-]+[a-f0-9]{4,8}$/i, '');
  // Strip leading "Font" prefix used by some foundries (e.g. "FontPlanar" → "Planar", "FontFlexaMono" → "FlexaMono")
  const noFontPrefix = stripped.replace(/^Font(?=[A-Z])/,  '');
  const finalName = (noFontPrefix.length >= 2 ? noFontPrefix : stripped).replace(/([a-z])([A-Z])/g, '$1 $2');
  if (finalName.length >= 2) return finalName;

  return cleaned;
}

// Determine generic category from computed style
function getCategory(style) {
  const ff = (style.fontFamily || '').toLowerCase();
  if (ff.includes('monospace') || ff.includes('ui-monospace')) return 'monospace';
  if (ff.includes('serif') && !ff.includes('sans-serif')) return 'serif';
  return 'sans-serif';
}

// Check if color is valid (non-empty, proper hex, not near-white/near-transparent)
function isValidColor(hex) {
  if (!hex || hex.length !== 7 || hex[0] !== '#') return false;
  return true;
}

// Extract hex colors from CSS gradient strings like "linear-gradient(135deg, #1a2b3c, rgb(...))"
function extractGradientColors(value) {
  if (!value || value === 'none') return [];
  const colors = [];
  // Match hex colors
  const hexMatches = value.match(/#[0-9a-fA-F]{3,8}\b/g);
  if (hexMatches) {
    hexMatches.forEach(h => {
      if (h.length === 4) {
        // Expand shorthand #abc → #aabbcc
        h = '#' + h[1]+h[1] + h[2]+h[2] + h[3]+h[3];
      }
      if (h.length === 7) colors.push(h.toLowerCase());
    });
  }
  // Match rgb/rgba colors
  const rgbMatches = value.match(/rgba?\s*\([^)]+\)/gi);
  if (rgbMatches) {
    rgbMatches.forEach(m => {
      const hex = rgb2hex(m);
      if (hex) colors.push(hex.toLowerCase());
    });
  }
  return colors;
}

// Extract weights declared in stylesheets (@font-face & CSS rules)
function getStylesheetWeights() {
  const sheetWeights = {}; // fontFamily → Set of weight strings
  try {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (rule instanceof CSSFontFaceRule) {
            const family = (rule.style.getPropertyValue('font-family') || '')
              .replace(/["']/g, '').trim();
            const w = rule.style.getPropertyValue('font-weight') || '400';
            if (family) {
              if (!sheetWeights[family]) sheetWeights[family] = new Set();
              // Handle ranges like "100 900" (variable fonts)
              if (w.includes(' ')) {
                const [lo, hi] = w.split(' ').map(Number);
                for (let v = lo; v <= hi; v += 100) {
                  sheetWeights[family].add(weightToName(v));
                }
              } else {
                sheetWeights[family].add(weightToName(w));
              }
            }
          }
        }
      } catch (e) { /* cross-origin sheet, skip */ }
    }
  } catch (e) { /* no stylesheets */ }
  return sheetWeights;
}

// ── Main extraction ─────────────────────────────────────────
function getPageData() {
  const maxColorToDisplay = 8;
  const maxElements = 800;
  let processedElements = 0;

  const arrBgColor = [];
  const arrFontColor = [];

  // fontMap: { "Inter": { weights: Set, weightCounts: Map, category: "sans-serif", role: "body"|"heading" } }
  const fontMap = {};

  function trackFont(name, weight, category, role) {
    if (!name) return;
    if (!fontMap[name]) {
      fontMap[name] = { weights: new Set(), weightCounts: new Map(), category: category, role: role };
    }
    const wName = weightToName(weight);
    fontMap[name].weights.add(wName);
    // Track raw numeric weight frequency to find the primary weight
    const numWeight = parseInt(weight, 10) || 400;
    fontMap[name].weightCounts.set(numWeight, (fontMap[name].weightCounts.get(numWeight) || 0) + 1);
    if (role === 'heading') fontMap[name].role = 'heading';
  }

  function collectColor(hex, arr) {
    if (!hex) return;
    hex = hex.toLowerCase();
    if (isValidColor(hex) && arr.indexOf(hex) === -1 && arr.length < maxColorToDisplay) {
      arr.push(hex);
    }
  }

  // Collect background colors from computed style, including gradients
  function collectBgColors(s, arr) {
    collectColor(rgb2hex(s.backgroundColor), arr);
    // Also extract colors from background-image (gradients)
    const bgImage = s.backgroundImage;
    if (bgImage && bgImage !== 'none') {
      extractGradientColors(bgImage).forEach(c => collectColor(c, arr));
    }
  }

  // Body
  const body = document.body;
  if (body) {
    const s = window.getComputedStyle(body);
    collectBgColors(s, arrBgColor);
    collectColor(rgb2hex(s.color), arrFontColor);
    trackFont(cleanFontFamily(s.fontFamily), s.fontWeight, getCategory(s), 'body');
  }

  // Headings
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function (el) {
    if (processedElements++ > maxElements) return;
    const s = window.getComputedStyle(el);
    collectBgColors(s, arrBgColor);
    collectColor(rgb2hex(s.color), arrFontColor);
    trackFont(cleanFontFamily(s.fontFamily), s.fontWeight, getCategory(s), 'heading');
  });

  // Body text elements — also collect colors from these
  document.querySelectorAll('p, span, li, a, div, blockquote, label, td, th').forEach(function (el) {
    if (processedElements++ > maxElements) return;
    const s = window.getComputedStyle(el);
    collectBgColors(s, arrBgColor);
    collectColor(rgb2hex(s.color), arrFontColor);
    trackFont(cleanFontFamily(s.fontFamily), s.fontWeight, getCategory(s), 'body');
  });

  // Also scan sections, headers, footers, navs, buttons — common containers with brand colors
  document.querySelectorAll('section, header, footer, nav, main, aside, article, button, [class*="hero"], [class*="banner"], [class*="cta"]').forEach(function (el) {
    if (processedElements++ > maxElements) return;
    const s = window.getComputedStyle(el);
    collectBgColors(s, arrBgColor);
    collectColor(rgb2hex(s.color), arrFontColor);
  });

  // Remaining elements for any missed colors
  const all = document.querySelectorAll('*');
  for (let i = 0; i < Math.min(all.length, maxElements); i++) {
    if (arrBgColor.length >= maxColorToDisplay && arrFontColor.length >= maxColorToDisplay) break;
    const s = window.getComputedStyle(all[i]);
    collectBgColors(s, arrBgColor);
    collectColor(rgb2hex(s.color), arrFontColor);
  }

  // Merge @font-face weights into fontMap
  const sheetWeights = getStylesheetWeights();
  for (const [name, data] of Object.entries(fontMap)) {
    if (sheetWeights[name]) {
      sheetWeights[name].forEach(w => data.weights.add(w));
    }
  }

  // Merge font variants into base families
  // Handles variable suffixes (e.g. "InterVariable" → "Inter")
  // and weight/width variants (e.g. "Bossa ExpandedMedium", "Bossa Regular" → "Bossa")
  const variableSuffixes = ['Variable', ' Variable', 'VF', ' VF', '-Variable'];
  const weightWidthSuffixes = [
    'ExtraCondensedThin', 'ExtraCondensedExtraLight', 'ExtraCondensedLight', 'ExtraCondensedRegular',
    'ExtraCondensedMedium', 'ExtraCondensedSemiBold', 'ExtraCondensedBold', 'ExtraCondensedExtraBold', 'ExtraCondensedBlack',
    'CondensedThin', 'CondensedExtraLight', 'CondensedLight', 'CondensedRegular',
    'CondensedMedium', 'CondensedSemiBold', 'CondensedBold', 'CondensedExtraBold', 'CondensedBlack',
    'ExpandedThin', 'ExpandedExtraLight', 'ExpandedLight', 'ExpandedRegular',
    'ExpandedMedium', 'ExpandedSemiBold', 'ExpandedBold', 'ExpandedExtraBold', 'ExpandedBlack',
    'SemiCondensedThin', 'SemiCondensedExtraLight', 'SemiCondensedLight', 'SemiCondensedRegular',
    'SemiCondensedMedium', 'SemiCondensedSemiBold', 'SemiCondensedBold', 'SemiCondensedExtraBold', 'SemiCondensedBlack',
    'SemiExpandedThin', 'SemiExpandedExtraLight', 'SemiExpandedLight', 'SemiExpandedRegular',
    'SemiExpandedMedium', 'SemiExpandedSemiBold', 'SemiExpandedBold', 'SemiExpandedExtraBold', 'SemiExpandedBlack',
    'ExtraCondensed', 'SemiCondensed', 'Condensed', 'SemiExpanded', 'ExtraExpanded', 'Expanded',
    'Hairline', 'UltraThin', 'ExtraThin',
    'Thin', 'ExtraLight', 'UltraLight', 'Light',
    'Regular', 'Normal', 'Book', 'Roman', 'Text',
    'Medium', 'SemiBold', 'DemiBold',
    'Bold', 'ExtraBold', 'UltraBold', 'Heavy',
    'Black', 'ExtraBlack', 'UltraBlack',
  ];
  // Sort by length descending so longer suffixes match first
  weightWidthSuffixes.sort((a, b) => b.length - a.length);

  function getBaseFontName(name) {
    // First strip variable suffixes
    for (const suffix of variableSuffixes) {
      if (name.endsWith(suffix)) {
        return name.slice(0, -suffix.length).trim();
      }
    }
    // Then try weight/width suffixes (with optional space or hyphen separator)
    for (const suffix of weightWidthSuffixes) {
      const patterns = [' ' + suffix, '-' + suffix, suffix];
      for (const pat of patterns) {
        if (name.endsWith(pat)) {
          const base = name.slice(0, -pat.length).trim();
          // Only strip if there's still a meaningful base name left (at least 2 chars)
          if (base.length >= 2) return base;
        }
      }
    }
    return name;
  }

  const mergedMap = {};
  for (const [name, data] of Object.entries(fontMap)) {
    const baseName = getBaseFontName(name);
    if (!mergedMap[baseName]) {
      mergedMap[baseName] = { weights: new Set(data.weights), weightCounts: new Map(data.weightCounts), category: data.category, role: data.role };
    } else {
      data.weights.forEach(w => mergedMap[baseName].weights.add(w));
      for (const [w, c] of data.weightCounts) {
        mergedMap[baseName].weightCounts.set(w, (mergedMap[baseName].weightCounts.get(w) || 0) + c);
      }
      if (data.role === 'heading') mergedMap[baseName].role = 'heading';
    }
  }

  // Build structured fonts array
  let fonts = Object.entries(mergedMap).map(([name, data]) => {
    // Find the most frequently used weight
    let primaryWeight = 400;
    let maxCount = 0;
    for (const [w, c] of data.weightCounts) {
      if (c > maxCount) { maxCount = c; primaryWeight = w; }
    }
    return {
      name: formatFontDisplayName(name),
      weights: Array.from(data.weights).sort((a, b) => {
        const order = ['Thin','ExtraLight','Light','Regular','Medium','SemiBold','Bold','ExtraBold','Black'];
        return order.indexOf(a) - order.indexOf(b);
      }),
      primaryWeight: primaryWeight,
      category: data.category,
      role: data.role
    };
  });

  // Filter browser default fonts only when custom fonts are also detected
  const defaultSet = new Set(BROWSER_DEFAULTS.map(f => f.toLowerCase()));
  const hasCustomFont = fonts.some(f => !defaultSet.has(f.name.toLowerCase()));
  if (hasCustomFont) {
    fonts = fonts.filter(f => !defaultSet.has(f.name.toLowerCase()));
  }

  // Merge all colors (bg + font), deduplicated, max 6
  const allColors = [];
  arrBgColor.concat(arrFontColor).forEach(c => {
    if (allColors.indexOf(c) === -1 && allColors.length < maxColorToDisplay) allColors.push(c);
  });

  // Extract @font-face CSS and stylesheet URLs so the popup can render fonts
  const fontFaceRules = [];
  const fontStylesheetUrls = [];
  try {
    for (const sheet of document.styleSheets) {
      try {
        // Collect external stylesheet URLs
        if (sheet.href) {
          fontStylesheetUrls.push(sheet.href);
        }
        const baseUrl = sheet.href || document.baseURI;
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (rule instanceof CSSFontFaceRule) {
            // Resolve relative URLs in @font-face src to absolute
            let cssText = rule.cssText;
            cssText = cssText.replace(/url\(["']?([^"')]+)["']?\)/g, (match, url) => {
              if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
                return match;
              }
              try {
                const absolute = new URL(url, baseUrl).href;
                return `url("${absolute}")`;
              } catch (e) {
                return match;
              }
            });
            fontFaceRules.push(cssText);
          }
        }
      } catch (e) { /* cross-origin sheet — URL fallback handles it */ }
    }
  } catch (e) { /* no stylesheets */ }

  // Detect icon library
  let iconLibrary = null;
  try {
    iconLibrary = detectIconLibrary();
  } catch (e) { /* silent */ }

  return {
    fonts: fonts,
    colors: allColors,
    background_colors: arrBgColor.slice(0, maxColorToDisplay),
    font_colors: arrFontColor.slice(0, maxColorToDisplay),
    fontFaceRules: fontFaceRules,
    fontStylesheetUrls: fontStylesheetUrls,
    iconLibrary: iconLibrary
  };
}

// ── Icon Library Detection ─────────────────────────────────
// Only returns a result when confidence >= 0.95 (two or more strong signals).
function detectIconLibrary() {
  const candidates = [];

  // Helper: check if any stylesheet href matches a pattern
  function hasStylesheetMatch(pattern) {
    try {
      for (const sheet of document.styleSheets) {
        try { if (sheet.href && sheet.href.includes(pattern)) return true; } catch (e) {}
      }
    } catch (e) {}
    return false;
  }

  // Helper: check if any script src matches a pattern
  function hasScriptMatch(pattern) {
    return Array.from(document.scripts).some(s => s.src && s.src.includes(pattern));
  }

  // 1. Font Awesome (check first — extremely common)
  {
    const signals = [
      !!document.querySelector('.fas, .far, .fab, .fal, .fa-solid, .fa-regular, .fa-brands'),
      !!document.querySelector('[class*="fa-"]'),
      hasStylesheetMatch('fontawesome') || hasStylesheetMatch('font-awesome'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 2) candidates.push({ library: 'fontawesome', confidence: 0.98, score });
  }

  // 2. Material Icons / Material Symbols
  {
    const signals = [
      !!document.querySelector('.material-icons, .material-icons-outlined, .material-icons-round, .material-icons-sharp'),
      !!document.querySelector('.material-symbols-outlined, .material-symbols-rounded, .material-symbols-sharp'),
      hasStylesheetMatch('fonts.googleapis.com/icon') || hasStylesheetMatch('fonts.googleapis.com/css2?family=Material'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 1) {
      // Material is very distinctive — single strong signal is enough
      candidates.push({ library: 'material', confidence: score >= 2 ? 0.99 : 0.95, score });
    }
  }

  // 3. Bootstrap Icons
  {
    const signals = [
      !!document.querySelector('[class*="bi-"]'),
      hasStylesheetMatch('bootstrap-icons'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 2) candidates.push({ library: 'bootstrap', confidence: 0.97, score });
  }

  // 4. Lucide Icons
  {
    const signals = [
      !!document.querySelector('[class*="lucide"]'),
      !!document.querySelector('[data-lucide]'),
      hasScriptMatch('lucide'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 2) candidates.push({ library: 'lucide', confidence: 0.96, score });
  }

  // 5. Feather Icons
  {
    const signals = [
      !!document.querySelector('[data-feather]'),
      !!document.querySelector('svg.feather'),
      hasScriptMatch('feather-icons') || hasScriptMatch('feather.min.js'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 2) candidates.push({ library: 'feather', confidence: 0.96, score });
  }

  // 6. Heroicons
  {
    const signals = [
      !!document.querySelector('[class*="heroicon"]'),
      hasScriptMatch('heroicons'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 2) candidates.push({ library: 'heroicons', confidence: 0.95, score });
  }

  // 7. Phosphor Icons
  {
    const signals = [
      !!document.querySelector('[class*="ph-"], .ph'),
      hasScriptMatch('phosphor'),
      hasStylesheetMatch('phosphor'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 2) candidates.push({ library: 'phosphor', confidence: 0.96, score });
  }

  // 8. Tabler Icons
  {
    const signals = [
      !!document.querySelector('[class*="tabler-"], .ti'),
      hasScriptMatch('tabler'),
      hasStylesheetMatch('tabler'),
    ];
    const score = signals.filter(Boolean).length;
    if (score >= 2) candidates.push({ library: 'tabler', confidence: 0.96, score });
  }

  // Pick highest confidence, then highest score
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.confidence - a.confidence || b.score - a.score);
  const best = candidates[0];
  return best.confidence >= 0.95 ? { library: best.library, confidence: best.confidence } : null;
}
