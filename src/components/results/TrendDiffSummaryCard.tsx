import { Button, Card, Space, Typography } from 'antd';
import type { TrendDiffSummaryProps } from '../workbench/WorkbenchTypes';

type TrendDiffSummaryCardProps = {
  trendDiff?: TrendDiffSummaryProps;
};

export function TrendDiffSummaryCard({ trendDiff }: TrendDiffSummaryCardProps) {
  if (!trendDiff) return null;
  return (
    <Card size="small" style={{ marginTop: 12 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Text type="secondary">
          t1→t2 已完成对比：新开 {trendDiff.openedCount}，关闭 {trendDiff.closedCount}
        </Typography.Text>
        <Button onClick={trendDiff.onOpenModal}>查看线程变化详情</Button>
      </Space>
    </Card>
  );
}
