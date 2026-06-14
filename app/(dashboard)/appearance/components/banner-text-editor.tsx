'use client';

import Textarea from '@/components/ui/textarea';
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

export default function BannerTextEditor({
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
    <section className="space-y-3 border border-stroke rounded-xl p-5 bg-card-bg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-secondary mt-0.5">{description}</p>
      </div>

      <Textarea
        value={value.ar}
        onChange={(newValue) =>
          onChange({
            ...value,
            ar: newValue,
          })
        }
        rows={3}
        label={labelAr}
        placeholder={placeholderAr}
      />

      <Textarea
        value={value.en}
        onChange={(newValue) =>
          onChange({
            ...value,
            en: newValue,
          })
        }
        rows={3}
        label={labelEn}
        placeholder={placeholderEn}
      />
    </section>
  );
}
