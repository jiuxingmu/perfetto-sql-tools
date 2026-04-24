import { Alert, Button, Card, Empty, Space, Table, Tag } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { QueryResult } from '../../types';
import { useThreadOverviewViewModel } from '../../hooks/useThreadOverviewViewModel';

type ThreadOverviewPanelProps = {
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
  a.download = 'thread-overview.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ThreadOverviewPanel({ activeResult }: ThreadOverviewPanelProps) {
  const { rows, summary } = useThreadOverviewViewModel(activeResult);
  if (!rows.length) return <Empty description="当前时间范围内没有线程数据或未命中筛选条件" />;

  const chartRows = rows.slice(0, 20);
  const chartOption = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 36, right: 24, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: chartRows.map((r) => r.threadName), axisLabel: { rotate: 20 } },
    yAxis: [
      { type: 'value', name: 'CPU(ms)', splitLine: { show: false } },
      { type: 'value', name: '次数', splitLine: { show: false } },
    ],
    series: [
      { name: 'CPU(ms)', type: 'bar', yAxisIndex: 0, data: chartRows.map((r) => Number(r.cpuTimeMs.toFixed(2))) },
      { name: '切换次数', type: 'line', yAxisIndex: 1, smooth: true, data: chartRows.map((r) => r.switchCount) },
      { name: '唤醒次数', type: 'line', yAxisIndex: 1, smooth: true, data: chartRows.map((r) => r.wakeupCount) },
    ],
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="分析结论" description={summary.conclusion} />
      <Card size="small" title="线程画像图（Top 20）">
        <ReactECharts option={chartOption} style={{ height: 320 }} />
      </Card>
      <Card
        size="small"
        title={`线程画像明细（总线程 ${summary.totalThreadCount}，活跃 ${summary.activeThreadCount}，主线程 ${summary.mainThreadCount}）`}
        extra={<Button size="small" onClick={() => exportCsv(activeResult?.rows ?? [])}>导出结果</Button>}
      >
        <Table
          size="small"
          rowKey="key"
          dataSource={rows}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          columns={[
            { title: '线程名', dataIndex: 'threadName', key: 'threadName', width: 220, ellipsis: true },
            { title: 'TID', dataIndex: 'tid', key: 'tid', width: 90 },
            { title: 'PID', dataIndex: 'pid', key: 'pid', width: 90 },
            { title: '进程', dataIndex: 'processName', key: 'processName', width: 180, ellipsis: true },
            {
              title: '主线程',
              dataIndex: 'isMainThread',
              key: 'isMainThread',
              width: 90,
              render: (v: number) => (v === 1 ? <Tag color="blue">是</Tag> : '否'),
            },
            { title: '线程类型', dataIndex: 'threadType', key: 'threadType', width: 110 },
            { title: '活跃时长(ms)', dataIndex: 'activeDurationMs', key: 'activeDurationMs', width: 120, render: (v: number) => v.toFixed(3) },
            { title: 'CPU(ms)', dataIndex: 'cpuTimeMs', key: 'cpuTimeMs', width: 110, render: (v: number) => v.toFixed(3) },
            { title: '切换次数', dataIndex: 'switchCount', key: 'switchCount', width: 100 },
            { title: '唤醒次数', dataIndex: 'wakeupCount', key: 'wakeupCount', width: 100 },
            { title: '建议下一步', dataIndex: 'nextStep', key: 'nextStep', width: 180, ellipsis: true },
          ]}
          scroll={{ x: 1500 }}
        />
      </Card>
    </Space>
  );
}
