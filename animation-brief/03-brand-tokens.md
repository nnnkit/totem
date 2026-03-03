# Totem Brand Tokens

Use these exact values when instructing Replit Animation on colors, fonts, and motion.

---

## Colors

### Accent (terracotta/coral)
| Token | Hex | Use |
|---|---|---|
| Accent primary | `#e07a5f` | Logo, "YOUR NEXT READ" label, tab indicator, "New" badge |
| Accent dark | `#c96b50` | Logo shadow, hover states |
| Accent 400 | `#e28067` | Subtle highlights |
| Accent 500 | `#d66b50` | Borders, underlines |

**Rule:** Terracotta only on 4 elements — logo, label, tab underline, "New" badge. Nowhere else.

### Backgrounds
| Token | Hex | Use |
|---|---|---|
| Page background | `#0f0f0e` | Main new tab background |
| Background dark | `#0a0a09` | Darkest scenes |
| Card surface | `rgba(255,255,255,0.06)` | Frosted glass cards |
| Card border | `rgba(255,255,255,0.07)` | Subtle card edges |
| Card hover | `rgba(255,255,255,0.09)` | On hover |

### Text
| Token | Value | Use |
|---|---|---|
| Primary text | `rgba(255,255,255,0.90)` | Headlines, titles |
| Secondary text | `rgba(255,255,255,0.65)` | Card content, body |
| Muted text | `rgba(255,255,255,0.45)` | Metadata, handles, timestamps |
| Ghost text | `rgba(255,255,255,0.28)` | Placeholder, disabled |

### Utility
| Token | Hex | Use |
|---|---|---|
| Highlight amber | `#fbbf24` at 40% opacity | Text highlights in reader |
| Success green | `#4ade80` at 90% | "Read" tab count badge |
| Border default | `rgba(255,255,255,0.08)` | List item borders |

---

## Typography

### Fonts
| Role | Family | Fallback |
|---|---|---|
| UI / sans | Space Grotesk | system-ui, sans-serif |
| Reader / editorial | Spectral | Charter, Georgia, serif |
| Mono | SF Mono | Consolas, monospace |

### Type Scale
| Size | Use |
|---|---|
| 60–72px Spectral light | Clock on home screen |
| 22–24px Spectral 400 | Reader body, home card headline |
| 18–20px Space Grotesk 600 | "Reading" header, section labels |
| 14px Space Grotesk 500 | Bookmark titles in list |
| 12px Space Grotesk 500 | Tab labels, metadata |
| 10px Space Grotesk 700, 0.25em letter-spacing | "YOUR NEXT READ" small caps label |

---

## Motion

### Easing Curves
| Name | Value | Use |
|---|---|---|
| Entrance | `cubic-bezier(0.23, 1, 0.32, 1)` | Cards, panels sliding in |
| Overlay entrance | `cubic-bezier(0.215, 0.61, 0.355, 1)` | Modals, readers opening |
| Exit | `ease-in` | Everything leaving |
| Tab indicator | `cubic-bezier(0.645, 0.045, 0.355, 1)` | Sliding underline |
| Hover/color | `ease` | Button states, color transitions |

### Timing
| Motion | Duration |
|---|---|
| Text line fade-in | 400ms |
| Stagger between text lines | 150–200ms |
| Card entrance (translate + fade) | 350ms |
| Tab indicator slide | 250ms |
| Scene transition (cross-dissolve) | 500ms |
| Highlight sweep | 300ms left-to-right |
| Logo scale entrance | 400ms (0.85 → 1.0) |

### Rules
- No cuts. All transitions are dissolves or fades.
- No zoom bursts, bounces, or elastic easing.
- Card translate is always 12px upward (translateY: 12px → 0).
- Backdrop blur on frosted glass: `blur(16px)`.

---

## Logo

### Mark (SVG)
```svg
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="18" fill="#1c1c1e"/>
  <path d="M20 80L80 80L80 20Z" fill="#e07a5f"/>
  <path d="M80 20L52.5 47.5L80 80Z" fill="#c96b50"/>
  <path d="M20 80L80 80L80 20Z" fill="url(#shine)"/>
  <defs>
    <linearGradient id="shine" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.45"/>
      <stop offset="50%" stop-color="white" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
</svg>
```

### Text Wordmark
- Text: `Totem`
- Font: Space Grotesk, weight 700
- Color: white
- Placed to the right of the logo mark, vertically centered

---

## Visual Personality

| Do | Don't |
|---|---|
| Calm, slow dissolves | Fast cuts or wipes |
| Spectral serif for reading content | Comic sans, display fonts |
| Terracotta as a single accent | Multiple accent colors |
| Frosted glass cards on dark bg | Bright white backgrounds |
| Generous whitespace | Crowded layouts |
| One idea per scene | Multiple features at once |
| Moody wallpaper photos | Stock illustration or icons |
