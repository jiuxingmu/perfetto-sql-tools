import { Alert, Button, Card, Empty, Space, Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { QueryResult } from '../../types';
import { useProcessOverviewViewModel } from '../../hooks/useProcessOverviewViewModel';

type ProcessOverviewPanelProps = {
  activeResult: QueryResult | null;
};

function exportCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(','), ...rows.map((row) => keys.map((k) => JSON.stringify(row[k] ?? '')).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'process-overview.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ProcessOverviewPanel({ activeResult }: ProcessOverviewPanelProps) {
  const { rows, summary } = useProcessOverviewViewModel(activeResult);
  if (!rows.length) return <Empty description="当前时间范围内没有活跃进程或未命中筛选条件" />;

  const chartRows = rows.slice(0, 20);
  const chartOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 36, right: 24, top: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      data: chartRows.map((r) => r.process),
      axisLabel: { rotate: 20 },
      splitLine: { show: false },
    },
    yAxis: [
      { type: 'value', name: 'CPU(ms)', splitLine: { show: false } },
      { type: 'value', name: '线程数', splitLine: { show: false } },
    ],
    series: [
      { name: 'CPU(ms)', type: 'bar', yAxisIndex: 0, data: chartRows.map((r) => Number(r.cpuTimeMs.toFixed(2))) },
      { name: '线程数', type: 'line', yAxisIndex: 1, smooth: true, data: chartRows.map((r) => r.threadCount) },
    ],
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="分析结论" description={summary.conclusion} />
      <Card size="small" title="进程画像图（Top 20）">
        <ReactECharts option={chartOption} style={{ height: 300 }} />
      </Card>
      <Card
        size="small"
        title={`进程画像明细（总进程 ${summary.totalProcessCount}，活跃 ${summary.activeProcessCount}）`}
        extra={<Button size="small" onClick={() => exportCsv(activeResult?.rows ?? [])}>导出结果</Button>}
      >
        <Table
          size="small"
          rowKey="key"
          dataSource={rows}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          columns={[
            { title: '进程', dataIndex: 'process', key: 'process', width: 220, ellipsis: true },
            { title: 'PID', dataIndex: 'pid', key: 'pid', width: 90 },
            { title: 'UID', dataIndex: 'uid', key: 'uid', width: 90 },
            { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
            { title: '活跃时长(s)', dataIndex: 'activeInWindowSec', key: 'activeInWindowSec', width: 120, render: (v: number) => v.toFixed(3) },
            { title: 'CPU(ms)', dataIndex: 'cpuTimeMs', key: 'cpuTimeMs', width: 110, render: (v: number) => v.toFixed(2) },
            { title: '线程数', dataIndex: 'threadCount', key: 'threadCount', width: 90 },
          ]}
          scroll={{ x: 980 }}
        />
      </Card>
    </Space>
  );
}
