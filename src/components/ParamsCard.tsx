import { Button, Card, Col, Row, Select } from 'antd';
import type { ReactNode } from 'react';
import type { ParamsConfigProps, TrendCompareProps } from './workbenchTypes';
export type { ParamFieldConfig } from './workbenchTypes';

type ParamsCardProps = {
  config: ParamsConfigProps;
  trendCompare?: TrendCompareProps;
};

function ParamField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="param-field">
      <span className="param-field-label">{label}</span>
      <div className="param-field-control">{children}</div>
    </div>
  );
}

export function ParamsCard({
  config,
  trendCompare,
}: ParamsCardProps) {
  return (
    <Card title={`参数配置 - ${config.activePluginName}`}>
      <div className="plugin-param-grid">
        {config.paramFields.map((field) => (
          <ParamField key={field.key} label={field.label}>
            {field.control}
          </ParamField>
        ))}
      </div>
      <div className="plugin-param-actions">
        <Button type="primary" loading={config.running} onClick={config.onRun}>运行</Button>
      </div>
      {trendCompare && (
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
      )}
    </Card>
  );
}
