import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Card, Col, Empty, Input, Layout, Modal, Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography, Upload, Button, message } from 'antd';
import type { UploadProps } from 'antd';
import ReactECharts from 'echarts-for-react';
import { PLUGINS, runPluginQuery } from './lib/plugins';
import './App.css';
import {
  isAbsoluteTraceTimeColumn,
  mapRowsToRelativeTraceTimes,
  relativeTraceSecFractionDigits,
  roundRelativeSec,
  toRelativeTraceSecDisplay,
} from './lib/traceRelativeTime';
import type { PluginDefinition, QueryParams, QueryResult, TraceDataset } from './types';

const { Header, Sider, Content, Footer } = Layout;
const PLUGIN_DISPLAY_ORDER: PluginDefinition['id'][] = [
  'process-list',
  'thread-detail',
  'thread-trend',
  'thread-blocked',
  'event-aggregate',
];

/** 结果表列宽：总和用于 `scroll.x`，避免列多时被压到只看见前几列。 */
function getResultColumnWidth(key: string): number {
  if (key === 'cmdline') return 360;
  if (key === 'name' || key === 'process') return 180;
  if (key === 'status') return 96;
  if (key === 'active_in_window_sec') return 140;
  if (isAbsoluteTraceTimeColumn(key)) return 132;
  if (key === 'parent_upid' || key === 'arg_set_id' || key === 'android_appid' || key === 'uid') return 112;
  if (key === 'upid' || key === 'pid') return 88;
  return 108;
}

/** 进程列表：主表仅展示这些列，其余在悬停浮层中展示。 */
const PROCESS_LIST_TABLE_KEYS = ['pid', 'name', 'process', 'uid', 'status', 'window_start_sec', 'window_end_sec'] as const;
const THREAD_DETAIL_TABLE_KEYS = ['tid', 'name', 'upid', 'process', 'is_main_thread', 'start_ts', 'end_ts'] as const;

const PROCESS_LIST_EXTRA_KEY_ORDER = [
  'upid',
  'cmdline',
  'parent_upid',
  'android_appid',
  'arg_set_id',
  'active_in_window_sec',
  'start_ts_sec',
  'end_ts_sec',
];
const THREAD_DETAIL_EXTRA_KEY_ORDER = [
  'utid',
  'process_pid',
  'process_uid',
  'process_cmdline',
  'process_parent_upid',
  'process_android_appid',
  'process_arg_set_id',
];

function getProcessListColumnWidth(key: string): number {
  if (key === 'name' || key === 'process') return 160;
  if (key === 'status') return 88;
  if (key === 'window_start_sec' || key === 'window_end_sec' || key === 'start_ts_sec' || key === 'end_ts_sec') return 120;
  if (key === 'uid' || key === 'pid') return 88;
  return 100;
}

function getThreadDetailColumnWidth(key: string): number {
  if (key === 'name' || key === 'process') return 170;
  if (key === 'start_ts' || key === 'end_ts') return 120;
  if (key === 'is_main_thread') return 110;
  if (key === 'tid' || key === 'upid') return 88;
  return 100;
}

function formatDetailValue(key: string, value: unknown, traceStartSec: number): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'active_in_window_sec') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? `${n.toFixed(3)} s` : String(value);
  }
  if (key === 'is_main_thread') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? (n ? '1 (main)' : '0') : String(value);
  }
  if (isAbsoluteTraceTimeColumn(key)) {
    return `${toRelativeTraceSecDisplay(value, traceStartSec, relativeTraceSecFractionDigits(key))} s`;
  }
  return String(value);
}

function formatThreadRelativeSecFromNs(value: unknown, traceStartSec: number): string {
  if (value === null || value === undefined || value === '') return '';
  const ns = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(ns)) return String(value);
  return roundRelativeSec(ns / 1e9 - traceStartSec, 3).toFixed(3);
}

function createDefaultParams(defaultEndSec: number): QueryParams {
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

function ParamField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="param-field">
      <Typography.Text className="param-field-label">{label}</Typography.Text>
      <div className="param-field-control">{children}</div>
    </div>
  );
}

function App() {
  const [dataset, setDataset] = useState<TraceDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [globalProcess, setGlobalProcess] = useState('');
  const [activePluginId, setActivePluginId] = useState<PluginDefinition['id']>('process-list');
  const [paramsByPlugin, setParamsByPlugin] = useState<Record<PluginDefinition['id'], QueryParams>>(() =>
    Object.fromEntries(
      PLUGINS.map((p) => [p.id, createDefaultParams(10)]),
    ) as Record<PluginDefinition['id'], QueryParams>,
  );
  const [resultByPlugin, setResultByPlugin] = useState<Partial<Record<PluginDefinition['id'], QueryResult>>>({});
  const [running, setRunning] = useState(false);
  const [trendCompareRange, setTrendCompareRange] = useState<{ t1?: number; t2?: number }>({});
  const [trendDiffRunning, setTrendDiffRunning] = useState(false);
  const [trendDiffRows, setTrendDiffRows] = useState<Record<string, unknown>[]>([]);
  const [trendDiffCompared, setTrendDiffCompared] = useState(false);
  const [trendDiffModalOpen, setTrendDiffModalOpen] = useState(false);
  const traceStartSec = dataset?.summary.timeRange[0] ?? 0;
  const traceEndSec = dataset?.summary.timeRange[1] ?? 0;
  const traceDurationSec = Math.max(0, traceEndSec - traceStartSec);

  const activePlugin = useMemo(() => PLUGINS.find((p) => p.id === activePluginId)!, [activePluginId]);
  const orderedPlugins = useMemo(() => {
    const rank = new Map(PLUGIN_DISPLAY_ORDER.map((id, idx) => [id, idx]));
    return [...PLUGINS].sort((a, b) => {
      const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, []);
  const isThreadTrend = activePlugin.id === 'thread-trend';
  const isThreadBlocked = activePlugin.id === 'thread-blocked';
  const isEventAggregate = activePlugin.id === 'event-aggregate';
  const activeParams = paramsByPlugin[activePluginId] ?? createDefaultParams(10);
  const activeResult = resultByPlugin[activePluginId] ?? null;
  const processOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.processes.map((p) => ({ label: p, value: p }));
  }, [dataset]);
  const paramFields = useMemo(
    () => {
      type ParamFieldConfig = {
        key: string;
        label: string;
        visible: boolean;
        control: ReactNode;
      };

      const fields: ParamFieldConfig[] = [
        {
          key: 'startSec',
          label: '开始(s)',
          visible: true,
          control: (
            <Input
              type="number"
              value={activeParams.startSec}
              onChange={(e) => setActiveParams((p) => ({ ...p, startSec: Number(e.target.value) }))}
            />
          ),
        },
        {
          key: 'endSec',
          label: '结束(s)',
          visible: true,
          control: (
            <Input
              type="number"
              value={activeParams.endSec}
              onChange={(e) => setActiveParams((p) => ({ ...p, endSec: Number(e.target.value) }))}
              max={traceDurationSec || undefined}
            />
          ),
        },
        {
          key: 'process',
          label: '进程',
          visible: true,
          control: (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部进程"
              style={{ width: '100%' }}
              options={processOptions}
              value={(globalProcess || activeParams.process) || undefined}
              onChange={(v) => setActiveParams((p) => ({ ...p, process: v ?? '' }))}
            />
          ),
        },
        {
          key: 'keyword',
          label: '事件关键字',
          visible: isEventAggregate,
          control: (
            <Input
              placeholder="如: methodA"
              value={activeParams.keyword}
              onChange={(e) => setActiveParams((p) => ({ ...p, keyword: e.target.value }))}
            />
          ),
        },
        {
          key: 'aggregateOrder',
          label: '排序规则',
          visible: isEventAggregate,
          control: (
            <Select
              style={{ width: '100%' }}
              value={activeParams.aggregateOrder ?? 'avg_desc'}
              onChange={(v) => setActiveParams((p) => ({
                ...p,
                aggregateOrder: v as QueryParams['aggregateOrder'],
              }))}
              options={[
                { label: '按平均耗时', value: 'avg_desc' },
                { label: '按总耗时', value: 'total_desc' },
                { label: '按调用次数', value: 'count_desc' },
              ]}
            />
          ),
        },
        {
          key: 'bucketMs',
          label: '分桶(ms)',
          visible: isThreadTrend,
          control: (
            <Input
              type="number"
              value={activeParams.bucketMs}
              onChange={(e) => setActiveParams((p) => ({ ...p, bucketMs: Number(e.target.value) }))}
            />
          ),
        },
        {
          key: 'suspiciousOnly',
          label: '疑似阻塞过滤',
          visible: isThreadBlocked,
          control: (
            <div className="param-switch-wrap">
              <Switch
                checked={(activeParams.suspiciousOnly ?? 1) === 1}
                onChange={(checked) => setActiveParams((p) => ({ ...p, suspiciousOnly: checked ? 1 : 0 }))}
              />
            </div>
          ),
        },
      ];

      return fields.filter((f) => f.visible);
    },
    [activeParams, globalProcess, isEventAggregate, isThreadBlocked, isThreadTrend, processOptions, traceDurationSec],
  );

  const [processListHover, setProcessListHover] = useState<{
    record: Record<string, unknown>;
    x: number;
    y: number;
  } | null>(null);
  const processListLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelProcessListHide = () => {
    if (processListLeaveTimerRef.current) {
      clearTimeout(processListLeaveTimerRef.current);
      processListLeaveTimerRef.current = null;
    }
  };

  const scheduleProcessListHide = () => {
    cancelProcessListHide();
    processListLeaveTimerRef.current = setTimeout(() => {
      setProcessListHover(null);
      processListLeaveTimerRef.current = null;
    }, 200);
  };

  useEffect(() => {
    cancelProcessListHide();
    setProcessListHover(null);
  }, [activePluginId, activeResult]);

  useEffect(() => () => cancelProcessListHide(), []);

  const uploadProps: UploadProps = {
    showUploadList: false,
    maxCount: 1,
    beforeUpload: async (file) => {
      setLoading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const resp = await fetch('/api/trace/import', { method: 'POST', body: form });
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const parsed = (await resp.json()) as TraceDataset;
        setDataset(parsed);
        setGlobalProcess('');
        const relativeEndSec = Number((parsed.summary.timeRange[1] - parsed.summary.timeRange[0]).toFixed(3));
        setResultByPlugin({});
        setParamsByPlugin(
          Object.fromEntries(
            PLUGINS.map((p) => [p.id, createDefaultParams(relativeEndSec)]),
          ) as Record<PluginDefinition['id'], QueryParams>,
        );
        message.success(`已导入 trace: ${file.name}`);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        const hint = text.includes('Failed to fetch') || text.includes('ECONNREFUSED')
          ? '后端服务未启动，请先执行 npm run server'
          : text;
        message.error(`导入失败: ${hint}`);
      } finally {
        setLoading(false);
      }
      return false;
    },
  };

  const setActiveParams = (updater: (p: QueryParams) => QueryParams) => {
    setParamsByPlugin((prev) => ({
      ...prev,
      [activePluginId]: updater(prev[activePluginId] ?? createDefaultParams(traceDurationSec || 10)),
    }));
  };

  const onRun = async () => {
    if (!dataset) {
      message.warning('请先导入 trace 文件');
      return;
    }
    setRunning(true);
    try {
      const absParams: QueryParams = {
        ...activeParams,
        process: globalProcess || activeParams.process,
        startSec: activeParams.startSec + traceStartSec,
        endSec: activeParams.endSec + traceStartSec,
      };
      const r = await runPluginQuery(activePlugin, absParams);
      setResultByPlugin((prev) => ({ ...prev, [activePluginId]: r }));
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      const hint = text.includes('Failed to fetch') || text.includes('ECONNREFUSED')
        ? '后端服务未启动，请先执行 npm run server'
        : text;
      message.error(`查询失败: ${hint}`);
    } finally {
      setRunning(false);
    }
  };

  const trendTimePointOptions = useMemo(() => {
    if (activePlugin.id !== 'thread-trend' || !activeResult?.rows?.length) return [];
    return activeResult.rows.map((r) => {
      const absSec = Number(r.bucket_ts_sec ?? 0);
      const relSec = roundRelativeSec(absSec - traceStartSec, 3);
      const label = `${relSec.toFixed(3)}s`;
      return { label, value: absSec };
    });
  }, [activePlugin.id, activeResult?.rows, traceStartSec]);

  const onCompareThreadTrend = async () => {
    const t1Abs = trendCompareRange.t1;
    const t2Abs = trendCompareRange.t2;
    if (activePlugin.id !== 'thread-trend') return;
    if (t1Abs === undefined || t2Abs === undefined) {
      message.warning('请先选择 t1 和 t2');
      return;
    }
    const t1 = Math.min(t1Abs, t2Abs);
    const t2 = Math.max(t1Abs, t2Abs);
    const processFilter = globalProcess || activeParams.process || '';
    const threadFilter = activeParams.thread || '';
    const esc = (s: string) => s.replaceAll("'", "''");
    const sql = `WITH params AS (
  SELECT
    CAST(${t1} * 1e9 AS INT) AS t1_ns,
    CAST(${t2} * 1e9 AS INT) AS t2_ns
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
    setTrendDiffRunning(true);
    setTrendDiffCompared(false);
    try {
      const resp = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      const rows = (await resp.json()) as Record<string, unknown>[];
      setTrendDiffRows(rows);
      setTrendDiffCompared(true);
      setTrendDiffModalOpen(true);
      message.success(`线程变化对比完成，共 ${rows.length} 条`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      message.error(`对比失败: ${text}`);
    } finally {
      setTrendDiffRunning(false);
    }
  };

  const trendOpenedRows = useMemo(
    () => trendDiffRows.filter((r) => String(r.change_type) === 'opened'),
    [trendDiffRows],
  );
  const trendClosedRows = useMemo(
    () => trendDiffRows.filter((r) => String(r.change_type) === 'closed'),
    [trendDiffRows],
  );

  const { tableColumns, tableScrollX } = useMemo(() => {
    if (!activeResult?.rows?.length) return { tableColumns: [], tableScrollX: 0 };
    const row0 = activeResult.rows[0] as Record<string, unknown>;

    if (activePluginId === 'process-list') {
      const keys = (PROCESS_LIST_TABLE_KEYS as readonly string[]).filter((k) =>
        Object.prototype.hasOwnProperty.call(row0, k),
      );
      const scrollX = Math.max(640, keys.reduce((acc, k) => acc + getProcessListColumnWidth(k), 0));
      const cols = keys.map((k) => ({
        title: k,
        dataIndex: k,
        key: k,
        width: getProcessListColumnWidth(k),
        ellipsis: true as const,
        render: isAbsoluteTraceTimeColumn(k)
          ? (v: unknown) => toRelativeTraceSecDisplay(v, traceStartSec, relativeTraceSecFractionDigits(k))
          : undefined,
      }));
      return { tableColumns: cols, tableScrollX: scrollX };
    }
    if (activePluginId === 'thread-detail') {
      const keys = (THREAD_DETAIL_TABLE_KEYS as readonly string[]).filter((k) =>
        Object.prototype.hasOwnProperty.call(row0, k),
      );
      const scrollX = Math.max(640, keys.reduce((acc, k) => acc + getThreadDetailColumnWidth(k), 0));
      const cols = keys.map((k) => ({
        title: k,
        dataIndex: k,
        key: k,
        width: getThreadDetailColumnWidth(k),
        ellipsis: true as const,
        render: (k === 'start_ts' || k === 'end_ts')
          ? (v: unknown) => formatThreadRelativeSecFromNs(v, traceStartSec)
          : isAbsoluteTraceTimeColumn(k)
            ? (v: unknown) => toRelativeTraceSecDisplay(v, traceStartSec, relativeTraceSecFractionDigits(k))
          : k === 'is_main_thread'
            ? (v: unknown) => {
                const n = typeof v === 'number' ? v : Number(v);
                return Number.isFinite(n) ? (n ? '1 (main)' : '0') : String(v ?? '');
              }
            : undefined,
      }));
      return { tableColumns: cols, tableScrollX: scrollX };
    }

    const keys = Object.keys(row0);
    const scrollX = Math.max(720, keys.reduce((acc, k) => acc + getResultColumnWidth(k), 0));
    const cols = keys.map((k) => ({
      title: isAbsoluteTraceTimeColumn(k) ? `${k} (rel s)` : k,
      dataIndex: k,
      key: k,
      width: getResultColumnWidth(k),
      ellipsis: true as const,
      render:
        k === 'active_in_window_sec'
          ? (v: unknown) => {
              const n = typeof v === 'number' ? v : Number(v);
              return Number.isFinite(n) ? n.toFixed(3) : String(v ?? '');
            }
          : isAbsoluteTraceTimeColumn(k)
            ? (v: unknown) => toRelativeTraceSecDisplay(v, traceStartSec, relativeTraceSecFractionDigits(k))
            : undefined,
    }));
    return { tableColumns: cols, tableScrollX: scrollX };
  }, [activeResult, traceStartSec, activePluginId]);

  const tableRowKey = (record: Record<string, unknown>, index?: number) => {
    const i = index ?? 0;
    const id = record.upid ?? record.pid ?? record.ts_sec ?? record.bucket_ts_sec ?? i;
    return `${i}-${String(id)}`;
  };

  const lineOption = useMemo(() => {
    if (!activeResult?.rows?.length || activePlugin.id !== 'thread-trend') return null;
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        name: 'Relative time (s)',
        data: activeResult.rows.map((r) => roundRelativeSec(Number(r.bucket_ts_sec) - traceStartSec, 3).toFixed(3)),
      },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, data: activeResult.rows.map((r) => Number(r.thread_count ?? 0)) }],
      grid: { left: 32, right: 24, top: 20, bottom: 32 },
    };
  }, [activeResult, activePlugin.id, traceStartSec]);


  const rawRowsJson = useMemo(() => {
    const rows = activeResult?.rows ?? [];
    if (!rows.length) return '[]';
    return JSON.stringify(mapRowsToRelativeTraceTimes(rows, traceStartSec), null, 2);
  }, [activeResult?.rows, traceStartSec]);

  const listSummaryText = useMemo(() => {
    if (activePlugin.id !== 'process-list' && activePlugin.id !== 'thread-detail') return null;
    if (!activeResult) return null;
    const p = globalProcess || activeParams.process || '全部进程';
    const t = activePlugin.id === 'thread-detail' ? (activeParams.thread || '全部线程') : '';
    const timeRange = `${activeParams.startSec.toFixed(3)}s ~ ${activeParams.endSec.toFixed(3)}s`;
    const count = activeResult.rows.length;
    if (activePlugin.id === 'thread-detail') {
      return `筛选条件：时间=${timeRange}，进程=${p}，线程=${t}；共计 ${count} 条结果。`;
    }
    return `筛选条件：时间=${timeRange}，进程=${p}；共计 ${count} 条结果。`;
  }, [activePlugin.id, activeResult, activeParams.endSec, activeParams.process, activeParams.startSec, activeParams.thread, globalProcess]);

  const blockedSuspiciousRuleText = useMemo(() => {
    if (activePlugin.id !== 'thread-blocked') return null;
    if ((activeParams.suspiciousOnly ?? 1) === 1) {
      return '疑似阻塞口径：满足任一条件（blocked_state=D / io_wait_flag=1 / blocked_dur_ms>=7）即展示。';
    }
    return '完整输出口径：展示主线程全部 blocked/sleeping 事件（不做时长过滤），用于全量排查。';
  }, [activePlugin.id, activeParams.suspiciousOnly]);

  const processListHoverPortal =
    processListHover && (activePlugin.id === 'process-list' || activePlugin.id === 'thread-detail')
      ? (() => {
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
          const panelW = Math.min(560, vw - 24);
          const panelH = 360;
          const left = Math.max(8, Math.min(processListHover.x, vw - panelW - 8));
          const top = Math.max(8, Math.min(processListHover.y, vh - panelH - 8));
          const mainTableKeys = activePlugin.id === 'process-list'
            ? (PROCESS_LIST_TABLE_KEYS as readonly string[])
            : (THREAD_DETAIL_TABLE_KEYS as readonly string[]);
          const extraOrder = activePlugin.id === 'process-list'
            ? PROCESS_LIST_EXTRA_KEY_ORDER
            : THREAD_DETAIL_EXTRA_KEY_ORDER;
          const extraRows = Object.entries(processListHover.record)
            .filter(([k]) => !mainTableKeys.includes(k))
            .sort((a, b) => {
              const ia = extraOrder.indexOf(a[0]);
              const ib = extraOrder.indexOf(b[0]);
              const ra = ia === -1 ? 1000 + a[0].charCodeAt(0) : ia;
              const rb = ib === -1 ? 1000 + b[0].charCodeAt(0) : ib;
              return ra - rb || a[0].localeCompare(b[0]);
            });
          return createPortal(
            <div
              role="tooltip"
              style={{
                position: 'fixed',
                left,
                top,
                zIndex: 2000,
                width: panelW,
                maxHeight: panelH,
                overflow: 'auto',
                pointerEvents: 'auto',
                boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
                borderRadius: 8,
              }}
              onMouseEnter={cancelProcessListHide}
              onMouseLeave={scheduleProcessListHide}
            >
              <Card size="small" title="More fields" styles={{ body: { padding: 12 } }}>
                {extraRows.length ? (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {extraRows.map(([k, v]) => {
                      const display = formatDetailValue(k, v, traceStartSec);
                      const longRaw = typeof v === 'string' && String(v).length > 80;
                      return (
                        <div
                          key={k}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            minWidth: 0,
                            width: '100%',
                          }}
                        >
                          <Typography.Text
                            strong
                            ellipsis={{ tooltip: k }}
                            style={{ width: 200, flexShrink: 0, margin: 0 }}
                          >
                            {k}
                          </Typography.Text>
                          <Typography.Text
                            ellipsis={{ tooltip: display }}
                            copyable={longRaw ? { text: String(v) } : false}
                            style={{ flex: 1, minWidth: 0, margin: 0 }}
                          >
                            {display}
                          </Typography.Text>
                        </div>
                      );
                    })}
                  </Space>
                ) : (
                  <Typography.Text type="secondary">No more fields</Typography.Text>
                )}
              </Card>
            </div>,
            document.body,
          );
        })()
      : null;

  const processListTableOnRow =
    (activePlugin.id === 'process-list' || activePlugin.id === 'thread-detail')
      ? (record: Record<string, unknown>) => ({
          onMouseEnter: (e: { clientX: number; clientY: number }) => {
            cancelProcessListHide();
            setProcessListHover({ record, x: e.clientX + 10, y: e.clientY + 10 });
          },
          onMouseMove: (e: { clientX: number; clientY: number }) => {
            setProcessListHover((prev) =>
              prev?.record === record ? { record, x: e.clientX + 10, y: e.clientY + 10 } : prev,
            );
          },
          onMouseLeave: scheduleProcessListHide,
        })
      : undefined;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>Perfetto SQL 可视化工具</Typography.Title>
        <Space size={10}>
          <Upload {...uploadProps}>
            <Button
              loading={loading}
              type="primary"
              style={{
                background: '#1677ff',
                borderColor: '#1677ff',
                color: '#fff',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(22,119,255,0.35)',
              }}
            >
              导入 Trace 文件
            </Button>
          </Upload>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="全局进程(可选)"
            style={{ width: 260 }}
            options={processOptions}
            value={globalProcess || undefined}
            onChange={(v) => setGlobalProcess(v ?? '')}
          />
        </Space>
      </Header>
      <Layout>
        <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: 12 }}>
          <Typography.Title level={5}>内置插件</Typography.Title>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {orderedPlugins.map((p) => (
              <Card key={p.id} size="small" hoverable onClick={() => setActivePluginId(p.id)} style={{ borderColor: p.id === activePluginId ? '#1677ff' : undefined }}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                    <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
                      {p.name}
                    </Typography.Text>
                    <Tag color="blue" style={{ marginInlineEnd: 0, flexShrink: 0 }}>{p.outputType}</Tag>
                  </div>
                  <Typography.Text
                    type="secondary"
                    ellipsis={{ tooltip: p.description }}
                    style={{ display: 'block' }}
                  >
                    {p.description}
                  </Typography.Text>
                </Space>
              </Card>
            ))}
          </Space>
        </Sider>
        <Content style={{ padding: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {dataset ? (
              <Row gutter={[12, 20]}>
                <Col span={6}><Statistic title="Trace 名称" value={dataset.summary.traceName} /></Col>
                <Col span={6}><Statistic title="时间范围(相对s)" value={`0.00 - ${traceDurationSec.toFixed(2)}`} /></Col>
                <Col span={4}><Statistic title="进程数" value={dataset.summary.processCount} /></Col>
                <Col span={4}><Statistic title="线程数" value={dataset.summary.threadCount} /></Col>
                <Col span={4}><Statistic title="记录数" value={dataset.summary.recordCount} /></Col>
              </Row>
            ) : <Empty description="请先导入 trace 文件" />}

            <Card title={`参数配置 - ${activePlugin.name}`}>
              <div className="plugin-param-grid">
                {paramFields.map((field) => (
                  <ParamField key={field.key} label={field.label}>
                    {field.control}
                  </ParamField>
                ))}
              </div>
              <div className="plugin-param-actions">
                <Button type="primary" loading={running} onClick={onRun}>运行</Button>
              </div>
              {isThreadTrend && (
                <Row style={{ marginTop: 12 }} gutter={12}>
                  <Col span={8}>
                    <Select
                      placeholder="选择 t1"
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      options={trendTimePointOptions}
                      value={trendCompareRange.t1}
                      onChange={(v) => setTrendCompareRange((prev) => ({ ...prev, t1: v }))}
                    />
                  </Col>
                  <Col span={8}>
                    <Select
                      placeholder="选择 t2"
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      options={trendTimePointOptions}
                      value={trendCompareRange.t2}
                      onChange={(v) => setTrendCompareRange((prev) => ({ ...prev, t2: v }))}
                    />
                  </Col>
                  <Col span={8}>
                    <Button block loading={trendDiffRunning} onClick={onCompareThreadTrend}>
                      对比线程变化
                    </Button>
                  </Col>
                </Row>
              )}
            </Card>

            <Card title="结果">
              {activeResult?.stats?.length ? (
                <Row gutter={12} style={{ marginBottom: 12 }}>
                  {activeResult.stats.map((s) => <Col key={s.label} span={6}><Card size="small"><Statistic title={s.label} value={s.value} /></Card></Col>)}
                </Row>
              ) : null}
              {blockedSuspiciousRuleText ? (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {blockedSuspiciousRuleText}
                </Typography.Text>
              ) : null}
              {listSummaryText ? (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {listSummaryText}
                </Typography.Text>
              ) : null}
              <Tabs items={[
                {
                  key: 'viz',
                  label: '可视化结果',
                  children: activePlugin.id === 'thread-trend' && lineOption ? (
                    <ReactECharts option={lineOption} style={{ height: 320 }} />
                  ) : (
                    <Table<Record<string, unknown>>
                      rowKey={tableRowKey}
                      size="small"
                      sticky
                      tableLayout="fixed"
                      scroll={tableScrollX ? { x: tableScrollX } : undefined}
                      columns={tableColumns}
                      dataSource={activeResult?.rows ?? []}
                      pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
                      onRow={processListTableOnRow}
                    />
                  ),
                },
                {
                  key: 'sql',
                  label: 'SQL 预览',
                  children: <pre style={{ margin: 0, background: '#0b1020', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>{activeResult?.sqlPreview ?? '--'}</pre>,
                },
                {
                  key: 'raw',
                  label: '原始数据',
                  children: <pre style={{ margin: 0, background: '#f6f8fa', padding: 12, borderRadius: 8, maxHeight: 320, overflow: 'auto' }}>{rawRowsJson}</pre>,
                },
              ]} />
              {activePlugin.id === 'thread-trend' && trendDiffCompared ? (
                <Card size="small" style={{ marginTop: 12 }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text type="secondary">
                      t1→t2 已完成对比：新开 {trendOpenedRows.length}，关闭 {trendClosedRows.length}
                    </Typography.Text>
                    <Button onClick={() => setTrendDiffModalOpen(true)}>查看线程变化详情</Button>
                  </Space>
                </Card>
              ) : null}
            </Card>
          </Space>
        </Content>
      </Layout>
      <Modal
        title={`t1→t2 线程变化详情（新开 ${trendOpenedRows.length}，关闭 ${trendClosedRows.length}）`}
        open={trendDiffModalOpen}
        onCancel={() => setTrendDiffModalOpen(false)}
        footer={null}
        width={1100}
        destroyOnClose
      >
        <Row gutter={12}>
          <Col span={12}>
            <Card size="small" title={`新开线程 (${trendOpenedRows.length})`} style={{ borderColor: '#d1fae5' }}>
              <Table<Record<string, unknown>>
                rowKey={(r, i) => `opened-${String(r.utid)}-${i ?? 0}`}
                size="small"
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: '无新开线程' }}
                columns={[
                  { title: 'utid', dataIndex: 'utid', key: 'utid', width: 100 },
                  { title: 'tid', dataIndex: 'tid', key: 'tid', width: 100 },
                  { title: 'thread', dataIndex: 'thread', key: 'thread' },
                  { title: 'process', dataIndex: 'process', key: 'process' },
                ]}
                dataSource={trendOpenedRows}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title={`关闭线程 (${trendClosedRows.length})`} style={{ borderColor: '#fee2e2' }}>
              <Table<Record<string, unknown>>
                rowKey={(r, i) => `closed-${String(r.utid)}-${i ?? 0}`}
                size="small"
                pagination={{ pageSize: 20 }}
                locale={{ emptyText: '无关闭线程' }}
                columns={[
                  { title: 'utid', dataIndex: 'utid', key: 'utid', width: 100 },
                  { title: 'tid', dataIndex: 'tid', key: 'tid', width: 100 },
                  { title: 'thread', dataIndex: 'thread', key: 'thread' },
                  { title: 'process', dataIndex: 'process', key: 'process' },
                ]}
                dataSource={trendClosedRows}
              />
            </Card>
          </Col>
        </Row>
      </Modal>
      <Footer style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '10px 24px' }}>
        Copyright © {new Date().getFullYear()} rengao
      </Footer>
      {processListHoverPortal}
    </Layout>
  );
}

export default App;
