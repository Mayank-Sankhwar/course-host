import { FormEvent, useEffect, useState } from 'react';
import { courseApi, type BulkEnrollmentResult, type InstructorEnrollment } from './course-api';

export function EnrollmentManager({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [enrollments, setEnrollments] = useState<InstructorEnrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<{ summary: Record<string, number>; results: BulkEnrollmentResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadEnrollments() {
    try {
      const response = await courseApi.enrollments(courseId);
      setEnrollments(response.enrollments);
      setTotal(response.total);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load enrolled learners.');
    }
  }

  useEffect(() => { void loadEnrollments(); }, [courseId]);

  async function addLearner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await courseApi.enrollLearner(courseId, email);
      setEmail('');
      await loadEnrollments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to add learner.');
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError('Choose a CSV file first.');
    setError(null);
    try {
      const response = await courseApi.bulkEnroll(courseId, file);
      setResult(response);
      setFile(null);
      await loadEnrollments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to upload CSV.');
    }
  }

  return <section>
    <h3>Enroll learners: {courseTitle}</h3>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={addLearner}><label>Learner email <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button type="submit">Add learner</button></form>
    <form onSubmit={upload}><label>CSV file <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label><button type="submit">Upload CSV</button></form>
    <p>{total} enrolled learners</p>
    <ul>{enrollments.map((enrollment) => <li key={enrollment.id}>{enrollment.learner.email} — {enrollment.progressState}</li>)}</ul>
    {result && <section><h4>Bulk enrollment results</h4><p>Total: {result.summary.total}; Added: {result.summary.added}; Already enrolled: {result.summary.alreadyEnrolled}; Not registered: {result.summary.learnerNotFound}; Invalid: {result.summary.invalidEmail}</p><table><thead><tr><th>Email</th><th>Status</th></tr></thead><tbody>{result.results.map((row, index) => <tr key={`${row.email}-${index}`}><td>{row.email}</td><td>{row.status}</td></tr>)}</tbody></table></section>}
  </section>;
}
