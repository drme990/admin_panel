import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Prevent body scroll and manage focus when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      // Restore body scroll
      document.body.style.overflow = '';

      // Restore previous focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        onClose();
      }

      // Focus trap - prevent tabbing outside modal
      if (event.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={`bg-card-bg rounded-site border border-stroke ${sizeClasses[size]} w-full max-h-[90vh] flex flex-col overflow-hidden`}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header - Always Visible */}
        <div className="shrink-0 bg-card-bg border-b border-stroke px-6 py-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-bold text-foreground">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:text-error rounded-lg transition-colors"
            type="button"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {/* Footer - Always Visible (if provided) */}
        {footer && (
          <div className="shrink-0 bg-card-bg border-t border-stroke px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
