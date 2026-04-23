import { useMemo, useState } from 'react';
import { Layout, Space } from 'antd';
import './App.css';
import { AppHeader } from './components/AppHeader';
import { ParamsCard } from './components/ParamsCard';
import { ProcessDetailHoverPortal } from './components/ProcessDetailHoverPortal';
import { PluginSidebar } from './components/PluginSidebar';
import { ResultsCard } from './components/ResultsCard';
import { TraceOverview } from './components/TraceOverview';
import { TrendDiffModal } from './components/TrendDiffModal';
import { useParamFields } from './hooks/useParamFields';
import { usePluginWorkspace } from './hooks/usePluginWorkspace';
import { useProcessListHover } from './hooks/useProcessListHover';
import { useResultViewModel } from './hooks/useResultViewModel';
import { useRunPluginQuery } from './hooks/useRunPluginQuery';
import { useTraceImport } from './hooks/useTraceImport';
import { useTrendDiff } from './hooks/useTrendDiff';
import { createParamsByPlugin } from './lib/pluginState';
import type { TraceDataset } from './types';

const { Content, Footer } = Layout;

function App() {
  const [dataset, setDataset] = useState<TraceDataset | null>(null);
  const [globalProcess, setGlobalProcess] = useState('');

  const traceStartSec = dataset?.summary.timeRange[0] ?? 0;
  const traceEndSec = dataset?.summary.timeRange[1] ?? 0;
  const traceDurationSec = Math.max(0, traceEndSec - traceStartSec);

  const {
    activePluginId,
    setActivePluginId,
    activePlugin,
    orderedPlugins,
    setParamsByPlugin,
    activeParams,
    setActiveParams,
    setResultByPlugin,
    activeResult,
  } = usePluginWorkspace({ traceDurationSec });

  const isThreadTrend = activePlugin.id === 'thread-trend';
  const isThreadBlocked = activePlugin.id === 'thread-blocked';
  const isEventAggregate = activePlugin.id === 'event-aggregate';

  const processOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.processes.map((p) => ({ label: p, value: p }));
  }, [dataset]);

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
    createParamsByPlugin,
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

  const {
    tableColumns,
    tableScrollX,
    lineOption,
    rawRowsJson,
    listSummaryText,
    blockedSuspiciousRuleText,
    tableRowKey,
  } = useResultViewModel({
    activePlugin,
    activePluginId,
    activeParams,
    activeResult,
    globalProcess,
    traceStartSec,
  });

  const {
    hover: processListHover,
    cancelHide: cancelProcessListHide,
    scheduleHide: scheduleProcessListHide,
    processListTableOnRow,
  } = useProcessListHover({
    activePluginId,
  });

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
