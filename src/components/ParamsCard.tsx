import { Button, Card, Col, Row, Select } from 'antd';
import type { ReactNode } from 'react';

type ParamFieldConfig = {
  key: string;
  label: string;
  control: ReactNode;
};

type ParamsCardProps = {
  activePluginName: string;
  paramFields: ParamFieldConfig[];
  running: boolean;
  onRun: () => void;
  isThreadTrend: boolean;
  trendCompareRange: { t1?: number; t2?: number };
  trendTimePointOptions: Array<{ label: string; value: number }>;
  trendDiffRunning: boolean;
  onChangeTrendRange: (patch: { t1?: number; t2?: number }) => void;
  onCompareThreadTrend: () => void;
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
  activePluginName,
  paramFields,
  running,
  onRun,
  isThreadTrend,
  trendCompareRange,
  trendTimePointOptions,
  trendDiffRunning,
  onChangeTrendRange,
  onCompareThreadTrend,
}: ParamsCardProps) {
  return (
    <Card title={`参数配置 - ${activePluginName}`}>
      <div className="plugin-param-grid">
        {paramFields.map((field) => (
          <ParamField key={field.key} label={field.label}>
            {field.control}
          </ParamField>
        ))}
      </div>
      <div className="plugin-param-actions">
        <Button type="primary" loading={running} onClick={onRun}>运行</Button>
      </div>
      {isThreadTrend && (
        <Row style={{ marginTop: 12 }} gutter={12}>
          <Col span={8}>
            <Select
              placeholder="选择 t1"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              options={trendTimePointOptions}
              value={trendCompareRange.t1}
              onChange={(v) => onChangeTrendRange({ ...trendCompareRange, t1: v })}
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder="选择 t2"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              options={trendTimePointOptions}
              value={trendCompareRange.t2}
              onChange={(v) => onChangeTrendRange({ ...trendCompareRange, t2: v })}
            />
          </Col>
          <Col span={8}>
            <Button block loading={trendDiffRunning} onClick={onCompareThreadTrend}>
              对比线程变化
            </Button>
          </Col>
        </Row>
      )}
    </Card>
  );
}

export type { ParamFieldConfig };
