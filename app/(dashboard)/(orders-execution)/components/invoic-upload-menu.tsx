import Button from "@/components/ui/button";
import Tooltip from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { LuUpload } from "react-icons/lu";

export interface InvoiceUploadMenuProps {
    onUpload: (reviewed: boolean) => void;
    disabled?: boolean;
    tooltipPos?: 'left' | 'right';
    labels: {
        tooltip?: string;
        uploadReviewed: string;
        uploadUnreviewed: string;
    };
    variant?: 'icon' | 'outline';
    buttonLabel?: string;
    className?: string;
}


export function InvoiceUploadMenu({ onUpload, disabled, tooltipPos, labels, variant = 'icon', buttonLabel, className }: InvoiceUploadMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const handleSelect = (reviewed: boolean) => {
        setIsOpen(false);
        onUpload(reviewed);
    };

    const trigger = variant === 'outline' ? (
        <Button
            variant="outline"
            size="custom"
            className={`px-3 py-2 ${className || ''}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsOpen((prev) => !prev);
            }}
            disabled={disabled}
            aria-label={labels.tooltip || buttonLabel}
        >
            <LuUpload size={16} className="me-2" />
            {buttonLabel}
        </Button>
    ) : (
        <Tooltip position={tooltipPos || 'left'} content={labels.tooltip || ''}>
            <Button
                variant="ghost"
                size="custom"
                className={`h-5 w-5 p-0 text-secondary hover:text-foreground ${className || ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen((prev) => !prev);
                }}
                disabled={disabled}
                aria-label={labels.tooltip || buttonLabel}
            >
                <LuUpload size={12} />
            </Button>
        </Tooltip>
    );

    return (
        <div className="relative" ref={rootRef}>
            {trigger}
            {isOpen && (
                <div className="absolute z-30 mt-1 w-40 rounded-site border border-stroke bg-card-bg p-1 shadow-xl">
                    <Button
                        variant="custom"
                        size="custom"
                        type="button"
                        className="w-full px-2 py-1.5 text-start text-sm hover:bg-background rounded-lg transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(true);
                        }}
                    >
                        {labels.uploadReviewed}
                    </Button>
                    <Button
                        variant="custom"
                        size="custom"
                        type="button"
                        className="w-full px-2 py-1.5 text-start text-sm hover:bg-background rounded-lg transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(false);
                        }}
                    >
                        {labels.uploadUnreviewed}
                    </Button>
                </div>
            )}
        </div>
    );
}