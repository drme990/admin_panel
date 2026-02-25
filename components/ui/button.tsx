import { cn } from '@/lib/utils';
import Link from 'next/link';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'icon'
  | 'custom';
type ButtonSize = 'sm' | 'md' | 'lg' | 'custom';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  href?: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  href,
  target,
  ...props
}: ButtonProps) {
  const baseStyles =
    'font-medium transition-all duration-200 rounded-site flex items-center justify-center';

  const variants = {
    primary:
      'gradient-site gradient-text font-medium hover:opacity-90 shadow-lg hover:shadow-xl',
    secondary: 'bg-secondary text-white hover:bg-secondary/90',
    outline:
      'border-1 border-stroke text-foreground hover:bg-foreground hover:text-background',
    ghost: 'text-foreground hover:bg-foreground/10',
    icon: 'p-3 rounded-md text-success bg-background border border-stroke',
    custom: '',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    custom: '',
  };

  const buttonClasses = cn(
    baseStyles,
    variants[variant],
    sizes[size],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={buttonClasses} target={target}>
        {children}
      </Link>
    );
  }

  return (
    <button className={buttonClasses} {...props}>
      {children}
    </button>
  );
}
