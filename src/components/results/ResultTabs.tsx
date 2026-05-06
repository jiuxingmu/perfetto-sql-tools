import { Space, Tabs, Typography } from 'antd';
import type { PluginDefinition, QueryResult } from '../../types';
import { sqlPreviewForActivePlugin } from '../../lib/resultSqlPreview';
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
  const sqlPreviewText = sqlPreviewForActivePlugin(activePluginId, activeResult);

  return (
    <Tabs
      destroyOnHidden
      items={[
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
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                与参数面板一致：时间窗口等为相对主 trace 起点（双 trace 时基线窗口相对基线文件起点）。点击「开始分析」后，实际请求里的时间会先加上对应 trace 起点再发给后端执行。
              </Typography.Paragraph>
              <RawCodePanel
                key={`sql-${activePluginId}-${activeResult?.pluginId ?? 'none'}`}
                dark
                value={sqlPreviewText}
              />
            </Space>
          ),
        },
        {
          key: 'raw',
          label: '原始数据',
          children: (
            <RawCodePanel value={rawRowsJson} />
          ),
        },
      ]}
    />
  );
}
