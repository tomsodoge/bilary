import styles from './ProgressBar.module.css';

type ProgressBarProps = {
  value: number;
  label?: string;
  className?: string;
};

export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`${styles.wrapper} ${className}`.trim()}>
      {label != null && (
        <div className={styles.labelRow}>
          {label && <span className={styles.label}>{label}</span>}
          <span className={styles.value}>{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className={styles.track} role="progressbar" aria-valuenow={clampedValue} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.bar} style={{ width: `${clampedValue}%` }} />
      </div>
    </div>
  );
}
