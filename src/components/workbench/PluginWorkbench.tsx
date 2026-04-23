import { WorkbenchMainContent } from './WorkbenchMainContent';
import { WorkbenchOverlays } from './WorkbenchOverlays';
import { WorkbenchShell } from './WorkbenchShell';
import { useWorkbenchPageState } from '../../hooks/useWorkbenchPageState';

export function PluginWorkbench() {
  const state = useWorkbenchPageState();
  const {
    dataset,
    globalProcess,
    setGlobalProcess,
    traceStartSec,
    traceDurationSec,
    processOptions,
    workspace,
    paramFields,
    traceImport,
    runState,
    trendDiff,
    resultView,
    hoverState,
  } = state;
  const { activePlugin, activePluginId, setActivePluginId, orderedPlugins, activeResult } = workspace;

  return (
    <>
      <WorkbenchShell
        header={{
          loading: traceImport.loading,
          uploadProps: traceImport.uploadProps,
          processOptions,
          globalProcess,
          onChangeGlobalProcess: setGlobalProcess,
        }}
        sidebar={{
          orderedPlugins,
          activePluginId,
          onSelectPlugin: setActivePluginId,
        }}
      >
        <WorkbenchMainContent
          dataset={dataset}
          traceDurationSec={traceDurationSec}
          activePluginId={activePlugin.id}
          activePluginName={activePlugin.name}
          activeResult={activeResult}
          paramFields={paramFields}
          running={runState.running}
          onRun={runState.onRun}
          trendCompare={activePlugin.id === 'thread-trend'
            ? {
                range: trendDiff.trendCompareRange,
                timePointOptions: trendDiff.trendTimePointOptions,
                running: trendDiff.trendDiffRunning,
                onChangeRange: trendDiff.setTrendCompareRange,
                onCompare: trendDiff.onCompareThreadTrend,
              }
            : undefined}
          resultView={{
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
          trendDiffSummary={activePlugin.id === 'thread-trend' && trendDiff.trendDiffCompared
            ? {
                openedCount: trendDiff.trendOpenedRows.length,
                closedCount: trendDiff.trendClosedRows.length,
                onOpenModal: () => trendDiff.setTrendDiffModalOpen(true),
              }
            : undefined}
        />
      </WorkbenchShell>
      <WorkbenchOverlays
        activePluginId={activePlugin.id}
        traceStartSec={traceStartSec}
        hover={hoverState.hover}
        onHoverEnter={hoverState.cancelHide}
        onHoverLeave={hoverState.scheduleHide}
        trendDiffModalOpen={trendDiff.trendDiffModalOpen}
        trendOpenedRows={trendDiff.trendOpenedRows}
        trendClosedRows={trendDiff.trendClosedRows}
        onCloseTrendDiffModal={() => trendDiff.setTrendDiffModalOpen(false)}
      />
    </>
  );
}
