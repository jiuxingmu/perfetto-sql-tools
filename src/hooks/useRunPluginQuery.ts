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
  baselineDataset: TraceDataset | null;
  baselineTraceStartSec: number;
  setResultByPlugin: Dispatch<SetStateAction<Partial<Record<PluginDefinition['id'], QueryResult>>>>;
};

export function useRunPluginQuery({
  dataset,
  activePlugin,
  activePluginId,
  activeParams,
  globalProcess,
  traceStartSec,
  baselineDataset,
  baselineTraceStartSec,
  setResultByPlugin,
}: UseRunPluginQueryArgs) {
  const [running, setRunning] = useState(false);

  const onRun = async () => {
    if (!dataset) {
      message.warning('请先导入 trace 文件');
      return;
    }
    const isDualStackDiff =
      activePluginId === 'main-thread-stack-diff-analysis'
      && (activeParams.stackDiffMode ?? 'single-trace') === 'dual-trace';
    if (isDualStackDiff && !baselineDataset) {
      message.warning('双 trace 模式请先导入基线 trace 文件');
      return;
    }
    setRunning(true);
    try {
      const compareOffset = isDualStackDiff ? baselineTraceStartSec : traceStartSec;
      const absParams: QueryParams = {
        ...activeParams,
        process: globalProcess || activeParams.process,
        startSec: activeParams.startSec + traceStartSec,
        endSec: activeParams.endSec + traceStartSec,
        compareStartSec: (activeParams.compareStartSec ?? 0) + compareOffset,
        compareEndSec: (activeParams.compareEndSec ?? 0) + compareOffset,
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
