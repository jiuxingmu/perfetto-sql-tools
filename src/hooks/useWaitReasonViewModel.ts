import { useMemo } from 'react';
import type { QueryResult } from '../types';
import { WAIT_TYPE_META } from '../lib/waitTypeMeta';

export type WaitRow = {
  key: string;
  blockedStartTs: number;
  blockedEndTs: number;
  blockedDurMs: number;
  waitTypeKey: string;
  waitTypeLabel: string;
  waitTypeDescription: string;
  threadState: string;
  blockedReason: string;
  blockedFunction: string;
  wakerThread: string;
  wakerProcess: string;
  processName: string;
  pid: number | null;
  tid: number | null;
};

function classifyUnknownSubtype(blockedFunction: string, blockedState: string): string {
  const fn = blockedFunction.toLowerCase();
  if (fn.includes('io') || fn.includes('read') || fn.includes('write') || fn.includes('fs')) return 'unknown_io';
  if (fn.includes('lock') || fn.includes('mutex') || fn.includes('rwlock') || fn.includes('spin')) return 'unknown_lock';
  if (fn.includes('sync') || fn.includes('wait')) return 'unknown_sync';
  if (['D', 'S', 'I', 'K', 'W', 'T', 't'].includes(blockedState)) return 'unknown_kernel';
  return 'unknown_other';
}

function normalizeRows(rows: Record<string, unknown>[]): WaitRow[] {
  return rows.map((row, index) => {
    const pid = Number(row.pid);
    const tid = Number(row.tid);
    const rawWaitType = String(row.wait_type ?? 'unknown');
    const blockedFunction = String(row.blocked_function ?? '');
    const blockedState = String(row.blocked_state ?? '');
    const waitTypeKey = rawWaitType === 'unknown'
      ? classifyUnknownSubtype(blockedFunction, blockedState)
      : rawWaitType;
    const typeMeta = WAIT_TYPE_META[waitTypeKey] ?? WAIT_TYPE_META.unknown_other;
    return {
      key: `${index}-${String(row.blocked_start_ts ?? '')}`,
      blockedStartTs: Number(row.blocked_start_ts ?? 0),
      blockedEndTs: Number(row.blocked_end_ts ?? 0),
      blockedDurMs: Number(row.blocked_dur_ms ?? 0),
      waitTypeKey,
      waitTypeLabel: typeMeta.label,
      waitTypeDescription: typeMeta.description,
      threadState: blockedState,
      blockedReason: String(row.blocked_reason ?? ''),
      blockedFunction,
      wakerThread: String(row.waker_thread ?? ''),
      wakerProcess: String(row.waker_process ?? ''),
      processName: String(row.process_name ?? ''),
      pid: Number.isFinite(pid) ? pid : null,
      tid: Number.isFinite(tid) ? tid : null,
    };
  });
}

export function useWaitReasonViewModel(activeResult: QueryResult | null) {
  const rows = useMemo(() => normalizeRows(activeResult?.rows ?? []), [activeResult?.rows]);

  const summary = useMemo(() => {
    const totalDur = rows.reduce((acc, row) => acc + row.blockedDurMs, 0);
    const waitCount = rows.length;
    const maxDur = rows.reduce((acc, row) => Math.max(acc, row.blockedDurMs), 0);
    const byType = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.waitTypeKey] = (acc[row.waitTypeKey] ?? 0) + row.blockedDurMs;
      return acc;
    }, {});
    const typeStats = Object.entries(byType)
      .map(([key, duration]) => ({
        key,
        label: (WAIT_TYPE_META[key] ?? WAIT_TYPE_META.unknown_other).label,
        description: (WAIT_TYPE_META[key] ?? WAIT_TYPE_META.unknown_other).description,
        duration,
      }))
      .sort((a, b) => b.duration - a.duration);
    const mainTypeLabel = typeStats[0]?.label ?? '-';
    const conclusion = typeStats.length
      ? `当前窗口主要等待类型为“${typeStats[0].label}”，累计 ${typeStats[0].duration.toFixed(2)} ms，建议优先沿该类型继续排查。`
      : '当前窗口未识别到明确等待片段。';
    return { totalDur, waitCount, maxDur, mainTypeLabel, byType, typeStats, conclusion };
  }, [rows]);

  return { rows, summary };
}
