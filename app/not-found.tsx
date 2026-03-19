import Link from 'next/link';
import {
  LuTriangleAlert as AlertTriangle,
  LuHouse as Home,
} from 'react-icons/lu';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('admin.notFound');

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-site border border-stroke bg-card-bg p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error">
          <AlertTriangle size={28} />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-secondary mb-6">{t('description')}</p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-background hover:bg-primary/90 transition-colors"
          >
            <Home size={18} />
            {t('backHome')}
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-stroke px-5 py-2.5 font-medium text-foreground hover:bg-background transition-colors"
          >
            {t('goLogin')}
          </Link>
        </div>
      </div>
    </main>
  );
}
