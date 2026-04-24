import { useMemo } from 'react';
import type { QueryParams } from '../types';
import { buildCommonParamFields, buildPluginSpecificParamFields } from './paramFieldFactories';

type UseParamFieldsArgs = {
  activeParams: QueryParams;
  processOptions: Array<{ label: string; value: string }>;
  globalProcess: string;
  isEventAggregate: boolean;
  isThreadTrend: boolean;
  isThreadOverview: boolean;
  isThreadBlocked: boolean;
  isCpuUsageAnalysis: boolean;
  isMainThreadJankAnalysis: boolean;
  isWaitReasonAnalysis: boolean;
  isProcessListOverview: boolean;
  isMainThreadStackDiffAnalysis: boolean;
  traceDurationSec: number;
  setActiveParams: (updater: (p: QueryParams) => QueryParams) => void;
};

export function useParamFields({
  activeParams,
  processOptions,
  globalProcess,
  isEventAggregate,
  isThreadTrend,
  isThreadOverview,
  isThreadBlocked,
  isCpuUsageAnalysis,
  isMainThreadJankAnalysis,
  isWaitReasonAnalysis,
  isProcessListOverview,
  isMainThreadStackDiffAnalysis,
  traceDurationSec,
  setActiveParams,
}: UseParamFieldsArgs) {
  return useMemo(() => {
    const fields = [
      ...buildCommonParamFields({
        activeParams,
        processOptions,
        globalProcess,
        traceDurationSec,
        setActiveParams,
      }),
      ...buildPluginSpecificParamFields({
        activeParams,
        isEventAggregate,
        isThreadTrend,
        isThreadOverview,
        isThreadBlocked,
        isCpuUsageAnalysis,
        isMainThreadJankAnalysis,
        isWaitReasonAnalysis,
        isProcessListOverview,
        isMainThreadStackDiffAnalysis,
        setActiveParams,
      }),
    ];

    const visibleFields = fields.filter((f) => f.visible);

    if (isMainThreadStackDiffAnalysis) {
      const order = new Map<string, number>([
        ['stackDiffMode', 1],
        ['startSec', 2],
        ['endSec', 3],
        ['diffCompareStartSec', 4],
        ['diffCompareEndSec', 5],
        ['process', 6],
        ['diffTopN', 7],
        ['diffSortBy', 8],
        ['diffMinCalls', 9],
        ['diffMinCostMs', 10],
        ['diffOnlyMainThread', 11],
      ]);
      return [...visibleFields].sort((a, b) => (order.get(a.key) ?? 100) - (order.get(b.key) ?? 100));
    }

    return visibleFields;
  }, [
    activeParams,
    globalProcess,
    isEventAggregate,
    isThreadBlocked,
    isCpuUsageAnalysis,
    isMainThreadJankAnalysis,
    isWaitReasonAnalysis,
    isProcessListOverview,
    isMainThreadStackDiffAnalysis,
    isThreadTrend,
    isThreadOverview,
    processOptions,
    setActiveParams,
    traceDurationSec,
  ]);
}
