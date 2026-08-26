import { beforeEach, describe, expect, it } from 'vitest';

import { OperationsModeController } from '@/components/operations/OperationsModeController';
import { DEFAULT_MAP_LAYERS } from '@/config/panels';
import type { MapLayers } from '@/types';

function operationsLayers(): MapLayers {
  const layers = { ...DEFAULT_MAP_LAYERS };
  for (const key of Object.keys(layers) as Array<keyof MapLayers>) layers[key] = false;
  layers.weather = true;
  layers.satellites = true;
  layers.conflicts = true;
  return layers;
}

describe('OperationsModeController', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('mounts the command HUD, refreshes source state, and tears down cleanly', async () => {
    const mapSection = document.createElement('section');
    mapSection.id = 'mapSection';
    document.body.appendChild(mapSection);
    let listener: (() => void) | null = null;
    let unsubscribed = 0;
    let status: 'fresh' | 'stale' = 'fresh';

    const controller = new OperationsModeController(mapSection, {
      getState: () => ({
        layers: operationsLayers(),
        renderer: 'globe',
        timeRange: '24h',
        sources: [{
          id: 'weather',
          status,
          itemCount: 3,
        }],
      }),
      subscribe: (next) => {
        listener = next;
        return () => { unsubscribed += 1; };
      },
    });

    controller.mount();

    expect(mapSection.classList.contains('operations-mode-active')).toBe(true);
    expect(mapSection.querySelector('[data-operations-hud]')).not.toBeNull();
    expect(mapSection.querySelector('[data-operations-layer="weather"]')?.textContent).toContain('Fresh');
    expect(mapSection.querySelector('[data-operations-layer="satellites"]')?.textContent).toContain('Modeled orbit');
    expect(mapSection.querySelector('[data-operations-selection]')?.textContent).toContain('Select a map signal');

    status = 'stale';
    listener?.();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(mapSection.querySelector('[data-operations-layer="weather"]')?.textContent).toContain('Stale');

    controller.destroy();

    expect(mapSection.classList.contains('operations-mode-active')).toBe(false);
    expect(mapSection.querySelector('[data-operations-hud]')).toBeNull();
    expect(unsubscribed).toBe(1);
  });

  it('is idempotent when mounted or destroyed more than once', () => {
    const mapSection = document.createElement('section');
    document.body.appendChild(mapSection);
    const controller = new OperationsModeController(mapSection, {
      getState: () => ({
        layers: operationsLayers(),
        renderer: 'flat',
        timeRange: '7d',
        sources: [],
      }),
      subscribe: () => () => undefined,
    });

    controller.mount();
    controller.mount();
    expect(mapSection.querySelectorAll('[data-operations-hud]')).toHaveLength(1);

    controller.destroy();
    controller.destroy();
    expect(mapSection.querySelectorAll('[data-operations-hud]')).toHaveLength(0);
  });
});
