'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import styles from './AddMailboxForm.module.css';

type AddMailboxFormProps = {
  onRefresh: () => void;
};

export function AddMailboxForm({ onRefresh }: AddMailboxFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    host: '',
    port: '993',
    username: '',
    password: '',
    tls: true,
  });

  function handleGmailConnect() {
    window.location.href = '/api/mailboxes/gmail/connect';
  }

  async function handleImapSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/mailboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          host: formData.host,
          port: parseInt(formData.port, 10),
          username: formData.username,
          password: formData.password,
          tls: formData.tls,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? 'Fehler beim Hinzufügen');
        return;
      }

      setFormData({
        displayName: '',
        host: '',
        port: '993',
        username: '',
        password: '',
        tls: true,
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Gmail verbinden</h3>
        <Button
          variant="primary"
          onClick={handleGmailConnect}
          disabled={loading}
        >
          Gmail verbinden
        </Button>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>IMAP Postfach hinzufügen</h3>
        <form onSubmit={handleImapSubmit} className={styles.form}>
          <Input
            label="Anzeigename"
            value={formData.displayName}
            onChange={(e) =>
              setFormData((p) => ({ ...p, displayName: e.target.value }))
            }
            placeholder="z.B. Mein Postfach"
            required
          />
          <Input
            label="Host"
            value={formData.host}
            onChange={(e) =>
              setFormData((p) => ({ ...p, host: e.target.value }))
            }
            placeholder="imap.example.com"
            required
          />
          <Input
            label="Port"
            type="number"
            value={formData.port}
            onChange={(e) =>
              setFormData((p) => ({ ...p, port: e.target.value }))
            }
            min={1}
            max={65535}
          />
          <Input
            label="Benutzername"
            value={formData.username}
            onChange={(e) =>
              setFormData((p) => ({ ...p, username: e.target.value }))
            }
            placeholder="user@example.com"
            required
          />
          <Input
            label="Passwort"
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData((p) => ({ ...p, password: e.target.value }))
            }
            placeholder="••••••••"
            required
          />
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="tls"
              checked={formData.tls}
              onChange={(e) =>
                setFormData((p) => ({ ...p, tls: e.target.checked }))
              }
              className={styles.checkbox}
            />
            <label htmlFor="tls" className={styles.checkboxLabel}>
              TLS verwenden
            </label>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <Button type="submit" loading={loading} disabled={loading}>
            Postfach hinzufügen
          </Button>
        </form>
      </section>
    </div>
  );
}
