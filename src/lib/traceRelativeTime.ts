const EXPLICIT_TRACE_TIME_KEYS = new Set([
  'ts_sec',
  'bucket_ts_sec',
  'first_ts_sec',
  'last_ts_sec',
  'window_start_sec',
  'window_end_sec',
  'start_ts_sec',
  'end_ts_sec',
]);

const RELATIVE_SEC_THREE_DECIMAL_KEYS = new Set(['window_start_sec', 'window_end_sec']);

/** Perfetto 查询结果里「相对 trace 起点」的绝对时间列（单位：秒，与 summary.timeRange 同源）。 */
export function isAbsoluteTraceTimeColumn(key: string): boolean {
  if (EXPLICIT_TRACE_TIME_KEYS.has(key)) return true;
  if (key.includes('dur')) return false;
  if (key.endsWith('_ts_sec')) return true;
  return false;
}

export function relativeTraceSecFractionDigits(key: string): number {
  return RELATIVE_SEC_THREE_DECIMAL_KEYS.has(key) ? 3 : 6;
}

/** 相对秒数按小数位四舍五入，避免浮点残差出现 `-0.000`。 */
export function roundRelativeSec(rel: number, fractionDigits: number): number {
  const scale = 10 ** fractionDigits;
  return Math.round(rel * scale) / scale;
}

export function toRelativeTraceSecDisplay(
  value: unknown,
  traceStartSec: number,
  fractionDigits: number = 6,
): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return value === null || value === undefined ? '' : String(value);
  const rounded = roundRelativeSec(n - traceStartSec, fractionDigits);
  return rounded.toFixed(fractionDigits);
}

export function mapRowsToRelativeTraceTimes(
  rows: Record<string, unknown>[],
  traceStartSec: number,
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const k of Object.keys(out)) {
      if (!isAbsoluteTraceTimeColumn(k)) continue;
      const v = out[k];
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) continue;
      const digits = relativeTraceSecFractionDigits(k);
      out[k] = roundRelativeSec(n - traceStartSec, digits);
    }
    return out;
  });
}
