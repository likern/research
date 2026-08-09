import './styles/index.css';

import './components/site-header/site-header.js';
import './components/hero/hero.js';
import './components/evidence/evidence.js';
import './components/code-example/code-example.js';
import './components/benchmark/benchmark.js';
import './components/doc-search/doc-search.js';

import { initializeTheme } from './theme.js';
import { getMessages } from './i18n/messages.js';
import { initializeNavigationCoordinator } from './navigation/coordinator.js';
import { initializeWebAwesome, type WebAwesomeRuntimeResult } from './vendor/webawesome/runtime.js';

initializeTheme();
initializeNavigationCoordinator();
window.addEventListener('pinega:navigation-commit', () => updateRuntimeLabels());
void initialize();

let webAwesomeRuntime: WebAwesomeRuntimeResult | undefined;

async function initialize(): Promise<void> {
  try {
    const messages = getMessages();
    webAwesomeRuntime = await initializeWebAwesome();
    document.documentElement.dataset.pinegaReady = 'true';
    updateRuntimeLabels(messages);
  } catch (error) {
    document.documentElement.dataset.pinegaReady = 'error';
    console.error('Pinega website failed to initialize.', error);
  }
}

function updateRuntimeLabels(messages = getMessages()): void {
  if (!webAwesomeRuntime) return;
  document.querySelectorAll<HTMLElement>('[data-runtime-source]').forEach(element => {
    element.textContent = webAwesomeRuntime?.proLineChart
      ? messages.runtime.project_pro
      : webAwesomeRuntime?.source === 'project'
        ? messages.runtime.project
        : messages.runtime.core;
  });
}
