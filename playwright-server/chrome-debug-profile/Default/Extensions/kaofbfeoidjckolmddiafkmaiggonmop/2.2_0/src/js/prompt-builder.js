/**
 * ═══════════════════════════════════════════════════════════════
 * AI Design System Prompt Builder — Chrome Extension Copy
 * ═══════════════════════════════════════════════════════════════
 * 
 * SOURCE OF TRUTH: src/shared/buildDesignPrompt.ts
 * 
 * This is a plain JS copy for the Chrome extension (no bundler).
 * When updating the prompt template, update BOTH files.
 * ═══════════════════════════════════════════════════════════════
 */

const TARGET_PREAMBLES = {
  'cursor': null,
  'windsurf': null,
  'generic': null,
  'lovable': 'You are building a web app. Apply this design system exactly as specified for all components, pages, and layouts. Do not use Tailwind defaults or introduce styles not defined below.',
  'v0': 'Generate a component using this design system. Use shadcn/ui. Reference the token mapping in FRAMEWORK RULES for all styling — do not use default Tailwind colors or generic fonts.',
  'claude-code': 'You are building a web app. This file defines the complete design system. Reference it for every styling decision. Do not deviate from the fonts, colors, or tokens specified below.',
  'bolt': 'This is the design system file for this project. Reference it for all styling decisions throughout every file you create or edit. Do not introduce styles outside this system.',
  'replit': 'This is the design system file for this project. Reference it for all styling decisions throughout every file you create or edit. Do not introduce styles outside this system.',
  'paper': 'Apply this design system to the current project. Use the specified fonts, colors, and tokens for all styling. Do not deviate from the system defined below.',
};

function buildGoogleFontsUrl(heading, body) {
  const encode = (f) => f.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${encode(heading)}:wght@400;500;600&family=${encode(body)}:wght@400;500&display=swap`;
}

/**
 * @param {Object} params
 * @param {string} params.headingFontName
 * @param {string} params.bodyFontName
 * @param {Object} params.colors - { bg, fg, fgMuted, primary, accent, border }
 * @param {string} params.target - AI tool key
 * @param {string} params.sourceUrl
 * @param {string} [params.sourceLabel]
 * @param {Object|null} [params.icon] - { name, installUrl }
 * @returns {string}
 */
function buildDesignPrompt(params) {
  const {
    headingFontName,
    bodyFontName,
    colors,
    target,
    sourceUrl,
    sourceLabel = 'Fontpair Extension',
    icon = null,
  } = params;

  const googleFontsUrl = buildGoogleFontsUrl(headingFontName, bodyFontName);

  // Icon rules
  let iconRulesBlock = '';
  if (icon) {
    iconRulesBlock = `
ICON RULES:
→ Use ${icon.name} exclusively for all icons
→ Install via: ${icon.installUrl}
→ Do NOT use Heroicons, Lucide, or any other icon library
→ Match icon size to surrounding text scale (16px inline, 20px UI, 24px feature icons)
`;
  }

  const preamble = TARGET_PREAMBLES[target];
  const preambleBlock = preamble ? `${preamble}\n\n` : '';

  return `${preambleBlock}DESIGN REFERENCE
Source: ${sourceLabel}
URL: ${sourceUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPOGRAPHY RULES:
→ Use ${headingFontName} for ALL headings (h1–h4), display text, and hero copy
→ Use ${bodyFontName} for ALL body text, captions, labels, and UI copy
→ Do NOT substitute with Inter, system-ui, Georgia, or any fallback font
→ Load via Google Fonts: ${googleFontsUrl}
→ Apply a typographic scale: hero 48–64px, h1 36px, h2 28px, h3 22px, body 16px, caption 13px
→ Font weight: 400 for body, 500–600 for headings — do not use 700+ unless explicitly needed
→ Letter spacing: slightly loose on headings (-0.01em to 0), normal on body

COLOR RULES:
→ Background: ${colors.bg} — use for page background and card surfaces
→ Foreground: ${colors.fg} — use for all primary text, headings, and icons
→ Foreground Muted: ${colors.fgMuted} — use for secondary text, placeholders, and metadata
→ Primary: ${colors.primary} — use for CTAs, active states, links, and key UI accents
→ Accent: ${colors.accent} — use for hover states, pressed buttons, and deep emphasis
→ Border: ${colors.border} — use for all dividers, input borders, and card outlines
→ Do NOT introduce colors outside this palette (no Tailwind defaults like blue-500 or gray-400)
→ Do NOT use black (#000000) — use ${colors.fg} as the darkest value
${iconRulesBlock}
COMPONENT RULES:
→ Every button must use Primary (${colors.primary}) background with white text, rounded-md
→ Every card must use Border (${colors.border}) outline, white background, consistent padding (16–24px)
→ Every input must use Border (${colors.border}) outline, Foreground Muted placeholder text
→ Every link must use Primary (${colors.primary}), Accent (${colors.accent}) on hover — no underline by default

FRAMEWORK RULES:
→ Use shadcn/ui components with Tailwind CSS
→ Map semantic tokens: primary → ${colors.primary}, foreground → ${colors.fg}, muted → ${colors.fgMuted}, border → ${colors.border}
→ Apply fonts via CSS variables: --font-heading: '${headingFontName}', --font-body: '${bodyFontName}'
→ Do NOT use Tailwind's default color scales — all colors must reference the palette above

OUTPUT RULES:
→ Every component must reference the design tokens — no hardcoded arbitrary values
→ Do not introduce UI elements, colors, or fonts not specified in this file
→ The final output must feel cohesive — as if designed by one person with one system
→ When in doubt, use less decoration, not more

— Powered by Fontpair`.trim();
}
