'use client';

import Textarea from '@/components/ui/textarea';
import { DocumentationAnswer } from '@/types/Appearance';

interface DocumentationSectionProps {
  value: DocumentationAnswer;
  onChange: (value: DocumentationAnswer) => void;
  title: string;
  description: string;
  labelAr: string;
  labelEn: string;
  placeholderAr: string;
  placeholderEn: string;
}

export default function DocumentationSection({
  value,
  onChange,
  title,
  description,
  labelAr,
  labelEn,
  placeholderAr,
  placeholderEn,
}: DocumentationSectionProps) {
  return (
    <section className="space-y-3 border border-stroke rounded-xl p-5 bg-card-bg">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-secondary mt-0.5">{description}</p>
      </div>

      <div>
        <Textarea
          value={value.ar}
          onChange={(newValue) =>
            onChange({
              ...value,
              ar: newValue,
            })
          }
           placeholder={placeholderAr}
           label={labelAr}
          />
      </div>

      <div>
        <Textarea
          value={value.en}
          onChange={(newValue) =>
            onChange({
              ...value,
              en: newValue,
            })
          }
           placeholder={placeholderEn}
           label={labelEn}
          />
      </div>
    </section>
  );
}
