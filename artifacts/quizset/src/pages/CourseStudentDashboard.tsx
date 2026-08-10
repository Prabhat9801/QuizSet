import { useEffect, useMemo, useState } from 'react';
import { Award, ArrowLeft, CheckCircle2, Clock3, Percent, Users } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton, Stat } from '@/components/ui';
import { attemptService, certificateService, computeTopicBreakdown, courseService, questionService, studentService } from '@/services/api';
import { Attempt, Course, Question, Student } from '@/types';
import { formatTimer } from '@/lib/format';
import { useApp } from '@/contexts/AppContext';

type StudentRow = { student: Student; attempts: Attempt[]; best: number; latest: number; lastAttempt: Attempt };

function accuracy(a: Attempt): number {
  return a.totalAttempted ? Math.round((a.score / a.totalAttempted) * 100) : 0;
}

/** Coaching owner's per-course drill-down: who has attempted, how well, and where the class is weak — topic by topic. */
export function CourseStudentDashboard() {
  const { toast } = useApp();
  const [, params] = useRoute('/coaching/courses/:id/students');
  const [course, setCourse] = useState<Course | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [unitFilter, setUnitFilter] = useState('All');
  const [studentQuery, setStudentQuery] = useState('');
  const [certifying, setCertifying] = useState<Student | null>(null);
  const [certNote, setCertNote] = useState('');
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    courseService.get(params.id).then(async (c) => {
      if (!c) return;
      setCourse(c);
      const [a, s, qs] = await Promise.all([attemptService.listForCourse(c.id), studentService.list(c.tenantId), questionService.listByCourse(c.id)]);
      setAttempts(a);
      setStudents(s);
      setQuestions(qs);
    });
  }, [params?.id]);

  const eligible = useMemo(() => {
    if (!course) return [];
    return students.filter((s) => course.assignedStudentIds.length === 0 || course.assignedStudentIds.includes(s.id));
  }, [course, students]);

  const rows = useMemo<StudentRow[]>(() => {
    if (!attempts) return [];
    const byStudent = new Map<string, Attempt[]>();
    attempts.forEach((a) => {
      const list = byStudent.get(a.studentId) || [];
      list.push(a);
      byStudent.set(a.studentId, list);
    });
    return eligible
      .map((student) => {
        const list = byStudent.get(student.id) || [];
        if (list.length === 0) return null;
        const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return { student, attempts: list, best: Math.max(...list.map(accuracy)), latest: accuracy(sorted[0]), lastAttempt: sorted[0] };
      })
      .filter((r): r is StudentRow => r !== null)
      .sort((a, b) => b.latest - a.latest);
  }, [eligible, attempts]);

  const notStarted = eligible.filter((s) => !rows.some((r) => r.student.id === s.id));
  const topicRows = useMemo(() => computeTopicBreakdown(attempts || [], questions), [attempts, questions]);
  const units = useMemo(() => Array.from(new Set(questions.map((q) => q.unit))).sort(), [questions]);
  const filteredTopicRows = topicRows.filter((r) => unitFilter === 'All' || r.unit === unitFilter);
  const sq = studentQuery.trim().toLowerCase();
  const filteredRows = rows.filter((r) => !sq || r.student.name.toLowerCase().includes(sq) || r.student.email.toLowerCase().includes(sq));

  const openCertify = (student: Student) => {
    setCertNote('');
    setCertifying(student);
  };

  const issueCertificate = async () => {
    if (!certifying || !course) return;
    setIssuing(true);
    try {
      await certificateService.issue({ tenantId: course.tenantId, studentId: certifying.id, courseId: course.id, note: certNote.trim() || undefined });
      toast('Certificate issued', `${certifying.name} can now see it in their certificates list.`);
      setCertifying(null);
    } finally {
      setIssuing(false);
    }
  };

  if (!course || !attempts) return <Skeleton className="skeleton-page" />;

  const avgAccuracy = attempts.length ? Math.round(attempts.reduce((sum, a) => sum + accuracy(a), 0) / attempts.length) : 0;
  const avgTime = attempts.length ? Math.round(attempts.reduce((sum, a) => sum + a.timeTakenSeconds, 0) / attempts.length) : 0;

  return (
    <>
      <PageHeader
        eyebrow={course.name}
        title="Student performance"
        description="Every attempt on this course, plus where the class is strong or weak by topic."
        action={
          <Link href={`/coaching/courses/${course.id}`} className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to course
          </Link>
        }
      />

      <div className="stats-grid">
        <Stat label="Total attempts" value={String(attempts.length)} icon={<CheckCircle2 />} />
        <Stat label="Students attempted" value={`${rows.length} / ${eligible.length}`} icon={<Users />} />
        <Stat label="Average accuracy" value={`${avgAccuracy}%`} icon={<Percent />} />
        <Stat label="Average time" value={formatTimer(avgTime)} icon={<Clock3 />} />
      </div>

      <Card>
        <div className="card-title">
          <div>
            <h2>Topic & unit accuracy</h2>
            <p>Across every student's attempts on this course.</p>
          </div>
        </div>
        {topicRows.length === 0 ? (
          <EmptyState title="No attempts yet" description="Accuracy breakdown appears once students start practising." />
        ) : (
          <>
            <div className="filter-bar" style={{ padding: '0 0 14px' }}>
              <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                <option value="All">All units</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <span className="filter-count">
                {filteredTopicRows.length} of {topicRows.length} topics
              </span>
            </div>
            {filteredTopicRows.length === 0 ? (
              <EmptyState title="No topics match" description="Try a different unit." />
            ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Topic</th>
                  <th>Attempted</th>
                  <th>Correct</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {filteredTopicRows.map((r) => {
                  const pct = r.attempted ? Math.round((r.correct / r.attempted) * 100) : 0;
                  return (
                    <tr key={`${r.unit}::${r.topic}`}>
                      <td>{r.unit}</td>
                      <td>{r.topic}</td>
                      <td>{r.attempted}</td>
                      <td>{r.correct}</td>
                      <td>
                        <Badge tone={pct >= 70 ? 'success' : pct >= 40 ? 'warning' : 'danger'}>{pct}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
      </Card>

      <Card>
        <div className="card-title">
          <div>
            <h2>Students</h2>
            <p>Ranked by their most recent attempt.</p>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No attempts yet" description="Nobody eligible for this course has attempted it yet." />
        ) : (
          <>
            <div className="filter-bar" style={{ padding: '0 0 14px' }}>
              <input type="text" placeholder="Search by name or email" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} />
              <span className="filter-count">
                {filteredRows.length} of {rows.length}
              </span>
            </div>
            {filteredRows.length === 0 ? (
              <EmptyState title="No students match" description="Try a different search." />
            ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Attempts</th>
                  <th>Best</th>
                  <th>Latest</th>
                  <th>Last attempt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.student.id}>
                    <td>
                      <b>{r.student.name}</b>
                      <br />
                      <small>{r.student.email}</small>
                    </td>
                    <td>{r.attempts.length}</td>
                    <td>{r.best}%</td>
                    <td>
                      <Badge tone={r.latest >= 70 ? 'success' : r.latest >= 40 ? 'warning' : 'danger'}>{r.latest}%</Badge>
                    </td>
                    <td>{new Date(r.lastAttempt.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div className="table-actions">
                        <Link href={`/coaching/courses/${course.id}/results/${r.lastAttempt.id}`} className="text-link">
                          View last attempt
                        </Link>
                        <button data-testid={`button-issue-certificate-${r.student.id}`} className="text-link" onClick={() => openCertify(r.student)}>
                          <Award size={13} /> Issue certificate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            )}
          </>
        )}
        {notStarted.length > 0 && (
          <div className="activity-list" style={{ marginTop: 18 }}>
            <p className="bank-count">Not started yet</p>
            {notStarted.map((s) => (
              <div className="activity" key={s.id}>
                <span className="activity-dot" />
                <div>
                  <b>{s.name}</b>
                  <small>{s.email}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {certifying && (
        <Modal title="Issue certificate" onClose={() => setCertifying(null)}>
          <p className="modal-copy">
            Issuing a branded certificate to <b>{certifying.name}</b> for <b>{course.name}</b>. This carries your coaching's current branding, snapshotted at
            the moment you issue it — a later rebrand won't change it.
          </p>
          <Field label="Note (optional)" htmlFor="cert-note">
            <textarea id="cert-note" className="form-input" value={certNote} onChange={(e) => setCertNote(e.target.value)} placeholder="e.g. Top scorer of the batch" data-testid="input-certificate-note" />
          </Field>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setCertifying(null)}>
              Cancel
            </Button>
            <Button onClick={issueCertificate} disabled={issuing} data-testid="button-confirm-issue-certificate">
              <Award size={14} /> {issuing ? 'Issuing…' : 'Issue certificate'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
