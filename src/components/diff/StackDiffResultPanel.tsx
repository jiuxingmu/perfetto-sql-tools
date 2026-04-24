import { Alert, Button, Card, Empty, Space } from 'antd';
import { useMainThreadStackDiffViewModel } from '../../hooks/useMainThreadStackDiffViewModel';
import type { QueryResult } from '../../types';
import { StackDiffSummaryCards } from './StackDiffSummaryCards';
import { StackDiffTable } from './StackDiffTable';
import { StackDiffTopChart } from './StackDiffTopChart';

type StackDiffResultPanelProps = {
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
  a.download = 'thread-stack-diff-analysis.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function StackDiffResultPanel({ activeResult }: StackDiffResultPanelProps) {
  const { rows, summary } = useMainThreadStackDiffViewModel(activeResult);
  if (!rows.length) return <Empty description="暂无可比较的线程堆栈差异" />;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="分析结论" description={summary.conclusion} />
      <StackDiffSummaryCards
        totalCallDelta={summary.totalCallDelta}
        totalCostDelta={summary.totalCostDelta}
        addedCount={summary.addedCount}
        removedCount={summary.removedCount}
        riskyCount={summary.riskyCount}
      />
      <Card size="small" title="差异排行图（Top 15）">
        <StackDiffTopChart rows={rows} />
      </Card>
      <Card
        size="small"
        title="差异明细"
        extra={<Button size="small" onClick={() => exportCsv(activeResult?.rows ?? [])}>导出结果</Button>}
      >
        <StackDiffTable rows={rows} />
      </Card>
    </Space>
  );
}
