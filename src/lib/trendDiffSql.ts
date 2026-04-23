export function buildTrendDiffSql(params: {
  t1Sec: number;
  t2Sec: number;
  processFilter: string;
  threadFilter: string;
}) {
  const esc = (s: string) => s.replaceAll("'", "''");
  const { t1Sec, t2Sec, processFilter, threadFilter } = params;

  return `WITH params AS (
  SELECT
    CAST(${t1Sec} * 1e9 AS INT) AS t1_ns,
    CAST(${t2Sec} * 1e9 AS INT) AS t2_ns
),
active_t1 AS (
  SELECT
    t.utid,
    t.tid,
    COALESCE(t.name, printf('tid_%d', t.tid)) AS thread,
    COALESCE(p.name, printf('pid_%d', p.pid)) AS process
  FROM thread t
  LEFT JOIN process p ON t.upid = p.upid
  JOIN params x
  WHERE t.utid IS NOT NULL
    AND ('${esc(processFilter)}' = '' OR COALESCE(p.name, '') = '${esc(processFilter)}')
    AND COALESCE(t.name, '') LIKE '%${esc(threadFilter)}%'
    AND COALESCE(t.start_ts, -9223372036854775808) <= x.t1_ns
    AND COALESCE(t.end_ts, 9223372036854775807) >= x.t1_ns
),
active_t2 AS (
  SELECT
    t.utid,
    t.tid,
    COALESCE(t.name, printf('tid_%d', t.tid)) AS thread,
    COALESCE(p.name, printf('pid_%d', p.pid)) AS process
  FROM thread t
  LEFT JOIN process p ON t.upid = p.upid
  JOIN params x
  WHERE t.utid IS NOT NULL
    AND ('${esc(processFilter)}' = '' OR COALESCE(p.name, '') = '${esc(processFilter)}')
    AND COALESCE(t.name, '') LIKE '%${esc(threadFilter)}%'
    AND COALESCE(t.start_ts, -9223372036854775808) <= x.t2_ns
    AND COALESCE(t.end_ts, 9223372036854775807) >= x.t2_ns
)
SELECT
  'closed' AS change_type,
  a1.utid,
  a1.tid,
  a1.thread,
  a1.process
FROM active_t1 a1
LEFT JOIN active_t2 a2 ON a1.utid = a2.utid
WHERE a2.utid IS NULL
UNION ALL
SELECT
  'opened' AS change_type,
  a2.utid,
  a2.tid,
  a2.thread,
  a2.process
FROM active_t2 a2
LEFT JOIN active_t1 a1 ON a2.utid = a1.utid
WHERE a1.utid IS NULL
ORDER BY 1 ASC, 3 ASC;`;
}
