import { Tabs } from 'antd';
import type { PluginDefinition, QueryResult } from '../../types';
import type { TableRowHoverHandler } from '../workbench/WorkbenchTypes';
import { RawCodePanel } from './RawCodePanel';
import { VisualizationPanel } from './VisualizationPanel';

type ResultTabsProps = {
  activePluginId: PluginDefinition['id'];
  activeResult: QueryResult | null;
  lineOption: Record<string, unknown> | null;
  tableColumns: Array<Record<string, unknown>>;
  tableScrollX: number;
  tableRowKey: (record: Record<string, unknown>, index?: number) => string;
  processListTableOnRow: TableRowHoverHandler;
  rawRowsJson: string;
};

export function ResultTabs({
  activePluginId,
  activeResult,
  lineOption,
  tableColumns,
  tableScrollX,
  tableRowKey,
  processListTableOnRow,
  rawRowsJson,
}: ResultTabsProps) {
  return (
    <Tabs items={[
      {
        key: 'viz',
        label: '可视化结果',
        children: (
          <VisualizationPanel
            activePluginId={activePluginId}
            lineOption={lineOption}
            activeResult={activeResult}
            tableColumns={tableColumns}
            tableScrollX={tableScrollX}
            tableRowKey={tableRowKey}
            processListTableOnRow={processListTableOnRow}
          />
        ),
      },
      {
        key: 'sql',
        label: 'SQL 预览',
        children: (
          <RawCodePanel dark value={activeResult?.sqlPreview ?? '--'} />
        ),
      },
      {
        key: 'raw',
        label: '原始数据',
        children: (
          <RawCodePanel value={rawRowsJson} />
        ),
      },
    ]} />
  );
}
