'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
    LuPlus,
    LuPencil,
    LuTrash2,
    LuEye,
    LuWallet,
    LuBuilding2,
    LuCreditCard,
    LuBanknote,
    LuSmartphone,
    LuCircleDollarSign,
} from 'react-icons/lu';

import Table from '@/components/ui/table';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { Account, AccountType } from '@/types/Account';
import AccountFormModal from './components/account-form-modal';
import AccountTransactionsModal from './components/account-transactions-modal';

const TYPE_ICON: Record<AccountType, React.ReactNode> = {
    bank_account: <LuBuilding2 size={16} />,
    digital_wallet: <LuWallet size={16} />,
    online_bank: <LuSmartphone size={16} />,
    cash: <LuBanknote size={16} />,
    credit_card: <LuCreditCard size={16} />,
    other: <LuCircleDollarSign size={16} />,
};

const TYPE_COLOR: Record<AccountType, string> = {
    bank_account: 'bg-blue-500/10 text-blue-500',
    digital_wallet: 'bg-purple-500/10 text-purple-500',
    online_bank: 'bg-cyan-500/10 text-cyan-500',
    cash: 'bg-green-500/10 text-green-500',
    credit_card: 'bg-orange-500/10 text-orange-500',
    other: 'bg-secondary/10 text-secondary',
};

interface AccountFormData {
    name: string;
    type: AccountType;
    currency: string;
    balance: string;
    notes: string;
    isActive: boolean;
}

export default function AccountsPage() {
    const t = useTranslations('admin.accounts');
    const ToolTipPositions = useLocale() === 'ar' ? 'right' : 'left';

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTransactions, setShowTransactions] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [selectedAccountName, setSelectedAccountName] = useState('');

    const { confirm, modalProps } = useConfirmModal();

    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/accounts?limit=200');
            const data = await res.json();
            if (data.success) {
                setAccounts(data.data.accounts);
            } else {
                toast.error(data.error || t('messages.loadFailed'));
            }
        } catch {
            toast.error(t('messages.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const openAddModal = () => {
        setEditingAccount(null);
        setShowModal(true);
    };

    const openEditModal = (account: Account) => {
        setEditingAccount(account);
        setShowModal(true);
    };

    const openTransactionsModal = (account: Account) => {
        setSelectedAccountId(account._id);
        setSelectedAccountName(account.name);
        setShowTransactions(true);
    };

    const handleCloseTransactions = () => {
        setShowTransactions(false);
        setSelectedAccountId(null);
        setSelectedAccountName('');
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingAccount(null);
    };

    const handleSubmit = async (formData: AccountFormData) => {
        setIsSubmitting(true);
        const payload = {
            name: formData.name.trim(),
            type: formData.type,
            currency: formData.currency.trim().toUpperCase(),
            balance: parseFloat(formData.balance) || 0,
            notes: formData.notes.trim() || undefined,
            isActive: formData.isActive,
        };

        try {
            const isEdit = !!editingAccount;
            const url = isEdit
                ? `/api/accounts/${editingAccount!._id}`
                : '/api/accounts';
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(
                    isEdit ? t('messages.updateSuccess') : t('messages.createSuccess'),
                );
                handleCloseModal();
                fetchAccounts();
            } else {
                toast.error(
                    data.error ||
                    (isEdit ? t('messages.updateFailed') : t('messages.createFailed')),
                );
            }
        } catch {
            toast.error(
                editingAccount ? t('messages.updateFailed') : t('messages.createFailed'),
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = useCallback(
        async (account: Account) => {
            const confirmed = await confirm({
                title: t('deleteConfirmTitle'),
                message: t('deleteConfirmMessage'),
                type: 'danger',
                confirmText: t('buttons.delete'),
                cancelText: t('buttons.cancel'),
            });
            if (!confirmed) return;

            try {
                const res = await fetch(`/api/accounts/${account._id}`, {
                    method: 'DELETE',
                });
                const data = await res.json();
                if (data.success) {
                    toast.success(t('messages.deleteSuccess'));
                    fetchAccounts();
                } else {
                    toast.error(data.error || t('messages.deleteFailed'));
                }
            } catch {
                toast.error(t('messages.deleteFailed'));
            }
        },
        [confirm, fetchAccounts, t],
    );

    const totalBalance = useMemo(
        () =>
            accounts
                .filter((a) => a.isActive)
                .reduce((sum, a) => sum + a.balance, 0),
        [accounts],
    );

    const columns = useMemo(
        () => [
            {
                header: t('table.name'),
                accessor: (account: Account) => (
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{account.name}</span>
                        {!account.isActive && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-secondary">
                                {t('inactive')}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                header: t('table.type'),
                accessor: (account: Account) => (
                    <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLOR[account.type]}`}
                    >
                        {TYPE_ICON[account.type]}
                        {t(`types.${account.type}`)}
                    </span>
                ),
            },
            {
                header: t('table.currency'),
                accessor: (account: Account) => (
                    <span className="font-mono font-semibold text-sm text-foreground">
                        {account.currency}
                    </span>
                ),
            },
            {
                header: t('table.balance'),
                accessor: (account: Account) => (
                    <span
                        className={`font-mono text-sm font-semibold ${account.balance < 0 ? 'text-red-500' : 'text-green-600'}`}
                    >
                        {account.balance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}{' '}
                        {account.currency}
                    </span>
                ),
            },
            {
                header: t('table.notes'),
                accessor: (account: Account) => (
                    <span className="text-secondary text-sm truncate max-w-xs">
                        {account.notes || '—'}
                    </span>
                ),
            },
            {
                header: t('table.actions'),
                accessor: (account: Account) => (
                    <div className="flex items-center gap-1">
                        <Tooltip position={ToolTipPositions} content={t('showTransactions')}>
                            <Button
                                variant="icon-primary"
                                size="custom"
                                onClick={() => openTransactionsModal(account)}
                                aria-label={t('showTransactions')}
                            >
                                <LuEye size={16} />
                            </Button>
                        </Tooltip>
                        <Tooltip position={ToolTipPositions} content={t('editAccount')}>
                            <Button
                                variant="icon-primary"
                                size="custom"
                                onClick={() => openEditModal(account)}
                                aria-label={t('editAccount')}
                            >
                                <LuPencil size={16} />
                            </Button>
                        </Tooltip>
                        <Tooltip position={ToolTipPositions} content={t('buttons.delete')}>
                            <Button
                                variant="icon-danger"
                                size="custom"
                                onClick={() => handleDelete(account)}
                                aria-label={t('buttons.delete')}
                            >
                                <LuTrash2 size={16} />
                            </Button>
                        </Tooltip>
                    </div>
                ),
            },
        ],
        [t, handleDelete, ToolTipPositions],
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-secondary">{t('description')}</p>
                </div>
                <Button onClick={openAddModal}>
                    <LuPlus size={20} />
                    {t('addAccount')}
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="border border-stroke rounded-lg p-4 bg-card-bg">
                    <p className="text-xs uppercase text-secondary mb-1">
                        {t('stats.totalAccounts')}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                        {accounts.length}
                    </p>
                </div>
                <div className="border border-stroke rounded-lg p-4 bg-card-bg">
                    <p className="text-xs uppercase text-secondary mb-1">
                        {t('stats.activeAccounts')}
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                        {accounts.filter((a) => a.isActive).length}
                    </p>
                </div>
                <div className="border border-stroke rounded-lg p-4 bg-card-bg col-span-2">
                    <p className="text-xs uppercase text-secondary mb-1">
                        {t('stats.combinedBalance')}
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                        {totalBalance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </p>
                    <p className="text-xs text-secondary mt-0.5">
                        {t('stats.combinedBalanceNote')}
                    </p>
                </div>
            </div>

            <Table<Account>
                columns={columns}
                data={accounts}
                loading={loading}
                emptyMessage={t('emptyMessage')}
            />

            <AccountFormModal
                isOpen={showModal}
                account={editingAccount}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
            />

            <ConfirmModal {...modalProps} />

            <AccountTransactionsModal
                isOpen={showTransactions}
                onClose={handleCloseTransactions}
                accountId={selectedAccountId}
                accountName={selectedAccountName}
            />
        </div>
    );
}

