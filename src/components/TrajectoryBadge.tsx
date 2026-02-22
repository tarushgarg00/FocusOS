interface TrajectoryBadgeProps {
  band: string;
  size?: 'sm' | 'md';
}

export function TrajectoryBadge({ band, size = 'md' }: TrajectoryBadgeProps) {
  const styles = {
    'Stable': 'bg-[#f0fdf4] text-[#15803d]',
    'Fragile': 'bg-[#fffbeb] text-[#b45309]',
    'At Risk': 'bg-[#fef2f2] text-[#dc2626]',
  };

  const cls = styles[band as keyof typeof styles] || styles['Fragile'];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${padding} ${cls}`}>
      {band}
    </span>
  );
}
