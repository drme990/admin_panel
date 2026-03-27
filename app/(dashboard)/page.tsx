import {
  LuPackage as Package,
  LuUsers as Users,
  LuShoppingCart as ShoppingCart,
  LuGlobe as Globe,
} from 'react-icons/lu';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { RevenueOverTimeChart } from '@/components/analytics/revenue-over-time-chart';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

async function getStats() {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get('admin_panel-token')?.value ||
      cookieStore.get('admin-token')?.value;

    const res = await fetch(`${BACKEND_URL}/api/admin/stats`, {
      cache: 'no-store',
      headers: token
        ? { Cookie: `admin_panel-token=${token}; admin-token=${token}` }
        : {},
    });

    if (!res.ok) {
      return {
        totalProducts: 0,
        totalCustomers: 0,
        totalOrders: 0,
        totalCountries: 0,
      };
    }

    const data = await res.json();
    return data.success
      ? data.data
      : {
          totalProducts: 0,
          totalCustomers: 0,
          totalOrders: 0,
          totalCountries: 0,
        };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      totalProducts: 0,
      totalCustomers: 0,
      totalOrders: 0,
      totalCountries: 0,
    };
  }
}

async function getAnalytics() {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get('admin_panel-token')?.value ||
      cookieStore.get('admin-token')?.value;

    const res = await fetch(`${BACKEND_URL}/api/admin/stats/analytics`, {
      cache: 'no-store',
      headers: token
        ? { Cookie: `admin_panel-token=${token}; admin-token=${token}` }
        : {},
    });

    if (!res.ok) {
      return { revenueByDay: [], revenueByMonth: [] };
    }

    const data = await res.json();
    return data.success
      ? {
          revenueByDay: data.data?.revenueByDay || [],
          revenueByMonth: data.data?.revenueByMonth || [],
        }
      : { revenueByDay: [], revenueByMonth: [] };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return { revenueByDay: [], revenueByMonth: [] };
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
  const analytics = await getAnalytics();
  const t = await getTranslations('admin.dashboard');
  const tAnalytics = await getTranslations('admin.analytics');

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
          title={t('stats.totalCustomers')}
          value={stats.totalCustomers}
          icon={Users}
          href="/customers"
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

      <div className="mt-8 bg-card-bg border border-stroke rounded-site p-6">
        <h2 className="text-xl font-bold text-foreground mb-6">
          {t('charts.revenueOverTime')}
        </h2>
        <RevenueOverTimeChart
          dayData={analytics.revenueByDay}
          monthData={analytics.revenueByMonth}
          dayLabel={tAnalytics('period.day')}
          monthLabel={tAnalytics('period.month')}
        />
      </div>
    </div>
  );
}
