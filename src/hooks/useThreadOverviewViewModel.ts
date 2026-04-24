import { useMemo } from 'react';
import type { QueryResult } from '../types';

export type ThreadOverviewRow = {
  key: string;
  threadName: string;
  tid: number | null;
  pid: number | null;
  processName: string;
  isMainThread: number;
  threadType: string;
  activeDurationMs: number;
  cpuTimeMs: number;
  switchCount: number;
  wakeupCount: number;
  nextStep: string;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(rows: Record<string, unknown>[]): ThreadOverviewRow[] {
  return rows.map((row, index) => ({
    key: `${index}-${String(row.tid ?? '')}`,
    threadName: String(row.thread_name ?? ''),
    tid: Number.isFinite(Number(row.tid)) ? Number(row.tid) : null,
    pid: Number.isFinite(Number(row.pid)) ? Number(row.pid) : null,
    processName: String(row.process_name ?? ''),
    isMainThread: toNum(row.is_main_thread),
    threadType: String(row.thread_type ?? 'unknown'),
    activeDurationMs: toNum(row.active_duration_ms),
    cpuTimeMs: toNum(row.cpu_time_ms),
    switchCount: toNum(row.switch_count),
    wakeupCount: toNum(row.wakeup_count),
    nextStep: String(row.next_step ?? ''),
  }));
}

export function useThreadOverviewViewModel(activeResult: QueryResult | null) {
  const rows = useMemo(() => normalize(activeResult?.rows ?? []), [activeResult?.rows]);
  const summary = useMemo(() => {
    const totalThreadCount = rows.length;
    const activeThreadCount = rows.filter((r) => r.activeDurationMs > 0 || r.cpuTimeMs > 0).length;
    const mainThreadCount = rows.filter((r) => r.isMainThread === 1).length;
    const topCpu = [...rows].sort((a, b) => b.cpuTimeMs - a.cpuTimeMs)[0];
    const topSwitch = [...rows].sort((a, b) => b.switchCount - a.switchCount)[0];
    const conclusion = totalThreadCount
      ? `本区间共有 ${totalThreadCount} 个线程，活跃线程 ${activeThreadCount} 个，主线程 ${mainThreadCount} 个。CPU 最忙线程是 ${topCpu?.threadName ?? '-'}，切换最频繁线程是 ${topSwitch?.threadName ?? '-'}。`
      : '当前时间范围内没有线程数据或未命中筛选条件。';
    return { totalThreadCount, activeThreadCount, mainThreadCount, conclusion };
  }, [rows]);

  return { rows, summary };
}
