PRIYAM SALES AGENCY — BRAND PACKAGE  (v1.0 · 2026)
===================================================
One source of truth for every Priyam app — online AND offline.
The fonts are SELF-HOSTED, so nothing depends on Google Fonts or any CDN.

WHAT'S IN THIS FOLDER
  priyam-brand.css      <- link THIS in every app. Tokens + @font-face + helpers.
  priyam-tokens.json    <- same values, machine-readable (for build tools / JS / Tailwind).
  fonts/                <- the 4 brand typefaces as .woff2 (variable, all weights).
       outfit.woff2 · hanken-grotesk.woff2 · ibm-plex-mono.woff2 · noto-sans-devanagari.woff2
  starter.html          <- open in a browser to see everything working.
  README.txt            <- this file.

------------------------------------------------------------------
INSTALL — 2 STEPS
------------------------------------------------------------------
1. Copy the WHOLE  priyam-brand/  folder into your project
   (keep priyam-brand.css next to the fonts/ folder — the CSS uses
    relative paths like ./fonts/outfit.woff2).

2. Link it in your page <head>:

       <link rel="stylesheet" href="/priyam-brand/priyam-brand.css">

   Then add class="ps-root" to <body> for the brand background + base text.
   That's it. Works the same whether the device is online or offline.

------------------------------------------------------------------
USING THE TOKENS
------------------------------------------------------------------
Never hardcode hex or font names again — reach for a variable:

   .quote-total { color: var(--ps-gold); font-family: var(--ps-font-display); }
   .card        { border-radius: var(--ps-radius-lg); box-shadow: var(--ps-shadow); }

Ready-made helper classes (see starter.html):
   Type     .ps-display .ps-h1 .ps-h2 .ps-h3 .ps-body .ps-small .ps-label
   Fonts    .ps-font-display .ps-font-body .ps-font-mono .ps-font-hindi
   UI       .ps-btn (+ --gold --terracotta --ghost) · .ps-card · .ps-tag · .ps-rule

KEY TOKENS
   Colour   --ps-gold #FBAE1A · --ps-terracotta #DF6D35 · --ps-ink #2B2B33
            --ps-slate --ps-muted --ps-border --ps-cloud --ps-paper
            status: --ps-confirmed --ps-pending --ps-issue · --ps-gradient
   Fonts    --ps-font-display (Outfit) · --ps-font-body (Hanken Grotesk)
            --ps-font-mono (IBM Plex Mono) · --ps-font-hindi (Noto Sans Devanagari)
   Radius   --ps-radius-sm/-radius/-radius-lg/-radius-pill
   Space    --ps-space-1 … --ps-space-8  (4 → 64px)
   Shadow   --ps-shadow-sm/-shadow/-shadow-dark

------------------------------------------------------------------
FRAMEWORK NOTES
------------------------------------------------------------------
Plain HTML / PHP ... link the CSS as above. Done.
React / Vue / etc .. import './priyam-brand/priyam-brand.css' once in your root
                     (App.jsx / main.js). Tokens are global CSS vars.
Tailwind ........... map priyam-tokens.json into tailwind.config (theme.colors,
                     fontFamily, borderRadius). Still link the CSS for @font-face.
Email / print ...... fonts may not load in email clients — keep the font stacks
                     (Outfit, sans-serif) so a safe fallback shows.

------------------------------------------------------------------
ONLINE-ONLY ALTERNATIVE (optional)
------------------------------------------------------------------
If an app is always online and you'd rather not ship font files, you can swap the
@font-face block for the Google Fonts link instead (see Brand Kit/fonts/embed-snippet.html).
The self-hosted version in this folder is recommended — it's faster and works offline.

------------------------------------------------------------------
UPDATING
------------------------------------------------------------------
Change a value in priyam-brand.css ONCE, redeploy the folder, and every app that
links it updates together. Bump the version comment at the top when you do.
All four typefaces are SIL Open Font License — free to self-host & ship commercially.
