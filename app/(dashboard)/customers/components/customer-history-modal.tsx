'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import Modal from '@/components/ui/modal';
import Tabs from '@/components/ui/tabs';
import { useTranslations } from 'next-intl';

type RefHistoryEntry = {
  _id: string;
  previousRef: string | null;
  newRef: string | null;
  changedByUserName: string;
  changedByUserEmail: string;
  changeSource: 'single' | 'bulk';
  createdAt: string;
};

export type CountryHistoryEntry = {
  _id: string;
  previousCountry: string | null;
  newCountry: string | null;
  changedByUserName: string;
  changedByUserEmail: string;
  createdAt: string;
};

interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadingRef: boolean;
  loadingCountry: boolean;
  customer: {
    _id: string;
    name: string;
    ref: string | null;
    detectedCountry?: string | null;
  } | null;
  refHistory: RefHistoryEntry[];
  countryHistory: CountryHistoryEntry[];
}

function formatRef(value: string | null) {
  return value || 'No referral';
}

function formatCountry(value: string | null) {
  return value || 'No country';
}

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

export default function CustomerHistoryModal({
  isOpen,
  onClose,
  loadingRef,
  loadingCountry,
  customer,
  refHistory,
  countryHistory,
}: CustomerHistoryModalProps) {
  const tRef = useTranslations('admin.customers.historyModal');
  const tCountry = useTranslations('admin.customers.countryHistoryModal');
  const [activeTab, setActiveTab] = useState<'ref' | 'country'>('ref');

  const tabOptions = [
    { value: 'ref', label: tRef('title') },
    { value: 'country', label: tCountry('title') },
  ];

  const isLoading = activeTab === 'ref' ? loadingRef : loadingCountry;
  const history = activeTab === 'ref' ? refHistory : countryHistory;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${customer?.name || ''} - ${tRef('history')}`}
      size="xl"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {tRef('close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-4 min-h-96">
        <Tabs
          value={activeTab}
          options={tabOptions}
          onChange={(v) => setActiveTab(v as 'ref' | 'country')}
          size="sm"
        />

        {isLoading ? (
          <Loading />
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-secondary">
              {activeTab === 'ref' ? tRef('emptyMessage') : tCountry('emptyMessage')}
            </p>
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
                        {activeTab === 'ref' ? tRef('changeLabel') : tCountry('changeLabel')}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {activeTab === 'ref'
                          ? `${formatRef((entry as RefHistoryEntry).previousRef)} ${tRef('arrow')} ${formatRef((entry as RefHistoryEntry).newRef)}`
                          : `${formatCountry((entry as CountryHistoryEntry).previousCountry)} ${tCountry('arrow')} ${formatCountry((entry as CountryHistoryEntry).newCountry)}`}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase text-secondary">
                        {activeTab === 'ref' ? tRef('changedBy') : tCountry('changedBy')}
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
                    {activeTab === 'ref' && (
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary capitalize">
                        {(entry as RefHistoryEntry).changeSource}
                      </span>
                    )}
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
