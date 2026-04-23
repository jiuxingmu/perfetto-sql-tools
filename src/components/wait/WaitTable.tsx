import { Button, Table, Tooltip } from 'antd';
import type { WaitRow } from '../../hooks/useWaitReasonViewModel';

type WaitTableProps = {
  rows: WaitRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

export function WaitTable({ rows, selectedKey, onSelect }: WaitTableProps) {
  return (
    <Table<WaitRow>
      rowKey={(row) => row.key}
      size="small"
      dataSource={rows}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      rowClassName={(row) => (row.key === selectedKey ? 'wait-selected-row' : '')}
      columns={[
        { title: '等待开始时间', dataIndex: 'blockedStartTs', key: 'blockedStartTs', width: 120, render: (v: number) => `${v.toFixed(3)} s` },
        { title: '等待结束时间', dataIndex: 'blockedEndTs', key: 'blockedEndTs', width: 120, render: (v: number) => `${v.toFixed(3)} s` },
        { title: '等待时长', dataIndex: 'blockedDurMs', key: 'blockedDurMs', width: 120, render: (v: number) => `${v.toFixed(3)} ms` },
        {
          title: '等待类型',
          key: 'waitType',
          width: 130,
          render: (_, row) => <Tooltip title={row.waitTypeDescription}>{row.waitTypeLabel}</Tooltip>,
        },
        { title: '线程状态', dataIndex: 'threadState', key: 'threadState', width: 90 },
        { title: '阻塞函数', dataIndex: 'blockedFunction', key: 'blockedFunction', width: 180, ellipsis: true },
        { title: '唤醒线程', dataIndex: 'wakerThread', key: 'wakerThread', width: 130, ellipsis: true },
        { title: '唤醒进程', dataIndex: 'wakerProcess', key: 'wakerProcess', width: 150, ellipsis: true },
        {
          title: '操作',
          key: 'action',
          width: 120,
          render: (_, row) => <Button size="small" onClick={() => onSelect(row.key)}>查看详情</Button>,
        },
      ]}
      expandable={{
        expandedRowRender: (row) => (
          <div style={{ display: 'grid', gap: 6 }}>
            <div><strong>归因:</strong> {row.blockedReason || '-'}</div>
            <div><strong>上下文:</strong> {row.processName} (pid={row.pid ?? '-'}) / tid={row.tid ?? '-'}</div>
            <div><strong>阻塞函数:</strong> {row.blockedFunction || '-'}</div>
          </div>
        ),
      }}
      onRow={(row) => ({ onClick: () => onSelect(row.key) })}
      scroll={{ x: 1200 }}
    />
  );
}
