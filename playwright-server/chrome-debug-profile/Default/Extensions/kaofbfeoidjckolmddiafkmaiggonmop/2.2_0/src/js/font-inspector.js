// Font Inspector — right-click context menu "Inspect Font" for selected text
// Injected into the active tab by background.js

(function fontpairInspectFont() {
  // Helpers (duplicated from script.js so this runs standalone)
  function weightToName(w) {
    const num = parseInt(w, 10);
    const map = {
      100: 'Thin', 200: 'ExtraLight', 300: 'Light',
      400: 'Regular', 500: 'Medium', 600: 'SemiBold',
      700: 'Bold', 800: 'ExtraBold', 900: 'Black'
    };
    return map[num] || 'Regular';
  }

  function cleanFontFamily(fontFamily) {
    if (!fontFamily) return null;
    const firstFont = fontFamily.split(',')[0].trim();
    const cleaned = firstFont.replace(/["']/g, '').trim();
    if (!cleaned || cleaned.length < 2) return null;
    // Format display name
    return cleaned
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  // Get the element from the current selection
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    console.warn('[Fontpair] No text selected');
    return;
  }

  let node = sel.anchorNode;
  if (!node) return;
  // Walk up to nearest Element
  while (node && node.nodeType !== Node.ELEMENT_NODE) {
    node = node.parentElement;
  }
  if (!node) return;

  const style = window.getComputedStyle(node);
  const fontFamily = cleanFontFamily(style.fontFamily);
  const fontWeight = style.fontWeight;
  const fontStyle = style.fontStyle;
  const fontSize = style.fontSize;
  const lineHeight = style.lineHeight;
  const letterSpacing = style.letterSpacing;
  const rawColor = style.color;

  // Convert rgb(r,g,b) to hex
  function rgbToHex(rgb) {
    const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return null;
    return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  const fontColorHex = rgbToHex(rawColor);

  if (!fontFamily) return;

  const weightName = weightToName(fontWeight);

  // Position tooltip near the selection
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Remove any existing tooltip
  const existing = document.getElementById('fontpair-inspect-tooltip');
  if (existing) existing.remove();

  // Create tooltip container with Shadow DOM
  const host = document.createElement('div');
  host.id = 'fontpair-inspect-tooltip';
  host.style.cssText = 'all:initial; position:fixed; z-index:2147483647; pointer-events:auto;';

  const shadow = host.attachShadow({ mode: 'closed' });

  // Detect dark mode
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const bg = isDark ? '#2a2a2a' : '#ffffff';
  const border = isDark ? '#404040' : '#e5e5e5';
  const textColor = isDark ? '#e5e5e5' : '#1a1a1a';
  const mutedColor = isDark ? '#999' : '#666';
  const accentColor = '#FFCF4A';

  // Position: above the selection if there's room, otherwise below
  const tooltipHeight = 180;
  let top = rect.top - tooltipHeight - 10;
  if (top < 8) top = rect.bottom + 10;
  let left = rect.left + rect.width / 2;
  // Clamp to viewport
  left = Math.max(200, Math.min(left, window.innerWidth - 200));

  host.style.top = top + 'px';
  host.style.left = left + 'px';
  host.style.transform = 'translateX(-50%)';

  const fontSizeIcon = '<svg class="tag-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M3 24.04L7.096 12.68H9.288L13.384 24.04H11.544L10.504 21.08H5.864L4.84 24.04H3ZM6.408 19.512H9.976L8.184 14.328L6.408 19.512Z"/><path d="M14.3512 24.04L20.4953 7H23.7833L29.9272 24.04H27.1672L25.6073 19.6H18.6473L17.1112 24.04H14.3512ZM19.4632 17.248H24.8153L22.1273 9.472L19.4632 17.248Z"/></svg>';
  const letterSpacingIcon = '<svg class="tag-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="5.5" y="5" width="2" height="22"/><path d="M9.5 23.1004L14.62 8.90039H17.36L22.48 23.1004H20.18L18.88 19.4004H13.08L11.8 23.1004H9.5ZM13.76 17.4404H18.22L15.98 10.9604L13.76 17.4404Z"/><rect x="24.4805" y="5" width="2" height="22"/></svg>';
  const lineHeightIcon = '<svg class="tag-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="22" height="2"/><path d="M9.50977 23.2L14.6298 9H17.3698L22.4898 23.2H20.1898L18.8898 19.5H13.0898L11.8098 23.2H9.50977ZM13.7698 17.54H18.2298L15.9898 11.06L13.7698 17.54Z"/><rect x="5" y="25.2002" width="22" height="2"/></svg>';

  const extraDetails = [];
  if (fontStyle && fontStyle !== 'normal') extraDetails.push({ text: fontStyle, icon: '' });
  if (letterSpacing && letterSpacing !== 'normal' && letterSpacing !== '0px') extraDetails.push({ text: letterSpacing, icon: letterSpacingIcon });
  if (lineHeight && lineHeight !== 'normal') extraDetails.push({ text: lineHeight, icon: lineHeightIcon });

  shadow.innerHTML = `
    <style>
      :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
      .tooltip {
        background: ${bg};
        border: 1px solid ${border};
        border-radius: 12px;
        padding: 18px 22px;
        min-width: 260px;
        max-width: 400px;
        box-shadow: 0 8px 30px rgba(0,0,0,${isDark ? '0.4' : '0.12'});
        animation: fpFadeIn 0.15s ease-out;
        color: ${textColor};
        font-size: 15px;
        line-height: 1.5;
      }
      @keyframes fpFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid ${border};
      }
      .logo {
        width: 24px; height: 24px;
        flex-shrink: 0;
      }
      .brand {
        font-size: 13px;
        font-weight: 600;
        color: ${mutedColor};
        text-transform: none;
        letter-spacing: 0.5px;
      }
      .font-name {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 8px;
        color: ${textColor};
      }
      .details {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .tag {
        background: ${isDark ? '#383838' : '#f5f5f5'};
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 13px;
        font-weight: 500;
        color: ${mutedColor};
      }
      .tag.weight {
        font-weight: 600;
      }
      .tag.has-icon {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .tag-icon {
        width: 15px; height: 15px;
        flex-shrink: 0;
      }
      .tag-icon path, .tag-icon rect {
        fill: ${mutedColor};
      }
      .color-swatch {
        width: 13px; height: 13px;
        border-radius: 3px;
        display: inline-block;
        vertical-align: middle;
        margin-right: 5px;
        border: 1px solid ${isDark ? '#555' : '#ddd'};
      }
      .tag.color {
        display: inline-flex;
        align-items: center;
      }
    </style>
    <div class="tooltip">
      <div class="header">
        <img class="logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAACshmLzAAAB3UlEQVRYCe1VPU8CQRCdExVNROw1tEqBpZU2xs7Gf0CNwR5+gAm9UWo12mohndJII7GCQiwlmlgK+HUqnvfmMsScnLucRJqbBPZ2b3bmzds3e4Z1TxYN0IYGmJtTBwACBgIGtBlotAzKbYVpfjlCU7NRWlqboPqd9nbPbteOkN0co/xemE72nyiTfqXqVYgBeUbWfKEFAJUeHo1SYq5NselPrjwasSg28/dLdFgHaOHUcUNyWGbDpJ3ci85WpY8SQP3W6Jw1dIA52Z8PZySq1kIUjRD7lMr286RFqeQbM6XMbjsYqo8RRKcS2+LCB2sCycX3YPuZVlfelRiUGqgUW4QEMATEHL/z40e7ckcDSHxz2eT1VNJk3/XsOIExlSkBIICcPQvP1gHmiXib6cZ7iFMskzYZWKNpMCuy7jVqAfDa3G0dbAhg0Uk3P1nrOwAEBojvI088/voCwH3WIsRE3Glbj9y8rGxDBC+VHbfC2YitcrNDsQTO74ZZBxArbksAwF0hRyF+3UZlG+Led1ul2LSDW/xdQDJ0B0QnleMekG5w73XPlQw8XDfce37M0QWo2I/51gCqlYrliP4NQOkixPRLQgDAzenHlBrwE7SXPb6PoJckv/kGAAIGAga+ABgKr0cixU26AAAAAElFTkSuQmCC" alt="fp" />
        <span class="brand">Fontpair</span>
      </div>
      <div class="font-name" style="font-family:${style.fontFamily}; font-weight:${fontWeight}; font-style:${fontStyle};">${fontFamily}</div>
      <div class="details">
        <span class="tag weight">${weightName} (${fontWeight})</span>
        <span class="tag has-icon">${fontSizeIcon}${fontSize}</span>
        ${extraDetails.map(d => d.icon ? `<span class="tag has-icon">${d.icon}${d.text}</span>` : `<span class="tag">${d.text}</span>`).join('')}
        ${fontColorHex ? `<span class="tag color"><span class="color-swatch" style="background:${fontColorHex}"></span>${fontColorHex}</span>` : ''}
      </div>
    </div>
  `;

  document.documentElement.appendChild(host);

  // Auto-dismiss after 5s
  const timer = setTimeout(() => host.remove(), 5000);

  // Dismiss on click outside
  const dismissHandler = (e) => {
    if (!host.contains(e.target)) {
      host.remove();
      clearTimeout(timer);
      document.removeEventListener('mousedown', dismissHandler, true);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', dismissHandler, true);
  }, 100);
})();
