import { useEffect, useState } from 'react';
import { courseApi, type ActivityRecord, type InactivityAlert, type LearnerActivity } from './course-api';

function displayActivity(item: LearnerActivity) {
  if (item.state === 'NOT_STARTED') return 'Not started';
  return `${item.state === 'INACTIVE' ? 'Inactive' : 'Active'} — ${new Date(item.lastProgressAt!).toLocaleString()}`;
}

export function ActivityManager({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [learners, setLearners] = useState<LearnerActivity[]>([]);
  const [alerts, setAlerts] = useState<InactivityAlert[]>([]);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    try {
      const [activity, alertResponse, logs] = await Promise.all([courseApi.activity(courseId), courseApi.alerts(courseId), courseApi.activityLog(courseId)]);
      setLearners(activity.learners); setAlerts(alertResponse.alerts); setRecords(logs.records);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load course activity.'); }
  }
  useEffect(() => { void load(); }, [courseId]);
  async function dismiss(learnerId: string) {
    setError(null);
    try { await courseApi.dismissAlert(courseId, learnerId); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to dismiss alert.'); }
  }
  return <section>
    <h3>Activity: {courseTitle}</h3>
    {error && <p role="alert">{error}</p>}
    <h4>Enrolled learner activity</h4>
    <ul>{learners.map((item) => <li key={item.enrollment.id}>{item.learner.email} — enrolled {new Date(item.enrollment.enrolledAt).toLocaleDateString()} — {displayActivity(item)}</li>)}</ul>
    <h4>Inactivity alerts</h4>
    {alerts.length === 0 ? <p>No active inactivity alerts.</p> : <ul>{alerts.map((alert) => <li key={alert.learner.id}>{alert.learner.email} — no progress for {alert.daysSinceLastProgress} days <button onClick={() => void dismiss(alert.learner.id)}>Dismiss</button></li>)}</ul>}
    <h4>Immutable course history</h4>
    <ul>{records.map((record) => <li key={record.id}>{new Date(record.createdAt).toLocaleString()} — {record.type} — {record.actor?.email ?? 'Unknown actor'}</li>)}</ul>
  </section>;
}
