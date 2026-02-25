'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Users,
  Menu,
  X,
  FileText,
  ShoppingCart,
  Globe,
  Ticket,
  UserRoundPlus,
  CreditCard,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Logo from '@/components/shared/logo';
import UserMenu from '@/components/shared/user-menu';
import { AuthProvider, useAuth } from '@/components/providers/auth-provider';
import { useLocale, useTranslations } from 'next-intl';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PageLoading } from '@/components/ui/loading';

const navItems = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard, superAdminOnly: false },
  { key: 'products', href: '/products', icon: Package, superAdminOnly: false },
  { key: 'orders', href: '/orders', icon: ShoppingCart, superAdminOnly: false },
  { key: 'coupons', href: '/coupons', icon: Ticket, superAdminOnly: false },
  { key: 'countries', href: '/countries', icon: Globe, superAdminOnly: false },
  { key: 'users', href: '/users', icon: Users, superAdminOnly: false },
  {
    key: 'referrals',
    href: '/referrals',
    icon: UserRoundPlus,
    superAdminOnly: false,
  },
  { key: 'activityLogs', href: '/logs', icon: FileText, superAdminOnly: false },
  {
    key: 'paymentSettings',
    href: '/payment-settings',
    icon: CreditCard,
    superAdminOnly: false,
  },
];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const t = useTranslations('admin');

  // Filter nav items based on user role and allowed pages
  const filteredNavItems = navItems.filter((item) => {
    if (item.key === 'dashboard') return true;
    if (user?.role === 'super_admin') return true;
    return (
      user?.allowedPages?.includes(
        item.key as import('@/types/User').AdminPage,
      ) ?? false
    );
  });

  // Check if current route is second-level or deeper (e.g., /products/new)
  const pathSegments = pathname.split('/').filter(Boolean);
  const isDeepRoute = pathSegments.length > 1;

  // Handle authentication redirect
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // Show login page without admin layout chrome
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show loading state while fetching user data
  if (loading) {
    return <PageLoading text={t('loading')} className="bg-background" />;
  }

  // Show redirecting state if not authenticated
  if (!user) {
    return <PageLoading text={t('redirecting')} className="bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={isRTL}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      {/* Mobile Header */}
      {!isDeepRoute && (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card-bg border-b border-stroke px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Logo />
        </div>
      )}

      {/* Sidebar */}
      {!isDeepRoute && (
        <aside
          className={cn(
            'fixed top-0 h-screen w-64 bg-card-bg border-stroke z-40 transition-all duration-300 hover:shadow-lg',
            isRTL ? 'right-0 border-l' : 'left-0 border-r',
            isRTL
              ? sidebarOpen
                ? 'translate-x-0'
                : 'translate-x-full'
              : sidebarOpen
                ? 'translate-x-0'
                : '-translate-x-full',
            isRTL ? 'lg:translate-x-0' : 'lg:translate-x-0',
          )}
        >
          <div className="flex flex-col h-full">
            <div className="hidden lg:flex items-center justify-center p-6 border-b border-stroke">
              <Logo />
            </div>

            <nav className="flex-1 p-4 space-y-2 mt-16 lg:mt-0">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-primary text-background'
                        : 'hover:bg-background hover:text-primary text-foreground',
                    )}
                  >
                    <Icon size={20} />
                    <span className="font-medium">
                      {t(`navigation.${item.key}`)}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-stroke text-foreground">
              <UserMenu />
            </div>
          </div>
        </aside>
      )}

      {/* Overlay */}
      {!isDeepRoute && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen',
          !isDeepRoute && 'pt-16 lg:pt-0',
          !isDeepRoute && (isRTL ? 'lg:mr-64' : 'lg:ml-64'),
        )}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
