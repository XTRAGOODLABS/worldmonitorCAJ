import { LAYER_REGISTRY } from '@/config/map-layer-definitions';
import { LAYER_TO_SOURCE } from '@/config/panels';
import type { DataSourceState, FreshnessStatus } from '@/services/data-freshness';
import type { MapLayers } from '@/types';

export type OperationsSourceState = Pick<
  DataSourceState,
  'id' | 'status' | 'itemCount'
>;

export type OperationsLayerStatus =
  | FreshnessStatus
  | 'modeled'
  | 'reference'
  | 'best_effort'
  | 'standby'
  | 'unknown';

export interface OperationsLayerView {
  key: keyof MapLayers;
  label: string;
  enabled: boolean;
  status: OperationsLayerStatus;
  statusLabel: string;
  tone: 'good' | 'warn' | 'bad' | 'info' | 'muted';
}

export interface OperationsLayerGroup {
  label: string;
  layers: OperationsLayerView[];
}

export interface OperationsSnapshot {
  groups: OperationsLayerGroup[];
  rendererLabel: string;
  timeRangeLabel: string;
  overallStatus: 'operational' | 'limited';
  activeLayerCount: number;
  attentionCount: number;
}

export interface OperationsSnapshotInput {
  layers: MapLayers;
  renderer: 'globe' | 'flat' | 'initializing';
  timeRange: string;
  sources: OperationsSourceState[];
}

const GROUPS: ReadonlyArray<{
  label: string;
  layers: Array<keyof MapLayers>;
}> = [
  { label: 'Movement', layers: ['flights', 'military', 'ais', 'satellites'] },
  { label: 'Intelligence', layers: ['conflicts', 'hotspots', 'ucdpEvents', 'gpsJamming'] },
  { label: 'Environment', layers: ['weather', 'fires', 'natural', 'outages'] },
  { label: 'Reference', layers: ['bases', 'cables', 'webcams'] },
];

const UNTRACKED_STATUS: Partial<Record<keyof MapLayers, {
  status: Extract<OperationsLayerStatus, 'modeled' | 'reference' | 'best_effort'>;
  label: string;
}>> = {
  satellites: { status: 'modeled', label: 'Modeled orbit' },
  bases: { status: 'reference', label: 'Reference data' },
  cables: { status: 'reference', label: 'Reference data' },
  conflicts: { status: 'reference', label: 'Curated zones' },
  hotspots: { status: 'reference', label: 'Curated locations' },
  flights: { status: 'best_effort', label: 'Best effort' },
  fires: { status: 'best_effort', label: 'Best effort' },
  natural: { status: 'best_effort', label: 'Best effort' },
  webcams: { status: 'best_effort', label: 'Best effort' },
};

const STATUS_SEVERITY: Record<FreshnessStatus, number> = {
  fresh: 0,
  stale: 1,
  disabled: 2,
  very_stale: 3,
  no_data: 4,
  error: 5,
};

function statusTone(status: OperationsLayerStatus): OperationsLayerView['tone'] {
  if (status === 'fresh') return 'good';
  if (status === 'error' || status === 'no_data' || status === 'very_stale') return 'bad';
  if (status === 'stale') return 'warn';
  if (status === 'modeled' || status === 'reference' || status === 'best_effort') return 'info';
  return 'muted';
}

function trackedStatusLabel(status: FreshnessStatus, itemCount: number): string {
  const count = itemCount > 0 ? ` · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : '';
  switch (status) {
    case 'fresh': return `Fresh${count}`;
    case 'stale': return `Stale${count}`;
    case 'very_stale': return `Very stale${count}`;
    case 'no_data': return 'No tracked data';
    case 'disabled': return 'Disabled';
    case 'error': return 'Source error';
  }
}

function buildLayerView(
  key: keyof MapLayers,
  layers: MapLayers,
  sourceById: Map<string, OperationsSourceState>,
): OperationsLayerView {
  const enabled = Boolean(layers[key]);
  if (!enabled) {
    return {
      key,
      label: LAYER_REGISTRY[key].fallbackLabel,
      enabled,
      status: 'standby',
      statusLabel: 'Standby',
      tone: 'muted',
    };
  }

  const sourceIds = LAYER_TO_SOURCE[key] ?? [];
  const sources = sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is OperationsSourceState => Boolean(source));
  if (sources.length > 0) {
    const worst = sources.reduce((current, source) => (
      STATUS_SEVERITY[source.status] > STATUS_SEVERITY[current.status] ? source : current
    ));
    const itemCount = sources.reduce((total, source) => total + source.itemCount, 0);
    return {
      key,
      label: LAYER_REGISTRY[key].fallbackLabel,
      enabled,
      status: worst.status,
      statusLabel: trackedStatusLabel(worst.status, itemCount),
      tone: statusTone(worst.status),
    };
  }

  const declared = UNTRACKED_STATUS[key];
  const status = declared?.status ?? 'unknown';
  return {
    key,
    label: LAYER_REGISTRY[key].fallbackLabel,
    enabled,
    status,
    statusLabel: declared?.label ?? 'Status unavailable',
    tone: statusTone(status),
  };
}

export function isAttentionStatus(status: OperationsLayerStatus): boolean {
  return status === 'error'
    || status === 'no_data'
    || status === 'very_stale'
    || status === 'unknown';
}

export function buildOperationsSnapshot(input: OperationsSnapshotInput): OperationsSnapshot {
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const groups = GROUPS.map((group) => ({
    label: group.label,
    layers: group.layers.map((key) => buildLayerView(key, input.layers, sourceById)),
  }));
  const activeLayers = groups.flatMap((group) => group.layers).filter((layer) => layer.enabled);
  const attentionCount = activeLayers.filter((layer) => isAttentionStatus(layer.status)).length;

  return {
    groups,
    rendererLabel: input.renderer === 'globe'
      ? '3D globe'
      : input.renderer === 'flat'
        ? '2D map'
        : 'Renderer starting',
    timeRangeLabel: input.timeRange.toUpperCase(),
    overallStatus: attentionCount > 0 ? 'limited' : 'operational',
    activeLayerCount: activeLayers.length,
    attentionCount,
  };
}
