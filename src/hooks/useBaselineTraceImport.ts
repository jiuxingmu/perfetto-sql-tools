import { useMemo, useState } from 'react';
import type { UploadProps } from 'antd';
import { message } from 'antd';
import { apiUrl } from '../lib/api';
import type { TraceDataset } from '../types';

type UseBaselineTraceImportArgs = {
  setBaselineDataset: (value: TraceDataset | null) => void;
};

export function useBaselineTraceImport({ setBaselineDataset }: UseBaselineTraceImportArgs) {
  const [loading, setLoading] = useState(false);

  const uploadProps: UploadProps = useMemo(() => ({
    showUploadList: false,
    maxCount: 1,
    beforeUpload: async (file) => {
      setLoading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const resp = await fetch(apiUrl('/trace/import-baseline'), { method: 'POST', body: form });
        if (!resp.ok) {
          const raw = await resp.text();
          if (raw.includes('Cannot POST') || raw.includes('<!DOCTYPE')) {
            throw new Error(
              '后端未提供该接口（多为旧进程或未代理）。请重启：npm run server；若用 vite preview，需同时跑后端且已配置 /api → 3001。',
            );
          }
          throw new Error(raw);
        }
        const parsed = (await resp.json()) as TraceDataset;
        setBaselineDataset(parsed);
        message.success(`已导入基线 trace: ${file.name}`);
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        const hint = text.includes('Failed to fetch') || text.includes('ECONNREFUSED')
          ? '后端服务未启动，请先执行 npm run server'
          : text;
        message.error(`基线导入失败: ${hint}`);
      } finally {
        setLoading(false);
      }
      return false;
    },
  }), [setBaselineDataset]);

  const clearBaseline = async () => {
    try {
      await fetch(apiUrl('/trace/baseline'), { method: 'DELETE' });
    } catch {
      // ignore network errors; still clear local state
    }
    setBaselineDataset(null);
    message.info('已清除基线 trace');
  };

  return { loading, uploadProps, clearBaseline };
}
