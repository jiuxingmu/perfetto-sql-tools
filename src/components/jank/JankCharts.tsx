import { Card, Col, Row } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { JankRow } from '../../hooks/useJankAnalysisViewModel';

type JankChartsProps = {
  rows: JankRow[];
  onSelect: (key: string) => void;
};

export function JankCharts({ rows, onSelect }: JankChartsProps) {
  const timelineOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: rows.map((r) => r.frameStartTs.toFixed(3)) },
    yAxis: { type: 'value', name: 'frame_dur_ms' },
    grid: { left: 40, right: 12, top: 16, bottom: 28 },
    series: [{
      type: 'line',
      smooth: true,
      data: rows.map((r) => r.frameDurMs),
      lineStyle: { color: '#1677ff' },
    }],
  };

  const bins = [0, 16.6, 33, 50, 100, Number.POSITIVE_INFINITY];
  const labels = ['<=16.6', '16.6~33', '33~50', '50~100', '>100'];
  const distribution = [0, 0, 0, 0, 0];
  rows.forEach((row) => {
    const dur = row.frameDurMs;
    for (let i = 0; i < bins.length - 1; i += 1) {
      if (dur > bins[i] && dur <= bins[i + 1]) {
        distribution[i] += 1;
        break;
      }
    }
  });

  const distOption = {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value' },
    grid: { left: 32, right: 12, top: 16, bottom: 28 },
    series: [{ type: 'bar', data: distribution, itemStyle: { color: '#69b1ff' } }],
  };

  const slowCount = rows.filter((row) => row.slowFlag).length;
  const pieOption = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['45%', '68%'],
      data: [
        { name: '慢帧', value: slowCount },
        { name: '正常帧', value: Math.max(0, rows.length - slowCount) },
      ],
    }],
  };

  return (
    <Row gutter={12}>
      <Col span={12}>
        <Card size="small" title="卡顿时间线">
          <ReactECharts
            option={timelineOption}
            style={{ height: 260 }}
            onEvents={{ click: (e: { dataIndex?: number }) => {
              const idx = e.dataIndex ?? -1;
              if (idx >= 0 && idx < rows.length) onSelect(rows[idx].key);
            } }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small" title="帧耗时分布">
          <ReactECharts option={distOption} style={{ height: 260 }} />
        </Card>
      </Col>
      <Col span={6}>
        <Card size="small" title="慢帧占比">
          <ReactECharts option={pieOption} style={{ height: 260 }} />
        </Card>
      </Col>
    </Row>
  );
}
