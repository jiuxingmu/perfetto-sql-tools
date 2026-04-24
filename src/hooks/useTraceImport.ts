import { useMemo, useState } from 'react';
import type { UploadProps } from 'antd';
import { message } from 'antd';
import type { PluginDefinition, QueryParams, QueryResult, TraceDataset } from '../types';

async function inferTopCpuProcessName(): Promise<string> {
  const sql = `WITH process_cpu AS (
  SELECT
    COALESCE(p.name, printf('pid_%d', p.pid)) AS process_name,
    COALESCE(p.uid, -1) AS process_uid,
    SUM(COALESCE(s.dur, 0)) AS cpu_dur_ns
  FROM sched s
  JOIN thread t ON s.utid = t.utid
  LEFT JOIN process p ON t.upid = p.upid
  WHERE COALESCE(s.dur, 0) > 0
    AND COALESCE(p.name, '') <> ''
  GROUP BY process_name, process_uid
),
non_system_top AS (
  SELECT process_name, cpu_dur_ns
  FROM process_cpu
  WHERE process_uid >= 10000
     OR process_name LIKE 'com.%'
  ORDER BY cpu_dur_ns DESC, process_name ASC
  LIMIT 1
),
all_top AS (
  SELECT process_name, cpu_dur_ns
  FROM process_cpu
  ORDER BY cpu_dur_ns DESC, process_name ASC
  LIMIT 1
)
SELECT process_name
FROM non_system_top
UNION ALL
SELECT process_name
FROM all_top
WHERE NOT EXISTS (SELECT 1 FROM non_system_top)
LIMIT 1;`;

  const resp = await fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!resp.ok) return '';
  const rows = (await resp.json()) as Array<Record<string, unknown>>;
  const processName = rows[0]?.process_name;
  return typeof processName === 'string' ? processName : '';
}

type UseTraceImportArgs = {
  createParamsByPlugin: (defaultEndSec: number) => Record<PluginDefinition['id'], QueryParams>;
  setDataset: (dataset: TraceDataset) => void;
  setGlobalProcess: (value: string) => void;
  setResultByPlugin: (value: Partial<Record<PluginDefinition['id'], QueryResult>>) => void;
  setParamsByPlugin: (value: Record<PluginDefinition['id'], QueryParams>) => void;
};

export function useTraceImport({
  createParamsByPlugin,
  setDataset,
  setGlobalProcess,
  setResultByPlugin,
  setParamsByPlugin,
}: UseTraceImportArgs) {
  const [loading, setLoading] = useState(false);

  const uploadProps: UploadProps = useMemo(() => ({
    showUploadList: false,
    maxCount: 1,
    beforeUpload: async (file) => {
      setLoading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const resp = await fetch('/api/trace/import', { method: 'POST', body: form });
        if (!resp.ok) {
          throw new Error(await resp.text());
        }
        const parsed = (await resp.json()) as TraceDataset;
        setDataset(parsed);
        const topProcessName = await inferTopCpuProcessName().catch(() => '');
        setGlobalProcess(topProcessName);
        const relativeEndSec = Number((parsed.summary.timeRange[1] - parsed.summary.timeRange[0]).toFixed(3));
        setResultByPlugin({});
        setParamsByPlugin(createParamsByPlugin(relativeEndSec));
        const smartHint = topProcessName
          ? `智能分析已将全局进程定位为「${topProcessName}」。如果不符合你的排查目标，可在顶部下拉手动切换。`
          : '智能分析暂未定位到明确的全局进程，你可以在顶部下拉手动选择。';
        message.success({
          content: `已导入 trace: ${file.name}`,
        });
        message.info({
          content: smartHint,
          duration: 5,
        });
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        const hint = text.includes('Failed to fetch') || text.includes('ECONNREFUSED')
          ? '后端服务未启动，请先执行 npm run server'
          : text;
        message.error(`导入失败: ${hint}`);
      } finally {
        setLoading(false);
      }
      return false;
    },
  }), [createParamsByPlugin, setDataset, setGlobalProcess, setParamsByPlugin, setResultByPlugin]);

  return { loading, uploadProps };
}
