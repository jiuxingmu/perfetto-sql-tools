import { Card, Col, Row, Statistic } from 'antd';

type StackDiffSummaryCardsProps = {
  totalCallDelta: number;
  totalCostDelta: number;
  addedCount: number;
  removedCount: number;
  riskyCount: number;
};

export function StackDiffSummaryCards({
  totalCallDelta,
  totalCostDelta,
  addedCount,
  removedCount,
  riskyCount,
}: StackDiffSummaryCardsProps) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} sm={12} md={8} lg={4}>
        <Card size="small"><Statistic title="总调用增量" value={totalCallDelta} /></Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={5}>
        <Card size="small"><Statistic title="总耗时增量(ms)" value={Number(totalCostDelta.toFixed(3))} /></Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={5}>
        <Card size="small"><Statistic title="新增调用链" value={addedCount} /></Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={5}>
        <Card size="small"><Statistic title="消失调用链" value={removedCount} /></Card>
      </Col>
      <Col xs={24} sm={12} md={8} lg={5}>
        <Card size="small"><Statistic title="风险项" value={riskyCount} /></Card>
      </Col>
    </Row>
  );
}
