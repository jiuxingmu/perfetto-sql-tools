import { Card, Col, Row, Statistic } from 'antd';

type CpuSummaryCardsProps = {
  totalCpuDurMs: number;
  top1Name: string;
  hotThreadCount: number;
  top10Ratio: number;
};

export function CpuSummaryCards({
  totalCpuDurMs,
  top1Name,
  hotThreadCount,
  top10Ratio,
}: CpuSummaryCardsProps) {
  return (
    <Row gutter={12}>
      <Col span={6}><Card size="small"><Statistic title="总 CPU 时长(ms)" value={totalCpuDurMs} /></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="Top 1 对象" value={top1Name || '-'} /></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="热点线程数" value={hotThreadCount} /></Card></Col>
      <Col span={6}><Card size="small"><Statistic title="Top10 占比" value={(top10Ratio * 100).toFixed(2)} suffix="%" /></Card></Col>
    </Row>
  );
}
