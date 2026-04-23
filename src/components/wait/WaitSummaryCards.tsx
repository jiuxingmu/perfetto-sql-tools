import { Card, Col, Row, Statistic } from 'antd';

type WaitSummaryCardsProps = {
  totalDur: number;
  waitCount: number;
  maxDur: number;
  mainType: string;
  ioLockBinderRatio: number;
};

export function WaitSummaryCards({
  totalDur,
  waitCount,
  maxDur,
  mainType,
  ioLockBinderRatio,
}: WaitSummaryCardsProps) {
  return (
    <Row gutter={12}>
      <Col span={5}><Card size="small"><Statistic title="总等待时长(ms)" value={totalDur.toFixed(2)} /></Card></Col>
      <Col span={5}><Card size="small"><Statistic title="等待次数" value={waitCount} /></Card></Col>
      <Col span={5}><Card size="small"><Statistic title="最长等待时长(ms)" value={maxDur.toFixed(3)} /></Card></Col>
      <Col span={5}><Card size="small"><Statistic title="最主要等待类型" value={mainType || '-'} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="IO/锁/Binder占比" value={(ioLockBinderRatio * 100).toFixed(2)} suffix="%" /></Card></Col>
    </Row>
  );
}
