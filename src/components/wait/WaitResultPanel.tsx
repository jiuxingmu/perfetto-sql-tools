import { Alert, Button, Card, Empty, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { QueryResult } from '../../types';
import { useWaitReasonViewModel } from '../../hooks/useWaitReasonViewModel';
import { WaitCharts } from './WaitCharts';
import { WaitSummaryCards } from './WaitSummaryCards';
import { WaitTable } from './WaitTable';

type WaitResultPanelProps = {
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
  a.download = 'wait-reason-analysis.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function WaitResultPanel({ activeResult }: WaitResultPanelProps) {
  const { rows, summary } = useWaitReasonViewModel(activeResult);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedValidKey = useMemo(
    () => (rows.some((row) => row.key === selectedKey) ? selectedKey : rows[0]?.key ?? null),
    [rows, selectedKey],
  );
  const ioLockBinderDur =
    (summary.byType.io ?? 0) +
    (summary.byType.lock ?? 0) +
    (summary.byType.binder ?? 0);
  const ioLockBinderRatio = summary.totalDur > 0 ? ioLockBinderDur / summary.totalDur : 0;

  if (!rows.length) return <Empty description="暂无等待归因数据" />;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="分析结论"
        description={summary.conclusion}
      />
      <WaitSummaryCards
        totalDur={summary.totalDur}
        waitCount={summary.waitCount}
        maxDur={summary.maxDur}
        mainType={summary.mainTypeLabel}
        ioLockBinderRatio={ioLockBinderRatio}
      />
      <WaitCharts rows={rows} typeStats={summary.typeStats} onSelect={setSelectedKey} />
      <Typography.Text type="secondary">
        说明：调度等待表示线程处于可运行或就绪状态，但当前尚未获取 CPU 时间片；未知等待已按 IO/锁/同步/内核等线索做细分归因。
      </Typography.Text>
      <Card
        size="small"
        title="等待明细"
        extra={<Button size="small" onClick={() => exportCsv(activeResult?.rows ?? [])}>导出结果</Button>}
      >
        <WaitTable rows={rows} selectedKey={selectedValidKey} onSelect={setSelectedKey} />
      </Card>
    </Space>
  );
}
