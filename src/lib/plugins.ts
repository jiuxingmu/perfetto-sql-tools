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
    description: '按时刻点统计某进程线程数量变化',
    outputType: 'line',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns,
    CAST({{bucketMs}} * 1e6 AS INT) AS bucket_ns
),
buckets AS (
  SELECT 0 AS bucket_idx, start_ns AS bucket_start_ns, start_ns + bucket_ns AS bucket_end_ns
  FROM params
  UNION ALL
  SELECT b.bucket_idx + 1, b.bucket_end_ns, b.bucket_end_ns + p.bucket_ns
  FROM buckets b
  JOIN params p
  WHERE b.bucket_end_ns < p.end_ns
    AND b.bucket_idx < 5000
),
threads_filtered AS (
  SELECT t.utid, t.start_ts, t.end_ts
  FROM thread t
  LEFT JOIN process p ON t.upid = p.upid
  WHERE t.utid IS NOT NULL
    AND ('{{process}}' = '' OR COALESCE(p.name, '') = '{{process}}')
    AND COALESCE(t.name, '') LIKE '%{{thread}}%'
),
bucketed AS (
  SELECT
    b.bucket_idx,
    b.bucket_start_ns,
    COUNT(DISTINCT tf.utid) AS thread_count
  FROM buckets b
  LEFT JOIN threads_filtered tf
    ON COALESCE(tf.start_ts, -9223372036854775808) <= b.bucket_start_ns
   AND COALESCE(tf.end_ts, 9223372036854775807) >= b.bucket_start_ns
  GROUP BY b.bucket_idx, b.bucket_start_ns
)
SELECT bucket_start_ns / 1e9 AS bucket_ts_sec, thread_count
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
  {
    id: 'thread-state',
    name: '线程状态明细',
    description: '统计某个进程在时间范围内的线程状态分布',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns
)
SELECT
  COALESCE(p.name, printf('pid_%d', p.pid)) AS process,
  COALESCE(t.name, printf('tid_%d', t.tid)) AS thread,
  t.tid,
  COALESCE(ts.state, 'unknown') AS state,
  COUNT(1) AS state_samples,
  ROUND(SUM(COALESCE(ts.dur, 0)) / 1e6, 3) AS state_dur_ms,
  ROUND(MIN(ts.ts) / 1e9, 6) AS first_ts_sec,
  ROUND(MAX(ts.ts + COALESCE(ts.dur, 0)) / 1e9, 6) AS last_ts_sec,
  MAX(COALESCE(ts.io_wait, 0)) AS io_wait_flag
FROM thread_state ts
JOIN thread t ON ts.utid = t.utid
LEFT JOIN process p ON t.upid = p.upid
JOIN params x
WHERE ts.ts <= x.end_ns
  AND (ts.ts + COALESCE(ts.dur, 0)) >= x.start_ns
  AND COALESCE(p.name, '') LIKE '%{{process}}%'
  AND COALESCE(t.name, '') LIKE '%{{thread}}%'
  AND COALESCE(ts.state, '') LIKE '%{{keyword}}%'
GROUP BY process, thread, t.tid, state
ORDER BY state_dur_ms DESC
LIMIT 5000;`,
  },
  {
    id: 'process-list',
    name: '进程列表',
    description: '列举时间范围内匹配的进程信息',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns
)
SELECT
  p.upid,
  p.pid,
  p.name AS name,
  COALESCE(p.name, printf('pid_%d', p.pid)) AS process,
  p.uid,
  COALESCE(p.cmdline, '') AS cmdline,
  p.parent_upid,
  CASE WHEN p.start_ts IS NULL THEN NULL ELSE ROUND(p.start_ts / 1e9, 6) END AS start_ts_sec,
  CASE WHEN p.end_ts IS NULL THEN NULL ELSE ROUND(p.end_ts / 1e9, 6) END AS end_ts_sec,
  p.android_appid,
  p.arg_set_id,
  CASE
    WHEN p.end_ts IS NULL THEN '运行中'
    ELSE '已结束'
  END AS status,
  ROUND(
    (
      MIN(COALESCE(p.end_ts, ts.end_ns), ts.end_ns) -
      MAX(COALESCE(p.start_ts, 0), ts.start_ns)
    ) / 1e9,
    3
  ) AS active_in_window_sec,
  ROUND(MAX(COALESCE(p.start_ts, 0), ts.start_ns) / 1e9, 6) AS window_start_sec,
  ROUND(MIN(COALESCE(p.end_ts, ts.end_ns), ts.end_ns) / 1e9, 6) AS window_end_sec
FROM process p
JOIN params ts
WHERE COALESCE(p.name, '') LIKE '%{{process}}%'
  AND COALESCE(p.start_ts, 0) <= ts.end_ns
  AND COALESCE(p.end_ts, ts.end_ns) >= ts.start_ns
ORDER BY active_in_window_sec DESC, p.upid ASC
LIMIT 5000;`,
  },
  {
    id: 'thread-detail',
    name: '线程列表',
    description: '列举时间范围内匹配的线程信息',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns
)
SELECT
  t.tid,
  COALESCE(t.name, printf('tid_%d', t.tid)) AS name,
  t.upid,
  COALESCE(p.name, printf('pid_%d', p.pid)) AS process,
  COALESCE(t.is_main_thread, 0) AS is_main_thread,
  t.start_ts AS start_ts,
  t.end_ts AS end_ts,
  t.utid,
  p.pid AS process_pid,
  p.uid AS process_uid,
  COALESCE(p.cmdline, '') AS process_cmdline,
  p.parent_upid AS process_parent_upid,
  p.android_appid AS process_android_appid,
  p.arg_set_id AS process_arg_set_id
FROM thread t
JOIN params ts
LEFT JOIN process p ON t.upid = p.upid
WHERE COALESCE(t.start_ts, 0) <= ts.end_ns
  AND COALESCE(t.end_ts, ts.end_ns) >= ts.start_ns
  AND COALESCE(p.name, '') LIKE '%{{process}}%'
  AND COALESCE(t.name, '') LIKE '%{{thread}}%'
ORDER BY t.upid ASC, t.tid ASC
LIMIT 5000;`,
  },
  {
    id: 'thread-blocked',
    name: '主线程阻塞分析',
    description: '分析目标进程主线程在时间范围内被阻塞的情况',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns
),
blocked AS (
  SELECT
    ts.utid,
    ts.state,
    ts.ts AS blocked_start_ns,
    COALESCE(ts.dur, 0) AS dur,
    ts.ts + COALESCE(ts.dur, 0) AS blocked_end_ns,
    ts.waker_utid,
    COALESCE(ts.io_wait, 0) AS io_wait,
    COALESCE(ts.blocked_function, '') AS blocked_function
  FROM thread_state ts
  JOIN params x
  WHERE ts.ts <= x.end_ns
    AND (ts.ts + COALESCE(ts.dur, 0)) >= x.start_ns
    AND COALESCE(ts.dur, 0) > 0
    AND COALESCE(ts.state, '') NOT IN ('Running', 'Runnable', 'R')
)
SELECT
  COALESCE(p.name, printf('pid_%d', p.pid)) AS process,
  COALESCE(t.name, printf('tid_%d', t.tid)) AS thread,
  t.tid AS blocked_tid,
  b.utid AS blocked_utid,
  b.state AS blocked_state,
  CASE
    WHEN b.state LIKE 'R%' THEN 'cpu_runnable_wait'
    WHEN b.io_wait = 1 THEN 'io_wait'
    WHEN b.blocked_function != '' THEN 'kernel_block'
    WHEN b.state = 'S' THEN 'sleep_wait'
    ELSE 'state_wait'
  END AS blocked_reason,
  CASE
    WHEN b.state LIKE 'R%' THEN 1
    WHEN b.io_wait = 1 THEN 1
    WHEN b.blocked_function != '' THEN 1
    WHEN b.state LIKE 'D%' THEN 1
    ELSE 0
  END AS suspicious_block_flag,
  ROUND(b.blocked_start_ns / 1e9, 6) AS blocked_start_ts_sec,
  ROUND(b.blocked_end_ns / 1e9, 6) AS blocked_end_ts_sec,
  ROUND(b.dur / 1e6, 3) AS blocked_dur_ms,
  b.io_wait AS io_wait_flag,
  b.blocked_function,
  wt.tid AS waker_tid,
  COALESCE(wt.name, '') AS waker_thread,
  COALESCE(wp.name, '') AS waker_process
FROM blocked b
JOIN thread t ON b.utid = t.utid
LEFT JOIN process p ON t.upid = p.upid
LEFT JOIN thread wt ON b.waker_utid = wt.utid
LEFT JOIN process wp ON wt.upid = wp.upid
WHERE COALESCE(p.name, '') LIKE '%{{process}}%'
  AND COALESCE(t.is_main_thread, 0) = 1
  AND (
    {{suspiciousOnly}} = 0
    OR (
      b.dur > 1e6
      AND (
        b.state LIKE 'R%'
        OR b.io_wait = 1
        OR b.blocked_function != ''
        OR b.state LIKE 'D%'
      )
    )
  )
ORDER BY b.blocked_start_ns ASC
LIMIT 5000;`,
  },
];

export function buildSqlPreview(def: PluginDefinition, p: QueryParams): string {
  return def.sqlTemplate
    .replaceAll('{{startSec}}', String(p.startSec))
    .replaceAll('{{endSec}}', String(p.endSec))
    .replaceAll('{{process}}', p.process ?? '')
    .replaceAll('{{thread}}', p.thread ?? '')
    .replaceAll('{{keyword}}', p.keyword ?? '')
    .replaceAll('{{suspiciousOnly}}', String(Math.max(0, Math.min(1, Number(p.suspiciousOnly ?? 0)))))
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
