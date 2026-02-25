'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import ProductForm from '@/components/admin/product-form';
import BackButton from '@/components/shared/back-button';
import { PageLoading } from '@/components/ui/loading';
import { Product } from '@/types/Product';

export default function ProductEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const t = useTranslations('admin.products');

  useEffect(() => {
    if (!productId) {
      router.push('/products');
      return;
    }

    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${productId}`);
        const data = await res.json();
        if (data.success) {
          setProduct(data.data);
        } else {
          toast.error(t('messages.loadFailed'));
          router.push('/products');
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error(t('messages.loadFailed'));
        router.push('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, router, t]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      setSaving(true);
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success(t('messages.updateSuccess'));
        router.push('/products');
      } else {
        const resData = await res.json();
        toast.error(resData.error || t('messages.saveFailed'));
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error(t('messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  if (!product) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('editProduct')}
          </h1>
          <p className="text-sm text-secondary">{product.name.ar}</p>
        </div>
      </div>

      <div className="bg-card-bg rounded-xl border border-stroke p-6">
        <ProductForm
          product={product}
          onSubmit={handleSubmit}
          loading={saving}
        />
      </div>
    </div>
  );
}
