import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { MapLayers } from '../src/types/index.ts';
import {
  buildOperationsSnapshot,
  type OperationsSourceState,
} from '../src/components/operations/operations-mode-model.ts';
import { DEFAULT_MAP_LAYERS } from '../src/config/panels.ts';

function source(overrides: Partial<OperationsSourceState>): OperationsSourceState {
  return {
    id: 'weather',
    name: 'Severe Weather Alerts',
    status: 'fresh',
    lastUpdate: new Date('2026-08-25T18:00:00Z'),
    itemCount: 4,
    enabled: true,
    lastError: null,
    ...overrides,
  };
}

function layers(overrides: Partial<MapLayers>): MapLayers {
  const next = { ...DEFAULT_MAP_LAYERS };
  for (const key of Object.keys(next) as Array<keyof MapLayers>) next[key] = false;
  return { ...next, ...overrides };
}

describe('operations mode presentation model', () => {
  it('keeps tracked freshness, modeled orbit data, and inactive layers distinct', () => {
    const snapshot = buildOperationsSnapshot({
      layers: layers({ weather: true, satellites: true }),
      renderer: 'globe',
      timeRange: '24h',
      sources: [source({})],
    });

    const weather = snapshot.groups.flatMap((group) => group.layers).find((layer) => layer.key === 'weather');
    const satellites = snapshot.groups.flatMap((group) => group.layers).find((layer) => layer.key === 'satellites');
    const conflicts = snapshot.groups.flatMap((group) => group.layers).find((layer) => layer.key === 'conflicts');

    assert.equal(weather?.status, 'fresh');
    assert.equal(weather?.statusLabel, 'Fresh · 4 items');
    assert.equal(satellites?.status, 'modeled');
    assert.equal(satellites?.statusLabel, 'Modeled orbit');
    assert.equal(conflicts?.status, 'standby');
    assert.equal(snapshot.rendererLabel, '3D globe');
  });

  it('reports tracked errors without claiming the whole workspace is offline', () => {
    const snapshot = buildOperationsSnapshot({
      layers: layers({ weather: true, bases: true }),
      renderer: 'flat',
      timeRange: '6h',
      sources: [source({ status: 'error', lastError: 'provider unavailable', itemCount: 0 })],
    });

    assert.equal(snapshot.overallStatus, 'limited');
    assert.equal(snapshot.attentionCount, 1);
    assert.equal(snapshot.activeLayerCount, 2);
    assert.equal(snapshot.rendererLabel, '2D map');
  });
});
