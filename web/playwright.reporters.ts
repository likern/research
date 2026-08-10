import type { ReporterDescription } from '@playwright/test';

export function releaseReporters({ htmlOutputFolder, includeHtml = Boolean(process.env.CI) }: {
  htmlOutputFolder?: string;
  includeHtml?: boolean;
} = {}): ReporterDescription[] {
  const reporters: ReporterDescription[] = [['list']];
  if (includeHtml) {
    reporters.push(['html', {
      ...(htmlOutputFolder ? { outputFolder: htmlOutputFolder } : {}),
      open: 'never',
    }]);
  }
  const jsonOutput = process.env.PINEGA_PLAYWRIGHT_JSON_OUTPUT;
  if (jsonOutput) reporters.push(['json', { outputFile: jsonOutput }]);
  return reporters;
}
