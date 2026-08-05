import { defineCustomElement } from '../../internal/define.js';
import { onWebAwesomeProReady } from '../../vendor/webawesome/runtime.js';

let benchmarkChartSequence = 0;

interface BenchmarkSeries {
  label: string;
  values: number[];
}

export interface BenchmarkData {
  labels: string[];
  series: BenchmarkSeries[];
}

interface LineChartElement extends HTMLElement {
  config: {
    data: {
      labels: string[];
      datasets: Array<{ label: string; data: number[] }>;
    };
  };
  updateComplete?: Promise<unknown>;
}

class PinegaBenchmark extends HTMLElement {
  #controller: AbortController | undefined;
  #data?: BenchmarkData;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();

    const table = this.querySelector<HTMLTableElement>('table');
    if (!table) throw new Error('pinega-benchmark requires a semantic data table.');
    this.#data = benchmarkDataFromTable(table);
    this.#renderFallback(this.#data);
    this.#upgradeToProChart();
    onWebAwesomeProReady(() => this.#upgradeToProChart(), this.#controller.signal);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
  }

  #renderFallback(data: BenchmarkData): void {
    let container = this.querySelector<HTMLElement>('[data-benchmark-visual]');
    if (!container) {
      container = document.createElement('div');
      container.dataset.benchmarkVisual = '';
      this.prepend(container);
    }
    container.replaceChildren(buildLineChartSvg(data, {
      title: this.dataset.chartTitle ?? 'Benchmark result',
      description: this.dataset.chartDescription ?? 'Line chart generated from the adjacent data table.',
      xLabel: this.dataset.xLabel ?? '',
      yLabel: this.dataset.yLabel ?? '',
    }));
    this.dataset.renderer = 'svg-fallback';
    const label = this.querySelector<HTMLElement>('[data-renderer-label]');
    if (label) label.textContent = 'Native SVG fallback';
  }

  #upgradeToProChart(): void {
    if (!this.#data || customElements.get('wa-line-chart') === undefined) return;
    const visual = this.querySelector<HTMLElement>('[data-benchmark-visual]');
    if (!visual) return;

    let chart = visual.querySelector<LineChartElement>('wa-line-chart');
    if (!chart) {
      chart = document.createElement('wa-line-chart') as LineChartElement;
      visual.append(chart);
    }

    chart.setAttribute('label', this.dataset.chartTitle ?? 'Benchmark result');
    chart.setAttribute('description', this.dataset.chartDescription ?? 'Benchmark data rendered as a line chart.');
    chart.setAttribute('legend-position', 'bottom');
    chart.setAttribute('grid', 'x y');
    if (this.dataset.xLabel) chart.setAttribute('x-label', this.dataset.xLabel);
    if (this.dataset.yLabel) chart.setAttribute('y-label', this.dataset.yLabel);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) chart.setAttribute('without-animation', '');

    chart.config = {
      data: {
        labels: this.#data.labels,
        datasets: this.#data.series.map(series => ({ label: series.label, data: series.values })),
      },
    };

    const fallback = visual.querySelector<SVGElement>('svg[data-chart-fallback]');
    if (fallback) fallback.setAttribute('hidden', '');
    this.dataset.renderer = 'webawesome-pro';
    const label = this.querySelector<HTMLElement>('[data-renderer-label]');
    if (label) label.textContent = 'Web Awesome Pro';
  }
}

export function benchmarkDataFromTable(table: HTMLTableElement): BenchmarkData {
  const headerCells = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
  if (headerCells.length < 2) throw new TypeError('Benchmark table requires an x-axis column and at least one data series.');
  const rows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  if (rows.length < 2) throw new TypeError('Benchmark table requires at least two data rows.');

  const labels: string[] = [];
  const series: BenchmarkSeries[] = headerCells.slice(1).map(cell => ({
    label: cell.textContent?.trim() || 'Series',
    values: [],
  }));

  for (const [rowIndex, row] of rows.entries()) {
    const cells = [...row.cells];
    if (cells.length !== headerCells.length) {
      throw new TypeError(`Benchmark row ${rowIndex + 1} contains ${cells.length} cells; expected ${headerCells.length}.`);
    }
    labels.push(cells[0]?.textContent?.trim() ?? String(rowIndex + 1));
    for (let index = 1; index < cells.length; index += 1) {
      const raw = cells[index]?.textContent?.trim().replaceAll(',', '') ?? '';
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new TypeError(`Benchmark cell ${rowIndex + 1}:${index + 1} is not numeric: ${JSON.stringify(raw)}.`);
      series[index - 1]?.values.push(value);
    }
  }

  return { labels, series };
}

export function niceAxisMaximum(maximum: number): number {
  if (!Number.isFinite(maximum) || maximum <= 0) return 1;
  const exponent = Math.floor(Math.log10(maximum));
  const magnitude = 10 ** exponent;
  const normalized = maximum / magnitude;
  const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * magnitude;
}

function buildLineChartSvg(
  data: BenchmarkData,
  metadata: { title: string; description: string; xLabel: string; yLabel: string },
): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const width = 760;
  const height = 340;
  const margin = { top: 30, right: 30, bottom: 68, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maximum = niceAxisMaximum(Math.max(...data.series.flatMap(series => series.values)));
  const x = (index: number): number => margin.left + (data.labels.length === 1 ? plotWidth / 2 : (index / (data.labels.length - 1)) * plotWidth);
  const y = (value: number): number => margin.top + plotHeight - (value / maximum) * plotHeight;

  const svg = document.createElementNS(namespace, 'svg');
  svg.dataset.chartFallback = '';
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.classList.add('pinega-benchmark-chart');

  benchmarkChartSequence += 1;
  const accessibleBaseId = `pinega-benchmark-chart-${benchmarkChartSequence}`;
  const title = document.createElementNS(namespace, 'title');
  title.id = `${accessibleBaseId}-title`;
  title.textContent = metadata.title;
  const description = document.createElementNS(namespace, 'desc');
  description.id = `${accessibleBaseId}-description`;
  description.textContent = metadata.description;
  svg.setAttribute('aria-labelledby', `${title.id} ${description.id}`);
  svg.append(title, description);

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (maximum / 4) * tick;
    const yPosition = y(value);
    svg.append(svgElement(namespace, 'line', {
      x1: String(margin.left), y1: String(yPosition), x2: String(width - margin.right), y2: String(yPosition), class: 'chart-grid-line',
    }));
    const label = svgElement(namespace, 'text', {
      x: String(margin.left - 12), y: String(yPosition + 4), class: 'chart-axis-label', 'text-anchor': 'end',
    });
    label.textContent = formatTick(value);
    svg.append(label);
  }

  data.labels.forEach((labelText, index) => {
    const label = svgElement(namespace, 'text', {
      x: String(x(index)), y: String(height - margin.bottom + 28), class: 'chart-axis-label', 'text-anchor': 'middle',
    });
    label.textContent = labelText;
    svg.append(label);
  });

  svg.append(svgElement(namespace, 'line', {
    x1: String(margin.left), y1: String(margin.top), x2: String(margin.left), y2: String(margin.top + plotHeight), class: 'chart-axis-line',
  }));
  svg.append(svgElement(namespace, 'line', {
    x1: String(margin.left), y1: String(margin.top + plotHeight), x2: String(width - margin.right), y2: String(margin.top + plotHeight), class: 'chart-axis-line',
  }));

  data.series.forEach((series, seriesIndex) => {
    const points = series.values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    svg.append(svgElement(namespace, 'polyline', {
      points,
      class: `chart-series chart-series-${seriesIndex + 1}`,
      fill: 'none',
      'vector-effect': 'non-scaling-stroke',
    }));
    series.values.forEach((value, index) => {
      const point = svgElement(namespace, 'circle', {
        cx: String(x(index)), cy: String(y(value)), r: '4.5', class: `chart-point chart-series-${seriesIndex + 1}`,
      });
      const pointTitle = document.createElementNS(namespace, 'title');
      pointTitle.textContent = `${series.label}: ${data.labels[index]} — ${value}`;
      point.append(pointTitle);
      svg.append(point);
    });
  });

  const legend = document.createElementNS(namespace, 'g');
  legend.setAttribute('class', 'chart-legend');
  data.series.forEach((series, index) => {
    const offset = margin.left + index * 170;
    legend.append(svgElement(namespace, 'line', {
      x1: String(offset), y1: String(height - 15), x2: String(offset + 26), y2: String(height - 15), class: `chart-series chart-series-${index + 1}`,
    }));
    const label = svgElement(namespace, 'text', {
      x: String(offset + 35), y: String(height - 11), class: 'chart-legend-label',
    });
    label.textContent = series.label;
    legend.append(label);
  });
  svg.append(legend);

  if (metadata.xLabel) {
    const label = svgElement(namespace, 'text', {
      x: String(margin.left + plotWidth / 2), y: String(height - 37), class: 'chart-axis-title', 'text-anchor': 'middle',
    });
    label.textContent = metadata.xLabel;
    svg.append(label);
  }
  if (metadata.yLabel) {
    const label = svgElement(namespace, 'text', {
      x: '18', y: String(margin.top + plotHeight / 2), class: 'chart-axis-title', 'text-anchor': 'middle',
      transform: `rotate(-90 18 ${margin.top + plotHeight / 2})`,
    });
    label.textContent = metadata.yLabel;
    svg.append(label);
  }

  return svg;
}

function svgElement(namespace: string, name: string, attributes: Record<string, string>): SVGElement {
  const element = document.createElementNS(namespace, name) as SVGElement;
  for (const [attribute, value] of Object.entries(attributes)) element.setAttribute(attribute, value);
  return element;
}

function formatTick(value: number): string {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
  return Number(value.toFixed(2)).toString();
}

defineCustomElement('pinega-benchmark', PinegaBenchmark);
