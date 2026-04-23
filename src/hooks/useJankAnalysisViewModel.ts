import { useMemo } from 'react';
import type { QueryResult } from '../types';

export type JankRow = {
  key: string;
  frameStartTs: number;
  frameEndTs: number;
  frameDurMs: number;
  slowFlag: boolean;
  jankType: string;
  mainThreadState: string;
  blockingReason: string;
  topSliceName: string;
  processName: string;
  pid: number | null;
  tid: number | null;
};

function normalizeRows(rows: Record<string, unknown>[]): JankRow[] {
  return rows.map((row, index) => {
    const pid = Number(row.pid);
    const tid = Number(row.tid);
    const frameStartTs = Number(row.frame_start_ts ?? 0);
    const frameEndTs = Number(row.frame_end_ts ?? 0);
    return {
      key: `${index}-${String(row.frame_start_ts ?? '')}`,
      frameStartTs,
      frameEndTs,
      frameDurMs: Number(row.frame_dur_ms ?? 0),
      slowFlag: Number(row.slow_flag ?? 0) === 1,
      jankType: String(row.jank_type ?? ''),
      mainThreadState: String(row.main_thread_state ?? ''),
      blockingReason: String(row.blocking_reason ?? ''),
      topSliceName: String(row.top_slice_name ?? ''),
      processName: String(row.process_name ?? ''),
      pid: Number.isFinite(pid) ? pid : null,
      tid: Number.isFinite(tid) ? tid : null,
    };
  });
}

export function useJankAnalysisViewModel(activeResult: QueryResult | null) {
  const rows = useMemo(() => normalizeRows(activeResult?.rows ?? []), [activeResult?.rows]);

  const summary = useMemo(() => {
    const frameCount = rows.length;
    const slowRows = rows.filter((row) => row.slowFlag);
    const slowRatio = frameCount ? slowRows.length / frameCount : 0;
    const maxDur = rows.reduce((acc, row) => Math.max(acc, row.frameDurMs), 0);
    const worst = rows[0];
    return {
      frameCount,
      slowCount: slowRows.length,
      slowRatio,
      maxDur,
      worstRange: worst ? `${worst.frameStartTs.toFixed(3)}s ~ ${worst.frameEndTs.toFixed(3)}s` : '-',
    };
  }, [rows]);

  return { rows, summary };
}
