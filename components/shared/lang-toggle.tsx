'use client';

import { useLocale } from 'next-intl';
import Button from '../ui/button';

export default function LangToggle() {
  const locale = useLocale();

  const toggleLang = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    document.cookie = `ADMIN_LOCALE=${newLocale}; path=/; max-age=31536000`;
    window.location.reload();
  };

  return (
    <Button
      variant="icon"
      onClick={toggleLang}
      size="custom"
      className="text-sm"
      aria-label={`Switch to ${locale === 'ar' ? 'English' : 'العربية'}`}
    >
      {locale === 'ar' ? 'EN' : 'AR'}
    </Button>
  );
}
