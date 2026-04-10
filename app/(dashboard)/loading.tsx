import { getTranslations } from 'next-intl/server';
import { PageLoading } from '@/components/ui/loading';

export default async function DashboardLoading() {
  const t = await getTranslations('admin');

  return <PageLoading text={t('loading')} className="bg-background" />;
}
