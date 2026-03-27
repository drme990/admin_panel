'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LuLayoutDashboard as LayoutDashboard,
  LuPackage,
  LuUsers,
  LuMenu,
  LuX,
  LuFileText,
  LuShoppingCart,
  LuGlobe,
  LuTicket,
  LuUserRoundPlus,
  LuPalette,
  LuRefreshCw,
  LuCalendarDays,
  LuWallet,
  LuUserCog,
  LuChartNoAxesCombined,
} from 'react-icons/lu';
import { useState, useEffect } from 'react';
import Logo from '@/components/shared/logo';
import UserMenu from '@/components/shared/user-menu';
import { AuthProvider, useAuth } from '@/components/providers/auth-provider';
import { useLocale, useTranslations } from 'next-intl';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PageLoading } from '@/components/ui/loading';
import Button from '@/components/ui/button';
import type { AdminPage } from '@/types/User';

const navItems = [
  {
    key: 'dashboard',
    href: '/',
    icon: LayoutDashboard,
    superAdminOnly: false,
    permissionKey: null,
  },
  {
    key: 'products',
    href: '/products',
    icon: LuPackage,
    superAdminOnly: false,
    permissionKey: 'products',
  },
  {
    key: 'orders',
    href: '/orders',
    icon: LuShoppingCart,
    superAdminOnly: false,
    permissionKey: 'orders',
  },
  {
    key: 'customers',
    href: '/customers',
    icon: LuUsers,
    superAdminOnly: false,
    permissionKey: 'customers',
  },
  {
    key: 'payments',
    href: '/payments',
    icon: LuWallet,
    superAdminOnly: false,
    permissionKey: 'payments',
  },
  {
    key: 'analytics',
    href: '/analytics',
    icon: LuChartNoAxesCombined,
    superAdminOnly: false,
    permissionKey: 'analytics',
  },
  {
    key: 'booking',
    href: '/booking',
    icon: LuCalendarDays,
    superAdminOnly: false,
    permissionKey: 'booking',
  },
  {
    key: 'coupons',
    href: '/coupons',
    icon: LuTicket,
    superAdminOnly: false,
    permissionKey: 'coupons',
  },
  {
    key: 'countries',
    href: '/countries',
    icon: LuGlobe,
    superAdminOnly: false,
    permissionKey: 'countries',
  },
  {
    key: 'admins',
    href: '/admins',
    icon: LuUserCog,
    superAdminOnly: false,
    permissionKey: 'admins',
  },
  {
    key: 'referrals',
    href: '/referrals',
    icon: LuUserRoundPlus,
    superAdminOnly: false,
    permissionKey: 'referrals',
  },
  {
    key: 'appearance',
    href: '/appearance',
    icon: LuPalette,
    superAdminOnly: false,
    permissionKey: 'appearance',
  },
  {
    key: 'exchange',
    href: '/exchange',
    icon: LuRefreshCw,
    superAdminOnly: false,
    permissionKey: 'exchange',
  },
  {
    key: 'activityLogs',
    href: '/logs',
    icon: LuFileText,
    superAdminOnly: false,
    permissionKey: 'activityLogs',
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
    if (!item.permissionKey) return false;
    return (
      user?.allowedPages?.includes(item.permissionKey as AdminPage) ?? false
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
          <Button
            variant="custom"
            size="custom"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            {sidebarOpen ? <LuX size={24} /> : <LuMenu size={24} />}
          </Button>
          <Logo />
        </div>
      )}

      {/* Sidebar */}
      {!isDeepRoute && (
        <aside
          className={cn(
            'fixed top-0 h-dvh w-64 bg-card-bg border-stroke z-40 transition-all duration-300 hover:shadow-lg',
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
          <div className="flex h-full min-h-0 flex-col">
            <div className="hidden shrink-0 lg:flex items-center justify-center p-6 border-b border-stroke">
              <Logo />
            </div>

            <nav className="mt-16 flex-1 min-h-0 overflow-y-auto p-4 space-y-2 lg:mt-0">
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
                        ? 'gradient-site gradient-text'
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

            <div className="shrink-0 p-4 border-t border-stroke text-foreground bg-card-bg">
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
