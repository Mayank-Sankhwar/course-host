import { FormEvent, useEffect, useState } from 'react';
import { courseApi, type BulkEnrollmentResult, type InstructorEnrollment } from './course-api';

export function EnrollmentManager({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [enrollments, setEnrollments] = useState<InstructorEnrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<{ summary: Record<string, number>; results: BulkEnrollmentResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    setAdding(true);
    try {
      await courseApi.enrollLearner(courseId, email);
      setEmail('');
      await loadEnrollments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to add learner.');
    } finally { setAdding(false); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError('Choose a CSV file first.');
    setError(null);
    setUploading(true);
    try {
      const response = await courseApi.bulkEnroll(courseId, file);
      setResult(response);
      setFile(null);
      await loadEnrollments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to upload CSV.');
    } finally { setUploading(false); }
  }

  async function exportProgress() {
    setError(null);
    setExporting(true);
    try {
      const { blob, filename } = await courseApi.exportProgressCsv(courseId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to export learner progress.');
    } finally {
      setExporting(false);
    }
  }

  return <section>
    <div className="page-heading"><div><h3>Enroll learners</h3><p className="helper-text">Manage learners for {courseTitle}.</p></div><span className="status-badge status-info">{total} enrolled</span></div>
    {error && <p role="alert">{error}</p>}
    <div className="enrollment-actions"><section className="subsection"><h4>Add learner</h4><p className="helper-text">Enroll one registered learner by email.</p><form onSubmit={addLearner}><label>Learner email <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={adding} /></label><button type="submit" disabled={adding}>{adding ? 'Adding learner…' : 'Add learner'}</button></form></section><section className="subsection"><h4>Bulk enrollment</h4><p className="helper-text">Upload a CSV with one learner email per row (up to 1,000 rows).</p><form onSubmit={upload}><label>CSV file <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required disabled={uploading} /></label><button type="submit" disabled={uploading}>{uploading ? 'Uploading CSV…' : 'Upload CSV'}</button></form></section></div>
    <div className="list-toolbar"><div><h4>Enrolled learners</h4><p className="helper-text">Current enrollment and progress state.</p></div><button className="button-secondary" type="button" onClick={() => void exportProgress()} disabled={exporting}>{exporting ? 'Exporting…' : 'Export Progress CSV'}</button></div>
    {enrollments.length ? <ul className="data-list learner-list">{enrollments.map((enrollment) => <li className="item-row" key={enrollment.id}><span>{enrollment.learner.email}</span><span className={`status-badge status-${enrollment.progressState.toLowerCase().replaceAll('_', '-')}`}>{enrollment.progressState.replaceAll('_', ' ')}</span></li>)}</ul> : <p className="empty">No learners are enrolled yet. Add an individual learner or upload a CSV.</p>}
    {result && <section className="subsection bulk-results"><h4>Bulk enrollment results</h4><p className="helper-text">Total: {result.summary.total}; Added: {result.summary.added}; Already enrolled: {result.summary.alreadyEnrolled}; Not registered: {result.summary.learnerNotFound}; Invalid: {result.summary.invalidEmail}</p><div className="table-wrap"><table><thead><tr><th>Email</th><th>Status</th></tr></thead><tbody>{result.results.map((row, index) => <tr key={`${row.email}-${index}`}><td>{row.email}</td><td><span className="status-badge status-info">{row.status}</span></td></tr>)}</tbody></table></div></section>}
  </section>;
}
