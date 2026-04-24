import { Card, Space, Typography } from 'antd';
import { createPortal } from 'react-dom';
import type { PluginDefinition } from '../../types';
import {
  formatDetailValue,
  PROCESS_LIST_EXTRA_KEY_ORDER,
  PROCESS_LIST_TABLE_KEYS,
} from '../../lib/resultPresentation';

type HoverState = {
  record: Record<string, unknown>;
  x: number;
  y: number;
};

type ProcessDetailHoverPortalProps = {
  hover: HoverState | null;
  activePluginId: PluginDefinition['id'];
  traceStartSec: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function ProcessDetailHoverPortal({
  hover,
  activePluginId,
  traceStartSec,
  onMouseEnter,
  onMouseLeave,
}: ProcessDetailHoverPortalProps) {
  if (!hover || activePluginId !== 'process-list') {
    return null;
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const panelW = Math.min(560, vw - 24);
  const panelH = 360;
  const left = Math.max(8, Math.min(hover.x, vw - panelW - 8));
  const top = Math.max(8, Math.min(hover.y, vh - panelH - 8));

  const mainTableKeys = PROCESS_LIST_TABLE_KEYS as readonly string[];
  const extraOrder = PROCESS_LIST_EXTRA_KEY_ORDER;

  const extraRows = Object.entries(hover.record)
    .filter(([k]) => !mainTableKeys.includes(k))
    .sort((a, b) => {
      const ia = extraOrder.indexOf(a[0]);
      const ib = extraOrder.indexOf(b[0]);
      const ra = ia === -1 ? 1000 + a[0].charCodeAt(0) : ia;
      const rb = ib === -1 ? 1000 + b[0].charCodeAt(0) : ib;
      return ra - rb || a[0].localeCompare(b[0]);
    });

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 2000,
        width: panelW,
        maxHeight: panelH,
        overflow: 'auto',
        pointerEvents: 'auto',
        boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
        borderRadius: 8,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Card size="small" title="More fields" styles={{ body: { padding: 12 } }}>
        {extraRows.length ? (
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            {extraRows.map(([k, v]) => {
              const display = formatDetailValue(k, v, traceStartSec);
              const longRaw = typeof v === 'string' && String(v).length > 80;
              return (
                <div
                  key={k}
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0, width: '100%' }}
                >
                  <Typography.Text strong ellipsis={{ tooltip: k }} style={{ width: 200, flexShrink: 0, margin: 0 }}>
                    {k}
                  </Typography.Text>
                  <Typography.Text
                    ellipsis={{ tooltip: display }}
                    copyable={longRaw ? { text: String(v) } : false}
                    style={{ flex: 1, minWidth: 0, margin: 0 }}
                  >
                    {display}
                  </Typography.Text>
                </div>
              );
            })}
          </Space>
        ) : (
          <Typography.Text type="secondary">No more fields</Typography.Text>
        )}
      </Card>
    </div>,
    document.body,
  );
}
