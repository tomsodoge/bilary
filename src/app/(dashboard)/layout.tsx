import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import styles from './layout.module.css';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav}>
          <Link href="/inbox-scan" className={styles.navLink}>
            Inbox Scan
          </Link>
          <Link href="/receipts" className={styles.navLink}>
            Belegübersicht
          </Link>
        </nav>
        <div className={styles.userSection}>
          <p className={styles.userEmail}>{user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
