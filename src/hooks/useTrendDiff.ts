import { useMemo, useState } from 'react';
import { message } from 'antd';
import { roundRelativeSec } from '../lib/traceRelativeTime';
import { buildTrendDiffSql } from '../lib/trendDiffSql';
import type { PluginDefinition, QueryParams, QueryResult } from '../types';

type UseTrendDiffArgs = {
  activePlugin: PluginDefinition;
  activeResult: QueryResult | null;
  traceStartSec: number;
  globalProcess: string;
  activeParams: QueryParams;
};

export function useTrendDiff({
  activePlugin,
  activeResult,
  traceStartSec,
  globalProcess,
  activeParams,
}: UseTrendDiffArgs) {
  const [trendCompareRange, setTrendCompareRange] = useState<{ t1?: number; t2?: number }>({});
  const [trendDiffRunning, setTrendDiffRunning] = useState(false);
  const [trendDiffRows, setTrendDiffRows] = useState<Record<string, unknown>[]>([]);
  const [trendDiffCompared, setTrendDiffCompared] = useState(false);
  const [trendDiffModalOpen, setTrendDiffModalOpen] = useState(false);

  const trendTimePointOptions = useMemo(() => {
    if (activePlugin.id !== 'thread-trend' || !activeResult?.rows?.length) return [];
    return activeResult.rows.map((r) => {
      const absSec = Number(r.bucket_ts_sec ?? 0);
      const relSec = roundRelativeSec(absSec - traceStartSec, 3);
      return { label: `${relSec.toFixed(3)}s`, value: absSec };
    });
  }, [activePlugin.id, activeResult?.rows, traceStartSec]);

  const onCompareThreadTrend = async () => {
    const t1Abs = trendCompareRange.t1;
    const t2Abs = trendCompareRange.t2;
    if (activePlugin.id !== 'thread-trend') return;
    if (t1Abs === undefined || t2Abs === undefined) {
      message.warning('请先选择 t1 和 t2');
      return;
    }
    const t1 = Math.min(t1Abs, t2Abs);
    const t2 = Math.max(t1Abs, t2Abs);
    const processFilter = globalProcess || activeParams.process || '';
    const threadFilter = activeParams.thread || '';
    const sql = buildTrendDiffSql({ t1Sec: t1, t2Sec: t2, processFilter, threadFilter });

    setTrendDiffRunning(true);
    setTrendDiffCompared(false);
    try {
      const resp = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const rows = (await resp.json()) as Record<string, unknown>[];
      setTrendDiffRows(rows);
      setTrendDiffCompared(true);
      setTrendDiffModalOpen(true);
      message.success(`线程变化对比完成，共 ${rows.length} 条`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      message.error(`对比失败: ${text}`);
    } finally {
      setTrendDiffRunning(false);
    }
  };

  const trendOpenedRows = useMemo(
    () => trendDiffRows.filter((r) => String(r.change_type) === 'opened'),
    [trendDiffRows],
  );
  const trendClosedRows = useMemo(
    () => trendDiffRows.filter((r) => String(r.change_type) === 'closed'),
    [trendDiffRows],
  );

  return {
    trendCompareRange,
    setTrendCompareRange,
    trendDiffRunning,
    trendDiffCompared,
    trendDiffModalOpen,
    setTrendDiffModalOpen,
    trendTimePointOptions,
    onCompareThreadTrend,
    trendOpenedRows,
    trendClosedRows,
  };
}
