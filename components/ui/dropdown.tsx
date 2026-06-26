import { ReactNode, useState, useRef, useEffect } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import Button from './button';

interface DropdownOption<T = string> {
  label: string;
  value: T;
  icon?: ReactNode;
}

interface DropdownProps<T = string> {
  label?: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  error?: string;
}

export default function Dropdown<T = string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  required = false,
  error,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<'down' | 'up'>('down');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !dropdownRef.current || !menuRef.current) return;

    const rect = dropdownRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const margin = 8;

    if (spaceBelow < menuHeight + margin && spaceAbove > spaceBelow) {
      setDirection('up');
    } else {
      setDirection('down');
    }
  }, [isOpen]);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium mb-2">{label}{required && <span className="text-error ml-1">*</span>}</label>
      )}

      <Button
        variant="custom"
        size="custom"
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between ${error ? 'border-error focus:ring-error/20 focus:border-error' : 'border-stroke focus:ring-primary focus:border-primary'}`}
      >
        <span className="flex items-center gap-2">
          {selectedOption?.icon}
          {selectedOption?.label || placeholder}
        </span>
        <LuChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </Button>

      {error && (
        <p className="text-xs text-error mt-1">{error}</p>
      )}

      {isOpen && (
        <div
          ref={menuRef}
          className={`absolute left-0 right-0 bg-card-bg border border-stroke rounded-lg shadow-lg z-50 min-h-30 max-h-60 overflow-y-auto ${direction === 'up'
            ? 'bottom-full mb-1'
            : 'top-full mt-1'
            }`}
        >
          {options.map((option, index) => (
            <Button
              variant="custom"
              size="custom"
              key={index}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-2 text-right hover:bg-background transition-colors flex items-center gap-2 ${option.value === value ? 'bg-primary/10 text-primary' : ''
                }`}
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
