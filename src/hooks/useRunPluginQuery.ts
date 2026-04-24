import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { message } from 'antd';
import { runPluginQuery } from '../lib/plugins';
import type { PluginDefinition, QueryParams, QueryResult, TraceDataset } from '../types';

type UseRunPluginQueryArgs = {
  dataset: TraceDataset | null;
  activePlugin: PluginDefinition;
  activePluginId: PluginDefinition['id'];
  activeParams: QueryParams;
  globalProcess: string;
  traceStartSec: number;
  setResultByPlugin: Dispatch<SetStateAction<Partial<Record<PluginDefinition['id'], QueryResult>>>>;
};

export function useRunPluginQuery({
  dataset,
  activePlugin,
  activePluginId,
  activeParams,
  globalProcess,
  traceStartSec,
  setResultByPlugin,
}: UseRunPluginQueryArgs) {
  const [running, setRunning] = useState(false);

  const onRun = async () => {
    if (!dataset) {
      message.warning('请先导入 trace 文件');
      return;
    }
    setRunning(true);
    try {
      const absParams: QueryParams = {
        ...activeParams,
        process: globalProcess || activeParams.process,
        startSec: activeParams.startSec + traceStartSec,
        endSec: activeParams.endSec + traceStartSec,
        // 与 startSec/endSec 一致：UI 为相对 trace 起点的秒数，SQL 需绝对时间戳（秒）
        compareStartSec: (activeParams.compareStartSec ?? 0) + traceStartSec,
        compareEndSec: (activeParams.compareEndSec ?? 0) + traceStartSec,
      };
      const r = await runPluginQuery(activePlugin, absParams);
      setResultByPlugin((prev) => ({ ...prev, [activePluginId]: r }));
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      const hint = text.includes('Failed to fetch') || text.includes('ECONNREFUSED')
        ? '后端服务未启动，请先执行 npm run server'
        : text;
      message.error(`查询失败: ${hint}`);
    } finally {
      setRunning(false);
    }
  };

  return { running, onRun };
}
