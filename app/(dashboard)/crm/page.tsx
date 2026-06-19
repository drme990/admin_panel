'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
    LuPlus,
    LuPencil,
    LuTrash2,
    LuPlay,
    LuTrophy,
    LuLoader,
} from 'react-icons/lu';
import Button from '@/components/ui/button';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import TierFormModal, { UserTier } from './components/tier-form-modal';
import { CurrencyPrice } from '@/components/admin/multi-currency-price-editor';

export default function CrmPage() {
    const t = useTranslations('admin.crm');
    const [tiers, setTiers] = useState<UserTier[]>([]);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingTier, setEditingTier] = useState<UserTier | null>(null);
    const { confirm, modalProps } = useConfirmModal();

    const fetchTiers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/crm/tiers');
            const data = await res.json();
            if (data.success) {
                setTiers(data.data);
            } else {
                toast.error(data.error || t('tiers.messages.loadFailed'));
            }
        } catch {
            toast.error(t('tiers.messages.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchTiers();
    }, [fetchTiers]);

    const handleAdd = () => {
        setEditingTier(null);
        setShowModal(true);
    };

    const handleEdit = (tier: UserTier) => {
        setEditingTier(tier);
        setShowModal(true);
    };

    const handleDelete = async (tier: UserTier) => {
        const confirmed = await confirm({
            title: t('tiers.deleteConfirmTitle'),
            message: t('tiers.deleteConfirmMessage'),
            type: 'danger',
            confirmText: t('tiers.buttons.delete'),
            cancelText: t('tiers.buttons.cancel'),
        });
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/crm/tiers/${tier._id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                toast.success(t('tiers.messages.deleteSuccess'));
                fetchTiers();
            } else {
                toast.error(data.error || t('tiers.messages.deleteFailed'));
            }
        } catch {
            toast.error(t('tiers.messages.deleteFailed'));
        }
    };

    const handleApplyAll = async () => {
        const confirmed = await confirm({
            title: t('tiers.applyConfirmTitle'),
            message: t('tiers.applyConfirmMessage'),
            type: 'info',
            confirmText: t('tiers.buttons.applyAll'),
            cancelText: t('tiers.buttons.cancel'),
        });
        if (!confirmed) return;

        setApplying(true);
        try {
            const res = await fetch('/api/crm/tiers/apply', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast.success(
                    t('tiers.messages.applySuccess', {
                        processed: data.data.processed,
                        errors: data.data.errors,
                    }),
                );
            } else {
                toast.error(data.error || t('tiers.messages.applyFailed'));
            }
        } catch {
            toast.error(t('tiers.messages.applyFailed'));
        } finally {
            setApplying(false);
        }
    };

    const handleSaved = () => {
        fetchTiers();
    };

    const formatAmounts = (amounts: CurrencyPrice[]) => {
        if (!amounts || amounts.length === 0) return '—';
        return amounts
            .filter((a) => a.amount > 0)
            .slice(0, 3)
            .map((a) => `${a.currencyCode} ${a.amount.toLocaleString()}`)
            .join(' · ');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <LuTrophy className="w-6 h-6 text-primary" />
                        {t('title')}
                    </h1>
                    <p className="text-sm text-secondary mt-1">{t('description')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleApplyAll}
                        disabled={applying || tiers.length === 0}
                    >
                        {applying ? (
                            <LuLoader className="w-4 h-4 animate-spin" />
                        ) : (
                            <LuPlay className="w-4 h-4" />
                        )}
                        {applying ? t('tiers.buttons.applying') : t('tiers.buttons.applyAll')}
                    </Button>
                    <Button onClick={handleAdd}>
                        <LuPlus className="w-4 h-4" />
                        {t('tiers.buttons.addTier')}
                    </Button>
                </div>
            </div>

            {/* Tiers Section */}
            <div className="bg-card-bg rounded-site border border-stroke overflow-hidden">
                <div className="px-6 py-4 border-b border-stroke">
                    <h2 className="text-lg font-semibold text-foreground">
                        {t('tiers.sectionTitle')}
                    </h2>
                    <p className="text-xs text-secondary mt-1">
                        {t('tiers.sectionDescription')}
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <LuLoader className="w-6 h-6 animate-spin text-secondary" />
                    </div>
                ) : tiers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <LuTrophy className="w-10 h-10 text-secondary/40 mb-3" />
                        <p className="text-secondary text-sm">{t('tiers.emptyMessage')}</p>
                        <Button className="mt-4" onClick={handleAdd}>
                            <LuPlus className="w-4 h-4" />
                            {t('tiers.buttons.addTier')}
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y divide-stroke">
                        {tiers.map((tier, index) => (
                            <div
                                key={tier._id}
                                className="flex items-center gap-4 px-6 py-4 hover:bg-background/50 transition-colors"
                            >
                                {/* Color + Rank */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div
                                        className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                                        style={{ backgroundColor: tier.color || '#6366f1' }}
                                    />
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                                        {index + 1}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground">{tier.name}</p>
                                    <p className="text-xs text-secondary mt-0.5">
                                        {t('tiers.minimumLabel')}:{' '}
                                        <span className="font-medium text-foreground">
                                            {formatAmounts(tier.minimumAmounts)}
                                        </span>
                                    </p>
                                    <p className="text-xs text-secondary">
                                        {t('tiers.baseCurrencyLabel')}: {tier.mainCurrency} ·{' '}
                                        {t('tiers.baseAmountLabel')}: {tier.baseAmount.toLocaleString()}
                                    </p>
                                </div>

                                {/* Currency count */}
                                <div className="flex-shrink-0 text-center">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                                        {tier.minimumAmounts.filter((a) => a.amount > 0).length}{' '}
                                        {t('tiers.currenciesLabel')}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEdit(tier)}
                                    >
                                        <LuPencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDelete(tier)}
                                        className="text-error border-error/30 hover:bg-error/10"
                                    >
                                        <LuTrash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info card */}
            <div className="rounded-site border border-stroke bg-card-bg p-5 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                    {t('howItWorks.title')}
                </h3>
                <ul className="text-xs text-secondary space-y-1.5 list-disc list-inside">
                    <li>{t('howItWorks.step1')}</li>
                    <li>{t('howItWorks.step2')}</li>
                    <li>{t('howItWorks.step3')}</li>
                    <li>{t('howItWorks.step4')}</li>
                </ul>
            </div>

            <TierFormModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSaved={handleSaved}
                editingTier={editingTier}
            />

            <ConfirmModal {...modalProps} />
        </div>
    );
}
