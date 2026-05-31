'use client';

import Button from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import Modal from '@/components/ui/modal';
import { useTranslations } from 'next-intl';

export type CountryHistoryEntry = {
  _id: string;
  previousCountry: string | null;
  newCountry: string | null;
  changedByUserName: string;
  changedByUserEmail: string;
  createdAt: string;
};

interface CustomerCountryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  customer: {
    _id: string;
    name: string;
    detectedCountry?: string | null;
  } | null;
  history: CountryHistoryEntry[];
}

function formatCountry(value: string | null, t: (key: 'none') => string) {
  return value || t('none');
}

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

export default function CustomerCountryHistoryModal({
  isOpen,
  onClose,
  loading,
  customer,
  history,
}: CustomerCountryHistoryModalProps) {
  const t = useTranslations('admin.customers.countryHistoryModal');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${customer?.name || ''} - ${t('title')}`}
      size="xl"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-4 min-h-96">
        {loading ? (
          <Loading />
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-secondary">{t('emptyMessage')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div
                key={entry._id}
                className="relative rounded-lg border border-stroke bg-card-bg p-4 pl-5"
              >
                <div className="absolute left-0 top-5 h-3 w-3 -translate-x-1/2 rounded-full bg-primary ring-4 ring-primary/15" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs uppercase text-secondary">
                        {t('changeLabel')}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {formatCountry(entry.previousCountry, t)} {t('arrow')}{' '}
                        {formatCountry(entry.newCountry, t)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase text-secondary">
                        {t('changedBy')}
                      </p>
                      <p className="text-sm text-foreground">
                        {entry.changedByUserName}
                      </p>
                      <p className="text-xs text-secondary">
                        {entry.changedByUserEmail}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <p className="text-xs text-secondary">
                      {formatRelativeDate(entry.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
