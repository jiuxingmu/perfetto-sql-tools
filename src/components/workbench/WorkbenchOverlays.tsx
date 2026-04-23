import { ProcessDetailHoverPortal } from './ProcessDetailHoverPortal';
import { TrendDiffModal } from './TrendDiffModal';
import type { PluginDefinition } from '../../types';

type WorkbenchOverlaysProps = {
  activePluginId: PluginDefinition['id'];
  traceStartSec: number;
  hover: { x: number; y: number; record: Record<string, unknown> } | null;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  trendDiffModalOpen: boolean;
  trendOpenedRows: Array<Record<string, unknown>>;
  trendClosedRows: Array<Record<string, unknown>>;
  onCloseTrendDiffModal: () => void;
};

export function WorkbenchOverlays({
  activePluginId,
  traceStartSec,
  hover,
  onHoverEnter,
  onHoverLeave,
  trendDiffModalOpen,
  trendOpenedRows,
  trendClosedRows,
  onCloseTrendDiffModal,
}: WorkbenchOverlaysProps) {
  return (
    <>
      <TrendDiffModal
        open={trendDiffModalOpen}
        openedRows={trendOpenedRows}
        closedRows={trendClosedRows}
        onClose={onCloseTrendDiffModal}
      />
      <ProcessDetailHoverPortal
        hover={hover}
        activePluginId={activePluginId}
        traceStartSec={traceStartSec}
        onMouseEnter={onHoverEnter}
        onMouseLeave={onHoverLeave}
      />
    </>
  );
}
