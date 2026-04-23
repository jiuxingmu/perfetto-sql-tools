import { useMemo, useState } from 'react';
import type { UploadProps } from 'antd';
import { message } from 'antd';
import type { PluginDefinition, QueryParams, QueryResult, TraceDataset } from '../types';

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
        setGlobalProcess('');
        const relativeEndSec = Number((parsed.summary.timeRange[1] - parsed.summary.timeRange[0]).toFixed(3));
        setResultByPlugin({});
        setParamsByPlugin(createParamsByPlugin(relativeEndSec));
        message.success(`已导入 trace: ${file.name}`);
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
