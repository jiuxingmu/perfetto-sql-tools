import { Space } from 'antd';
import { ParamsCard } from './ParamsCard';
import { ResultsCard } from './ResultsCard';
import { TraceOverview } from './TraceOverview';
import type {
  ParamFieldConfig,
  ResultViewProps,
  TrendCompareProps,
  TrendDiffSummaryProps,
} from './WorkbenchTypes';
import type { PluginDefinition, QueryResult, TraceDataset } from '../../types';

type WorkbenchMainContentProps = {
  dataset: TraceDataset | null;
  traceDurationSec: number;
  activePluginId: PluginDefinition['id'];
  activePluginName: string;
  activeResult: QueryResult | null;
  paramFields: ParamFieldConfig[];
  running: boolean;
  onRun: () => void;
  trendCompare?: TrendCompareProps;
  resultView: ResultViewProps;
  trendDiffSummary?: TrendDiffSummaryProps;
};

export function WorkbenchMainContent({
  dataset,
  traceDurationSec,
  activePluginId,
  activePluginName,
  activeResult,
  paramFields,
  running,
  onRun,
  trendCompare,
  resultView,
  trendDiffSummary,
}: WorkbenchMainContentProps) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <TraceOverview dataset={dataset} traceDurationSec={traceDurationSec} />

      <ParamsCard
        config={{
          activePluginName,
          paramFields,
          running,
          onRun,
        }}
        trendCompare={trendCompare}
      />

      <ResultsCard
        view={{
          activePluginId,
          activeResult,
          blockedSuspiciousRuleText: resultView.blockedSuspiciousRuleText,
          listSummaryText: resultView.listSummaryText,
          pluginGuidanceText: resultView.pluginGuidanceText,
          lineOption: resultView.lineOption,
          tableColumns: resultView.tableColumns,
          tableScrollX: resultView.tableScrollX,
          tableRowKey: resultView.tableRowKey,
          processListTableOnRow: resultView.processListTableOnRow,
          rawRowsJson: resultView.rawRowsJson,
        }}
        trendDiff={trendDiffSummary}
      />
    </Space>
  );
}
