import { PLUGINS } from './plugins';
import type { PluginDefinition, QueryParams } from '../types';

export const PLUGIN_DISPLAY_ORDER: PluginDefinition['id'][] = [
  'process-list',
  'thread-overview',
  'thread-trend',
  'cpu-usage-analysis',
  'main-thread-stack-diff-analysis',
  'main-thread-jank-analysis',
  'wait-reason-analysis',
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
    onlyMainThread: 1,
    frameThresholdMs: 16.6,
    slowFrameThresholdMs: 33,
    blockedThresholdMs: 5,
    waitTypeFilter: '',
    sortBy: 'cpu_time',
    onlyActive: 1,
    uid: undefined,
    statusFilter: '',
    tid: undefined,
    statLevel: 'thread',
    process: '',
    thread: '',
    keyword: '',
    suspiciousOnly: 1,
    aggregateOrder: 'avg_desc',
    compareStartSec: 0,
    compareEndSec: Math.min(defaultEndSec, 5),
    diffMinCalls: 1,
    diffMinCostMs: 0.1,
    diffTopN: 30,
    diffSortBy: 'cost_delta',
    stackDiffMode: 'single-trace',
  };
}

export function createParamsByPlugin(defaultEndSec: number): Record<PluginDefinition['id'], QueryParams> {
  return Object.fromEntries(PLUGINS.map((plugin) => {
    const base = createDefaultParams(defaultEndSec);
    if (plugin.id === 'cpu-usage-analysis') {
      return [plugin.id, { ...base, onlyMainThread: 0 }];
    }
    if (plugin.id === 'main-thread-jank-analysis' || plugin.id === 'wait-reason-analysis') {
      return [plugin.id, { ...base, onlyMainThread: 1 }];
    }
    if (plugin.id === 'thread-trend') {
      return [plugin.id, { ...base, bucketMs: 1000, topN: 10 }];
    }
    if (plugin.id === 'thread-overview') {
      return [plugin.id, { ...base, onlyMainThread: 0, topN: 20, sortBy: 'cpu_time' }];
    }
    if (plugin.id === 'main-thread-stack-diff-analysis') {
      return [plugin.id, {
        ...base,
        onlyMainThread: 1,
        diffSortBy: 'cost_delta',
        diffTopN: 30,
        diffMinCalls: 1,
        diffMinCostMs: 0.1,
        compareStartSec: base.startSec,
        compareEndSec: Math.min(base.endSec, base.startSec + Math.max(1, (base.endSec - base.startSec) / 2)),
      }];
    }
    return [plugin.id, base];
  })) as Record<PluginDefinition['id'], QueryParams>;
}
