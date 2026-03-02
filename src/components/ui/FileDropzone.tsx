'use client';

import { useCallback, useState } from 'react';
import styles from './FileDropzone.module.css';

type FileDropzoneProps = {
  accept?: string;
  maxSize?: number;
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
};

export function FileDropzone({
  accept,
  maxSize,
  onFile,
  disabled = false,
  className = '',
}: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndEmit = useCallback(
    (file: File) => {
      setError(null);

      if (maxSize != null && file.size > maxSize) {
        const sizeMB = (maxSize / (1024 * 1024)).toFixed(1);
        setError(`Datei zu groß. Maximal ${sizeMB} MB erlaubt.`);
        return;
      }

      onFile(file);
    },
    [maxSize, onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (!file) return;

      validateAndEmit(file);
    },
    [disabled, validateAndEmit]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      validateAndEmit(file);
      e.target.value = '';
    },
    [validateAndEmit]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    document.getElementById('file-dropzone-input')?.click();
  }, [disabled]);

  return (
    <div
      className={`${styles.zone} ${dragOver ? styles.dragOver : ''} ${disabled ? styles.disabled : ''} ${className}`.trim()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label="Datei hier ablegen oder klicken zum Auswählen"
    >
      <input
        id="file-dropzone-input"
        type="file"
        className={styles.input}
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        tabIndex={-1}
      />
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className={styles.text}>Datei hier ablegen oder klicken zum Auswählen</p>
      {accept && <p className={styles.hint}>Erlaubt: {accept}</p>}
      {maxSize != null && (
        <p className={styles.hint}>Max. {(maxSize / (1024 * 1024)).toFixed(1)} MB</p>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
