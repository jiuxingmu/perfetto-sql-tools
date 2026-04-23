import { Card, Col, Row, Statistic } from 'antd';
import type { QueryResult } from '../../types';

type ResultStatsRowProps = {
  activeResult: QueryResult | null;
};

export function ResultStatsRow({ activeResult }: ResultStatsRowProps) {
  if (!activeResult?.stats?.length) return null;
  return (
    <Row gutter={12} style={{ marginBottom: 12 }}>
      {activeResult.stats.map((s) => (
        <Col key={s.label} span={6}>
          <Card size="small"><Statistic title={s.label} value={s.value} /></Card>
        </Col>
      ))}
    </Row>
  );
}
