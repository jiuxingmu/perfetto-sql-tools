import { Card } from 'antd';
import type { ResultViewProps, TrendDiffSummaryProps } from './WorkbenchTypes';
import {
  ResultTabs,
  ResultStatsRow,
  ResultSummaryTexts,
  TrendDiffSummaryCard,
} from '../results';

type ResultsCardProps = {
  view: ResultViewProps;
  trendDiff?: TrendDiffSummaryProps;
};

export function ResultsCard({
  view,
  trendDiff,
}: ResultsCardProps) {
  return (
    <Card title="结果">
      <ResultStatsRow activeResult={view.activeResult} />
      <ResultSummaryTexts
        blockedSuspiciousRuleText={view.blockedSuspiciousRuleText}
        listSummaryText={view.listSummaryText}
      />

      <ResultTabs
        activePluginId={view.activePluginId}
        activeResult={view.activeResult}
        lineOption={view.lineOption}
        tableColumns={view.tableColumns}
        tableScrollX={view.tableScrollX}
        tableRowKey={view.tableRowKey}
        processListTableOnRow={view.processListTableOnRow}
        rawRowsJson={view.rawRowsJson}
      />

      <TrendDiffSummaryCard trendDiff={trendDiff} />
    </Card>
  );
}
