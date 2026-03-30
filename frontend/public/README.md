# StealthVault Logo Assets

## Files

- `stealthvault-logo.svg` - Main logo used in the header (currently: minimal variant)
- `favicon.svg` - Browser tab icon (32x32px optimized)
- `switch-logo.js` - Script to switch between logo variants

## Logo Variants

### 1. Minimal (Current)
- **File**: `stealthvault-logo-minimal.svg`
- **Style**: Clean circular design with subtle glow
- **Best for**: Professional, clean appearance

### 2. Hexagon
- **File**: `stealthvault-logo-alt.svg`
- **Style**: Geometric hexagon with animated sparkles
- **Best for**: Tech-focused, dynamic appearance

### 3. Original
- **File**: Available as backup
- **Style**: Shield-based design with animations
- **Best for**: Security-focused branding

## Switching Logos

Use the logo switcher script:

```bash
# Switch to minimal (clean)
node switch-logo.js minimal

# Switch to hexagon (geometric)
node switch-logo.js hexagon

# View available options
node switch-logo.js
```

## Logo Design Elements

All variants feature:
- **Violet/Indigo gradient**: Modern purple theme (#8b5cf6 to #6366f1)
- **Lock icon**: Central encryption symbol
- **Keyhole detail**: Cryptographic emphasis
- **Subtle sparkles**: "Stealth" and FHE magic effects

## Brand Colors

- Primary: `#8b5cf6` (violet-500)
- Secondary: `#6366f1` (indigo-500)  
- Dark accent: `#1e1b4b` (indigo-900)
- Sparkle accent: `#fbbf24` (amber-400)
- Glow effect: Subtle blur with primary color

## Usage Guidelines

- Logo works on dark backgrounds (optimized for slate UI)
- SVG format ensures crisp display at any size
- Maintains aspect ratio and readability
- Consistent brand identity across header and favicon