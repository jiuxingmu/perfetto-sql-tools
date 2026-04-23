import { useMemo } from 'react';
import type { QueryParams } from '../types';
import { buildCommonParamFields, buildPluginSpecificParamFields } from './paramFieldFactories';

type UseParamFieldsArgs = {
  activeParams: QueryParams;
  processOptions: Array<{ label: string; value: string }>;
  globalProcess: string;
  isEventAggregate: boolean;
  isThreadTrend: boolean;
  isThreadBlocked: boolean;
  isCpuUsageAnalysis: boolean;
  traceDurationSec: number;
  setActiveParams: (updater: (p: QueryParams) => QueryParams) => void;
};

export function useParamFields({
  activeParams,
  processOptions,
  globalProcess,
  isEventAggregate,
  isThreadTrend,
  isThreadBlocked,
  isCpuUsageAnalysis,
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
        isThreadBlocked,
        isCpuUsageAnalysis,
        setActiveParams,
      }),
    ];

    return fields.filter((f) => f.visible);
  }, [
    activeParams,
    globalProcess,
    isEventAggregate,
    isThreadBlocked,
    isCpuUsageAnalysis,
    isThreadTrend,
    processOptions,
    setActiveParams,
    traceDurationSec,
  ]);
}
