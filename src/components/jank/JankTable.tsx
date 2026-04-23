import { Button, Table } from 'antd';
import type { JankRow } from '../../hooks/useJankAnalysisViewModel';

type JankTableProps = {
  rows: JankRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

export function JankTable({ rows, selectedKey, onSelect }: JankTableProps) {
  return (
    <Table<JankRow>
      rowKey={(row) => row.key}
      size="small"
      dataSource={rows}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      rowClassName={(row) => (row.key === selectedKey ? 'jank-selected-row' : '')}
      expandable={{
        expandedRowRender: (row) => (
          <div style={{ display: 'grid', gap: 6 }}>
            <div><strong>上下文:</strong> {row.processName} / {row.mainThreadState}</div>
            <div><strong>阻塞原因:</strong> {row.blockingReason || '-'}</div>
            <div><strong>关联 slice:</strong> {row.topSliceName || '-'}</div>
          </div>
        ),
      }}
      columns={[
        { title: '开始时间', dataIndex: 'frameStartTs', key: 'frameStartTs', width: 120, render: (v: number) => v.toFixed(3) },
        { title: '结束时间', dataIndex: 'frameEndTs', key: 'frameEndTs', width: 120, render: (v: number) => v.toFixed(3) },
        { title: '持续时间(ms)', dataIndex: 'frameDurMs', key: 'frameDurMs', width: 120 },
        { title: '是否慢帧', dataIndex: 'slowFlag', key: 'slowFlag', width: 90, render: (v: boolean) => (v ? '是' : '否') },
        { title: '卡顿类型', dataIndex: 'jankType', key: 'jankType', width: 120 },
        { title: '主线程状态', dataIndex: 'mainThreadState', key: 'mainThreadState', width: 140 },
        { title: '阻塞原因', dataIndex: 'blockingReason', key: 'blockingReason', width: 180, ellipsis: true },
        { title: 'slice/函数', dataIndex: 'topSliceName', key: 'topSliceName', width: 180, ellipsis: true },
        {
          title: '操作',
          key: 'action',
          width: 120,
          render: (_, row) => <Button size="small" onClick={() => onSelect(row.key)}>定位此条</Button>,
        },
      ]}
      onRow={(row) => ({ onClick: () => onSelect(row.key) })}
      scroll={{ x: 1200 }}
    />
  );
}
