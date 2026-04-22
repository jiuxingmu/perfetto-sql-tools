import type { PluginDefinition, QueryParams, QueryResult } from '../types';

export const PLUGINS: PluginDefinition[] = [
  {
    id: 'slice-list',
    name: 'Slice 模糊匹配列表',
    description: '某段时间内某进程/线程满足关键字的 slice 列表',
    outputType: 'table',
    sqlTemplate: `SELECT s.ts / 1e9 AS ts_sec, s.dur / 1e6 AS dur_ms, s.name,
  COALESCE(t.name, printf('tid_%d', t.tid)) AS thread,
  COALESCE(p.name, printf('pid_%d', p.pid)) AS process
FROM slice s
JOIN thread_track tt ON s.track_id = tt.id
JOIN thread t ON tt.utid = t.utid
LEFT JOIN process p ON t.upid = p.upid
WHERE s.ts BETWEEN {{startSec}} * 1e9 AND {{endSec}} * 1e9
  AND COALESCE(p.name, '') LIKE '%{{process}}%'
  AND COALESCE(t.name, '') LIKE '%{{thread}}%'
  AND s.name LIKE '%{{keyword}}%'
ORDER BY s.ts ASC
LIMIT 5000;`,
  },
  {
    id: 'thread-trend',
    name: '线程数量变化趋势',
    description: '按时间分桶统计线程活跃数量变化',
    outputType: 'line',
    sqlTemplate: `WITH filtered AS (
  SELECT s.ts, t.utid
  FROM slice s
  JOIN thread_track tt ON s.track_id = tt.id
  JOIN thread t ON tt.utid = t.utid
  LEFT JOIN process p ON t.upid = p.upid
  WHERE s.ts BETWEEN {{startSec}} * 1e9 AND {{endSec}} * 1e9
    AND COALESCE(p.name, '') LIKE '%{{process}}%'
),
bucketed AS (
  SELECT CAST((ts - {{startSec}} * 1e9) / ({{bucketMs}} * 1e6) AS INT) AS bucket_idx,
         COUNT(DISTINCT utid) AS thread_count
  FROM filtered
  GROUP BY bucket_idx
)
SELECT ({{startSec}} + bucket_idx * {{bucketMs}} / 1000.0) AS bucket_ts_sec, thread_count
FROM bucketed
ORDER BY bucket_idx;`,
  },
  {
    id: 'event-aggregate',
    name: '事件总耗时聚合',
    description: '某类事件总耗时/均值/次数统计',
    outputType: 'stats',
    sqlTemplate: `SELECT s.name,
  SUM(s.dur) / 1e6 AS total_dur_ms,
  AVG(s.dur) / 1e6 AS avg_dur_ms,
  COUNT(1) AS cnt
FROM slice s
JOIN thread_track tt ON s.track_id = tt.id
JOIN thread t ON tt.utid = t.utid
LEFT JOIN process p ON t.upid = p.upid
WHERE s.ts BETWEEN {{startSec}} * 1e9 AND {{endSec}} * 1e9
  AND COALESCE(p.name, '') LIKE '%{{process}}%'
  AND COALESCE(t.name, '') LIKE '%{{thread}}%'
  AND s.name LIKE '%{{keyword}}%'
GROUP BY s.name
ORDER BY total_dur_ms DESC
LIMIT 1000;`,
  },
];

export function buildSqlPreview(def: PluginDefinition, p: QueryParams): string {
  return def.sqlTemplate
    .replaceAll('{{startSec}}', String(p.startSec))
    .replaceAll('{{endSec}}', String(p.endSec))
    .replaceAll('{{process}}', p.process ?? '')
    .replaceAll('{{thread}}', p.thread ?? '')
    .replaceAll('{{keyword}}', p.keyword ?? '')
    .replaceAll('{{bucketMs}}', String(Math.max(1, p.bucketMs ?? 1000)));
}

function buildStats(plugin: PluginDefinition, rows: Record<string, unknown>[]): QueryResult['stats'] {
  if (plugin.id === 'thread-trend') {
    const values = rows.map((r) => Number(r.thread_count ?? 0));
    const sum = values.reduce((acc, n) => acc + n, 0);
    return [
      { label: '峰值', value: values.length ? Math.max(...values) : 0 },
      { label: '均值', value: values.length ? (sum / values.length).toFixed(2) : 0 },
      { label: '最小值', value: values.length ? Math.min(...values) : 0 },
      { label: '样本点', value: values.length },
    ];
  }
  if (plugin.id === 'event-aggregate') {
    const totalDur = rows.reduce((acc, r) => acc + Number(r.total_dur_ms ?? 0), 0);
    const totalCount = rows.reduce((acc, r) => acc + Number(r.cnt ?? 0), 0);
    return [
      { label: '总耗时(ms)', value: Number(totalDur.toFixed(2)) },
      { label: '总次数', value: totalCount },
      { label: '事件种类', value: rows.length },
      { label: '平均耗时(ms)', value: totalCount ? (totalDur / totalCount).toFixed(2) : 0 },
    ];
  }
  return undefined;
}

export async function runPluginQuery(plugin: PluginDefinition, params: QueryParams): Promise<QueryResult> {
  const sqlPreview = buildSqlPreview(plugin, params);
  const resp = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: sqlPreview }),
  });
  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(msg || 'SQL 查询失败');
  }
  const rows = (await resp.json()) as Record<string, unknown>[];

  return {
    sqlPreview,
    rows,
    stats: buildStats(plugin, rows),
  };
}
