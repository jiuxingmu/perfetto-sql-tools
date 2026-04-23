import { useMemo } from 'react';
import type { QueryResult } from '../types';

export type ProcessOverviewRow = {
  key: string;
  process: string;
  pid: number | null;
  uid: number | null;
  status: string;
  activeInWindowSec: number;
  cpuTimeMs: number;
  threadCount: number;
  slowFrameCount: number;
  topWaitType: string;
  nextStep: string;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(rows: Record<string, unknown>[]): ProcessOverviewRow[] {
  return rows.map((row, index) => ({
    key: `${index}-${String(row.upid ?? row.pid ?? '')}`,
    process: String(row.process ?? row.name ?? ''),
    pid: Number.isFinite(Number(row.pid)) ? Number(row.pid) : null,
    uid: Number.isFinite(Number(row.uid)) ? Number(row.uid) : null,
    status: String(row.status ?? ''),
    activeInWindowSec: toNum(row.active_in_window_sec),
    cpuTimeMs: toNum(row.cpu_time_ms),
    threadCount: toNum(row.thread_count),
    slowFrameCount: toNum(row.slow_frame_count),
    topWaitType: String(row.top_wait_type ?? ''),
    nextStep: String(row.next_step ?? ''),
  }));
}

export function useProcessOverviewViewModel(activeResult: QueryResult | null) {
  const rows = useMemo(() => normalize(activeResult?.rows ?? []), [activeResult?.rows]);
  const summary = useMemo(() => {
    const totalProcessCount = rows.length;
    const activeProcessCount = rows.filter((row) => row.activeInWindowSec > 0).length;
    const topCpu = [...rows].sort((a, b) => b.cpuTimeMs - a.cpuTimeMs)[0];
    const topThread = [...rows].sort((a, b) => b.threadCount - a.threadCount)[0];
    const conclusion = totalProcessCount
      ? `本区间共有 ${activeProcessCount} 个活跃进程。CPU 最高为 ${topCpu?.process ?? '-'}，线程数最多为 ${topThread?.process ?? '-'}。`
      : '当前时间范围内未命中可分析的活跃进程。';
    return {
      totalProcessCount,
      activeProcessCount,
      topCpuProcess: topCpu?.process ?? '-',
      topThreadProcess: topThread?.process ?? '-',
      conclusion,
    };
  }, [rows]);

  return { rows, summary };
}
