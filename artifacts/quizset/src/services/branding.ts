import type { Tenant } from '@/types';

// Converts a tenant's brand hex into the CSS custom properties index.css
// already consumes as `hsl(var(--primary))` / `hsl(var(--secondary))`
// everywhere (buttons, badges, charts, accents). This is what makes
// white-labelling real instead of a color-picker that only repaints its own
// preview card — every component that already reads --primary repaints the
// moment these are set on <html>.

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslTriplet({ h, s, l }: Hsl): string {
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** WCAG relative luminance — decides whether text on the brand color should be black or white. */
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(clean.slice(0, 2), 16));
  const g = channel(parseInt(clean.slice(2, 4), 16));
  const b = channel(parseInt(clean.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const isValidHex = (hex: string) => /^#[0-9a-fA-F]{6}$/.test(hex);

let defaultPrimary: string | null = null;
let defaultSecondary: string | null = null;
let defaultPrimaryForeground: string | null = null;

/** Captures index.css's own :root values once, so resetBranding() can restore them exactly. */
function captureDefaults() {
  if (defaultPrimary !== null) return;
  const style = getComputedStyle(document.documentElement);
  defaultPrimary = style.getPropertyValue('--primary').trim();
  defaultSecondary = style.getPropertyValue('--secondary').trim();
  defaultPrimaryForeground = style.getPropertyValue('--primary-foreground').trim();
}

export function applyBranding(tenant: Pick<Tenant, 'primaryColor' | 'secondaryColor'>) {
  if (typeof document === 'undefined') return;
  captureDefaults();
  const root = document.documentElement.style;
  if (isValidHex(tenant.primaryColor)) {
    root.setProperty('--primary', hslTriplet(hexToHsl(tenant.primaryColor)));
    root.setProperty('--primary-foreground', relativeLuminance(tenant.primaryColor) > 0.45 ? '224 40% 13%' : '0 0% 100%');
  }
  if (isValidHex(tenant.secondaryColor)) {
    root.setProperty('--secondary', hslTriplet(hexToHsl(tenant.secondaryColor)));
  }
}

/** Restores the app's own default palette — used on logout and for the platform-owner shell, which is never tenant-branded. */
export function resetBranding() {
  if (typeof document === 'undefined' || defaultPrimary === null) return;
  const root = document.documentElement.style;
  root.setProperty('--primary', defaultPrimary);
  root.setProperty('--secondary', defaultSecondary!);
  root.setProperty('--primary-foreground', defaultPrimaryForeground!);
}
