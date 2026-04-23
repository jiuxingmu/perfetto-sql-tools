import { useMemo } from 'react';
import type { QueryResult } from '../types';

export type CpuRow = {
  key: string;
  name: string;
  pid: number | null;
  tid: number | null;
  cpuDurMs: number;
  cpuRatio: number;
  sliceCount: number;
  avgSliceDurMs: number;
  isMainThread: boolean;
  statLevel: 'process' | 'thread';
};

function normalizeCpuRows(rows: Record<string, unknown>[]): CpuRow[] {
  return rows.map((row, idx) => {
    const pid = Number(row.pid);
    const tid = Number(row.tid);
    const statLevel = String(row.stat_level) === 'process' ? 'process' : 'thread';
    return {
      key: `${idx}-${String(row.name ?? '')}-${String(row.pid ?? '')}-${String(row.tid ?? '')}`,
      name: String(row.name ?? ''),
      pid: Number.isFinite(pid) ? pid : null,
      tid: Number.isFinite(tid) ? tid : null,
      cpuDurMs: Number(row.cpu_dur_ms ?? 0),
      cpuRatio: Number(row.cpu_ratio ?? 0),
      sliceCount: Number(row.slice_count ?? 0),
      avgSliceDurMs: Number(row.avg_slice_dur_ms ?? 0),
      isMainThread: Number(row.is_main_thread ?? 0) === 1,
      statLevel,
    };
  });
}

export function useCpuAnalysisViewModel(activeResult: QueryResult | null) {
  const rows = useMemo(() => normalizeCpuRows(activeResult?.rows ?? []), [activeResult?.rows]);

  const summary = useMemo(() => {
    const totalCpuDurMs = rows.reduce((acc, row) => acc + row.cpuDurMs, 0);
    const top1Name = rows[0]?.name ?? '-';
    const hotThreadCount = rows.filter((row) => row.cpuRatio >= 0.05).length;
    const top10Ratio = rows.slice(0, 10).reduce((acc, row) => acc + row.cpuRatio, 0);
    return {
      totalCpuDurMs: Number(totalCpuDurMs.toFixed(2)),
      top1Name,
      hotThreadCount,
      top10Ratio,
      statLevel: rows[0]?.statLevel ?? 'thread',
    };
  }, [rows]);

  return {
    rows,
    summary,
  };
}
