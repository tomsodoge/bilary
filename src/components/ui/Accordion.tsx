'use client';

import { useState, type ReactNode } from 'react';
import styles from './Accordion.module.css';

type AccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
};

export function Accordion({ title, children, defaultOpen = false, badge }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`${styles.accordion} ${isOpen ? styles.open : ''}`}>
      <button
        type="button"
        className={styles.summary}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className={styles.summaryContent}>
          <svg
            className={styles.icon}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
          {title}
          {badge && <span className={styles.badge}>{badge}</span>}
        </span>
      </button>
      <div className={styles.details} hidden={!isOpen}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
