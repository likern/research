import './styles/index.css';

import './components/site-header/site-header.js';
import './components/hero/hero.js';
import './components/evidence/evidence.js';
import './components/code-example/code-example.js';
import './components/benchmark/benchmark.js';
import './components/doc-search/doc-search.js';

import { initializeTheme } from './theme.js';
import { initializeWebAwesome } from './vendor/webawesome/runtime.js';

initializeTheme();
void initialize();

async function initialize(): Promise<void> {
  try {
    const runtime = await initializeWebAwesome();
    document.documentElement.dataset.pinegaReady = 'true';
    document.querySelectorAll<HTMLElement>('[data-runtime-source]').forEach(element => {
      element.textContent = runtime.proLineChart
        ? 'Web Awesome project + Pro chart'
        : runtime.source === 'project'
          ? 'Web Awesome project'
          : 'Pinned Web Awesome Core 3.11.0';
    });
  } catch (error) {
    document.documentElement.dataset.pinegaReady = 'error';
    console.error('Pinega website failed to initialize.', error);
  }
}
