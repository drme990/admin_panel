'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import ProductForm from '@/components/admin/product-form';
import BackButton from '@/components/shared/back-button';

export default function ProductCreatePage() {
  const router = useRouter();
  const t = useTranslations('admin.products');

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success(t('messages.createSuccess'));
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('addProduct')}
          </h1>
        </div>
      </div>

      <div className="bg-card-bg rounded-xl border border-stroke p-6">
        <ProductForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
