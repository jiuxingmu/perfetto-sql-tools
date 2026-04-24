import type { QueryParams } from '../types';

type AggRow = {
  stack_key: string;
  process_name: string;
  thread_name: string;
  pid: number;
  tid: number;
  calls: number;
  cost_ns: number;
};

function normalizeAgg(rows: Record<string, unknown>[]): AggRow[] {
  return rows.map((row) => ({
    stack_key: String(row.stack_key ?? ''),
    process_name: String(row.process_name ?? ''),
    thread_name: String(row.thread_name ?? ''),
    pid: Number(row.pid ?? 0),
    tid: Number(row.tid ?? 0),
    calls: Number(row.calls ?? 0),
    cost_ns: Number(row.cost_ns ?? 0),
  }));
}

function changeType(callsA: number, callsB: number, costDeltaNs: number, callsDelta: number): string {
  if (callsA === 0 && callsB > 0) return '新增';
  if (callsB === 0 && callsA > 0) return '消失';
  if (costDeltaNs > 0) return '增强';
  if (costDeltaNs < 0) return '减少';
  if (callsDelta !== 0) return '结构变化';
  return '一致';
}

function riskLevel(costDeltaNs: number, callsDelta: number): string {
  if (costDeltaNs >= 20 * 1e6 || callsDelta >= 30) return '高风险';
  if (costDeltaNs >= 8 * 1e6 || callsDelta >= 10) return '异常';
  if (costDeltaNs > 0 || callsDelta > 0) return '关注';
  return '正常';
}

/**
 * baselineRows = 侧 A（基线），targetRows = 侧 B（目标），与 SQL 版语义一致。
 */
export function mergeStackDiffAggRows(
  baselineRows: Record<string, unknown>[],
  targetRows: Record<string, unknown>[],
  p: QueryParams,
): Record<string, unknown>[] {
  const minCalls = Math.max(0, Number(p.diffMinCalls ?? 1));
  const minCostNs = Math.max(0, Number(p.diffMinCostMs ?? 0.1) * 1e6);
  const topN = Math.max(1, Number(p.diffTopN ?? 30));

  const A = normalizeAgg(baselineRows);
  const B = normalizeAgg(targetRows);
  const mapA = new Map(A.map((r) => [r.stack_key, r]));
  const mapB = new Map(B.map((r) => [r.stack_key, r]));
  const keys = new Set<string>([...mapA.keys(), ...mapB.keys()]);

  const diffs: Record<string, unknown>[] = [];
  for (const stack_key of keys) {
    const a = mapA.get(stack_key);
    const b = mapB.get(stack_key);
    const calls_a = a?.calls ?? 0;
    const calls_b = b?.calls ?? 0;
    const cost_ns_a = a?.cost_ns ?? 0;
    const cost_ns_b = b?.cost_ns ?? 0;
    const calls_delta = calls_b - calls_a;
    const cost_delta_ns = cost_ns_b - cost_ns_a;
    const process_name = b?.process_name || a?.process_name || (p.process ?? '');
    const thread_name = b?.thread_name || a?.thread_name || (p.thread ?? '');
    const pid = b?.pid ?? a?.pid ?? 0;
    const tid = b?.tid ?? a?.tid ?? 0;

    if (calls_a + calls_b < minCalls) continue;
    if (Math.max(cost_ns_a, cost_ns_b) < minCostNs) continue;

    const cost_a_ms = cost_ns_a / 1e6;
    const cost_b_ms = cost_ns_b / 1e6;
    const cost_delta_ms = cost_delta_ns / 1e6;
    const avg_cost_a_ms = calls_a > 0 ? cost_a_ms / calls_a : 0;
    const avg_cost_b_ms = calls_b > 0 ? cost_b_ms / calls_b : 0;
    const avg_delta_ms = avg_cost_b_ms - avg_cost_a_ms;

    diffs.push({
      stack_key,
      process_name,
      thread_name,
      pid,
      tid,
      calls_a,
      calls_b,
      calls_delta,
      cost_a_ms: Number(cost_a_ms.toFixed(3)),
      cost_b_ms: Number(cost_b_ms.toFixed(3)),
      cost_delta_ms: Number(cost_delta_ms.toFixed(3)),
      avg_cost_a_ms: Number(avg_cost_a_ms.toFixed(3)),
      avg_cost_b_ms: Number(avg_cost_b_ms.toFixed(3)),
      avg_delta_ms: Number(avg_delta_ms.toFixed(3)),
      change_type: changeType(calls_a, calls_b, cost_delta_ns, calls_delta),
      risk_level: riskLevel(cost_delta_ns, calls_delta),
    });
  }

  const sortKey = p.diffSortBy ?? 'cost_delta';
  diffs.sort((x, y) => {
    const dx = Number(x.cost_delta_ms ?? 0) * 1e6;
    const dy = Number(y.cost_delta_ms ?? 0) * 1e6;
    const cx = Number(x.calls_delta ?? 0);
    const cy = Number(y.calls_delta ?? 0);
    const ax = Number(x.avg_delta_ms ?? 0);
    const ay = Number(y.avg_delta_ms ?? 0);
    if (sortKey === 'calls_delta') {
      if (cy !== cx) return cy - cx;
      if (dy !== dx) return dy - dx;
    } else if (sortKey === 'avg_delta') {
      if (ay !== ax) return ay - ax;
      if (dy !== dx) return dy - dx;
    } else {
      if (dy !== dx) return dy - dx;
      if (cy !== cx) return cy - cx;
    }
    return String(x.stack_key).localeCompare(String(y.stack_key));
  });

  return diffs.slice(0, topN);
}
