export type TraceSummary = {
  traceName: string;
  timeRange: [number, number];
  processCount: number;
  threadCount: number;
  tableCount: number;
  recordCount: number;
};

export type TraceDataset = {
  summary: TraceSummary;
  processes: string[];
  threads: string[];
};

export type PluginId =
  | 'thread-trend'
  | 'thread-overview'
  | 'event-aggregate'
  | 'process-list'
  | 'thread-blocked'
  | 'cpu-usage-analysis'
  | 'main-thread-jank-analysis'
  | 'wait-reason-analysis'
  | 'main-thread-stack-diff-analysis';

export type QueryParams = {
  startSec: number;
  endSec: number;
  process?: string;
  pid?: number;
  thread?: string;
  tid?: number;
  keyword?: string;
  bucketMs?: number;
  topN?: number;
  onlyMainThread?: number;
  frameThresholdMs?: number;
  slowFrameThresholdMs?: number;
  blockedThresholdMs?: number;
  waitTypeFilter?: '' | 'io' | 'lock' | 'binder' | 'futex' | 'workqueue' | 'schedule';
  statLevel?: 'process' | 'thread';
  sortBy?: 'cpu_time' | 'thread_count' | 'active_duration' | 'switch_count' | 'wakeup_count';
  onlyActive?: number;
  uid?: number;
  statusFilter?: '' | 'running' | 'ended';
  suspiciousOnly?: number;
  aggregateOrder?: 'avg_desc' | 'total_desc' | 'count_desc';
  compareStartSec?: number;
  compareEndSec?: number;
  diffMinCalls?: number;
  diffMinCostMs?: number;
  diffTopN?: number;
  diffSortBy?: 'cost_delta' | 'calls_delta' | 'avg_delta';
  /** 单 trace 两窗口均查主库；双 trace 时基线侧查 baseline 库 */
  stackDiffMode?: 'single-trace' | 'dual-trace';
};

export type PluginDefinition = {
  id: PluginId;
  name: string;
  description: string;
  outputType: 'table' | 'line' | 'stats';
  sqlTemplate: string;
};

export type QueryResult = {
  /** 产生该结果的内置插件 id，用于 SQL 预览等与当前选中插件对齐 */
  pluginId: PluginId;
  /** 实际发往 /query 的 SQL（含绝对 trace 时间，与 Perfetto ts 域一致） */
  sqlPreview: string;
  /** 与参数面板一致的预览 SQL（相对主 trace 起点的窗口等），便于对照表单 */
  sqlPreviewRelative: string;
  rows: Record<string, unknown>[];
  stats?: { label: string; value: string | number }[];
};
