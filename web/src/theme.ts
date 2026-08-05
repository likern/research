const storageKey = 'pinega-color-scheme';
type ColorScheme = 'light' | 'dark';

export function initializeTheme(): void {
  const stored = readStoredScheme();
  const media = matchMedia('(prefers-color-scheme: dark)');
  applyScheme(stored ?? (media.matches ? 'dark' : 'light'));

  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const next: ColorScheme = document.documentElement.classList.contains('pinega-dark') ? 'light' : 'dark';
      applyScheme(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // Storage is optional; the current document still updates correctly.
      }
    });
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

  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', String(dark));
    button.textContent = dark ? 'Use light theme' : 'Use dark theme';
  });

  window.dispatchEvent(new CustomEvent('pinega:theme-change', { detail: { scheme } }));
}

function readStoredScheme(): ColorScheme | undefined {
  try {
    const value = localStorage.getItem(storageKey);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}
