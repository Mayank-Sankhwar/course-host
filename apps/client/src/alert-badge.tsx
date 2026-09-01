import { useEffect, useState } from 'react';
import { courseApi } from './course-api';

export function AlertBadge() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { courseApi.alertCount().then(({ count: value }) => setCount(value)).catch(() => setCount(null)); }, []);
  return <>{count === null ? '' : ` (${count})`}</>;
}
