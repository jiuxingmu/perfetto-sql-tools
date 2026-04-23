import { Button, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import type { PluginDefinition, QueryResult } from '../types';
import { ResultTabs } from './results/ResultTabs';

type ResultsCardProps = {
  activePlugin: PluginDefinition;
  activeResult: QueryResult | null;
  blockedSuspiciousRuleText: string | null;
  listSummaryText: string | null;
  lineOption: Record<string, unknown> | null;
  tableColumns: Array<Record<string, unknown>>;
  tableScrollX: number;
  tableRowKey: (record: Record<string, unknown>, index?: number) => string;
  processListTableOnRow:
    | ((record: Record<string, unknown>) => {
      onMouseEnter: (e: { clientX: number; clientY: number }) => void;
      onMouseMove: (e: { clientX: number; clientY: number }) => void;
      onMouseLeave: () => void;
    })
    | undefined;
  rawRowsJson: string;
  trendDiffCompared: boolean;
  trendOpenedCount: number;
  trendClosedCount: number;
  onOpenTrendDiffModal: () => void;
};

export function ResultsCard({
  activePlugin,
  activeResult,
  blockedSuspiciousRuleText,
  listSummaryText,
  lineOption,
  tableColumns,
  tableScrollX,
  tableRowKey,
  processListTableOnRow,
  rawRowsJson,
  trendDiffCompared,
  trendOpenedCount,
  trendClosedCount,
  onOpenTrendDiffModal,
}: ResultsCardProps) {
  return (
    <Card title="结果">
      {activeResult?.stats?.length ? (
        <Row gutter={12} style={{ marginBottom: 12 }}>
          {activeResult.stats.map((s) => (
            <Col key={s.label} span={6}>
              <Card size="small"><Statistic title={s.label} value={s.value} /></Card>
            </Col>
          ))}
        </Row>
      ) : null}

      {blockedSuspiciousRuleText ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {blockedSuspiciousRuleText}
        </Typography.Text>
      ) : null}
      {listSummaryText ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {listSummaryText}
        </Typography.Text>
      ) : null}

      <ResultTabs
        activePluginId={activePlugin.id}
        activeResult={activeResult}
        lineOption={lineOption}
        tableColumns={tableColumns}
        tableScrollX={tableScrollX}
        tableRowKey={tableRowKey}
        processListTableOnRow={processListTableOnRow}
        rawRowsJson={rawRowsJson}
      />

      {activePlugin.id === 'thread-trend' && trendDiffCompared ? (
        <Card size="small" style={{ marginTop: 12 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text type="secondary">
              t1→t2 已完成对比：新开 {trendOpenedCount}，关闭 {trendClosedCount}
            </Typography.Text>
            <Button onClick={onOpenTrendDiffModal}>查看线程变化详情</Button>
          </Space>
        </Card>
      ) : null}
    </Card>
  );
}
