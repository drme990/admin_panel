import { useLocale } from 'next-intl';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import Button from './button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  hasNextPage,
  hasPrevPage,
}: PaginationProps) {
  const canGoPrev = hasPrevPage ?? currentPage > 1;
  const canGoNext = hasNextPage ?? currentPage < totalPages;
  const locale = useLocale();

  if (totalPages <= 1) return null;

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
    <div className="flex items-center justify-between px-4 py-3 bg-card-bg border border-stroke rounded-site mt-4">
      <div className="text-sm text-secondary">
        Page {currentPage} of {totalPages}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="custom"
          size="custom"
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
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
              className={`px-3 py-1 rounded-lg transition-colors ${
                currentPage === page
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
          disabled={!canGoNext}
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
