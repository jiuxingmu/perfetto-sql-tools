import { Tabs } from 'antd';
import type { PluginDefinition, QueryResult } from '../../types';
import { VisualizationPanel } from './VisualizationPanel';

type ResultTabsProps = {
  activePluginId: PluginDefinition['id'];
  activeResult: QueryResult | null;
  lineOption: Record<string, unknown> | null;
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
          <pre style={{ margin: 0, background: '#0b1020', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
            {activeResult?.sqlPreview ?? '--'}
          </pre>
        ),
      },
      {
        key: 'raw',
        label: '原始数据',
        children: (
          <pre style={{ margin: 0, background: '#f6f8fa', padding: 12, borderRadius: 8, maxHeight: 320, overflow: 'auto' }}>
            {rawRowsJson}
          </pre>
        ),
      },
    ]} />
  );
}
