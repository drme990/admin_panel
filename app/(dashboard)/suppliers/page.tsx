'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Table from '@/components/ui/table';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Dropdown from '@/components/ui/dropdown';
import SupplierFormModal from './components/supplier-form-modal';
import SupplierDetailModal from './components/supplier-detail-modal';
import { Supplier } from '@/types/Supplier';

import { toast } from 'react-toastify';
import { LuSearch, LuPlus, LuPencil, LuTrash2, LuEye } from 'react-icons/lu';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function SuppliersPage() {
    const t = useTranslations('admin.suppliers');
    const { confirm, modalProps } = useConfirmModal();

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(25);
    const [total, setTotal] = useState(0);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const fetchSuppliers = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            params.set('page', String(page));
            params.set('limit', String(pageSize));

            const res = await fetch(`/api/suppliers?${params.toString()}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || t('noSuppliers'));
                setSuppliers([]);
                return;
            }
            setSuppliers(data.data.suppliers || []);
            setTotal(data.data.total || 0);
        } catch {
            toast.error(t('noSuppliers'));
            setSuppliers([]);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, page, pageSize, t]);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    const handleDelete = async (supplier: Supplier) => {
        const confirmed = await confirm({
            title: t('deleteSupplier'),
            message: t('messages.deleteConfirm'),
        });
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/suppliers/${supplier._id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || t('messages.deleteConfirm'));
                return;
            }
            toast.success(t('messages.deleteSuccess'));
            fetchSuppliers();
        } catch {
            toast.error(t('messages.deleteConfirm'));
        }
    };

    const statusBadge = (status: string) => {
        const isActive = status === 'active';
        return (
            <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isActive
                    ? 'bg-success/10 text-success'
                    : 'bg-error/10 text-error'
                    }`}
            >
                {isActive ? t('status.active') : t('status.inactive')}
            </span>
        );
    };

    const columns = [
        {
            header: t('fields.name'),
            accessor: (row: Supplier) => (
                <span className="font-medium text-foreground">{row.name}</span>
            ),
        },
        {
            header: t('fields.phone'),
            accessor: (row: Supplier) => row.phone || '-',
        },
        {
            header: t('fields.email'),
            accessor: (row: Supplier) => row.email || '-',
        },
        {
            header: t('fields.status'),
            accessor: (row: Supplier) => statusBadge(row.status),
        },
        {
            header: t('fields.balance'),
            accessor: (row: Supplier) => {
                const b = row.balance || 0;
                const color = b > 0 ? 'text-success' : b < 0 ? 'text-error' : 'text-success';
                return (
                    <span className={`font-mono ${color}`}>
                        {b.toLocaleString()}
                    </span>
                );
            },
        },
        {
            header: t('fields.totalOrders'),
            accessor: (row: Supplier) => (
                <span className="font-mono">{(row.totalOrders || 0).toLocaleString()}</span>
            ),
        },
        {
            header: t('fields.totalPayouts'),
            accessor: (row: Supplier) => (
                <span className="font-mono">{(row.totalPayouts || 0).toLocaleString()}</span>
            ),
        },
        {
            header: t('fields.address'),
            accessor: (row: Supplier) => row.address || '-',
            className: 'max-w-[200px] truncate',
        },
        {
            header: t('actions'),
            accessor: (row: Supplier) => (
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSupplier(row);
                            setIsDetailOpen(true);
                        }}
                        className="p-1.5"
                        title={t('supplierDetails')}
                    >
                        <LuEye size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingSupplier(row);
                            setIsFormOpen(true);
                        }}
                        className="p-1.5"
                        title={t('editSupplier')}
                    >
                        <LuPencil size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(row);
                        }}
                        className="p-1.5 text-error hover:text-error"
                        title={t('deleteSupplier')}
                    >
                        <LuTrash2 size={16} />
                    </Button>
                </div>
            ),
            className: 'w-28',
        },
    ];

    const statusOptions = [
        { value: 'all', label: t('status.all') },
        { value: 'active', label: t('status.active') },
        { value: 'inactive', label: t('status.inactive') },
    ];

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
                    <p className="text-secondary mt-1">{t('description')}</p>
                </div>
                <Button
                    onClick={() => {
                        setEditingSupplier(null);
                        setIsFormOpen(true);
                    }}
                    className="flex items-center gap-2"
                >
                    <LuPlus size={18} />
                    {t('addSupplier')}
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    <Input
                        placeholder={t('search')}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-10"
                    />
                </div>
                <Dropdown
                    options={statusOptions}
                    value={statusFilter}
                    onChange={(value) => {
                        setStatusFilter(value as StatusFilter);
                        setPage(1);
                    }}
                    className="w-40"
                />
            </div>

            <Table
                columns={columns}
                data={suppliers}
                loading={loading}
                emptyMessage={t('noSuppliers')}
            />

            {total > 0 && (
                <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(total / pageSize)}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            )}

            <ConfirmModal {...modalProps} />

            <SupplierFormModal
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditingSupplier(null);
                }}
                supplier={editingSupplier}
                onSuccess={fetchSuppliers}
            />

            <SupplierDetailModal
                isOpen={isDetailOpen}
                onClose={() => {
                    setIsDetailOpen(false);
                    setSelectedSupplier(null);
                }}
                supplier={selectedSupplier}
                onSupplierUpdated={fetchSuppliers}
            />
        </div>
    );
}
