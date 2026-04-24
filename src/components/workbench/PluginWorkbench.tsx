import { Button, Card, Space, Typography, Upload } from 'antd';
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
    baselineDataset,
    baselineImport,
    runState,
    trendDiff,
    resultView,
    hoverState,
  } = state;
  const { activePlugin, activePluginId, setActivePluginId, orderedPlugins, activeResult, activeParams } = workspace;

  const pluginExtras = activePlugin.id === 'main-thread-stack-diff-analysis'
    && (activeParams.stackDiffMode ?? 'single-trace') === 'dual-trace'
    ? (
      <Card size="small" title="双 Trace：基线文件">
        <Space wrap align="center">
          <Upload {...baselineImport.uploadProps}>
            <Button loading={baselineImport.loading}>导入基线 Trace</Button>
          </Upload>
          {baselineDataset ? (
            <>
              <Typography.Text type="secondary">
                当前基线：
                <Typography.Text strong>{baselineDataset.summary.traceName}</Typography.Text>
                {' '}
                （时长约
                {Math.max(0, baselineDataset.summary.timeRange[1] - baselineDataset.summary.timeRange[0]).toFixed(2)}
                s）
              </Typography.Text>
              <Button size="small" onClick={() => void baselineImport.clearBaseline()}>清除基线</Button>
            </>
          ) : (
            <Typography.Text type="secondary">尚未加载基线文件</Typography.Text>
          )}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
          目标窗口使用主 trace；基线开始/结束为相对基线文件起点。重新导入主 trace 时会清除基线。
        </Typography.Paragraph>
      </Card>
    )
    : null;

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
          pluginExtras={pluginExtras}
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
