import { FormEvent, useEffect, useState } from 'react';
import { courseApi, type BulkEnrollmentResult, type InstructorEnrollment } from './course-api';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBulkEmails(input: string): { emails: string[]; invalid: string[] } {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const value of input.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean)) {
    if (value === 'email') continue;
    if (!emailPattern.test(value)) { invalid.push(value); continue; }
    if (!seen.has(value)) { seen.add(value); emails.push(value); }
  }
  return { emails, invalid };
}

export function EnrollmentManager({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pastedEmails, setPastedEmails] = useState('');
  const [enrollments, setEnrollments] = useState<InstructorEnrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<{ summary: Record<string, number>; results: BulkEnrollmentResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  const normalizedPaste = normalizeBulkEmails(pastedEmails);

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

  async function bulkEnroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUploading(true);
    try {
      const source = file ? await file.text() : pastedEmails;
      const normalized = normalizeBulkEmails(source);
      if (normalized.invalid.length) throw new Error(`Invalid email address: ${normalized.invalid[0]}`);
      if (!normalized.emails.length) throw new Error('Paste learner emails or choose a CSV file first.');
      const normalizedFile = new File([normalized.emails.join('\n')], file?.name ?? 'pasted-learner-emails.csv', { type: 'text/csv' });
      const response = await courseApi.bulkEnroll(courseId, normalizedFile);
      setResult(response);
      setFile(null);
      setPastedEmails('');
      await loadEnrollments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to enroll learners.');
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
    <div className="enrollment-actions"><section className="subsection"><h4>Add learner</h4><p className="helper-text">Enroll one registered learner by email.</p><form onSubmit={addLearner}><label>Learner email <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={adding} /></label><button type="submit" disabled={adding}>{adding ? 'Adding learner…' : 'Add learner'}</button></form></section><section className="subsection"><h4>Bulk enrollment</h4><p className="helper-text">Paste learner emails or upload a CSV. Emails may be separated by commas, spaces, semicolons, or new lines.</p><form onSubmit={bulkEnroll}><label>Paste learner emails <textarea value={pastedEmails} onChange={(event) => setPastedEmails(event.target.value)} placeholder="learner1@gmail.com\nlearner2@gmail.com" disabled={uploading} /></label>{pastedEmails && <p className="helper-text">{normalizedPaste.emails.length} unique learner {normalizedPaste.emails.length === 1 ? 'email' : 'emails'} ready to enroll{normalizedPaste.invalid.length ? `; ${normalizedPaste.invalid.length} invalid` : ''}.</p>}<label>Or upload CSV <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={uploading} /></label><button type="submit" disabled={uploading}>{uploading ? 'Enrolling learners…' : 'Enroll learners'}</button></form></section></div>
    <div className="list-toolbar"><div><h4>Enrolled learners</h4><p className="helper-text">Current enrollment and progress state.</p></div><button className="button-secondary" type="button" onClick={() => void exportProgress()} disabled={exporting}>{exporting ? 'Exporting…' : 'Export Progress CSV'}</button></div>
    {enrollments.length ? <ul className="data-list learner-list">{enrollments.map((enrollment) => <li className="item-row" key={enrollment.id}><span>{enrollment.learner.email}</span><span className={`status-badge status-${enrollment.progressState.toLowerCase().replaceAll('_', '-')}`}>{enrollment.progressState.replaceAll('_', ' ')}</span></li>)}</ul> : <p className="empty">No learners are enrolled yet. Add an individual learner or upload a CSV.</p>}
    {result && <section className="subsection bulk-results"><h4>Bulk enrollment results</h4><p className="helper-text">Total: {result.summary.total}; Added: {result.summary.added}; Already enrolled: {result.summary.alreadyEnrolled}; Not registered: {result.summary.learnerNotFound}; Invalid: {result.summary.invalidEmail}</p><div className="table-wrap"><table><thead><tr><th>Email</th><th>Status</th></tr></thead><tbody>{result.results.map((row, index) => <tr key={`${row.email}-${index}`}><td>{row.email}</td><td><span className="status-badge status-info">{row.status}</span></td></tr>)}</tbody></table></div></section>}
  </section>;
}
