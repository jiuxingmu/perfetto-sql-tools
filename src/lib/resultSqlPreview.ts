import type { PluginDefinition, QueryResult } from '../types';

/**
 * 仅展示「当前插件」最近一次查询所对应的 SQL，避免与其它插件结果串台。
 */
export function sqlPreviewForActivePlugin(
  activePluginId: PluginDefinition['id'],
  activeResult: QueryResult | null,
): string {
  if (!activeResult) return '--';
  if (activeResult.pluginId !== activePluginId) return '--';
  return activeResult.sqlPreviewRelative;
}
