import './styles/index.css';

import './components/site-header/site-header.js';
import './components/hero/hero.js';
import './components/evidence/evidence.js';

import { initializeTheme, refreshThemeControls } from './theme.js';
import { DynamicFeatureGraph } from './features/runtime.js';
import { getMessages } from './i18n/messages.js';
import { initializeNavigationCoordinator } from './navigation/coordinator.js';
import { initializeWebAwesome, type WebAwesomeRuntimeResult } from './vendor/webawesome/runtime.js';

initializeTheme();
const featureGraph = new DynamicFeatureGraph();
initializeNavigationCoordinator(featureGraph);
window.addEventListener('pinega:navigation-commit', () => {
  refreshThemeControls();
  updateRuntimeLabels();
});
void initialize();

let webAwesomeRuntime: WebAwesomeRuntimeResult | undefined;

async function initialize(): Promise<void> {
  try {
    const messages = getMessages();
    const main = document.querySelector<HTMLElement>('main#main-content');
    if (!main) throw new TypeError('Pinega document has no main#main-content.');
    webAwesomeRuntime = await initializeWebAwesome();
    await featureGraph.initializeRoute(main);
    document.documentElement.dataset.pinegaFeatureGraph = 'dynamic';
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
