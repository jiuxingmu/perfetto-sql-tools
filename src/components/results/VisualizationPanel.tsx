import { Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { PluginDefinition, QueryResult } from '../../types';
import type { TableRowHoverHandler } from '../workbench/WorkbenchTypes';
import { CpuResultPanel } from '../cpu';
import { JankResultPanel } from '../jank';
import { ProcessOverviewPanel } from '../process';
import { WaitResultPanel } from '../wait';

type VisualizationPanelProps = {
  activePluginId: PluginDefinition['id'];
  lineOption: Record<string, unknown> | null;
  activeResult: QueryResult | null;
  tableColumns: Array<Record<string, unknown>>;
  tableScrollX: number;
  tableRowKey: (record: Record<string, unknown>, index?: number) => string;
  processListTableOnRow: TableRowHoverHandler;
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
  if (activePluginId === 'cpu-usage-analysis') {
    return <CpuResultPanel activeResult={activeResult} />;
  }
  if (activePluginId === 'main-thread-jank-analysis') {
    return <JankResultPanel activeResult={activeResult} />;
  }
  if (activePluginId === 'wait-reason-analysis') {
    return <WaitResultPanel activeResult={activeResult} />;
  }
  if (activePluginId === 'process-list') {
    return <ProcessOverviewPanel activeResult={activeResult} />;
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
