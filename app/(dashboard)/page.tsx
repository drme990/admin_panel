import { Package, Users, ShoppingCart, Globe } from 'lucide-react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function getStats() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    const res = await fetch(`${BACKEND_URL}/api/admin/stats`, {
      cache: 'no-store',
      headers: token ? { Cookie: `admin-token=${token}` } : {},
    });

    if (!res.ok) {
      return {
        totalProducts: 0,
        totalUsers: 0,
        totalOrders: 0,
        totalCountries: 0,
      };
    }

    const data = await res.json();
    return data.success
      ? data.data
      : { totalProducts: 0, totalUsers: 0, totalOrders: 0, totalCountries: 0 };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      totalProducts: 0,
      totalUsers: 0,
      totalOrders: 0,
      totalCountries: 0,
    };
  }
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  href?: string;
  color: string;
}) {
  const content = (
    <div className="bg-card-bg border border-stroke rounded-site p-8 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="flex items-center justify-between mb-6">
        <div
          className={`w-14 h-14 rounded-xl flex items-center justify-center ${color} group-hover:scale-105 transition-transform duration-200`}
        >
          <Icon size={28} className="text-white" />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-foreground mb-2">{value}</h3>
      <p className="text-secondary text-base">{title}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export default async function DashboardPage() {
  const stats = await getStats();
  const t = await getTranslations('admin.dashboard');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-secondary">{t('welcome')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('stats.totalProducts')}
          value={stats.totalProducts}
          icon={Package}
          href="/products"
          color="bg-orange-500"
        />
        <StatCard
          title={t('stats.totalUsers')}
          value={stats.totalUsers}
          icon={Users}
          href="/users"
          color="bg-blue-500"
        />
        <StatCard
          title={t('stats.orders')}
          value={stats.totalOrders}
          icon={ShoppingCart}
          href="/orders"
          color="bg-purple-500"
        />
        <StatCard
          title={t('stats.countries')}
          value={stats.totalCountries}
          icon={Globe}
          href="/countries"
          color="bg-teal-500"
        />
      </div>
    </div>
  );
}
