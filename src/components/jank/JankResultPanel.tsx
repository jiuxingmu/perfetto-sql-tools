import { Button, Card, Empty, Space } from 'antd';
import { useMemo, useState } from 'react';
import { useJankAnalysisViewModel } from '../../hooks/useJankAnalysisViewModel';
import type { QueryResult } from '../../types';
import { JankCharts } from './JankCharts';
import { JankSummaryCards } from './JankSummaryCards';
import { JankTable } from './JankTable';

type JankResultPanelProps = {
  activeResult: QueryResult | null;
};

function exportCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(','), ...rows.map((row) => keys.map((k) => JSON.stringify(row[k] ?? '')).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'main-thread-jank-analysis.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function JankResultPanel({ activeResult }: JankResultPanelProps) {
  const { rows, summary } = useJankAnalysisViewModel(activeResult);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedValidKey = useMemo(
    () => (rows.some((row) => row.key === selectedKey) ? selectedKey : rows[0]?.key ?? null),
    [rows, selectedKey],
  );

  if (!rows.length) return <Empty description="暂无主线程卡顿数据" />;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <JankSummaryCards
        frameCount={summary.frameCount}
        slowCount={summary.slowCount}
        slowRatio={summary.slowRatio}
        maxDur={summary.maxDur}
        worstRange={summary.worstRange}
      />
      <JankCharts rows={rows} onSelect={setSelectedKey} />
      <Card
        size="small"
        title="慢帧明细"
        extra={<Button size="small" onClick={() => exportCsv(activeResult?.rows ?? [])}>导出结果</Button>}
      >
        <JankTable rows={rows} selectedKey={selectedValidKey} onSelect={setSelectedKey} />
      </Card>
    </Space>
  );
}
