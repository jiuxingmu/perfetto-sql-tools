import { useCallback, useMemo, useState } from 'react';
import { PLUGINS } from '../lib/plugins';
import { createDefaultParams, createParamsByPlugin, PLUGIN_DISPLAY_ORDER } from '../lib/pluginState';
import type { PluginDefinition, QueryParams, QueryResult } from '../types';

type UsePluginWorkspaceArgs = {
  traceDurationSec: number;
};

export function usePluginWorkspace({ traceDurationSec }: UsePluginWorkspaceArgs) {
  const [activePluginId, setActivePluginId] = useState<PluginDefinition['id']>('process-list');
  const [paramsByPlugin, setParamsByPlugin] = useState<Record<PluginDefinition['id'], QueryParams>>(() =>
    createParamsByPlugin(10),
  );
  const [resultByPlugin, setResultByPlugin] = useState<Partial<Record<PluginDefinition['id'], QueryResult>>>({});

  const activePlugin = useMemo(() => PLUGINS.find((plugin) => plugin.id === activePluginId)!, [activePluginId]);

  const orderedPlugins = useMemo(() => {
    const rank = new Map(PLUGIN_DISPLAY_ORDER.map((id, idx) => [id, idx]));
    return [...PLUGINS].sort((a, b) => {
      const rankA = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    });
  }, []);

  const activeParams = paramsByPlugin[activePluginId] ?? createDefaultParams(10);
  const activeResult = resultByPlugin[activePluginId] ?? null;

  const setActiveParams = useCallback((updater: (params: QueryParams) => QueryParams) => {
    setParamsByPlugin((prev) => ({
      ...prev,
      [activePluginId]: updater(prev[activePluginId] ?? createDefaultParams(traceDurationSec || 10)),
    }));
  }, [activePluginId, traceDurationSec]);

  return {
    activePluginId,
    setActivePluginId,
    activePlugin,
    orderedPlugins,
    paramsByPlugin,
    setParamsByPlugin,
    activeParams,
    setActiveParams,
    resultByPlugin,
    setResultByPlugin,
    activeResult,
  };
}
