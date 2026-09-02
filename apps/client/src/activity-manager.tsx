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
    <div className="page-heading"><div><h3>Activity & alerts</h3><p className="helper-text">Review learner engagement and immutable history for {courseTitle}.</p></div></div>
    {error && <p role="alert">{error}</p>}
    <h4>Enrolled learner activity</h4>
    {learners.length ? <ul className="data-list">{learners.map((item) => <li className="item-row" key={item.enrollment.id}><span>{item.learner.email} <small className="helper-text">· enrolled {new Date(item.enrollment.enrolledAt).toLocaleDateString()}</small></span><span className={`status-badge status-${item.state.toLowerCase()}`}>{displayActivity(item)}</span></li>)}</ul> : <p className="empty">No learner activity yet.</p>}
    <h4>Inactivity alerts</h4>
    {alerts.length === 0 ? <p className="empty">No active inactivity alerts.</p> : <ul className="data-list">{alerts.map((alert) => <li className="item-row" key={alert.learner.id}><span>{alert.learner.email} — no progress for {alert.daysSinceLastProgress} days</span><button onClick={() => void dismiss(alert.learner.id)}>Dismiss</button></li>)}</ul>}
    <h4>Immutable course history</h4>
    {records.length ? <ul className="data-list">{records.map((record) => <li key={record.id}>{new Date(record.createdAt).toLocaleString()} — {record.type.replaceAll('_', ' ')} — {record.actor?.email ?? 'Unknown actor'}</li>)}</ul> : <p className="empty">No history has been recorded yet.</p>}
  </section>;
}
