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
  | 'event-aggregate'
  | 'process-list'
  | 'thread-detail'
  | 'thread-blocked'
  | 'cpu-usage-analysis'
  | 'main-thread-jank-analysis';

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
  statLevel?: 'process' | 'thread';
  suspiciousOnly?: number;
  aggregateOrder?: 'avg_desc' | 'total_desc' | 'count_desc';
};

export type PluginDefinition = {
  id: PluginId;
  name: string;
  description: string;
  outputType: 'table' | 'line' | 'stats';
  sqlTemplate: string;
};

export type QueryResult = {
  sqlPreview: string;
  rows: Record<string, unknown>[];
  stats?: { label: string; value: string | number }[];
};
