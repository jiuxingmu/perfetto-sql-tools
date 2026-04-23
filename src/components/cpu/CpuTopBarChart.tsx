import ReactECharts from 'echarts-for-react';
import type { CpuRow } from '../../hooks/useCpuAnalysisViewModel';

type CpuTopBarChartProps = {
  rows: CpuRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

export function CpuTopBarChart({ rows, selectedKey, onSelect }: CpuTopBarChartProps) {
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 16, top: 16, bottom: 80 },
    xAxis: {
      type: 'category',
      axisLabel: { rotate: 25 },
      data: rows.map((row) => `${row.name}${row.statLevel === 'thread' && row.tid !== null ? `(${row.tid})` : ''}`),
    },
    yAxis: { type: 'value', name: 'cpu_dur_ms' },
    series: [{
      type: 'bar',
      data: rows.map((row) => ({
        value: row.cpuDurMs,
        itemStyle: { color: row.key === selectedKey ? '#1677ff' : '#91caff' },
      })),
    }],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 320 }}
      onEvents={{
        click: (params: { dataIndex?: number }) => {
          const idx = params.dataIndex ?? -1;
          if (idx >= 0 && idx < rows.length) onSelect(rows[idx].key);
        },
      }}
    />
  );
}
