# Soteria Assurance — Design System Reference

`soteria-assurance-screens.html` is the canonical visual design system & screen
library (open it in a browser; `support.js` is its canvas runtime). It defines
the look-and-feel that the web app (`apps/web`) and mobile app (`apps/mobile`)
implement. The design tokens are encoded in code at `packages/ui/src/tokens`.

## Screen library (frames)

1. iPad Field Audit · 2. Finding Creation Modal · 3. Web Dashboard ·
4. Opening Meeting Studio · 5. Wiki Article · 6. Corrective Action Tracker ·
7. iPhone Sync / Offline · 8. Asset Sheet

## Palette (matches `SoteriaTokens`)

| Role | Hex |
|---|---|
| Deep navy (headers, sidebar, logo) | `#0A2647` |
| Primary | `#1B4F8E` |
| Certification gold (accent) | `#C9A84C` (light `#E7C66B`) |
| Secondary teal | `#1B8CA8` |
| Conforming (green) | `#2D9E2D` |
| Minor NC (orange) | `#E67E22` |
| Major NC (red) | `#C0392B` |
| Strong point (purple) | `#8E44AD` |
| Background | `#F4F7FB` |
| Surface | `#FFFFFF` |
| Border | `#E6EBF2` / `#E3E8F0` / `#D1D9E6` |
| Text primary / secondary / muted | `#1A1D23` / `#6B7280` / `#8893A4` |

## Type

Montserrat (display/headings, 500–800), Inter (body, 400–700),
JetBrains Mono (clause codes, NCR numbers, data, 500–700).

## Component recipes

- **Cards:** radius `12px`, border `1px #E6EBF2`, shadow `0 2px 8px rgba(10,38,71,.06)`.
- **Buttons / inputs:** radius `8–9px`.
- **Pills / badges / status chips:** radius `99px`.
- **Modals / overlays:** shadow `0 24–30px 60–80px rgba(10,38,71,.22–.28)`.
- **Focus ring:** `0 0 0 3–4px rgba(27,79,142,.18)`.
- **Logo:** navy shield (`#0A2647`) with a gold (`#C9A84C`) check.
