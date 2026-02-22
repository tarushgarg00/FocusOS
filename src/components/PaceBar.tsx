interface PaceBarProps {
  current: number;
  required: number;
  target: number;
  band: string;
}

export function PaceBar({ current, target, band }: PaceBarProps) {
  const pct = Math.min(100, Math.max(0, (current / Math.max(target, 0.1)) * 100));

  const fillColor = band === 'Stable'
    ? 'bg-[#16A34A]'
    : band === 'Fragile'
      ? 'bg-[#D97706]'
      : 'bg-[#DC2626]';

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full ${fillColor}`}
        style={{ width: `${pct}%`, transition: 'width 500ms ease' }}
      />
    </div>
  );
}
