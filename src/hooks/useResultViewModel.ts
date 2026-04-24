import { useMemo } from 'react';
import { buildTablePresentation } from '../lib/resultPresentation';
import { mapRowsToRelativeTraceTimes, roundRelativeSec } from '../lib/traceRelativeTime';
import type { PluginDefinition, QueryParams, QueryResult } from '../types';

type UseResultViewModelArgs = {
  activePlugin: PluginDefinition;
  activePluginId: PluginDefinition['id'];
  activeParams: QueryParams;
  activeResult: QueryResult | null;
  globalProcess: string;
  traceStartSec: number;
};

export function useResultViewModel({
  activePlugin,
  activePluginId,
  activeParams,
  activeResult,
  globalProcess,
  traceStartSec,
}: UseResultViewModelArgs) {
  const { tableColumns, tableScrollX } = useMemo(
    () => buildTablePresentation(activePluginId, activeResult?.rows, traceStartSec),
    [activeResult?.rows, activePluginId, traceStartSec],
  );

  const lineOption = useMemo(() => {
    if (!activeResult?.rows?.length || activePlugin.id !== 'thread-trend') return null;
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        name: 'Relative time (s)',
        data: activeResult.rows.map((row) =>
          roundRelativeSec(Number(row.bucket_ts_sec) - traceStartSec, 3).toFixed(3)),
      },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, data: activeResult.rows.map((row) => Number(row.thread_count ?? 0)) }],
      grid: { left: 32, right: 24, top: 20, bottom: 32 },
    };
  }, [activePlugin.id, activeResult, traceStartSec]);

  const rawRowsJson = useMemo(() => {
    const rows = activeResult?.rows ?? [];
    if (!rows.length) return '[]';
    return JSON.stringify(mapRowsToRelativeTraceTimes(rows, traceStartSec), null, 2);
  }, [activeResult?.rows, traceStartSec]);

  const listSummaryText = useMemo(() => {
    if (activePlugin.id !== 'process-list') return null;
    if (!activeResult) return null;

    const processName = globalProcess || activeParams.process || '全部进程';
    const timeRangeText = `${activeParams.startSec.toFixed(3)}s ~ ${activeParams.endSec.toFixed(3)}s`;
    const resultCount = activeResult.rows.length;
    return `筛选条件：时间=${timeRangeText}，进程=${processName}；共计 ${resultCount} 条结果。`;
  }, [
    activePlugin.id,
    activeResult,
    activeParams.endSec,
    activeParams.process,
    activeParams.startSec,
    globalProcess,
  ]);

  const blockedSuspiciousRuleText = useMemo(() => {
    if (activePlugin.id !== 'thread-blocked') return null;
    if ((activeParams.suspiciousOnly ?? 1) === 1) {
      return '疑似阻塞口径：满足任一条件（blocked_state=D / io_wait_flag=1 / blocked_dur_ms>=7）即展示。';
    }
    return '完整输出口径：展示主线程全部 blocked/sleeping 事件（不做时长过滤），用于全量排查。';
  }, [activePlugin.id, activeParams.suspiciousOnly]);

  const pluginGuidanceText = useMemo(() => {
    if (activePlugin.id === 'main-thread-jank-analysis') {
      return '定位说明：该插件用于识别“哪里卡了”（慢帧/卡顿区间）；若要分析“为什么在等”，请继续查看「等待原因归因分析」。';
    }
    if (activePlugin.id === 'wait-reason-analysis') {
      return '定位说明：该插件用于解释“为什么在等”（IO/锁/Binder/futex 等）；若要确认主线程是否出现可疑阻塞证据，请查看「主线程阻塞分析」。';
    }
    if (activePlugin.id === 'thread-blocked') {
      return '定位说明：该插件用于验证主线程阻塞证据（blocked 状态、时长、waker）；若要看卡顿现象，请查看「主线程卡顿分析」。';
    }
    return null;
  }, [activePlugin.id]);

  const tableRowKey = (record: Record<string, unknown>, index?: number) => {
    const rowIndex = index ?? 0;
    const id = record.upid ?? record.pid ?? record.ts_sec ?? record.bucket_ts_sec ?? rowIndex;
    return `${rowIndex}-${String(id)}`;
  };

  return {
    tableColumns,
    tableScrollX,
    lineOption,
    rawRowsJson,
    listSummaryText,
    blockedSuspiciousRuleText,
    pluginGuidanceText,
    tableRowKey,
  };
}
