import type { PluginDefinition, QueryResult } from '../../types';
import type { ReactNode } from 'react';

export type TableRowHoverHandler =
  | ((record: Record<string, unknown>) => {
    onMouseEnter: (e: { clientX: number; clientY: number }) => void;
    onMouseMove: (e: { clientX: number; clientY: number }) => void;
    onMouseLeave: () => void;
  })
  | undefined;

export type ResultViewProps = {
  activePluginId: PluginDefinition['id'];
  activeResult: QueryResult | null;
  blockedSuspiciousRuleText: string | null;
  listSummaryText: string | null;
  lineOption: Record<string, unknown> | null;
  tableColumns: Array<Record<string, unknown>>;
  tableScrollX: number;
  tableRowKey: (record: Record<string, unknown>, index?: number) => string;
  processListTableOnRow: TableRowHoverHandler;
  rawRowsJson: string;
};

export type TrendDiffSummaryProps = {
  openedCount: number;
  closedCount: number;
  onOpenModal: () => void;
};

export type ParamFieldConfig = {
  key: string;
  label: string;
  control: ReactNode;
};

export type ParamsConfigProps = {
  activePluginName: string;
  paramFields: ParamFieldConfig[];
  running: boolean;
  onRun: () => void;
};

export type TrendCompareProps = {
  range: { t1?: number; t2?: number };
  timePointOptions: Array<{ label: string; value: number }>;
  running: boolean;
  onChangeRange: (patch: { t1?: number; t2?: number }) => void;
  onCompare: () => void;
};
