import type { PluginDefinition, QueryParams, QueryResult } from '../types';
import { buildStackDiffAggSql } from './stackDiffAggSql';
import { mergeStackDiffAggRows } from './stackDiffMerge';

export const PLUGINS: PluginDefinition[] = [
  {
    id: 'main-thread-stack-diff-analysis',
    name: '线程堆栈 Diff 分析',
    description: '单 trace 双窗口或双 trace 文件对比 slice 调用链，可限定主线程',
    outputType: 'table',
    sqlTemplate:
      'SELECT 1 AS _stack_diff_placeholder WHERE 0; -- 实际查询由双侧聚合 SQL 在运行时拼接',
  },
  {
    id: 'wait-reason-analysis',
    name: '等待归因分析',
    description: '解释为什么在等（IO/锁/Binder/futex 等）',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns,
    CAST({{pid}} AS INT) AS target_pid,
    CAST({{tid}} AS INT) AS target_tid,
    CAST(MAX(1, {{blockedThresholdMs}} * 1e6) AS INT) AS blocked_threshold_ns,
    CAST(MAX(0, {{onlyMainThread}}) AS INT) AS only_main_thread
),
trace_window AS (
  SELECT start_ts AS trace_start_ns
  FROM trace_bounds
  LIMIT 1
),
candidate AS (
  SELECT
    ts.utid,
    ts.ts AS blocked_start_ts_ns,
    ts.ts + COALESCE(ts.dur, 0) AS blocked_end_ts_ns,
    COALESCE(ts.dur, 0) AS blocked_dur_ns,
    COALESCE(ts.state, '') AS blocked_state,
    COALESCE(ts.io_wait, 0) AS io_wait,
    COALESCE(ts.blocked_function, '') AS blocked_function,
    t.tid,
    COALESCE(t.name, printf('tid_%d', t.tid)) AS thread_name,
    COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) AS is_main_thread,
    p.pid,
    COALESCE(p.name, printf('pid_%d', p.pid)) AS process_name,
    ts.waker_utid
  FROM thread_state ts
  JOIN thread t ON ts.utid = t.utid
  LEFT JOIN process p ON t.upid = p.upid
  JOIN params x
  WHERE ts.ts < x.end_ns
    AND (ts.ts + COALESCE(ts.dur, 0)) > x.start_ns
    AND COALESCE(ts.dur, 0) >= x.blocked_threshold_ns
    AND COALESCE(ts.state, '') NOT IN ('R', 'Running')
    AND (
      COALESCE(ts.state, '') IN ('D', 'S', 'T', 't', 'X', 'x', 'K', 'W', 'I')
      OR COALESCE(ts.io_wait, 0) = 1
      OR COALESCE(ts.blocked_function, '') <> ''
    )
    AND ('{{process}}' = '' OR COALESCE(p.name, '') = '{{process}}')
    AND ('{{thread}}' = '' OR COALESCE(t.name, '') LIKE '%' || '{{thread}}' || '%')
    AND (x.target_pid <= 0 OR COALESCE(p.pid, -1) = x.target_pid)
    AND (x.target_tid <= 0 OR COALESCE(t.tid, -1) = x.target_tid)
    AND (x.only_main_thread = 0 OR COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) = 1)
),
enriched AS (
  SELECT
    c.*,
    COALESCE(wt.name, '') AS waker_thread,
    COALESCE(wp.name, '') AS waker_process,
    CASE
      WHEN c.io_wait = 1 OR LOWER(c.blocked_function) LIKE '%io%' THEN 'io'
      WHEN LOWER(c.blocked_function) LIKE '%futex%' THEN 'futex'
      WHEN LOWER(c.blocked_function) LIKE '%binder%' OR LOWER(c.thread_name) LIKE '%binder%' THEN 'binder'
      WHEN LOWER(c.blocked_function) LIKE '%mutex%' OR LOWER(c.blocked_function) LIKE '%lock%' THEN 'lock'
      WHEN LOWER(c.blocked_function) LIKE '%work%' OR LOWER(c.blocked_function) LIKE '%flush%' THEN 'workqueue'
      WHEN c.blocked_state IN ('D', 'S', 'T', 't', 'X', 'x', 'K', 'W', 'I') THEN 'schedule'
      WHEN LOWER(c.blocked_function) LIKE '%read%' OR LOWER(c.blocked_function) LIKE '%write%' OR LOWER(c.blocked_function) LIKE '%fs%' THEN 'unknown_io'
      WHEN LOWER(c.blocked_function) LIKE '%sync%' OR LOWER(c.blocked_function) LIKE '%wait%' THEN 'unknown_sync'
      WHEN LOWER(c.blocked_function) LIKE '%kernel%' OR c.blocked_state IN ('D', 'S', 'I') THEN 'unknown_kernel'
      ELSE 'unknown_other'
    END AS wait_type
  FROM candidate c
  LEFT JOIN thread wt ON c.waker_utid = wt.utid
  LEFT JOIN process wp ON wt.upid = wp.upid
)
SELECT
  ROUND((e.blocked_start_ts_ns - tw.trace_start_ns) / 1e9, 3) AS blocked_start_ts,
  ROUND((e.blocked_end_ts_ns - tw.trace_start_ns) / 1e9, 3) AS blocked_end_ts,
  ROUND(e.blocked_dur_ns / 1e6, 3) AS blocked_dur_ms,
  e.wait_type,
  e.blocked_state,
  e.blocked_function,
  e.waker_thread,
  e.waker_process,
  e.process_name,
  e.pid,
  e.tid,
  CASE
    WHEN e.wait_type = 'io' THEN 'IO 等待'
    WHEN e.wait_type = 'lock' THEN '锁等待'
    WHEN e.wait_type = 'binder' THEN 'Binder 等待'
    WHEN e.wait_type = 'futex' THEN 'futex 等待'
    WHEN e.wait_type = 'workqueue' THEN 'workqueue/flush 等待'
    WHEN e.wait_type = 'schedule' THEN '调度或内核等待'
    WHEN e.wait_type = 'unknown_io' THEN '未知等待(IO 相关)'
    WHEN e.wait_type = 'unknown_sync' THEN '未知等待(同步相关)'
    WHEN e.wait_type = 'unknown_kernel' THEN '未知等待(内核态等待)'
    ELSE '未知等待'
  END AS blocked_reason
FROM enriched e
LEFT JOIN trace_window tw
WHERE ('{{waitTypeFilter}}' = '' OR e.wait_type = '{{waitTypeFilter}}')
ORDER BY e.blocked_dur_ns DESC, e.blocked_start_ts_ns ASC
LIMIT 5000;`,
  },
  {
    id: 'main-thread-jank-analysis',
    name: '慢帧分析',
    description: '定位哪里卡了（慢帧与卡顿区间）',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns,
    CAST({{pid}} AS INT) AS target_pid,
    CAST({{tid}} AS INT) AS target_tid,
    CAST(MAX(1, {{frameThresholdMs}} * 1e6) AS INT) AS frame_threshold_ns,
    CAST(MAX(1, {{slowFrameThresholdMs}} * 1e6) AS INT) AS slow_frame_threshold_ns,
    CAST(MAX(0, {{onlyMainThread}}) AS INT) AS only_main_thread
),
trace_window AS (
  SELECT start_ts AS trace_start_ns
  FROM trace_bounds
  LIMIT 1
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
  LEFT JOIN process p ON t.upid = p.upid
  JOIN params x
  WHERE ('{{process}}' = '' OR COALESCE(p.name, '') = '{{process}}')
    AND ('{{thread}}' = '' OR COALESCE(t.name, '') LIKE '%' || '{{thread}}' || '%')
    AND (x.target_pid <= 0 OR COALESCE(p.pid, -1) = x.target_pid)
    AND (x.target_tid <= 0 OR COALESCE(t.tid, -1) = x.target_tid)
    AND (x.only_main_thread = 0 OR COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) = 1)
),
main_sched AS (
  SELECT
    s.ts AS frame_start_ts,
    s.ts + COALESCE(s.dur, 0) AS frame_end_ts,
    COALESCE(s.dur, 0) AS frame_dur_ns,
    ts.thread_name,
    ts.process_name,
    ts.pid,
    ts.tid,
    ts.is_main_thread
  FROM sched s
  JOIN thread_scope ts ON s.utid = ts.utid
  JOIN params x
  WHERE s.ts < x.end_ns
    AND (s.ts + COALESCE(s.dur, 0)) > x.start_ns
    AND COALESCE(s.dur, 0) > 0
),
slice_ctx AS (
  SELECT
    ms.frame_start_ts,
    ms.frame_end_ts,
    MAX(COALESCE(sl.name, '')) AS top_slice_name
  FROM main_sched ms
  LEFT JOIN thread_track tt ON tt.utid = (SELECT utid FROM thread_scope WHERE tid = ms.tid LIMIT 1)
  LEFT JOIN slice sl
    ON sl.track_id = tt.id
   AND sl.ts < ms.frame_end_ts
   AND (sl.ts + COALESCE(sl.dur, 0)) > ms.frame_start_ts
  GROUP BY ms.frame_start_ts, ms.frame_end_ts
)
SELECT
  ROUND((ms.frame_start_ts - tw.trace_start_ns) / 1e9, 3) AS frame_start_ts,
  ROUND((ms.frame_end_ts - tw.trace_start_ns) / 1e9, 3) AS frame_end_ts,
  ROUND(ms.frame_dur_ns / 1e6, 3) AS frame_dur_ms,
  CASE WHEN ms.frame_dur_ns >= (SELECT frame_threshold_ns FROM params) THEN 1 ELSE 0 END AS slow_flag,
  CASE
    WHEN ms.frame_dur_ns >= (SELECT slow_frame_threshold_ns FROM params) THEN 'severe_jank'
    WHEN ms.frame_dur_ns >= (SELECT frame_threshold_ns FROM params) THEN 'slow_frame'
    ELSE 'normal'
  END AS jank_type,
  CASE WHEN ms.is_main_thread = 1 THEN 'running_main' ELSE 'running_non_main' END AS main_thread_state,
  CASE WHEN ms.frame_dur_ns >= (SELECT slow_frame_threshold_ns FROM params) THEN 'dur_exceeds_slow_threshold' ELSE '' END AS blocking_reason,
  COALESCE(sc.top_slice_name, '') AS top_slice_name,
  ms.process_name,
  ms.pid,
  ms.tid
FROM main_sched ms
LEFT JOIN trace_window tw
LEFT JOIN slice_ctx sc ON ms.frame_start_ts = sc.frame_start_ts AND ms.frame_end_ts = sc.frame_end_ts
ORDER BY ms.frame_dur_ns DESC, ms.frame_start_ts ASC
LIMIT 5000;`,
  },
  {
    id: 'cpu-usage-analysis',
    name: '热点线程分析',
    description: '识别进程/线程 CPU 热点、占比与调度片段特征',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns,
    CAST(MAX(1, {{topN}}) AS INT) AS top_n,
    CAST(MAX(0, {{onlyMainThread}}) AS INT) AS only_main_thread,
    CAST({{pid}} AS INT) AS target_pid
),
sched_scope AS (
  SELECT
    s.ts,
    s.dur,
    s.utid,
    t.tid,
    COALESCE(t.name, printf('tid_%d', t.tid)) AS thread_name,
    COALESCE(t.is_main_thread, 0) AS is_main_thread,
    p.pid,
    COALESCE(p.name, printf('pid_%d', p.pid)) AS process_name
  FROM sched s
  JOIN thread t ON s.utid = t.utid
  LEFT JOIN process p ON t.upid = p.upid
  JOIN params x
  WHERE s.ts < x.end_ns
    AND (s.ts + COALESCE(s.dur, 0)) > x.start_ns
    AND ('{{process}}' = '' OR COALESCE(p.name, '') = '{{process}}')
    AND (x.target_pid <= 0 OR COALESCE(p.pid, -1) = x.target_pid)
    AND (x.only_main_thread = 0 OR COALESCE(t.is_main_thread, 0) = 1)
),
clipped AS (
  SELECT
    process_name,
    pid,
    thread_name,
    tid,
    is_main_thread,
    MAX(0, MIN(ts + dur, x.end_ns) - MAX(ts, x.start_ns)) AS overlap_dur_ns
  FROM sched_scope
  JOIN params x
  WHERE COALESCE(dur, 0) > 0
),
process_agg AS (
  SELECT
    process_name AS name,
    pid,
    NULL AS tid,
    SUM(overlap_dur_ns) AS cpu_dur_ns,
    COUNT(1) AS slice_count,
    AVG(overlap_dur_ns) AS avg_slice_dur_ns,
    0 AS main_thread_ratio
  FROM clipped
  GROUP BY process_name, pid
),
thread_agg AS (
  SELECT
    thread_name AS name,
    pid,
    tid,
    SUM(overlap_dur_ns) AS cpu_dur_ns,
    COUNT(1) AS slice_count,
    AVG(overlap_dur_ns) AS avg_slice_dur_ns,
    AVG(CASE WHEN is_main_thread = 1 THEN 1.0 ELSE 0.0 END) AS main_thread_ratio
  FROM clipped
  GROUP BY thread_name, pid, tid
),
selected_agg AS (
  SELECT * FROM process_agg WHERE '{{statLevel}}' = 'process'
  UNION ALL
  SELECT * FROM thread_agg WHERE '{{statLevel}}' = 'thread'
),
total AS (
  SELECT SUM(cpu_dur_ns) AS total_cpu_dur_ns FROM selected_agg
)
SELECT
  '{{statLevel}}' AS stat_level,
  name,
  pid,
  tid,
  ROUND(cpu_dur_ns / 1e6, 3) AS cpu_dur_ms,
  ROUND(cpu_dur_ns * 1.0 / NULLIF(total_cpu_dur_ns, 0), 6) AS cpu_ratio,
  slice_count,
  ROUND(avg_slice_dur_ns / 1e6, 3) AS avg_slice_dur_ms,
  CASE WHEN main_thread_ratio >= 0.5 THEN 1 ELSE 0 END AS is_main_thread
FROM selected_agg
JOIN total
WHERE cpu_dur_ns > 0
ORDER BY cpu_dur_ns DESC, name ASC
LIMIT (SELECT top_n FROM params);`,
  },
  {
    id: 'thread-trend',
    name: '线程数量趋势',
    description: '按时间分桶统计线程数',
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
    id: 'thread-overview',
    name: '线程画像总览',
    description: '线程级性能画像与筛选入口',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns,
    CAST(MAX(1, {{topN}}) AS INT) AS top_n,
    CAST(MAX(0, {{onlyActive}}) AS INT) AS only_active,
    CAST(MAX(0, {{onlyMainThread}}) AS INT) AS only_main_thread,
    CAST({{pid}} AS INT) AS target_pid,
    CAST({{tid}} AS INT) AS target_tid
),
thread_scope AS (
  SELECT
    t.utid,
    t.tid,
    COALESCE(t.name, printf('tid_%d', t.tid)) AS thread_name,
    COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) AS is_main_thread,
    COALESCE(t.start_ts, 0) AS start_ts,
    COALESCE(t.end_ts, 9223372036854775807) AS end_ts,
    p.upid,
    p.pid,
    COALESCE(p.name, printf('pid_%d', p.pid)) AS process_name
  FROM thread t
  LEFT JOIN process p ON t.upid = p.upid
  JOIN params x
  WHERE t.utid IS NOT NULL
    AND ('{{process}}' = '' OR COALESCE(p.name, '') = '{{process}}')
    AND COALESCE(t.name, '') LIKE '%{{thread}}%'
    AND (x.target_pid <= 0 OR COALESCE(p.pid, -1) = x.target_pid)
    AND (x.target_tid <= 0 OR COALESCE(t.tid, -1) = x.target_tid)
    AND (x.only_main_thread = 0 OR COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) = 1)
),
thread_profile AS (
  SELECT
    ts.*,
    ROUND((MAX(ts.start_ts, x.start_ns)) / 1e9, 3) AS window_start_ts,
    ROUND((MIN(ts.end_ts, x.end_ns)) / 1e9, 3) AS window_end_ts,
    ROUND(MAX(0, MIN(ts.end_ts, x.end_ns) - MAX(ts.start_ts, x.start_ns)) / 1e6, 3) AS active_duration_ms
  FROM thread_scope ts
  JOIN params x
),
cpu_agg AS (
  SELECT
    t.utid,
    ROUND(SUM(MAX(0, MIN(s.ts + COALESCE(s.dur, 0), x.end_ns) - MAX(s.ts, x.start_ns))) / 1e6, 3) AS cpu_time_ms,
    COUNT(1) AS switch_count
  FROM sched s
  JOIN thread t ON s.utid = t.utid
  JOIN params x
  WHERE s.ts < x.end_ns
    AND (s.ts + COALESCE(s.dur, 0)) > x.start_ns
  GROUP BY t.utid
),
wakeup_agg AS (
  SELECT
    ts.utid,
    SUM(CASE WHEN ts.waker_utid IS NOT NULL THEN 1 ELSE 0 END) AS wakeup_count
  FROM thread_state ts
  JOIN params x
  WHERE ts.ts < x.end_ns
    AND (ts.ts + COALESCE(ts.dur, 0)) > x.start_ns
  GROUP BY ts.utid
),
combined AS (
  SELECT
    tp.thread_name,
    tp.tid,
    tp.pid,
    tp.process_name,
    tp.is_main_thread,
    tp.window_start_ts,
    tp.window_end_ts,
    tp.active_duration_ms,
    COALESCE(ca.cpu_time_ms, 0) AS cpu_time_ms,
    COALESCE(ca.switch_count, 0) AS switch_count,
    COALESCE(wa.wakeup_count, 0) AS wakeup_count,
    CASE
      WHEN LOWER(tp.thread_name) = 'main' OR tp.is_main_thread = 1 THEN 'main'
      WHEN LOWER(tp.thread_name) LIKE '%binder%' THEN 'binder'
      WHEN LOWER(tp.thread_name) LIKE '%render%' THEN 'render'
      WHEN LOWER(tp.thread_name) LIKE '%io%' THEN 'io'
      WHEN LOWER(tp.thread_name) LIKE '%net%' THEN 'network'
      WHEN LOWER(tp.thread_name) LIKE '%worker%' THEN 'worker'
      ELSE 'unknown'
    END AS thread_type,
    CASE
      WHEN tp.is_main_thread = 1 THEN '查看慢帧分析'
      WHEN COALESCE(ca.cpu_time_ms, 0) > 0 THEN '查看热点线程分析'
      WHEN COALESCE(wa.wakeup_count, 0) > 0 THEN '查看等待归因分析'
      ELSE '查看线程画像总览'
    END AS next_step
  FROM thread_profile tp
  LEFT JOIN cpu_agg ca ON tp.utid = ca.utid
  LEFT JOIN wakeup_agg wa ON tp.utid = wa.utid
)
SELECT *
FROM combined c
WHERE ((SELECT only_active FROM params) = 0 OR c.active_duration_ms > 0 OR c.cpu_time_ms > 0)
ORDER BY {{threadOrderBy}}
LIMIT (SELECT top_n FROM params);`,
  },
  {
    id: 'event-aggregate',
    name: '事件耗时聚合',
    description: '统计事件总耗时/均值/次数',
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
ORDER BY {{aggregateOrderBy}}
LIMIT 1000;`,
  },
  {
    id: 'process-list',
    name: '进程画像总览',
    description: '时间范围内的进程风险画像与分析入口',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns,
    CAST(MAX(1, {{topN}}) AS INT) AS top_n,
    CAST(MAX(0, {{onlyActive}}) AS INT) AS only_active,
    CAST({{pid}} AS INT) AS target_pid,
    CAST({{uid}} AS INT) AS target_uid
),
process_base AS (
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
  COALESCE(p.start_ts, 0) AS start_ts_ns,
  COALESCE(p.end_ts, 9223372036854775807) AS end_ts_ns,
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
  AND (ts.target_pid <= 0 OR COALESCE(p.pid, -1) = ts.target_pid)
  AND (ts.target_uid <= 0 OR COALESCE(p.uid, -1) = ts.target_uid)
  AND COALESCE(p.start_ts, 0) <= ts.end_ns
  AND COALESCE(p.end_ts, ts.end_ns) >= ts.start_ns
),
sched_agg AS (
  SELECT
    t.upid,
    ROUND(SUM(
      MAX(0, MIN(s.ts + COALESCE(s.dur, 0), x.end_ns) - MAX(s.ts, x.start_ns))
    ) / 1e6, 3) AS cpu_time_ms
  FROM sched s
  JOIN thread t ON s.utid = t.utid
  JOIN params x
  WHERE s.ts < x.end_ns
    AND (s.ts + COALESCE(s.dur, 0)) > x.start_ns
  GROUP BY t.upid
),
thread_agg AS (
  SELECT
    upid,
    COUNT(1) AS thread_count
  FROM thread
  GROUP BY upid
),
wait_top AS (
  SELECT
    sub.upid,
    sub.wait_type AS top_wait_type
  FROM (
    SELECT
      t.upid,
      CASE
        WHEN COALESCE(ts.io_wait, 0) = 1 OR LOWER(COALESCE(ts.blocked_function, '')) LIKE '%io%' THEN 'io'
        WHEN LOWER(COALESCE(ts.blocked_function, '')) LIKE '%futex%' THEN 'futex'
        WHEN LOWER(COALESCE(ts.blocked_function, '')) LIKE '%binder%' THEN 'binder'
        WHEN LOWER(COALESCE(ts.blocked_function, '')) LIKE '%lock%' OR LOWER(COALESCE(ts.blocked_function, '')) LIKE '%mutex%' THEN 'lock'
        ELSE 'schedule'
      END AS wait_type,
      COUNT(1) AS cnt,
      ROW_NUMBER() OVER (
        PARTITION BY t.upid
        ORDER BY COUNT(1) DESC
      ) AS rk
    FROM thread_state ts
    JOIN thread t ON ts.utid = t.utid
    JOIN params x
    WHERE ts.ts < x.end_ns
      AND (ts.ts + COALESCE(ts.dur, 0)) > x.start_ns
    GROUP BY t.upid, wait_type
  ) sub
  WHERE sub.rk = 1
),
process_profile AS (
  SELECT
    pb.*,
    COALESCE(sa.cpu_time_ms, 0) AS cpu_time_ms,
    COALESCE(ta.thread_count, 0) AS thread_count,
    0 AS slow_frame_count,
    COALESCE(wt.top_wait_type, 'schedule') AS top_wait_type
  FROM process_base pb
  LEFT JOIN sched_agg sa ON pb.upid = sa.upid
  LEFT JOIN thread_agg ta ON pb.upid = ta.upid
  LEFT JOIN wait_top wt ON pb.upid = wt.upid
),
scored AS (
  SELECT
    *,
    CASE
      WHEN cpu_time_ms > 0 THEN '查看热点线程分析'
      WHEN thread_count >= 60 THEN '查看线程画像总览'
      ELSE '查看慢帧分析'
    END AS next_step
  FROM process_profile
)
SELECT *
FROM scored s
WHERE ((SELECT only_active FROM params) = 0 OR s.active_in_window_sec > 0)
  AND ('{{statusFilter}}' = '' OR (
    ('{{statusFilter}}' = 'running' AND s.status = '运行中')
    OR ('{{statusFilter}}' = 'ended' AND s.status = '已结束')
  ))
ORDER BY {{processOrderBy}}
LIMIT (SELECT top_n FROM params);`,
  },
  {
    id: 'thread-blocked',
    name: '主线程阻塞总览',
    description: '验证主线程阻塞证据与唤醒链路',
    outputType: 'table',
    sqlTemplate: `WITH params AS (
  SELECT
    CAST({{startSec}} * 1e9 AS INT) AS start_ns,
    CAST({{endSec}} * 1e9 AS INT) AS end_ns
),
trace_window AS (
  SELECT start_ts AS trace_start_ns
  FROM trace_bounds
  LIMIT 1
),
main_thread_candidates AS (
  SELECT
    t.utid,
    t.tid,
    t.upid,
    COALESCE(t.name, printf('tid_%d', t.tid)) AS thread_name,
    -- 兼容说明：
    -- 1) 常见 Perfetto 版本可直接使用 t.is_main_thread
    -- 2) 若你的版本没有该字段，请将下面的 COALESCE(...) 改成:
    --    CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END
    COALESCE(t.is_main_thread, CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END) AS main_thread_score,
    CASE WHEN COALESCE(t.name, '') = 'main' THEN 1 ELSE 0 END AS main_name_score
  FROM thread t
  LEFT JOIN process p ON t.upid = p.upid
  WHERE COALESCE(p.name, '') = '{{process}}'
),
target_main_thread AS (
  SELECT utid, tid, upid, thread_name
  FROM main_thread_candidates
  ORDER BY main_thread_score DESC, main_name_score DESC, tid ASC
  LIMIT 1
),
blocked_events AS (
  SELECT
    ts.utid,
    ts.state,
    ts.ts AS blocked_start_ts_ns,
    COALESCE(ts.dur, 0) AS dur,
    ts.ts + COALESCE(ts.dur, 0) AS blocked_end_ts_ns,
    ts.waker_utid,
    COALESCE(ts.io_wait, 0) AS io_wait,
    COALESCE(ts.blocked_function, '') AS blocked_function
  FROM thread_state ts
  JOIN target_main_thread mt ON ts.utid = mt.utid
  JOIN params x
  WHERE ts.ts <= x.end_ns
    AND (ts.ts + COALESCE(ts.dur, 0)) >= x.start_ns
    AND COALESCE(ts.dur, 0) > 0
    AND COALESCE(ts.state, '') IN ('D', 'S', 'T', 't', 'X', 'x', 'K', 'W', 'I')
)
SELECT
  COALESCE(p.name, printf('pid_%d', p.pid)) AS process,
  mt.thread_name AS thread,
  mt.tid AS blocked_tid,
  b.utid AS blocked_utid,
  COALESCE(b.state, '') AS blocked_state,
  CASE
    WHEN COALESCE(b.state, '') = 'D' AND b.io_wait = 1 THEN 'uninterruptible sleep, io_wait'
    WHEN COALESCE(b.state, '') = 'D' THEN 'uninterruptible sleep'
    WHEN b.io_wait = 1 THEN 'io_wait'
    ELSE ''
  END AS blocked_reason,
  CASE
    WHEN COALESCE(b.state, '') = 'D' THEN 1
    WHEN b.io_wait = 1 THEN 1
    WHEN b.dur >= 7e6 THEN 1
    ELSE 0
  END AS suspicious_block_flag,
  ROUND((b.blocked_start_ts_ns - tw.trace_start_ns) / 1e9, 6) AS blocked_start_ts_sec,
  ROUND((b.blocked_end_ts_ns - tw.trace_start_ns) / 1e9, 6) AS blocked_end_ts_sec,
  ROUND(b.dur / 1e6, 3) AS blocked_dur_ms,
  b.io_wait AS io_wait_flag,
  b.blocked_function,
  wt.tid AS waker_tid,
  COALESCE(wt.name, '') AS waker_thread,
  COALESCE(wp.name, '') AS waker_process
FROM blocked_events b
JOIN target_main_thread mt ON b.utid = mt.utid
LEFT JOIN process p ON mt.upid = p.upid
LEFT JOIN trace_window tw
LEFT JOIN thread wt ON b.waker_utid = wt.utid
LEFT JOIN process wp ON wt.upid = wp.upid
WHERE COALESCE(p.name, '') = '{{process}}'
  AND (
    ({{suspiciousOnly}} = 1 AND (
      COALESCE(b.state, '') = 'D'
      OR b.io_wait = 1
      OR b.dur >= 7e6
    ))
    OR {{suspiciousOnly}} = 0
  )
ORDER BY b.dur DESC, b.blocked_start_ts_ns ASC
LIMIT 5000;`,
  },
];

export function buildSqlPreview(def: PluginDefinition, p: QueryParams): string {
  if (def.id === 'main-thread-stack-diff-analysis') {
    const sqlBase = buildStackDiffAggSql(p, Number(p.compareStartSec ?? 0), Number(p.compareEndSec ?? 0));
    const sqlTgt = buildStackDiffAggSql(p, Number(p.startSec), Number(p.endSec));
    return `-- 基线侧时间窗口聚合\n${sqlBase}\n\n-- 目标侧时间窗口聚合\n${sqlTgt}`;
  }
  const aggregateOrderBy = (() => {
    switch (p.aggregateOrder) {
      case 'total_desc':
        return 'total_dur_ms DESC, cnt DESC, s.name ASC';
      case 'count_desc':
        return 'cnt DESC, total_dur_ms DESC, s.name ASC';
      case 'avg_desc':
      default:
        return 'avg_dur_ms DESC, total_dur_ms DESC, s.name ASC';
    }
  })();
  const processOrderBy = (() => {
    switch (p.sortBy) {
      case 'cpu_time':
        return 's.cpu_time_ms DESC, s.thread_count DESC, s.upid ASC';
      case 'thread_count':
        return 's.thread_count DESC, s.cpu_time_ms DESC, s.upid ASC';
      case 'active_duration':
      default:
        return 's.active_in_window_sec DESC, s.cpu_time_ms DESC, s.thread_count DESC, s.upid ASC';
    }
  })();
  const threadOrderBy = (() => {
    switch (p.sortBy) {
      case 'active_duration':
        return 'c.active_duration_ms DESC, c.cpu_time_ms DESC, c.tid ASC';
      case 'switch_count':
        return 'c.switch_count DESC, c.cpu_time_ms DESC, c.tid ASC';
      case 'wakeup_count':
        return 'c.wakeup_count DESC, c.cpu_time_ms DESC, c.tid ASC';
      case 'cpu_time':
      default:
        return 'c.cpu_time_ms DESC, c.active_duration_ms DESC, c.tid ASC';
    }
  })();
  const diffOrderBy = (() => {
    switch (p.diffSortBy) {
      case 'calls_delta':
        return 'd.calls_delta DESC, d.cost_delta_ns DESC, d.stack_key ASC';
      case 'avg_delta':
        return 'avg_delta_ms DESC, d.cost_delta_ns DESC, d.stack_key ASC';
      case 'cost_delta':
      default:
        return 'd.cost_delta_ns DESC, d.calls_delta DESC, d.stack_key ASC';
    }
  })();

  return def.sqlTemplate
    .replaceAll('{{startSec}}', String(p.startSec))
    .replaceAll('{{endSec}}', String(p.endSec))
    .replaceAll('{{process}}', p.process ?? '')
    .replaceAll('{{thread}}', p.thread ?? '')
    .replaceAll('{{keyword}}', p.keyword ?? '')
    .replaceAll('{{pid}}', String(Math.max(0, Number(p.pid ?? 0))))
    .replaceAll('{{tid}}', String(Math.max(0, Number(p.tid ?? 0))))
    .replaceAll('{{topN}}', String(Math.max(1, Number(p.topN ?? 10))))
    .replaceAll('{{frameThresholdMs}}', String(Math.max(1, Number(p.frameThresholdMs ?? 16.6))))
    .replaceAll('{{slowFrameThresholdMs}}', String(Math.max(1, Number(p.slowFrameThresholdMs ?? 33))))
    .replaceAll('{{blockedThresholdMs}}', String(Math.max(1, Number(p.blockedThresholdMs ?? 5))))
    .replaceAll('{{waitTypeFilter}}', p.waitTypeFilter ?? '')
    .replaceAll('{{uid}}', String(Math.max(0, Number(p.uid ?? 0))))
    .replaceAll('{{statusFilter}}', p.statusFilter ?? '')
    .replaceAll('{{onlyActive}}', String(Math.max(0, Math.min(1, Number(p.onlyActive ?? 1)))))
    .replaceAll('{{processOrderBy}}', processOrderBy)
    .replaceAll('{{threadOrderBy}}', threadOrderBy)
    .replaceAll('{{onlyMainThread}}', String(Math.max(0, Math.min(1, Number(p.onlyMainThread ?? 0)))))
    .replaceAll('{{statLevel}}', p.statLevel === 'process' ? 'process' : 'thread')
    .replaceAll('{{aggregateOrderBy}}', aggregateOrderBy)
    .replaceAll('{{suspiciousOnly}}', String(Math.max(0, Math.min(1, Number(p.suspiciousOnly ?? 0)))))
    .replaceAll('{{bucketMs}}', String(Math.max(1, p.bucketMs ?? 1000)))
    .replaceAll('{{compareStartSec}}', String(Math.max(0, Number(p.compareStartSec ?? p.startSec))))
    .replaceAll('{{compareEndSec}}', String(Math.max(0, Number(p.compareEndSec ?? p.endSec))))
    .replaceAll('{{diffMinCalls}}', String(Math.max(0, Number(p.diffMinCalls ?? 1))))
    .replaceAll('{{diffMinCostMs}}', String(Math.max(0, Number(p.diffMinCostMs ?? 0.1))))
    .replaceAll('{{diffTopN}}', String(Math.max(1, Number(p.diffTopN ?? 30))))
    .replaceAll('{{diffOrderBy}}', diffOrderBy);
}

function buildStats(plugin: PluginDefinition, rows: Record<string, unknown>[]): QueryResult['stats'] {
  // 有专用可视化面板的插件不在此生成 stats，避免与 ResultsCard / ResultStatsRow 重复展示摘要
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
  // cpu-usage-analysis、thread-overview、main-thread-jank-analysis、wait-reason-analysis、
  // main-thread-stack-diff-analysis（线程堆栈 Diff）：摘要由各 *ResultPanel 内展示
  return undefined;
}

async function postQueryRows(sql: string, trace: 'primary' | 'baseline' = 'primary'): Promise<Record<string, unknown>[]> {
  const resp = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, trace }),
  });
  if (!resp.ok) {
    const msg = await resp.text();
    throw new Error(msg || 'SQL 查询失败');
  }
  return (await resp.json()) as Record<string, unknown>[];
}

export async function runPluginQuery(plugin: PluginDefinition, params: QueryParams): Promise<QueryResult> {
  if (plugin.id === 'main-thread-stack-diff-analysis') {
    const mode = params.stackDiffMode ?? 'single-trace';
    const baseTrace: 'primary' | 'baseline' = mode === 'dual-trace' ? 'baseline' : 'primary';
    const sqlBase = buildStackDiffAggSql(
      params,
      Number(params.compareStartSec ?? 0),
      Number(params.compareEndSec ?? 0),
    );
    const sqlTgt = buildStackDiffAggSql(params, Number(params.startSec), Number(params.endSec));
    const [rowsA, rowsB] = await Promise.all([
      postQueryRows(sqlBase, baseTrace),
      postQueryRows(sqlTgt, 'primary'),
    ]);
    const rows = mergeStackDiffAggRows(rowsA, rowsB, params);
    const sqlPreview = `-- 基线侧（${baseTrace === 'baseline' ? '基线 trace' : '主 trace'}）\n${sqlBase}\n\n-- 目标侧（主 trace）\n${sqlTgt}`;
    return {
      sqlPreview,
      rows,
      stats: buildStats(plugin, rows),
    };
  }

  const sqlPreview = buildSqlPreview(plugin, params);
  const rows = await postQueryRows(sqlPreview, 'primary');

  return {
    sqlPreview,
    rows,
    stats: buildStats(plugin, rows),
  };
}
