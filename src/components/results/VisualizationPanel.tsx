import { Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { PluginDefinition, QueryResult } from '../../types';

type VisualizationPanelProps = {
  activePluginId: PluginDefinition['id'];
  lineOption: Record<string, unknown> | null;
  activeResult: QueryResult | null;
  tableColumns: Array<Record<string, unknown>>;
  tableScrollX: number;
  tableRowKey: (record: Record<string, unknown>, index?: number) => string;
  processListTableOnRow:
    | ((record: Record<string, unknown>) => {
      onMouseEnter: (e: { clientX: number; clientY: number }) => void;
      onMouseMove: (e: { clientX: number; clientY: number }) => void;
      onMouseLeave: () => void;
    })
    | undefined;
};

export function VisualizationPanel({
  activePluginId,
  lineOption,
  activeResult,
  tableColumns,
  tableScrollX,
  tableRowKey,
  processListTableOnRow,
}: VisualizationPanelProps) {
  if (activePluginId === 'thread-trend' && lineOption) {
    return <ReactECharts option={lineOption} style={{ height: 320 }} />;
  }

  return (
    <Table<Record<string, unknown>>
      rowKey={tableRowKey}
      size="small"
      sticky
      tableLayout="fixed"
      scroll={tableScrollX ? { x: tableScrollX } : undefined}
      columns={tableColumns}
      dataSource={activeResult?.rows ?? []}
      pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200] }}
      onRow={processListTableOnRow}
    />
  );
}
