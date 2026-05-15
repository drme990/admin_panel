import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import Modal from '@/components/ui/modal';

interface CopySettingsModalProps {
  copyFromCountryModalOpen: boolean;
  setCopyFromCountryModalOpen: (open: boolean) => void;
  copyFromCountryId: string | null;
  setCopyFromCountryId: (id: string | null) => void;
  availableCountriesForCopy: { label: string; value: string }[];
  onCopyFromCountry: (countryId: string) => void;
  t: (key: string) => string;
}

export default function CopySettingsModal({
  copyFromCountryModalOpen,
  setCopyFromCountryModalOpen,
  copyFromCountryId,
  setCopyFromCountryId,
  availableCountriesForCopy,
  onCopyFromCountry,
  t,
}: CopySettingsModalProps) {
  return (
    <Modal
      isOpen={copyFromCountryModalOpen}
      onClose={() => setCopyFromCountryModalOpen(false)}
      title={t('visibilitySettings.copyModal.title')}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setCopyFromCountryModalOpen(false)}
          >
            {t('visibilitySettings.copyModal.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (copyFromCountryId) {
                onCopyFromCountry(copyFromCountryId);
                setCopyFromCountryModalOpen(false);
              }
            }}
            disabled={!copyFromCountryId}
          >
            {t('visibilitySettings.copyModal.copyButton')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-secondary">
          {t('visibilitySettings.copyModal.description')}
        </p>
        <div className="w-full min-h-60">
          <Dropdown<string | null>
            value={copyFromCountryId}
            options={[
              {
                label: t('visibilitySettings.copyModal.selectCountry'),
                value: null,
              },
              ...availableCountriesForCopy,
            ]}
            onChange={setCopyFromCountryId}
          />
        </div>
        {copyFromCountryId && (
          <p className="text-sm text-secondary">
            {t('visibilitySettings.copyModal.copyDescription')}
          </p>
        )}
      </div>
    </Modal>
  );
}
