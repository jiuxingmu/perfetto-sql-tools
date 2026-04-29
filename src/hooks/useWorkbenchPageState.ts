import { useMemo, useState } from 'react';
import { useBaselineTraceImport } from './useBaselineTraceImport';
import { useParamFields } from './useParamFields';
import { usePluginWorkspace } from './usePluginWorkspace';
import { useProcessListHover } from './useProcessListHover';
import { useResultViewModel } from './useResultViewModel';
import { useRunPluginQuery } from './useRunPluginQuery';
import { useTraceImport } from './useTraceImport';
import { useTrendDiff } from './useTrendDiff';
import { apiUrl } from '../lib/api';
import { createParamsByPlugin } from '../lib/pluginState';
import type { TraceDataset } from '../types';

export function useWorkbenchPageState() {
  const [dataset, setDataset] = useState<TraceDataset | null>(null);
  const [baselineDataset, setBaselineDataset] = useState<TraceDataset | null>(null);
  const [globalProcess, setGlobalProcess] = useState('');

  const traceStartSec = dataset?.summary.timeRange[0] ?? 0;
  const traceEndSec = dataset?.summary.timeRange[1] ?? 0;
  const traceDurationSec = Math.max(0, traceEndSec - traceStartSec);
  const baselineTraceStartSec = baselineDataset?.summary.timeRange[0] ?? 0;

  const workspace = usePluginWorkspace({ traceDurationSec });
  const {
    activePluginId,
    activePlugin,
    activeParams,
    setActiveParams,
    setResultByPlugin,
    setParamsByPlugin,
    activeResult,
  } = workspace;

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
    isThreadOverview: activePlugin.id === 'thread-overview',
    isThreadBlocked: activePlugin.id === 'thread-blocked',
    isCpuUsageAnalysis: activePlugin.id === 'cpu-usage-analysis',
    isMainThreadJankAnalysis: activePlugin.id === 'main-thread-jank-analysis',
    isWaitReasonAnalysis: activePlugin.id === 'wait-reason-analysis',
    isProcessListOverview: activePlugin.id === 'process-list',
    isMainThreadStackDiffAnalysis: activePlugin.id === 'main-thread-stack-diff-analysis',
    traceDurationSec,
    setActiveParams,
  });

  const baselineImport = useBaselineTraceImport({ setBaselineDataset });

  const traceImport = useTraceImport({
    createParamsByPlugin,
    setDataset,
    setGlobalProcess,
    setResultByPlugin,
    setParamsByPlugin,
    onAfterPrimaryImport: async () => {
      try {
        await fetch(apiUrl('/trace/baseline'), { method: 'DELETE' });
      } catch {
        // ignore
      }
      setBaselineDataset(null);
    },
  });

  const runState = useRunPluginQuery({
    dataset,
    activePlugin,
    activePluginId,
    activeParams,
    globalProcess,
    traceStartSec,
    baselineDataset,
    baselineTraceStartSec,
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

  return {
    dataset,
    baselineDataset,
    globalProcess,
    setGlobalProcess,
    traceStartSec,
    traceDurationSec,
    processOptions,
    workspace,
    paramFields,
    traceImport,
    baselineImport,
    runState,
    trendDiff,
    resultView,
    hoverState,
  };
}
