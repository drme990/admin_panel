'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import CustomDatePicker from '@/components/ui/custom-date-picker';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  onUpdateDate: (date: string) => void;
  updating: boolean;
  locale: string;
}

export default function ChangeExecutionDateModal({
  isOpen,
  onClose,
  currentDate,
  onUpdateDate,
  updating,
  locale,
}: Props) {
  const t = useTranslations('execution');
  const [date, setDate] = useState(currentDate);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setDate(currentDate);
  }

  const handleSave = () => {
    if (!date) return;
    onUpdateDate(date);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('changeExecutionDate.title')}
      size="sm"
      className="overflow-visible"
      contentClassName="overflow-visible"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} disabled={updating}>
            {t('changeExecutionDate.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={updating || !date}
          >
            {updating ? t('changeExecutionDate.saving') : t('changeExecutionDate.save')}
          </Button>
        </div>
      }
    >
      <CustomDatePicker
        value={date}
        onChange={setDate}
        locale={locale}
        label={t('changeExecutionDate.dateLabel')}
        placeholder={t('changeExecutionDate.dateLabel')}
      />
    </Modal>
  );
}
