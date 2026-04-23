type RawCodePanelProps = {
  value: string;
  dark?: boolean;
};

export function RawCodePanel({ value, dark = false }: RawCodePanelProps) {
  return (
    <pre
      style={dark
        ? { margin: 0, background: '#0b1020', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }
        : { margin: 0, background: '#f6f8fa', padding: 12, borderRadius: 8, maxHeight: 320, overflow: 'auto' }}
    >
      {value}
    </pre>
  );
}
