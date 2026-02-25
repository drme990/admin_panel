'use client';

import { useLocale } from 'next-intl';
import Button from '../ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export default function BackButton({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [hasHistory] = useState(
    () => typeof window !== 'undefined' && window.history.length > 1,
  );

  const handleBack = () => {
    if (hasHistory) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const ArrowIcon = locale === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <Button
      className={className}
      variant="icon"
      size="custom"
      onClick={handleBack}
      aria-label="Go back"
    >
      <ArrowIcon className="h-4 w-4" />
    </Button>
  );
}
