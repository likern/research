import { setBasePath } from '@awesome.me/webawesome/dist/webawesome.js';

import '@awesome.me/webawesome/dist/components/badge/badge.js';
import '@awesome.me/webawesome/dist/components/breadcrumb/breadcrumb.js';
import '@awesome.me/webawesome/dist/components/breadcrumb-item/breadcrumb-item.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/button-group/button-group.js';
import '@awesome.me/webawesome/dist/components/callout/callout.js';
import '@awesome.me/webawesome/dist/components/card/card.js';
import '@awesome.me/webawesome/dist/components/copy-button/copy-button.js';
import '@awesome.me/webawesome/dist/components/divider/divider.js';
import '@awesome.me/webawesome/dist/components/input/input.js';
import '@awesome.me/webawesome/dist/components/spinner/spinner.js';

setBasePath('/assets/webawesome');

export const coreComponentTags = [
  'wa-badge',
  'wa-breadcrumb',
  'wa-breadcrumb-item',
  'wa-button',
  'wa-button-group',
  'wa-callout',
  'wa-card',
  'wa-copy-button',
  'wa-divider',
  'wa-input',
  'wa-spinner',
] as const;
