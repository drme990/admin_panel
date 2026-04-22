'use client';

import { BannerText } from '@/types/Appearance';

interface BannerTextEditorProps {
  value: BannerText;
  onChange: (value: BannerText) => void;
  title: string;
  description: string;
  labelAr: string;
  labelEn: string;
  placeholderAr: string;
  placeholderEn: string;
}

export function BannerTextEditor({
  value,
  onChange,
  title,
  description,
  labelAr,
  labelEn,
  placeholderAr,
  placeholderEn,
}: BannerTextEditorProps) {
  return (
    <div className="space-y-3 border border-stroke rounded-xl p-5 bg-card-bg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-secondary mt-0.5">{description}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {labelAr}
        </label>
        <textarea
          value={value.ar}
          onChange={(e) =>
            onChange({
              ...value,
              ar: e.target.value,
            })
          }
          rows={3}
          className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
          placeholder={placeholderAr}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {labelEn}
        </label>
        <textarea
          value={value.en}
          onChange={(e) =>
            onChange({
              ...value,
              en: e.target.value,
            })
          }
          rows={3}
          className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
          placeholder={placeholderEn}
        />
      </div>
    </div>
  );
}
