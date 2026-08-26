import { h } from '@/utils/dom-utils';
import {
  buildOperationsSnapshot,
  isAttentionStatus,
  type OperationsSnapshot,
  type OperationsSnapshotInput,
} from './operations-mode-model';

interface OperationsModeControllerOptions {
  getState: () => OperationsSnapshotInput;
  subscribe: (listener: () => void) => () => void;
}

export class OperationsModeController {
  private root: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private refreshFrame: number | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: OperationsModeControllerOptions,
  ) {}

  mount(): void {
    if (this.root) {
      this.refresh();
      return;
    }

    this.root = h('section', { className: 'operations-mode-hud' });
    this.root.dataset.operationsHud = '';
    this.root.setAttribute('aria-label', 'Watchtower command center');
    this.host.classList.add('operations-mode-active');
    this.host.appendChild(this.root);
    this.unsubscribe = this.options.subscribe(() => this.scheduleRefresh());
    this.refresh();
  }

  refresh(): void {
    if (!this.root) return;
    if (this.refreshFrame !== null) {
      cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = null;
    }
    const snapshot = buildOperationsSnapshot(this.options.getState());
    this.root.replaceChildren(
      this.buildTopBar(snapshot),
      this.buildLayerRail(snapshot),
      this.buildSelectionRail(),
      this.buildEventStrip(snapshot),
    );
  }

  destroy(): void {
    if (this.refreshFrame !== null) cancelAnimationFrame(this.refreshFrame);
    this.refreshFrame = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root?.remove();
    this.root = null;
    this.host.classList.remove('operations-mode-active');
  }

  private scheduleRefresh(): void {
    if (this.refreshFrame !== null) return;
    this.refreshFrame = requestAnimationFrame(() => {
      this.refreshFrame = null;
      this.refresh();
    });
  }

  private buildTopBar(snapshot: OperationsSnapshot): HTMLElement {
    const bar = h('header', { className: 'operations-mode-hud__top' });
    const identity = h('div', { className: 'operations-mode-hud__identity' });
    identity.append(
      h('strong', null, 'WATCHTOWER'),
      h('span', null, 'GEOSPATIAL INTELLIGENCE'),
    );

    const metrics = h('div', { className: 'operations-mode-hud__metrics' });
    metrics.append(
      this.metric(snapshot.rendererLabel),
      this.metric(snapshot.timeRangeLabel),
      this.metric(`${snapshot.activeLayerCount} overlays`),
    );
    const health = this.metric(snapshot.overallStatus === 'operational' ? 'Tracked sources nominal' : 'Limited source coverage');
    health.classList.add(`operations-mode-tone--${snapshot.overallStatus === 'operational' ? 'good' : 'warn'}`);
    metrics.appendChild(health);
    bar.append(identity, metrics);
    return bar;
  }

  private metric(text: string): HTMLElement {
    return h('span', { className: 'operations-mode-hud__metric' }, text);
  }

  private buildLayerRail(snapshot: OperationsSnapshot): HTMLElement {
    const rail = h('aside', { className: 'operations-mode-hud__rail operations-mode-hud__rail--layers' });
    rail.setAttribute('aria-label', 'Operations overlay status');
    rail.appendChild(h('h2', null, 'OVERLAYS'));

    for (const group of snapshot.groups) {
      const section = h('section', { className: 'operations-mode-hud__group' });
      section.appendChild(h('h3', null, group.label));
      for (const layer of group.layers) {
        const row = h('div', { className: `operations-mode-hud__layer operations-mode-tone--${layer.tone}` });
        row.dataset.operationsLayer = String(layer.key);
        row.setAttribute('role', 'status');
        row.setAttribute('aria-label', `${layer.label}: ${layer.statusLabel}`);
        const label = h('span', { className: 'operations-mode-hud__layer-name' }, layer.label);
        const status = h('span', { className: 'operations-mode-hud__layer-status' }, layer.statusLabel);
        row.append(label, status);
        section.appendChild(row);
      }
      rail.appendChild(section);
    }
    return rail;
  }

  private buildSelectionRail(): HTMLElement {
    const rail = h('aside', { className: 'operations-mode-hud__rail operations-mode-hud__rail--selection' });
    rail.dataset.operationsSelection = '';
    rail.setAttribute('aria-live', 'polite');
    rail.append(
      h('span', { className: 'operations-mode-hud__eyebrow' }, 'SELECTED INTEL'),
      h('h2', null, 'Select a map signal'),
      h('p', null, 'Use the existing globe markers and popups to inspect source details.'),
    );
    return rail;
  }

  private buildEventStrip(snapshot: OperationsSnapshot): HTMLElement {
    const strip = h('footer', { className: 'operations-mode-hud__events' });
    strip.appendChild(h('strong', null, 'SOURCE WATCH'));
    const attention = snapshot.groups
      .flatMap((group) => group.layers)
      .filter((layer) => layer.enabled && isAttentionStatus(layer.status))
      .slice(0, 3);

    if (attention.length === 0) {
      strip.append(
        h('span', null, 'No tracked source errors'),
        h('small', null, 'Modeled and reference overlays remain labeled separately.'),
      );
      return strip;
    }

    for (const layer of attention) {
      strip.appendChild(h('span', { className: 'operations-mode-hud__event' }, `${layer.label}: ${layer.statusLabel}`));
    }
    return strip;
  }
}
