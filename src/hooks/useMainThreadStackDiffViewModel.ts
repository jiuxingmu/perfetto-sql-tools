import { useMemo } from 'react';
import type { QueryResult } from '../types';

export type StackDiffRow = {
  key: string;
  stackKey: string;
  processName: string;
  threadName: string;
  pid: number | null;
  tid: number | null;
  callsA: number;
  callsB: number;
  callsDelta: number;
  costAMs: number;
  costBMs: number;
  costDeltaMs: number;
  avgAMs: number;
  avgBMs: number;
  avgDeltaMs: number;
  changeType: string;
  riskLevel: string;
};

function normalizeRows(rows: Record<string, unknown>[]): StackDiffRow[] {
  return rows.map((row, idx) => {
    const pid = Number(row.pid);
    const tid = Number(row.tid);
    return {
      key: `${idx}-${String(row.stack_key ?? '')}`,
      stackKey: String(row.stack_key ?? ''),
      processName: String(row.process_name ?? ''),
      threadName: String(row.thread_name ?? ''),
      pid: Number.isFinite(pid) ? pid : null,
      tid: Number.isFinite(tid) ? tid : null,
      callsA: Number(row.calls_a ?? 0),
      callsB: Number(row.calls_b ?? 0),
      callsDelta: Number(row.calls_delta ?? 0),
      costAMs: Number(row.cost_a_ms ?? 0),
      costBMs: Number(row.cost_b_ms ?? 0),
      costDeltaMs: Number(row.cost_delta_ms ?? 0),
      avgAMs: Number(row.avg_cost_a_ms ?? 0),
      avgBMs: Number(row.avg_cost_b_ms ?? 0),
      avgDeltaMs: Number(row.avg_delta_ms ?? 0),
      changeType: String(row.change_type ?? ''),
      riskLevel: String(row.risk_level ?? '正常'),
    };
  });
}

export function useMainThreadStackDiffViewModel(activeResult: QueryResult | null) {
  const rows = useMemo(() => normalizeRows(activeResult?.rows ?? []), [activeResult?.rows]);

  const summary = useMemo(() => {
    const totalCallDelta = rows.reduce((acc, row) => acc + row.callsDelta, 0);
    const totalCostDelta = rows.reduce((acc, row) => acc + row.costDeltaMs, 0);
    const addedCount = rows.filter((row) => row.changeType === '新增').length;
    const removedCount = rows.filter((row) => row.changeType === '消失').length;
    const riskyCount = rows.filter((row) => row.riskLevel === '高风险' || row.riskLevel === '异常').length;
    const top = rows[0];
    const conclusion = top
      ? `目标窗口较基线窗口总耗时变化 ${totalCostDelta.toFixed(3)}ms，最显著差异为 ${top.stackKey}（${top.changeType}，耗时增量 ${top.costDeltaMs.toFixed(3)}ms）。`
      : '未发现显著差异。';
    return {
      totalCallDelta,
      totalCostDelta,
      addedCount,
      removedCount,
      riskyCount,
      conclusion,
    };
  }, [rows]);

  return { rows, summary };
}
