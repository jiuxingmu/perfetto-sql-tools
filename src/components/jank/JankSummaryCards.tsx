import { Card, Col, Row, Statistic } from 'antd';

type JankSummaryCardsProps = {
  frameCount: number;
  slowCount: number;
  slowRatio: number;
  maxDur: number;
  worstRange: string;
};

export function JankSummaryCards({
  frameCount,
  slowCount,
  slowRatio,
  maxDur,
  worstRange,
}: JankSummaryCardsProps) {
  return (
    <Row gutter={12}>
      <Col span={5}><Card size="small"><Statistic title="总帧数" value={frameCount} /></Card></Col>
      <Col span={5}><Card size="small"><Statistic title="慢帧数" value={slowCount} /></Card></Col>
      <Col span={5}><Card size="small"><Statistic title="慢帧占比" value={(slowRatio * 100).toFixed(2)} suffix="%" /></Card></Col>
      <Col span={5}><Card size="small"><Statistic title="最大卡顿时长(ms)" value={maxDur.toFixed(3)} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="最严重时间段" value={worstRange} valueStyle={{ fontSize: 12 }} /></Card></Col>
    </Row>
  );
}
