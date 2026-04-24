import ReactECharts from 'echarts-for-react';
import type { StackDiffRow } from '../../hooks/useMainThreadStackDiffViewModel';

type StackDiffTopChartProps = {
  rows: StackDiffRow[];
};

export function StackDiffTopChart({ rows }: StackDiffTopChartProps) {
  const topRows = rows.slice(0, 15);
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 36, right: 24, top: 34, bottom: 60 },
    xAxis: {
      type: 'category',
      data: topRows.map((row) => row.stackKey),
      axisLabel: { rotate: 24 },
    },
    yAxis: [
      { type: 'value', name: '耗时增量(ms)', splitLine: { show: false } },
      { type: 'value', name: '调用增量', splitLine: { show: false } },
    ],
    series: [
      {
        name: '耗时增量(ms)',
        type: 'bar',
        data: topRows.map((row) => Number(row.costDeltaMs.toFixed(3))),
      },
      {
        name: '调用增量',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: topRows.map((row) => row.callsDelta),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} />;
}
