import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, FileText, IndianRupee, Mail, Phone, Play, Plus, Sparkles, Users } from 'lucide-react';
import { Link } from 'wouter';
import { Card, PageHeader, Stat, Badge, Button } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { courseService, CourseWithCount, liveTestService, paymentService, questionBankRequestService, studentService, tenantService } from '@/services/api';
import { formatRupees } from '@/lib/format';

export function PlatformDashboard() {
  const [coachingCount, setCoachingCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    tenantService.list().then(async (tenants) => {
      setCoachingCount(tenants.length);
      // tenant.students is a static seed number that never moves as students
      // actually join — sum the real per-tenant lists instead.
      const counts = await Promise.all(tenants.map((t) => studentService.list(t.id)));
      setStudentCount(counts.reduce((sum, list) => sum + list.length, 0));
    });
    paymentService.list().then((all) => setRevenue(all.filter((t) => t.status === 'Success').reduce((sum, t) => sum + t.amount, 0)));
    questionBankRequestService.list().then((all) => setPendingRequests(all.filter((r) => r.status !== 'Finalized').length));
  }, []);

  return (
    <>
      <PageHeader eyebrow="Platform overview" title="Platform Overview" description="Here's the signal from across your coaching network." />
      <div className="stats-grid stagger">
        <Stat icon={<Users />} label="Coachings on the network" value={String(coachingCount)} />
        <Stat icon={<Users />} label="Total students" value={studentCount.toLocaleString('en-IN')} />
        <Stat icon={<IndianRupee size={16} />} label="Total collected" value={formatRupees(revenue)} />
        <Stat icon={<BookOpen />} label="Requests in the pipeline" value={String(pendingRequests)} />
      </div>
      <Card>
        <div className="card-title">
          <div>
            <h2>Where to look next</h2>
            <p>The two things platform owners do most</p>
          </div>
        </div>
        <div className="quick-actions">
          <Link href="/platform/question-requests">
            <BookOpen size={17} />
            <span>
              <b>Question requests</b>
              <small>{pendingRequests} waiting on you</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/platform/coachings">
            <Users size={17} />
            <span>
              <b>Coachings</b>
              <small>Manage every tenant on the network</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </Card>
    </>
  );
}

export function CoachingDashboard() {
  const { tenant, tenantId } = useApp();
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [pendingJoinCount, setPendingJoinCount] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    courseService.listWithCounts(tenantId).then(setCourses);
    studentService.list(tenantId).then((s) => setStudentCount(s.length));
    paymentService.list(tenantId).then((all) => setRevenue(all.filter((t) => t.status === 'Success').reduce((sum, t) => sum + t.amount, 0)));
    liveTestService.list(tenantId).then((tests) => setPendingJoinCount(tests.filter((t) => liveTestService.phase(t) === 'Upcoming').length));
  }, [tenantId]);

  const published = courses.filter((c) => c.status === 'Published').length;

  return (
    <>
      <PageHeader eyebrow={`${tenant.name} workspace`} title={`Good morning, ${tenant.owner || tenant.name}`} description="Your academy's courses, students and revenue at a glance." action={<Link href="/coaching/courses/create" className="btn btn-primary"><Plus size={15} /> Create course</Link>} />
      <div className="stats-grid stagger">
        <Stat icon={<IndianRupee size={16} />} label="Revenue" value={formatRupees(revenue)} />
        <Stat icon={<Users />} label="Students" value={String(studentCount)} />
        <Stat icon={<BookOpen />} label="Published courses" value={String(published)} />
        <Stat icon={<Play />} label="Upcoming live tests" value={String(pendingJoinCount)} />
      </div>
      <Card>
        <div className="card-title">
          <div>
            <h2>Quick actions</h2>
            <p>Move the work forward</p>
          </div>
        </div>
        <div className="quick-actions">
          <Link href="/coaching/courses/create">
            <Plus size={17} />
            <span>
              <b>Create course</b>
              <small>Configure a new course</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/coaching/live-tests">
            <Play size={17} />
            <span>
              <b>Schedule live test</b>
              <small>Bring your learners together</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/coaching/students">
            <Users size={17} />
            <span>
              <b>View students</b>
              <small>Review requests and progress</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
          <Link href="/coaching/question-banks">
            <BookOpen size={17} />
            <span>
              <b>Request question bank</b>
              <small>Give your next course a head start</small>
            </span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </Card>
    </>
  );
}

export function StudentDashboard() {
  const { user, tenant, tenantId } = useApp();
  const [courses, setCourses] = useState<CourseWithCount[]>([]);

  useEffect(() => {
    if (tenantId) courseService.listWithCounts(tenantId).then((all) => setCourses(all.filter((c) => c.status === 'Published').slice(0, 3)));
  }, [tenantId]);

  return (
    <>
      <div className="hero-student">
        <div className="student-hero-grid">
          <div>
            <div className="eyebrow" style={{ color: '#9cf2f8' }}>
              YOUR LEARNING SPACE
            </div>
            <h1>Good morning, {user?.name?.split(' ')[0] || 'there'}.</h1>
            <p>Small, focused sessions add up. Keep your rhythm today.</p>
            <div className="student-hero-actions">
              <Link href="/student/courses" className="btn btn-secondary">
                Continue learning <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="student-columns">
        <div className="student-main">
          <div className="card-title">
            <div>
              <h2>Available courses</h2>
              <p>Chosen by {tenant.name} for your path</p>
            </div>
            <Link href="/student/courses" className="text-link">
              View library <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="exam-grid">
            {courses.map((c) => (
              <Card className="exam-card" key={c.id}>
                <div className="exam-accent" />
                <Badge tone="info">{c.sale ? 'AVAILABLE' : 'FREE'}</Badge>
                <h3>{c.name}</h3>
                <p>
                  {tenant.name} · {c.subject}
                </p>
                <div className="exam-meta">
                  <span>
                    <FileText size={12} />
                    {c.questionCount} questions
                  </span>
                </div>
                <div className="price">
                  <strong>{c.sale ? formatRupees(c.sale) : 'Free'}</strong>
                </div>
                <Link href={`/student/courses/${c.id}`} className="btn btn-ghost" style={{ width: '100%' }}>
                  View course <ArrowUpRight size={14} />
                </Link>
              </Card>
            ))}
          </div>
        </div>
        <div className="student-side">
          <Card>
            <div className="card-title">
              <div>
                <h2>AI study companion</h2>
                <p>Ask about a weak topic or a shortcut</p>
              </div>
              <Sparkles size={17} color="hsl(var(--primary))" />
            </div>
            <div className="ai-box">
              <b>Not sure where to start?</b>
              <p>Ask the AI assistant for a shortcut on your weakest topic, or what to practise today.</p>
              <Link href="/student/ai" className="text-link">
                Ask the study companion <ArrowUpRight size={13} />
              </Link>
            </div>
          </Card>
          <div className="section-spacer" />
          <Card>
            <div className="card-title">
              <div>
                <h2>Live tests</h2>
                <p>See what's scheduled</p>
              </div>
            </div>
            <Link href="/student/live-tests" className="text-link">
              View live tests <ArrowUpRight size={13} />
            </Link>
          </Card>
          {(tenant.supportEmail || tenant.supportPhone) && (
            <>
              <div className="section-spacer" />
              <Card>
                <div className="card-title">
                  <div>
                    <h2>Need help?</h2>
                    <p>Reach {tenant.name} directly</p>
                  </div>
                </div>
                {tenant.supportEmail && (
                  <p className="text-link" style={{ pointerEvents: 'none' }}>
                    <Mail size={13} /> {tenant.supportEmail}
                  </p>
                )}
                {tenant.supportPhone && (
                  <p className="text-link" style={{ pointerEvents: 'none' }}>
                    <Phone size={13} /> {tenant.supportPhone}
                  </p>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
