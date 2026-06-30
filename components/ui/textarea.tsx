'use client';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
};

export default function Textarea({
  value,
  onChange,
  placeholder,
  label,
  rows = 4,
  maxLength,
  showCount = false,
}: Props) {

  return (
    <div>
      {label ? (
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
        </label>
      ) : null}

      <textarea
        value={value}
        onChange={(e) => {
          const val = maxLength ? e.target.value.slice(0, maxLength) : e.target.value;
          onChange(val);
        }}
        rows={rows}
        maxLength={maxLength}
        className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success resize-none"
        placeholder={placeholder}
      />
      {showCount && maxLength && (
        <div className="text-right">
          <span className={`text-xs ${value.length >= maxLength ? 'text-error' : 'text-secondary'}`}>
            {value.length}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
}
