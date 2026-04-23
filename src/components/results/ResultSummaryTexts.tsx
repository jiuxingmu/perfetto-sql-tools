import { Typography } from 'antd';

type ResultSummaryTextsProps = {
  blockedSuspiciousRuleText: string | null;
  listSummaryText: string | null;
};

export function ResultSummaryTexts({
  blockedSuspiciousRuleText,
  listSummaryText,
}: ResultSummaryTextsProps) {
  return (
    <>
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
