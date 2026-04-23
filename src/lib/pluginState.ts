import { PLUGINS } from './plugins';
import type { PluginDefinition, QueryParams } from '../types';

export const PLUGIN_DISPLAY_ORDER: PluginDefinition['id'][] = [
  'process-list',
  'thread-detail',
  'cpu-usage-analysis',
  'thread-trend',
  'thread-blocked',
  'event-aggregate',
];

export function createDefaultParams(defaultEndSec: number): QueryParams {
  return {
    startSec: 0,
    endSec: defaultEndSec,
    pid: undefined,
    bucketMs: 1000,
    topN: 10,
    onlyMainThread: 0,
    statLevel: 'thread',
    process: '',
    thread: '',
    keyword: '',
    suspiciousOnly: 1,
    aggregateOrder: 'avg_desc',
  };
}

export function createParamsByPlugin(defaultEndSec: number): Record<PluginDefinition['id'], QueryParams> {
  return Object.fromEntries(
    PLUGINS.map((plugin) => [plugin.id, createDefaultParams(defaultEndSec)]),
  ) as Record<PluginDefinition['id'], QueryParams>;
}
