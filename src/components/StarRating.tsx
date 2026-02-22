import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: number;
}

export function StarRating({ value, onChange, readonly = false, size = 16 }: StarRatingProps) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={`transition-transform ${!readonly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
          style={{ transitionDuration: '100ms' }}
        >
          <Star
            size={size}
            className={n <= value ? 'fill-[#D97706] text-[#D97706]' : 'text-border'}
          />
        </button>
      ))}
    </div>
  );
}
