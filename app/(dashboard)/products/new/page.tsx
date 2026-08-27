'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import ProductForm from '@/app/(dashboard)/products/components/product-form';
import BackButton from '@/components/shared/back-button';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

export default function ProductCreatePage() {
  const router = useRouter();
  const t = useTranslations('admin.products');
  const [hasChanges, setHasChanges] = useState(false);
  const { confirm, modalProps } = useConfirmModal();

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success(t('messages.createSuccess'));
        setHasChanges(false);
        router.push('/products');
      } else {
        const resData = await res.json();
        toast.error(resData.error || t('messages.saveFailed'));
      }
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error(t('messages.saveFailed'));
    }
  };

  const handleBack = async () => {
    if (hasChanges) {
      const confirmed = await confirm({
        title: t('messages.discardChangesTitle') || 'Discard changes?',
        message:
          t('messages.discardChangesMessage') ||
          'You have unsaved changes. Are you sure you want to leave without saving?',
        type: 'warning',
        confirmText: t('messages.discard') || 'Discard',
        cancelText: t('messages.continueEditing') || 'Continue editing',
      });
      if (!confirmed) return;
    }
    router.push('/products');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-3 sticky top-0 z-40 bg-background/80 backdrop-blur-sm py-3 -mx-4 px-4">
        <BackButton onClick={handleBack} />
        <h1 className="text-2xl font-bold text-foreground">
          {t('addProduct')}
        </h1>
      </div>

      <ProductForm onSubmit={handleSubmit} onChangesChange={setHasChanges} />

      <ConfirmModal {...modalProps} />
    </div>
  );
}
