import { useEffect, useState } from 'react';
import { courseApi, type InstructorDashboard } from './course-api';

export function InstructorDashboardView() {
  const [dashboard, setDashboard] = useState<InstructorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    courseApi.dashboard().then(setDashboard).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dashboard.'));
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!dashboard) return <p>Loading dashboard…</p>;
  return <section><h2>Instructor dashboard</h2>
    <div className="metrics">{[
      ['Total learners', dashboard.totals.totalLearners], ['Published courses', dashboard.totals.publishedCourses],
      ['Completions this month', dashboard.totals.completionsThisMonth], ['Learners in progress', dashboard.totals.inProgress]
    ].map(([label, value]) => <article key={String(label)}><strong>{value}</strong><span>{label}</span></article>)}</div>
    <div className="split"><section><h3>Enrollments by course</h3>{dashboard.enrollmentByCourse.length ? <ul>{dashboard.enrollmentByCourse.map((course) => <li key={course.id}>{course.title}: {course.enrollmentCount}</li>)}</ul> : <p>No courses yet.</p>}</section>
    <section><h3>Enrollment progress</h3><ul>{dashboard.enrollmentByState.map((item) => <li key={item.state}>{item.state.replace('_', ' ')}: {item.count}</li>)}</ul></section></div>
    <section><h3>Completions in the last eight weeks</h3><ul>{dashboard.completionTrend.map((week) => <li key={week.start}>{new Date(week.start).toLocaleDateString()}: {week.completed}</li>)}</ul></section>
  </section>;
}
