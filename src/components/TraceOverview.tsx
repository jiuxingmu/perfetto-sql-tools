import { Col, Empty, Row, Statistic } from 'antd';
import type { TraceDataset } from '../types';

type TraceOverviewProps = {
  dataset: TraceDataset | null;
  traceDurationSec: number;
};

export function TraceOverview({ dataset, traceDurationSec }: TraceOverviewProps) {
  if (!dataset) return <Empty description="请先导入 trace 文件" />;

  return (
    <Row gutter={[12, 20]}>
      <Col span={6}><Statistic title="Trace 名称" value={dataset.summary.traceName} /></Col>
      <Col span={6}><Statistic title="时间范围(相对s)" value={`0.00 - ${traceDurationSec.toFixed(2)}`} /></Col>
      <Col span={4}><Statistic title="进程数" value={dataset.summary.processCount} /></Col>
      <Col span={4}><Statistic title="线程数" value={dataset.summary.threadCount} /></Col>
      <Col span={4}><Statistic title="记录数" value={dataset.summary.recordCount} /></Col>
    </Row>
  );
}
