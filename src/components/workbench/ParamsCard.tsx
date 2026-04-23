import { Button, Card } from 'antd';
import type { ParamsConfigProps, TrendCompareProps } from './WorkbenchTypes';
import { ParamFieldItem, TrendCompareControls } from '../params';
export type { ParamFieldConfig } from './WorkbenchTypes';

type ParamsCardProps = {
  config: ParamsConfigProps;
  trendCompare?: TrendCompareProps;
};

export function ParamsCard({
  config,
  trendCompare,
}: ParamsCardProps) {
  return (
    <Card title={`参数配置 - ${config.activePluginName}`}>
      <div className="plugin-param-grid">
        {config.paramFields.map((field) => (
          <ParamFieldItem key={field.key} label={field.label}>
            {field.control}
          </ParamFieldItem>
        ))}
      </div>
      <div className="plugin-param-actions">
        <Button type="primary" loading={config.running} onClick={config.onRun}>运行</Button>
      </div>
      {trendCompare ? <TrendCompareControls trendCompare={trendCompare} /> : null}
    </Card>
  );
}
