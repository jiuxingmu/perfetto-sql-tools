import { useEffect, useRef, useState } from 'react';
import type { PluginDefinition } from '../types';

type HoverState = {
  record: Record<string, unknown>;
  x: number;
  y: number;
};

type RowMouseHandler = {
  onMouseEnter: (event: { clientX: number; clientY: number }) => void;
  onMouseMove: (event: { clientX: number; clientY: number }) => void;
  onMouseLeave: () => void;
};

type UseProcessListHoverArgs = {
  activePluginId: PluginDefinition['id'];
};

export function useProcessListHover({ activePluginId }: UseProcessListHoverArgs) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    cancelHide();
    leaveTimerRef.current = setTimeout(() => {
      setHover(null);
      leaveTimerRef.current = null;
    }, 200);
  };

  useEffect(() => () => cancelHide(), []);

  const processListTableOnRow = (
    activePluginId === 'process-list'
  )
    ? (record: Record<string, unknown>): RowMouseHandler => ({
        onMouseEnter: (event) => {
          cancelHide();
          setHover({ record, x: event.clientX + 10, y: event.clientY + 10 });
        },
        onMouseMove: (event) => {
          setHover((prev) =>
            prev?.record === record ? { record, x: event.clientX + 10, y: event.clientY + 10 } : prev,
          );
        },
        onMouseLeave: scheduleHide,
      })
    : undefined;

  return {
    hover,
    cancelHide,
    scheduleHide,
    processListTableOnRow,
  };
}
