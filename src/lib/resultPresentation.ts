import { isAbsoluteTraceTimeColumn, relativeTraceSecFractionDigits, toRelativeTraceSecDisplay } from './traceRelativeTime';
import type { PluginDefinition } from '../types';

export const PROCESS_LIST_TABLE_KEYS = ['pid', 'name', 'process', 'uid', 'status', 'window_start_sec', 'window_end_sec'] as const;

export const PROCESS_LIST_EXTRA_KEY_ORDER = [
  'upid',
  'cmdline',
  'parent_upid',
  'android_appid',
  'arg_set_id',
  'active_in_window_sec',
  'start_ts_sec',
  'end_ts_sec',
];

function getResultColumnWidth(key: string): number {
  if (key === 'cmdline') return 360;
  if (key === 'name' || key === 'process') return 180;
  if (key === 'status') return 96;
  if (key === 'active_in_window_sec') return 140;
  if (isAbsoluteTraceTimeColumn(key)) return 132;
  if (key === 'parent_upid' || key === 'arg_set_id' || key === 'android_appid' || key === 'uid') return 112;
  if (key === 'upid' || key === 'pid') return 88;
  return 108;
}

function getProcessListColumnWidth(key: string): number {
  if (key === 'name' || key === 'process') return 160;
  if (key === 'status') return 88;
  if (key === 'window_start_sec' || key === 'window_end_sec' || key === 'start_ts_sec' || key === 'end_ts_sec') return 120;
  if (key === 'uid' || key === 'pid') return 88;
  return 100;
}

export function formatDetailValue(key: string, value: unknown, traceStartSec: number): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'active_in_window_sec') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? `${n.toFixed(3)} s` : String(value);
  }
  if (key === 'is_main_thread') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? (n ? '1 (main)' : '0') : String(value);
  }
  if (isAbsoluteTraceTimeColumn(key)) {
    return `${toRelativeTraceSecDisplay(value, traceStartSec, relativeTraceSecFractionDigits(key))} s`;
  }
  return String(value);
}

export function buildTablePresentation(
  activePluginId: PluginDefinition['id'],
  rows: Record<string, unknown>[] | undefined,
  traceStartSec: number,
) {
  if (!rows?.length) return { tableColumns: [], tableScrollX: 0 };
  const row0 = rows[0] as Record<string, unknown>;

  if (activePluginId === 'process-list') {
    const keys = (PROCESS_LIST_TABLE_KEYS as readonly string[]).filter((k) =>
      Object.prototype.hasOwnProperty.call(row0, k),
    );
    const scrollX = Math.max(640, keys.reduce((acc, k) => acc + getProcessListColumnWidth(k), 0));
    const cols = keys.map((k) => ({
      title: k,
      dataIndex: k,
      key: k,
      width: getProcessListColumnWidth(k),
      ellipsis: true as const,
      render: isAbsoluteTraceTimeColumn(k)
        ? (v: unknown) => toRelativeTraceSecDisplay(v, traceStartSec, relativeTraceSecFractionDigits(k))
        : undefined,
    }));
    return { tableColumns: cols, tableScrollX: scrollX };
  }

  const keys = Object.keys(row0);
  const scrollX = Math.max(720, keys.reduce((acc, k) => acc + getResultColumnWidth(k), 0));
  const cols = keys.map((k) => ({
    title: isAbsoluteTraceTimeColumn(k) ? `${k} (rel s)` : k,
    dataIndex: k,
    key: k,
    width: getResultColumnWidth(k),
    ellipsis: true as const,
    render:
      k === 'active_in_window_sec'
        ? (v: unknown) => {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? n.toFixed(3) : String(v ?? '');
        }
        : isAbsoluteTraceTimeColumn(k)
          ? (v: unknown) => toRelativeTraceSecDisplay(v, traceStartSec, relativeTraceSecFractionDigits(k))
          : undefined,
  }));
  return { tableColumns: cols, tableScrollX: scrollX };
}
