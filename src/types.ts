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

export type PluginId = 'slice-list' | 'thread-trend' | 'event-aggregate' | 'thread-state' | 'process-list' | 'thread-detail';

export type QueryParams = {
  startSec: number;
  endSec: number;
  process?: string;
  thread?: string;
  keyword?: string;
  bucketMs?: number;
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
