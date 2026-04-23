import { useMemo, useState } from 'react';
import { Layout, Space } from 'antd';
import { AppHeader } from './AppHeader';
import { ParamsCard } from './ParamsCard';
import { ProcessDetailHoverPortal } from './ProcessDetailHoverPortal';
import { PluginSidebar } from './PluginSidebar';
import { ResultsCard } from './ResultsCard';
import { TraceOverview } from './TraceOverview';
import { TrendDiffModal } from './TrendDiffModal';
import { useParamFields } from '../hooks/useParamFields';
import { usePluginWorkspace } from '../hooks/usePluginWorkspace';
import { useProcessListHover } from '../hooks/useProcessListHover';
import { useResultViewModel } from '../hooks/useResultViewModel';
import { useRunPluginQuery } from '../hooks/useRunPluginQuery';
import { useTraceImport } from '../hooks/useTraceImport';
import { useTrendDiff } from '../hooks/useTrendDiff';
import { createParamsByPlugin } from '../lib/pluginState';
import type { TraceDataset } from '../types';

const { Content } = Layout;

export function PluginWorkbench() {
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

  const processOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.processes.map((processName) => ({ label: processName, value: processName }));
  }, [dataset]);

  const paramFields = useParamFields({
    activeParams,
    processOptions,
    globalProcess,
    isEventAggregate: activePlugin.id === 'event-aggregate',
    isThreadTrend: activePlugin.id === 'thread-trend',
    isThreadBlocked: activePlugin.id === 'thread-blocked',
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

  const trendDiff = useTrendDiff({
    activePlugin,
    activeResult,
    traceStartSec,
    globalProcess,
    activeParams,
  });

  const resultView = useResultViewModel({
    activePlugin,
    activePluginId,
    activeParams,
    activeResult,
    globalProcess,
    traceStartSec,
  });

  const hoverState = useProcessListHover({ activePluginId });

  return (
    <>
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
              config={{
                activePluginName: activePlugin.name,
                paramFields,
                running,
                onRun,
              }}
              trendCompare={activePlugin.id === 'thread-trend'
                ? {
                    range: trendDiff.trendCompareRange,
                    timePointOptions: trendDiff.trendTimePointOptions,
                    running: trendDiff.trendDiffRunning,
                    onChangeRange: trendDiff.setTrendCompareRange,
                    onCompare: trendDiff.onCompareThreadTrend,
                  }
                : undefined}
            />

            <ResultsCard
              view={{
                activePluginId: activePlugin.id,
                activeResult,
                blockedSuspiciousRuleText: resultView.blockedSuspiciousRuleText,
                listSummaryText: resultView.listSummaryText,
                lineOption: resultView.lineOption,
                tableColumns: resultView.tableColumns,
                tableScrollX: resultView.tableScrollX,
                tableRowKey: resultView.tableRowKey,
                processListTableOnRow: hoverState.processListTableOnRow,
                rawRowsJson: resultView.rawRowsJson,
              }}
              trendDiff={activePlugin.id === 'thread-trend' && trendDiff.trendDiffCompared
                ? {
                    openedCount: trendDiff.trendOpenedRows.length,
                    closedCount: trendDiff.trendClosedRows.length,
                    onOpenModal: () => trendDiff.setTrendDiffModalOpen(true),
                  }
                : undefined}
            />
          </Space>
        </Content>
      </Layout>
      <TrendDiffModal
        open={trendDiff.trendDiffModalOpen}
        openedRows={trendDiff.trendOpenedRows}
        closedRows={trendDiff.trendClosedRows}
        onClose={() => trendDiff.setTrendDiffModalOpen(false)}
      />
      <ProcessDetailHoverPortal
        hover={hoverState.hover}
        activePluginId={activePlugin.id}
        traceStartSec={traceStartSec}
        onMouseEnter={hoverState.cancelHide}
        onMouseLeave={hoverState.scheduleHide}
      />
    </>
  );
}
