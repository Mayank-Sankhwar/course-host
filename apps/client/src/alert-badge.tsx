import { useEffect, useState } from 'react';
import { courseApi } from './course-api';

export function AlertBadge() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { courseApi.alertCount().then(({ count: value }) => setCount(value)).catch(() => setCount(null)); }, []);
  if (count === null) return null;
  return <span className={`nav-alert-badge ${count > 0 ? 'has-alerts' : ''}`} aria-label={`${count} active alerts`}>{count}</span>;
}
