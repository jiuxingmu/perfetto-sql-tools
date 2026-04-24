import { Typography } from 'antd';

type ResultSummaryTextsProps = {
  blockedSuspiciousRuleText: string | null;
  listSummaryText: string | null;
  pluginGuidanceText: string | null;
};

export function ResultSummaryTexts({
  blockedSuspiciousRuleText,
  listSummaryText,
  pluginGuidanceText,
}: ResultSummaryTextsProps) {
  return (
    <>
      {pluginGuidanceText ? (
        <Typography.Text style={{ display: 'block', marginBottom: 8 }}>
          {pluginGuidanceText}
        </Typography.Text>
      ) : null}
      {blockedSuspiciousRuleText ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {blockedSuspiciousRuleText}
        </Typography.Text>
      ) : null}
      {listSummaryText ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {listSummaryText}
        </Typography.Text>
      ) : null}
    </>
  );
}
