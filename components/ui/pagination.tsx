import { useLocale, useTranslations } from 'next-intl';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import Button from './button';
import Dropdown from './dropdown';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  disabled?: boolean;
  pageSize?: number | 'all';
  onPageSizeChange?: (size: number | 'all') => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 'all'] as const;

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  hasNextPage,
  hasPrevPage,
  disabled = false,
  pageSize = 20,
  onPageSizeChange,
}: PaginationProps) {
  const canGoPrev = hasPrevPage ?? currentPage > 1;
  const canGoNext = hasNextPage ?? currentPage < totalPages;
  const locale = useLocale();
  const t = useTranslations('orders.pagination');

  const pageSizeOptions = PAGE_SIZE_OPTIONS.map((size) => ({
    label: size === 'all' ? t('all') : String(size),
    value: size,
  }));

  if (totalPages <= 1 && pageSize !== 'all') return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card-bg border border-stroke rounded-site mt-4 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">{t('show')}</span>
            <Dropdown
              value={pageSize === 'all' ? 'all' : String(pageSize)}
              options={pageSizeOptions.map((opt) => ({
                label: opt.label,
                value: opt.value === 'all' ? 'all' : String(opt.value),
              }))}
              onChange={(val) => onPageSizeChange(val === 'all' ? 'all' : Number(val))}
              disabled={disabled}
              className="w-20"
            />
          </div>
        )}
        <div className="text-sm text-secondary">
          {t('pageInfo', { page: currentPage, totalPages })}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="custom"
          size="custom"
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || !canGoPrev}
          className="p-2 rounded-lg hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LuChevronRight
            size={18}
            className={locale === 'en' ? 'rotate-180' : ''}
          />
        </Button>

        {getPageNumbers().map((page, index) =>
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-secondary">
              ...
            </span>
          ) : (
            <Button
              variant="custom"
              size="custom"
              type="button"
              key={page}
              onClick={() => onPageChange(page as number)}
              disabled={disabled}
              className={`px-3 py-1 rounded-lg transition-colors ${currentPage === page
                ? 'bg-success text-white'
                : 'hover:bg-background text-foreground'
                }`}
            >
              {page}
            </Button>
          ),
        )}

        <Button
          variant="custom"
          size="custom"
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || !canGoNext}
          className="p-2 rounded-lg hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LuChevronLeft
            size={18}
            className={locale === 'en' ? 'rotate-180' : ''}
          />
        </Button>
      </div>
    </div>
  );
}
