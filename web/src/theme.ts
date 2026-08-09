import { getMessages } from './i18n/messages.js';

const storageKey = 'pinega-color-scheme';
type ColorScheme = 'light' | 'dark';
let initialized = false;

export function initializeTheme(): void {
  if (initialized) return;
  initialized = true;
  const stored = readStoredScheme();
  const media = matchMedia('(prefers-color-scheme: dark)');
  applyScheme(stored ?? (media.matches ? 'dark' : 'light'));

  document.addEventListener('click', event => {
    const control = event.target instanceof Element ? event.target.closest('[data-theme-toggle]') : null;
    if (!control) return;
    const next: ColorScheme = document.documentElement.classList.contains('pinega-dark') ? 'light' : 'dark';
    applyScheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage is optional; the current document still updates correctly.
    }
  });

  media.addEventListener('change', event => {
    if (readStoredScheme() === undefined) applyScheme(event.matches ? 'dark' : 'light');
  });
}

function applyScheme(scheme: ColorScheme): void {
  const root = document.documentElement;
  const dark = scheme === 'dark';
  root.classList.toggle('pinega-dark', dark);
  root.classList.toggle('wa-dark', dark);
  root.classList.toggle('pinega-light', !dark);
  root.classList.toggle('wa-light', !dark);
  root.style.colorScheme = scheme;

  refreshThemeControls();

  window.dispatchEvent(new CustomEvent('pinega:theme-change', { detail: { scheme } }));
}

export function refreshThemeControls(): void {
  const messages = getMessages();
  const dark = document.documentElement.classList.contains('pinega-dark');
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', String(dark));
    button.textContent = dark ? messages.theme.use_light : messages.theme.use_dark;
  });
}

function readStoredScheme(): ColorScheme | undefined {
  try {
    const value = localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}
