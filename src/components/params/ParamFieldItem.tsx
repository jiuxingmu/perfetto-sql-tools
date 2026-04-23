import type { ReactNode } from 'react';

type ParamFieldItemProps = {
  label: string;
  children: ReactNode;
};

export function ParamFieldItem({ label, children }: ParamFieldItemProps) {
  return (
    <div className="param-field">
      <span className="param-field-label">{label}</span>
      <div className="param-field-control">{children}</div>
    </div>
  );
}
