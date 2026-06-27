'use client';

import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { useTranslations } from 'next-intl';

interface CustomerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    _id: string;
    name: string;
    email: string;
    createdAt: string;
    registrationIp?: string;
    lastLoginIp?: string;
    lastLoginAt?: string;
    detectedCountry?: string | null;
    isAdminCreated?: boolean;
  } | null;
}

export default function CustomerInfoModal({
  isOpen,
  onClose,
  customer,
}: CustomerInfoModalProps) {
  const t = useTranslations('admin.customers.infoModal');

  if (!customer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${customer.name} - ${t('title')}`}
      size="md"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-4">
        <div className="rounded-lg border border-stroke bg-card-bg p-4 space-y-3">
          <div>
            <p className="text-xs uppercase text-secondary">{t('email')}</p>
            <p className="text-sm font-medium text-foreground">
              {customer.email}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">
              {t('isAdminCreated')}
            </p>
            <p className="text-sm font-medium text-foreground">
              {customer.isAdminCreated ? t('yes') : t('no')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">
              {t('registeredDate')}
            </p>
            <p className="text-sm font-medium text-foreground">
              {new Date(customer.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">
              {t('registrationIp')}
            </p>
            <p className="text-sm font-medium text-foreground">
              {customer.registrationIp || t('notAvailable')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">
              {t('lastLoginIp')}
            </p>
            <p className="text-sm font-medium text-foreground">
              {customer.lastLoginIp || t('notAvailable')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">
              {t('lastLoginTime')}
            </p>
            <p className="text-sm font-medium text-foreground">
              {customer.lastLoginAt
                ? new Date(customer.lastLoginAt).toLocaleString()
                : t('notAvailable')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">
              {t('detectedCountry')}
            </p>
            <p className="text-sm font-medium text-foreground">
              {customer.detectedCountry || t('notAvailable')}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
