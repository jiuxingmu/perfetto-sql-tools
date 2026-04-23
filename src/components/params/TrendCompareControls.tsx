import { Button, Col, Row, Select } from 'antd';
import type { TrendCompareProps } from '../workbench/WorkbenchTypes';

type TrendCompareControlsProps = {
  trendCompare: TrendCompareProps;
};

export function TrendCompareControls({ trendCompare }: TrendCompareControlsProps) {
  return (
    <Row style={{ marginTop: 12 }} gutter={12}>
      <Col span={8}>
        <Select
          placeholder="选择 t1"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          options={trendCompare.timePointOptions}
          value={trendCompare.range.t1}
          onChange={(v) => trendCompare.onChangeRange({ ...trendCompare.range, t1: v })}
        />
      </Col>
      <Col span={8}>
        <Select
          placeholder="选择 t2"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          options={trendCompare.timePointOptions}
          value={trendCompare.range.t2}
          onChange={(v) => trendCompare.onChangeRange({ ...trendCompare.range, t2: v })}
        />
      </Col>
      <Col span={8}>
        <Button block loading={trendCompare.running} onClick={trendCompare.onCompare}>
          对比线程变化
        </Button>
      </Col>
    </Row>
  );
}
