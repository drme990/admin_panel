import { Package, Users, ShoppingCart, Globe } from 'lucide-react';
import Link from 'next/link';
import dbConnect from '@/lib/db';
import ProductModel from '@/models/Product';
import UserModel from '@/models/User';
import OrderModel from '@/models/Order';
import CountryModel from '@/models/Country';
import { getTranslations } from 'next-intl/server';

async function getStats() {
  try {
    await dbConnect();

    const [totalProducts, totalUsers, totalOrders, totalCountries] =
      await Promise.all([
        ProductModel.countDocuments(),
        UserModel.countDocuments(),
        OrderModel.countDocuments(),
        CountryModel.countDocuments(),
      ]);

    return {
      totalProducts,
      totalUsers,
      totalOrders,
      totalCountries,
    };
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
          color="bg-primary"
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
