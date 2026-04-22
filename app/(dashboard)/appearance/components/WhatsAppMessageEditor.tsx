'use client';

interface WhatsAppMessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  title: string;
  description: string;
  labelMessage: string;
  placeholder: string;
}

export function WhatsAppMessageEditor({
  value,
  onChange,
  title,
  description,
  labelMessage,
  placeholder,
}: WhatsAppMessageEditorProps) {
  return (
    <div className="space-y-3 border border-stroke rounded-xl p-5 bg-card-bg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-secondary mt-0.5">{description}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {labelMessage}
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
