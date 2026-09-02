import { useEffect, useState } from 'react';
import { courseApi, type InstructorDashboard } from './course-api';

export function InstructorDashboardView() {
  const [dashboard, setDashboard] = useState<InstructorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    courseApi.dashboard().then(setDashboard).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dashboard.'));
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!dashboard) return <p className="loading-state">Loading dashboard…</p>;
  return <section className="card"><div className="page-heading"><div><h2>Instructor dashboard</h2><p>Track your courses and learner activity at a glance.</p></div></div>
    <div className="metrics">{[
      ['Total learners', dashboard.totals.totalLearners], ['Published courses', dashboard.totals.publishedCourses],
      ['Completions this month', dashboard.totals.completionsThisMonth], ['Learners in progress', dashboard.totals.inProgress]
    ].map(([label, value]) => <article key={String(label)}><strong>{value}</strong><span>{label}</span></article>)}</div>
    <div className="split"><section><h3>Enrollments by course</h3>{dashboard.enrollmentByCourse.length ? <ul className="data-list">{dashboard.enrollmentByCourse.map((course) => <li className="item-row" key={course.id}><span>{course.title}</span><strong>{course.enrollmentCount}</strong></li>)}</ul> : <p className="empty">No courses yet.</p>}</section>
    <section><h3>Enrollment progress</h3><ul className="data-list">{dashboard.enrollmentByState.map((item) => <li className="item-row" key={item.state}><span className={`status-badge status-${item.state.toLowerCase().replaceAll('_', '-')}`}>{item.state.replace('_', ' ')}</span><strong>{item.count}</strong></li>)}</ul></section></div>
    <section className="subsection"><h3>Completions in the last eight weeks</h3><ul className="data-list">{dashboard.completionTrend.map((week) => <li className="item-row" key={week.start}><span>{new Date(week.start).toLocaleDateString()}</span><strong>{week.completed}</strong></li>)}</ul></section>
  </section>;
}
