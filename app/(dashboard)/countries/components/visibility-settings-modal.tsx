'use client';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Dropdown from '@/components/ui/dropdown';
import Tabs from '@/components/ui/tabs';
import { useTranslations, useLocale } from 'next-intl';

interface Country {
  _id: string;
  code: string;
  name: { ar: string; en: string };
}

type VisibilityTab = 'realPrice' | 'exchangePrice';

interface CountryVisibilityOptions {
  realPrice?: boolean;
  exchangePrice?: boolean;
}

type CountryVisibilityMap = Record<string, CountryVisibilityOptions>;

interface VisibilitySettingsModalProps {
  visibilityOpen: boolean;
  setVisibilityOpen: (open: boolean) => void;

  visibilityCountry: Country | null;

  visibilityMode: 'all' | 'custom';
  setVisibilityMode: (mode: 'all' | 'custom') => void;

  visibilityTab: VisibilityTab;
  setVisibilityTab: (tab: VisibilityTab) => void;

  countriesToSee : CountryVisibilityMap;
  toggleVisibleToCountry: (code: string) => void;

  selectAllCountries: () => void;
  clearAllCountries: () => void;

  saveVisibilitySettings: () => void;
  visibilitySaving: boolean;

  regionFilter: string;
  setRegionFilter: (value: string) => void;
  regionOptions: Array<{ label: string; value: string }>;

  activeVisibilityCountries: Country[];
}

export default function VisibilitySettingsModal({
  visibilityOpen,
  setVisibilityOpen,
  visibilityCountry,
  visibilityMode,
  setVisibilityMode,
  visibilityTab,
  setVisibilityTab,
  countriesToSee ,
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

  const priceTabOptions = [
    {
      value: 'realPrice' as const,
      label: t('visibilitySettings.priceTabs.realPrice'),
    },
    {
      value: 'exchangePrice' as const,
      label: t('visibilitySettings.priceTabs.exchangePrice'),
    },
  ];

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
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {t('visibilitySettings.modeLabel')}
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={visibilityMode === 'all'}
                onChange={() => setVisibilityMode('all')}
              />
              {t('visibilitySettings.noSettings')}
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={visibilityMode === 'custom'}
                onChange={() => setVisibilityMode('custom')}
              />
              {t('visibilitySettings.customSettings')}
            </label>
          </div>

          <p className="text-sm text-secondary">
            {t('visibilitySettings.modeDescription')}
          </p>
        </div>

        {visibilityMode === 'custom' && (
          <div className="space-y-3">
            <Tabs<VisibilityTab>
              value={visibilityTab}
              options={priceTabOptions}
              onChange={setVisibilityTab}
            />

            <div className="flex justify-between items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {t('visibilitySettings.selectCountries')}
              </span>

              <div className="flex gap-2">
                <Button onClick={selectAllCountries} variant="ghost">
                  {t('visibilitySettings.selectAll')}
                </Button>

                <Button onClick={clearAllCountries} variant="ghost">
                  {t('visibilitySettings.clearAll')}
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs text-secondary">
                {t('visibilitySettings.regionLabel')}
              </span>
              <div className="w-56">
                <Dropdown<string>
                  value={regionFilter}
                  options={regionOptions}
                  onChange={setRegionFilter}
                />
              </div>
            </div>

            <div className="h-60 overflow-y-auto border border-stroke p-3 space-y-2 rounded">
              {activeVisibilityCountries.map((country) => (
                <Checkbox
                  key={country._id}
                  checked={Boolean(
                    countriesToSee [country.code.toUpperCase()]?.[
                      visibilityTab
                    ],
                  )}
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
