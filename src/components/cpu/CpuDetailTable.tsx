import { Table } from 'antd';
import type { CpuRow } from '../../hooks/useCpuAnalysisViewModel';

type CpuDetailTableProps = {
  rows: CpuRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

export function CpuDetailTable({ rows, selectedKey, onSelect }: CpuDetailTableProps) {
  return (
    <Table<CpuRow>
      rowKey={(row) => row.key}
      size="small"
      pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
      dataSource={rows}
      columns={[
        { title: 'name', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
        { title: 'pid', dataIndex: 'pid', key: 'pid', width: 88 },
        { title: 'tid', dataIndex: 'tid', key: 'tid', width: 88 },
        { title: 'cpu_dur_ms', dataIndex: 'cpuDurMs', key: 'cpuDurMs', width: 120 },
        {
          title: 'cpu_ratio',
          dataIndex: 'cpuRatio',
          key: 'cpuRatio',
          width: 120,
          render: (v: number) => `${(v * 100).toFixed(2)}%`,
        },
        { title: 'slice_count', dataIndex: 'sliceCount', key: 'sliceCount', width: 110 },
        { title: 'avg_slice_dur_ms', dataIndex: 'avgSliceDurMs', key: 'avgSliceDurMs', width: 140 },
      ]}
      rowClassName={(row) => (row.key === selectedKey ? 'cpu-selected-row' : '')}
      onRow={(row) => ({
        onClick: () => onSelect(row.key),
      })}
      scroll={{ x: 980 }}
    />
  );
}
