import { ThemeProvider } from 'next-themes';

export const ADMIN_THEMES = [
  'light',
  'black',
  'manasik',
  'ghadaq',
  'colors',
] as const;
export type AdminTheme = (typeof ADMIN_THEMES)[number];

export default function OurThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      themes={[...ADMIN_THEMES]}
      enableSystem={false}
      defaultTheme="black"
      storageKey="admin-panel-theme"
    >
      {children}
    </ThemeProvider>
  );
}
