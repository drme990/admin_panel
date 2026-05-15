'use client';

import { useTranslations, useLocale } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Dropdown from '@/components/ui/dropdown';
import Tabs from '@/components/ui/tabs';
import Tooltip from '@/components/ui/tooltip';
import CopySettingsModal from './copy-settings-modal';

import { LuCopy } from 'react-icons/lu';

interface Country {
  _id: string;
  code: string;
  name: { ar: string; en: string };
  isActive: boolean;
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

  countriesToSee: CountryVisibilityMap;
  toggleVisibleToCountry: (code: string) => void;

  selectAllCountries: () => void;
  clearAllCountries: () => void;

  saveVisibilitySettings: () => void;
  visibilitySaving: boolean;

  regionFilter: string;
  setRegionFilter: (value: string) => void;
  regionOptions: Array<{ label: string; value: string }>;

  activeVisibilityCountries: Country[];

  copyFromCountryModalOpen: boolean;
  setCopyFromCountryModalOpen: (open: boolean) => void;
  copyFromCountryId: string | null;
  setCopyFromCountryId: (id: string | null) => void;
  allCountries: Country[];
  onCopyFromCountry: (countryId: string) => void;
}

export default function VisibilitySettingsModal({
  visibilityOpen,
  setVisibilityOpen,
  visibilityCountry,
  visibilityMode,
  setVisibilityMode,
  visibilityTab,
  setVisibilityTab,
  countriesToSee,
  toggleVisibleToCountry,
  selectAllCountries,
  clearAllCountries,
  saveVisibilitySettings,
  visibilitySaving,
  regionFilter,
  setRegionFilter,
  regionOptions,
  activeVisibilityCountries,
  copyFromCountryModalOpen,
  setCopyFromCountryModalOpen,
  copyFromCountryId,
  setCopyFromCountryId,
  allCountries,
  onCopyFromCountry,
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

  // Filter countries for copy dropdown (exclude current country and inactive countries)
  const availableCountriesForCopy = allCountries
    .filter((c) => c.isActive && c._id !== visibilityCountry?._id)
    .map((c) => ({
      label: `${locale === 'ar' ? c.name.ar : c.name.en} (${c.code})`,
      value: c._id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

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
                <Button size="sm" onClick={selectAllCountries} variant="ghost">
                  {t('visibilitySettings.selectAll')}
                </Button>

                <Button size="sm" onClick={clearAllCountries} variant="ghost">
                  {t('visibilitySettings.clearAll')}
                </Button>

                <Tooltip
                  content={t('visibilitySettings.copyFromCountryTooltip')}
                  position={locale === 'ar' ? 'right' : 'left'}
                >
                  <Button
                    onClick={() => setCopyFromCountryModalOpen(true)}
                    variant="icon"
                    size="custom"
                  >
                    <LuCopy className="text-lg" />
                  </Button>
                </Tooltip>
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
                    countriesToSee[country.code.toUpperCase()]?.[visibilityTab],
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

        {/* Copy from Country Modal */}
        <CopySettingsModal
          copyFromCountryModalOpen={copyFromCountryModalOpen}
          setCopyFromCountryModalOpen={setCopyFromCountryModalOpen}
          copyFromCountryId={copyFromCountryId}
          setCopyFromCountryId={setCopyFromCountryId}
          availableCountriesForCopy={availableCountriesForCopy}
          onCopyFromCountry={onCopyFromCountry}
          t={t}
        />
      </div>
    </Modal>
  );
}
