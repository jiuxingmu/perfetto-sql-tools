import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout, Space } from 'antd';
import { PLUGINS } from './lib/plugins';
import './App.css';
import { AppHeader } from './components/AppHeader';
import { ParamsCard } from './components/ParamsCard';
import { ProcessDetailHoverPortal } from './components/ProcessDetailHoverPortal';
import { PluginSidebar } from './components/PluginSidebar';
import { ResultsCard } from './components/ResultsCard';
import { TraceOverview } from './components/TraceOverview';
import { TrendDiffModal } from './components/TrendDiffModal';
import { useParamFields } from './hooks/useParamFields';
import { useRunPluginQuery } from './hooks/useRunPluginQuery';
import { useTraceImport } from './hooks/useTraceImport';
import { useTrendDiff } from './hooks/useTrendDiff';
import {
  mapRowsToRelativeTraceTimes,
  roundRelativeSec,
} from './lib/traceRelativeTime';
import { buildTablePresentation } from './lib/resultPresentation';
import type { PluginDefinition, QueryParams, QueryResult, TraceDataset } from './types';

const { Content, Footer } = Layout;
const PLUGIN_DISPLAY_ORDER: PluginDefinition['id'][] = [
  'process-list',
  'thread-detail',
  'thread-trend',
  'thread-blocked',
  'event-aggregate',
];

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

function App() {
  const [dataset, setDataset] = useState<TraceDataset | null>(null);
  const [globalProcess, setGlobalProcess] = useState('');
  const [activePluginId, setActivePluginId] = useState<PluginDefinition['id']>('process-list');
  const [paramsByPlugin, setParamsByPlugin] = useState<Record<PluginDefinition['id'], QueryParams>>(() =>
    Object.fromEntries(
      PLUGINS.map((p) => [p.id, createDefaultParams(10)]),
    ) as Record<PluginDefinition['id'], QueryParams>,
  );
  const [resultByPlugin, setResultByPlugin] = useState<Partial<Record<PluginDefinition['id'], QueryResult>>>({});
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

  const setActiveParams = (updater: (p: QueryParams) => QueryParams) => {
    setParamsByPlugin((prev) => ({
      ...prev,
      [activePluginId]: updater(prev[activePluginId] ?? createDefaultParams(traceDurationSec || 10)),
    }));
  };
  const paramFields = useParamFields({
    activeParams,
    processOptions,
    globalProcess,
    isEventAggregate,
    isThreadTrend,
    isThreadBlocked,
    traceDurationSec,
    setActiveParams,
  });
  const { loading, uploadProps } = useTraceImport({
    createDefaultParams,
    setDataset,
    setGlobalProcess,
    setResultByPlugin,
    setParamsByPlugin,
  });
  const { running, onRun } = useRunPluginQuery({
    dataset,
    activePlugin,
    activePluginId,
    activeParams,
    globalProcess,
    traceStartSec,
    setResultByPlugin,
  });
  const {
    trendCompareRange,
    setTrendCompareRange,
    trendDiffRunning,
    trendDiffCompared,
    trendDiffModalOpen,
    setTrendDiffModalOpen,
    trendTimePointOptions,
    onCompareThreadTrend,
    trendOpenedRows,
    trendClosedRows,
  } = useTrendDiff({
    activePlugin,
    activeResult,
    traceStartSec,
    globalProcess,
    activeParams,
  });

  const { tableColumns, tableScrollX } = useMemo(
    () => buildTablePresentation(activePluginId, activeResult?.rows, traceStartSec),
    [activeResult?.rows, traceStartSec, activePluginId],
  );

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
      <AppHeader
        loading={loading}
        uploadProps={uploadProps}
        processOptions={processOptions}
        globalProcess={globalProcess}
        onChangeGlobalProcess={setGlobalProcess}
      />
      <Layout>
        <PluginSidebar
          orderedPlugins={orderedPlugins}
          activePluginId={activePluginId}
          onSelectPlugin={setActivePluginId}
        />
        <Content style={{ padding: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <TraceOverview dataset={dataset} traceDurationSec={traceDurationSec} />

            <ParamsCard
              activePluginName={activePlugin.name}
              paramFields={paramFields}
              running={running}
              onRun={onRun}
              isThreadTrend={isThreadTrend}
              trendCompareRange={trendCompareRange}
              trendTimePointOptions={trendTimePointOptions}
              trendDiffRunning={trendDiffRunning}
              onChangeTrendRange={setTrendCompareRange}
              onCompareThreadTrend={onCompareThreadTrend}
            />

            <ResultsCard
              activePlugin={activePlugin}
              activeResult={activeResult}
              blockedSuspiciousRuleText={blockedSuspiciousRuleText}
              listSummaryText={listSummaryText}
              lineOption={lineOption as Record<string, unknown> | null}
              tableColumns={tableColumns as Array<Record<string, unknown>>}
              tableScrollX={tableScrollX}
              tableRowKey={tableRowKey}
              processListTableOnRow={processListTableOnRow}
              rawRowsJson={rawRowsJson}
              trendDiffCompared={trendDiffCompared}
              trendOpenedCount={trendOpenedRows.length}
              trendClosedCount={trendClosedRows.length}
              onOpenTrendDiffModal={() => setTrendDiffModalOpen(true)}
            />
          </Space>
        </Content>
      </Layout>
      <TrendDiffModal
        open={trendDiffModalOpen}
        openedRows={trendOpenedRows}
        closedRows={trendClosedRows}
        onClose={() => setTrendDiffModalOpen(false)}
      />
      <Footer style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: '10px 24px' }}>
        Copyright © {new Date().getFullYear()} rengao
      </Footer>
      <ProcessDetailHoverPortal
        hover={processListHover}
        activePluginId={activePlugin.id}
        traceStartSec={traceStartSec}
        onMouseEnter={cancelProcessListHide}
        onMouseLeave={scheduleProcessListHide}
      />
    </Layout>
  );
}

export default App;
