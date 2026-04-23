import { Card, Col, Row } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { WaitRow } from '../../hooks/useWaitReasonViewModel';

type WaitChartsProps = {
  rows: WaitRow[];
  typeStats: Array<{ key: string; label: string; description: string; duration: number }>;
  onSelect: (key: string) => void;
};

export function WaitCharts({ rows, typeStats, onSelect }: WaitChartsProps) {
  const pieOption = {
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['45%', '68%'], data: typeStats.map((item) => ({ name: item.label, value: item.duration })) }],
  };
  const barOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: typeStats.map((item) => item.label) },
    yAxis: { type: 'value', name: 'dur_ms' },
    grid: { left: 42, right: 12, top: 16, bottom: 28 },
    series: [{ type: 'bar', data: typeStats.map((item) => Number(item.duration.toFixed(3))), itemStyle: { color: '#95de64' } }],
  };
  const timelineOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { data?: [number, number, number, string] }) => {
        const data = params.data;
        if (!data) return '';
        return `开始: ${data[0].toFixed(3)} s<br/>持续: ${data[1].toFixed(3)} ms<br/>结束: ${data[2].toFixed(3)} s<br/>类型: ${data[3]}`;
      },
    },
    xAxis: { type: 'value', name: '相对时间(s)' },
    yAxis: { type: 'value', name: '等待时长(ms)' },
    grid: { left: 42, right: 12, top: 16, bottom: 28 },
    series: [{
      type: 'scatter',
      data: rows.map((row) => [row.blockedStartTs, row.blockedDurMs, row.blockedEndTs, row.waitTypeLabel]),
      itemStyle: { color: '#73d13d' },
      symbolSize: 8,
    }],
  };

  return (
    <Row gutter={12}>
      <Col span={8}><Card size="small" title="等待类型占比"><ReactECharts option={pieOption} style={{ height: 260 }} /></Card></Col>
      <Col span={8}><Card size="small" title="各类型累计时长"><ReactECharts option={barOption} style={{ height: 260 }} /></Card></Col>
      <Col span={8}>
        <Card size="small" title="等待时间线">
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
    </Row>
  );
}
