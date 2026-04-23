import { PLUGINS } from './plugins';
import type { PluginDefinition, QueryParams } from '../types';

export const PLUGIN_DISPLAY_ORDER: PluginDefinition['id'][] = [
  'process-list',
  'thread-detail',
  'thread-trend',
  'thread-blocked',
  'event-aggregate',
];

export function createDefaultParams(defaultEndSec: number): QueryParams {
  return {
    startSec: 0,
    endSec: defaultEndSec,
    bucketMs: 1000,
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
