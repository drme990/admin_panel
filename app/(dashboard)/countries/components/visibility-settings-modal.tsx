'use client';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Dropdown from '@/components/ui/dropdown';
import { useTranslations, useLocale } from 'next-intl';

interface Country {
  _id: string;
  code: string;
  name: { ar: string; en: string };
}

interface Option {
  label: string;
  value: string;
}

interface VisibilitySettingsModalProps {
  visibilityOpen: boolean;
  setVisibilityOpen: (open: boolean) => void;

  visibilityCountry: Country | null;

  visibilityMode: 'all' | 'specific';
  setVisibilityMode: (mode: 'all' | 'specific') => void;

  visibleToCountries: string[];
  toggleVisibleToCountry: (code: string) => void;

  selectAllCountries: () => void;
  clearAllCountries: () => void;

  saveVisibilitySettings: () => void;
  visibilitySaving: boolean;

  regionFilter: string;
  setRegionFilter: (value: string) => void;
  regionOptions: Option[];

  activeVisibilityCountries: Country[];
}

export default function VisibilitySettingsModal({
  visibilityOpen,
  setVisibilityOpen,
  visibilityCountry,
  visibilityMode,
  setVisibilityMode,
  visibleToCountries,
  toggleVisibleToCountry,
  selectAllCountries,
  clearAllCountries,
  saveVisibilitySettings,
  visibilitySaving,
  regionFilter,
  setRegionFilter,
  regionOptions,
  activeVisibilityCountries,
}: VisibilitySettingsModalProps) {
  const t = useTranslations('admin.countries');
  const locale = useLocale();

  return (
    <Modal
      isOpen={visibilityOpen}
      onClose={() => {
        if (!visibilitySaving) setVisibilityOpen(false);
      }}
      title={
        visibilityCountry
          ? `${t('visibilitySettings.title')} - ${
              locale === 'ar'
                ? visibilityCountry.name.ar
                : visibilityCountry.name.en
            }`
          : t('visibilitySettings.title')
      }
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setVisibilityOpen(false)}
            disabled={visibilitySaving}
          >
            {t('visibilitySettings.cancel')}
          </Button>
          <Button onClick={saveVisibilitySettings} disabled={visibilitySaving}>
            {visibilitySaving ? '...' : t('visibilitySettings.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Mode */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {t('visibilitySettings.modeLabel')}
          </label>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={visibilityMode === 'all'}
                onChange={() => setVisibilityMode('all')}
              />
              {t('visibilitySettings.allCountries')}
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={visibilityMode === 'specific'}
                onChange={() => setVisibilityMode('specific')}
              />
              {t('visibilitySettings.specificCountries')}
            </label>
          </div>
        </div>

        {/* Countries */}
        {visibilityMode === 'specific' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>{t('visibilitySettings.selectCountries')}</span>

              <div className="flex gap-2">
                <Button onClick={selectAllCountries} variant="ghost">
                  {t('visibilitySettings.selectAll')}
                </Button>

                <Button onClick={clearAllCountries} variant="ghost">
                  {t('visibilitySettings.clearAll')}
                </Button>
              </div>
            </div>

            <Dropdown<string>
              value={regionFilter}
              options={regionOptions}
              onChange={setRegionFilter}
            />

            <div className="h-60 overflow-y-auto border border-stroke p-3 space-y-2 rounded">
              {activeVisibilityCountries.map((country) => (
                <Checkbox
                  key={country._id}
                  checked={visibleToCountries.includes(country.code)}
                  onChange={() => toggleVisibleToCountry(country.code)}
                  label={`${
                    locale === 'ar' ? country.name.ar : country.name.en
                  } (${country.code})`}
                />
              ))}

              {activeVisibilityCountries.length === 0 && (
                <p className="text-center text-sm text-secondary">
                  {t('visibilitySettings.noCountriesAvailable')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
