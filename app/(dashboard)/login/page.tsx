'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import {
  LuLogIn,
  LuEye,
  LuEyeOff,
} from 'react-icons/lu';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import { PageLoading } from '@/components/ui/loading';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const t = useTranslations('admin.login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  if (authLoading || user) {
    return (
      <PageLoading text={t('buttons.loggingIn')} className="bg-background" />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, appId: 'admin_panel' }),
      });

      const data = await res.json();

      if (res.ok) {
        await refreshUser();
        router.replace('/');
      } else if (res.status === 429) {
        setError(data.error || t('errors.tooManyAttempts'));
      } else {
        setError(data.error || t('errors.invalidCredentials'));
      }
    } catch (err) {
      console.error('Login error', err);
      setError(t('errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card-bg border border-stroke rounded-site p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t('title')}
            </h1>
            <p className="text-secondary text-sm">{t('subtitle')}</p>
          </div>

          {error && (
            <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label={t('form.email')}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              disabled={loading}
            />

            <Input
              id="password"
              label={t('form.password')}
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              suffix={
                <Button
                  type="button"
                  variant="custom"
                  size="custom"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-secondary hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                </Button>
              }
            />

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                t('buttons.loggingIn')
              ) : (
                <>
                  <LuLogIn size={20} />
                  {t('buttons.login')}
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
