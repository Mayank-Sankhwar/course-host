import { useEffect, useState } from 'react';
import { courseApi, type InstructorDashboard } from './course-api';

function CompletionTrend({ trend }: { trend: InstructorDashboard['completionTrend'] }) {
  const maximum = Math.max(...trend.map((week) => week.completed), 1);
  return <div className="trend-chart" role="img" aria-label="Course completions across the last eight weeks">
    {trend.map((week) => {
      const label = new Date(week.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return <div className="trend-bar-group" key={week.start}>
        <span className="trend-value">{week.completed}</span>
        <div className="trend-track"><div className="trend-bar" style={{ height: `${Math.max((week.completed / maximum) * 100, week.completed ? 8 : 0)}%` }} /></div>
        <span className="trend-label">{label}</span>
      </div>;
    })}
  </div>;
}

export function InstructorDashboardView() {
  const [dashboard, setDashboard] = useState<InstructorDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    courseApi.dashboard().then(setDashboard).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load dashboard.'));
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!dashboard) return <p className="loading-state">Loading dashboard…</p>;
  const metrics = [
    ['Total learners', dashboard.totals.totalLearners, 'learner'], ['Published courses', dashboard.totals.publishedCourses, 'course'],
    ['Completions this month', dashboard.totals.completionsThisMonth, 'complete'], ['Learners in progress', dashboard.totals.inProgress, 'progress']
  ];
  const hasCompletions = dashboard.completionTrend.some((week) => week.completed > 0);
  return <section className="card dashboard"><div className="page-heading"><div><p className="eyebrow">Instructor workspace</p><h2>Dashboard</h2><p>Overview of your courses and learner activity.</p></div></div>
    <div className="metrics">{metrics.map(([label, value, tone]) => <article className={`metric-card metric-${tone}`} key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="dashboard-grid"><section className="subsection"><div className="section-heading"><div><h3>Enrollment by course</h3><p className="helper-text">Learners currently enrolled in each course.</p></div></div>{dashboard.enrollmentByCourse.length ? <ul className="data-list compact-list">{dashboard.enrollmentByCourse.map((course) => <li className="item-row" key={course.id}><span>{course.title}</span><strong>{course.enrollmentCount}</strong></li>)}</ul> : <p className="empty">No courses yet. Create a course to start building your catalogue.</p>}</section>
    <section className="subsection"><div className="section-heading"><div><h3>Enrollment progress</h3><p className="helper-text">Current learner progress across your courses.</p></div></div><ul className="data-list compact-list">{dashboard.enrollmentByState.map((item) => <li className="item-row" key={item.state}><span className={`status-badge status-${item.state.toLowerCase().replaceAll('_', '-')}`}>{item.state.replace('_', ' ')}</span><strong>{item.count}</strong></li>)}</ul></section></div>
    <section className="subsection trend-section"><div className="section-heading"><div><h3>Completion trend</h3><p className="helper-text">Completed enrollments over the last eight weeks.</p></div>{hasCompletions && <span className="helper-text">Weekly completions</span>}</div>{hasCompletions ? <CompletionTrend trend={dashboard.completionTrend} /> : <p className="empty">No completions recorded in the last eight weeks.</p>}</section>
  </section>;
}
