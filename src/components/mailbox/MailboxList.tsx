'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import styles from './MailboxList.module.css';

export interface MailboxItem {
  id: number;
  type: string;
  displayName: string;
  status: string;
  statusMessage: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
}

type MailboxListProps = {
  mailboxes: MailboxItem[];
  onRefresh: () => void;
};

function formatDate(date: Date | null): string {
  if (!date) return '–';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusVariant(status: string): 'success' | 'error' | 'warning' | 'info' {
  switch (status) {
    case 'connected':
      return 'success';
    case 'failed':
      return 'error';
    case 'disconnected':
      return 'warning';
    default:
      return 'info';
  }
}

export function MailboxList({ mailboxes, onRefresh }: MailboxListProps) {
  async function handleDelete(id: number) {
    const res = await fetch(`/api/mailboxes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Fehler beim Löschen');
      return;
    }
    onRefresh();
  }

  async function handleTest(id: number) {
    const res = await fetch(`/api/mailboxes/${id}/test`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? 'Verbindungstest fehlgeschlagen');
      return;
    }
    alert('Verbindung erfolgreich');
    onRefresh();
  }

  if (mailboxes.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Keine Postfächer verbunden.</p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {mailboxes.map((mb) => (
        <li key={mb.id} className={styles.item}>
          <div className={styles.info}>
            <span className={styles.typeLabel}>
              {mb.type === 'gmail' ? 'Gmail' : 'IMAP'}
            </span>
            <span className={styles.displayName}>{mb.displayName}</span>
            <Badge variant={getStatusVariant(mb.status)} className={styles.badge}>
              {mb.status}
            </Badge>
            {mb.statusMessage && (
              <span className={styles.statusMessage}>{mb.statusMessage}</span>
            )}
            <span className={styles.meta}>
              Letzte Synchronisation: {formatDate(mb.lastSyncAt)}
            </span>
          </div>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleTest(mb.id)}
            >
              Testen
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(mb.id)}
            >
              Löschen
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
