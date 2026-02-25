'use client';

import Link from 'next/link';

export default function Logo() {
  return (
    <Link href="/" className="block w-fit">
      <span className="text-xl font-bold text-foreground">Admin Panel</span>
    </Link>
  );
}
