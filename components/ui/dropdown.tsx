import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { LuChevronDown, LuSearch } from 'react-icons/lu';
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
  searchable?: boolean;
  searchPlaceholder?: string;
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
  searchable = false,
  searchPlaceholder = 'Search...',
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<'down' | 'up'>('down');
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const filteredOptions = searchable
    ? options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

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

  const measureMenu = useCallback((menu: HTMLDivElement | null) => {
    if (!menu || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const margin = 8;

    if (spaceBelow < menuHeight + margin && spaceAbove > spaceBelow) {
      setDirection('up');
    } else {
      setDirection('down');
    }
  }, []);

  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
  }, [isOpen, searchable]);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) setSearch('');
  }

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
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
          ref={measureMenu}
          className={`absolute left-0 right-0 bg-card-bg border border-stroke rounded-lg shadow-lg z-50 min-h-30 max-h-60 overflow-y-auto ${direction === 'up'
            ? 'bottom-full mb-1'
            : 'top-full mt-1'
            }`}
        >
          {searchable && (
            <div className="sticky top-0 z-10 px-3 py-2 bg-card-bg border-b border-stroke">
              <div className="relative">
                <LuSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-stroke bg-background text-foreground focus:outline-none focus:border-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          {filteredOptions.map((option, index) => (
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
