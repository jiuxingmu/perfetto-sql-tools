import type { QueryParams } from '../types';

/**
 * 单 trace 内按时间窗口聚合 slice（按 stack_key），供线程堆栈 Diff 单侧查询。
 * winStartSec / winEndSec 须为绝对时间（秒，与 Perfetto ts 同源）。
 */
export const STACK_DIFF_AGG_SQL_TEMPLATE = `WITH params AS (
  SELECT
    CAST({{winStartSec}} * 1e9 AS INT) AS win_start_ns,
    CAST({{winEndSec}} * 1e9 AS INT) AS win_end_ns,
    CAST({{pid}} AS INT) AS target_pid,
    CAST({{tid}} AS INT) AS target_tid,
    CAST(MAX(0, {{onlyMainThread}}) AS INT) AS only_main_thread
),
thread_scope AS (
  SELECT
    t.utid,
    t.tid,
    COALESCE(t.name, printf('tid_%d', t.tid)) AS thread_name,
    COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) AS is_main_thread,
    p.pid,
    COALESCE(p.name, printf('pid_%d', p.pid)) AS process_name
  FROM thread t
  LEFT JOIN process p ON p.upid = t.upid
  JOIN params x
  WHERE ('{{process}}' = '' OR COALESCE(p.name, '') = '{{process}}')
    AND ('{{thread}}' = '' OR COALESCE(t.name, '') LIKE '%' || '{{thread}}' || '%')
    AND (x.target_pid <= 0 OR COALESCE(p.pid, -1) = x.target_pid)
    AND (x.target_tid <= 0 OR COALESCE(t.tid, -1) = x.target_tid)
    AND (x.only_main_thread = 0 OR COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) = 1)
),
slice_events AS (
  SELECT
    sl.ts,
    sl.ts + COALESCE(sl.dur, 0) AS end_ts,
    COALESCE(sl.dur, 0) AS dur_ns,
    COALESCE(sl.name, '') AS stack_key,
    ts.process_name,
    ts.thread_name,
    ts.pid,
    ts.tid
  FROM slice sl
  JOIN thread_track tt ON sl.track_id = tt.id
  JOIN thread_scope ts ON tt.utid = ts.utid
  WHERE COALESCE(sl.dur, 0) > 0
    AND COALESCE(sl.name, '') <> ''
),
agg AS (
  SELECT
    se.stack_key,
    MAX(se.process_name) AS process_name,
    MAX(se.thread_name) AS thread_name,
    MAX(se.pid) AS pid,
    MAX(se.tid) AS tid,
    COUNT(1) AS calls,
    SUM(se.dur_ns) AS cost_ns
  FROM slice_events se
  JOIN params x
  WHERE se.ts < x.win_end_ns
    AND se.end_ts > x.win_start_ns
  GROUP BY se.stack_key
)
SELECT * FROM agg;`;

export function buildStackDiffAggSql(p: QueryParams, winStartSec: number, winEndSec: number): string {
  return STACK_DIFF_AGG_SQL_TEMPLATE
    .replaceAll('{{winStartSec}}', String(winStartSec))
    .replaceAll('{{winEndSec}}', String(winEndSec))
    .replaceAll('{{process}}', p.process ?? '')
    .replaceAll('{{thread}}', p.thread ?? '')
    .replaceAll('{{pid}}', String(Math.max(0, Number(p.pid ?? 0))))
    .replaceAll('{{tid}}', String(Math.max(0, Number(p.tid ?? 0))))
    .replaceAll('{{onlyMainThread}}', String(Math.max(0, Math.min(1, Number(p.onlyMainThread ?? 0)))));
}
