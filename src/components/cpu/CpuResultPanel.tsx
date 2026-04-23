import { Button, Card, Empty, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { QueryResult } from '../../types';
import { useCpuAnalysisViewModel } from '../../hooks/useCpuAnalysisViewModel';
import { CpuDetailTable } from './CpuDetailTable';
import { CpuSummaryCards } from './CpuSummaryCards';
import { CpuTopBarChart } from './CpuTopBarChart';

type CpuResultPanelProps = {
  activeResult: QueryResult | null;
};

function downloadRowsAsCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [
    keys.join(','),
    ...rows.map((row) => keys.map((k) => JSON.stringify(row[k] ?? '')).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'cpu-usage-analysis.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CpuResultPanel({ activeResult }: CpuResultPanelProps) {
  const { rows, summary } = useCpuAnalysisViewModel(activeResult);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedValidKey = useMemo(
    () => (rows.some((row) => row.key === selectedKey) ? selectedKey : rows[0]?.key ?? null),
    [rows, selectedKey],
  );

  if (!rows.length) return <Empty description="暂无 CPU 占用数据" />;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <CpuSummaryCards
        totalCpuDurMs={summary.totalCpuDurMs}
        top1Name={summary.top1Name}
        hotThreadCount={summary.hotThreadCount}
        top10Ratio={summary.top10Ratio}
      />

      <Card
        size="small"
        title="CPU Top N 图表"
        extra={(
          <Typography.Text type="secondary">
            统计粒度：{summary.statLevel === 'process' ? '进程' : '线程'}
          </Typography.Text>
        )}
      >
        <CpuTopBarChart rows={rows} selectedKey={selectedValidKey} onSelect={setSelectedKey} />
      </Card>

      <Card
        size="small"
        title="CPU 明细表"
        extra={<Button size="small" onClick={() => downloadRowsAsCsv(activeResult?.rows ?? [])}>导出结果</Button>}
      >
        <CpuDetailTable rows={rows} selectedKey={selectedValidKey} onSelect={setSelectedKey} />
      </Card>
    </Space>
  );
}
