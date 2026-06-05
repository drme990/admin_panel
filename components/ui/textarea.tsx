'use client';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
};

export default function Textarea({
  value,
  onChange,
  placeholder,
  label,
  rows = 4
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
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
        placeholder={placeholder}
      />
    </div>
  );
}