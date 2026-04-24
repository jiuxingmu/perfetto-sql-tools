import { Table, Tag } from 'antd';
import type { StackDiffRow } from '../../hooks/useMainThreadStackDiffViewModel';

type StackDiffTableProps = {
  rows: StackDiffRow[];
};

const riskColorMap: Record<string, string> = {
  高风险: 'red',
  异常: 'orange',
  关注: 'gold',
  正常: 'default',
};

export function StackDiffTable({ rows }: StackDiffTableProps) {
  return (
    <Table<StackDiffRow>
      size="small"
      rowKey="key"
      dataSource={rows}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      scroll={{ x: 1450 }}
      columns={[
        { title: '调用链', dataIndex: 'stackKey', key: 'stackKey', width: 260, ellipsis: true },
        { title: '变化类型', dataIndex: 'changeType', key: 'changeType', width: 100 },
        {
          title: '风险等级',
          dataIndex: 'riskLevel',
          key: 'riskLevel',
          width: 100,
          render: (value: string) => <Tag color={riskColorMap[value] ?? 'default'}>{value}</Tag>,
        },
        { title: 'A调用', dataIndex: 'callsA', key: 'callsA', width: 80 },
        { title: 'B调用', dataIndex: 'callsB', key: 'callsB', width: 80 },
        { title: '调用差值', dataIndex: 'callsDelta', key: 'callsDelta', width: 92 },
        { title: 'A总耗时(ms)', dataIndex: 'costAMs', key: 'costAMs', width: 110, render: (v: number) => v.toFixed(3) },
        { title: 'B总耗时(ms)', dataIndex: 'costBMs', key: 'costBMs', width: 110, render: (v: number) => v.toFixed(3) },
        { title: '耗时差值(ms)', dataIndex: 'costDeltaMs', key: 'costDeltaMs', width: 120, render: (v: number) => v.toFixed(3) },
        { title: 'A平均(ms)', dataIndex: 'avgAMs', key: 'avgAMs', width: 100, render: (v: number) => v.toFixed(3) },
        { title: 'B平均(ms)', dataIndex: 'avgBMs', key: 'avgBMs', width: 100, render: (v: number) => v.toFixed(3) },
        { title: '平均差值(ms)', dataIndex: 'avgDeltaMs', key: 'avgDeltaMs', width: 110, render: (v: number) => v.toFixed(3) },
        { title: '进程', dataIndex: 'processName', key: 'processName', width: 180, ellipsis: true },
        { title: '线程', dataIndex: 'threadName', key: 'threadName', width: 180, ellipsis: true },
      ]}
    />
  );
}
