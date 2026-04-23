import { Button, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import type { ResultViewProps, TrendDiffSummaryProps } from './workbenchTypes';
import { ResultTabs } from './results/ResultTabs';

type ResultsCardProps = {
  view: ResultViewProps;
  trendDiff?: TrendDiffSummaryProps;
};

export function ResultsCard({
  view,
  trendDiff,
}: ResultsCardProps) {
  return (
    <Card title="结果">
      {view.activeResult?.stats?.length ? (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {view.activeResult.stats.map((s) => (
            <Col key={s.label} span={6}>
              <Card size="small"><Statistic title={s.label} value={s.value} /></Card>
            </Col>
          ))}
        </Row>
      ) : null}

      {view.blockedSuspiciousRuleText ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {view.blockedSuspiciousRuleText}
        </Typography.Text>
      ) : null}
      {view.listSummaryText ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {view.listSummaryText}
        </Typography.Text>
      ) : null}

      <ResultTabs
        activePluginId={view.activePluginId}
        activeResult={view.activeResult}
        lineOption={view.lineOption}
        tableColumns={view.tableColumns}
        tableScrollX={view.tableScrollX}
        tableRowKey={view.tableRowKey}
        processListTableOnRow={view.processListTableOnRow}
        rawRowsJson={view.rawRowsJson}
      />

      {trendDiff ? (
        <Card size="small" style={{ marginTop: 12 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text type="secondary">
              t1→t2 已完成对比：新开 {trendDiff.openedCount}，关闭 {trendDiff.closedCount}
            </Typography.Text>
            <Button onClick={trendDiff.onOpenModal}>查看线程变化详情</Button>
          </Space>
        </Card>
      ) : null}
    </Card>
  );
}
