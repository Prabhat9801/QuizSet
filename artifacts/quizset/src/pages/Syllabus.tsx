import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarClock, Play } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { courseService, questionService, studyPlanService } from '@/services/api';
import { Course, StudyPlan, StudyPlanItemStatus } from '@/types';

const STATUS_TONE: Record<StudyPlanItemStatus, 'neutral' | 'warning' | 'danger'> = {
  Upcoming: 'neutral',
  'Due now': 'warning',
  Overdue: 'danger',
};

/**
 * Shared Unit -> Topics syllabus view for both roles, matching this
 * codebase's existing shared-page pattern (Courses.tsx / QuestionBanks.tsx
 * take a `scope` prop rather than forking into two near-identical pages).
 * `scope="coaching"` is reached from CourseEdit.tsx; `scope="student"` from
 * StudentCourseLibrary.tsx's CourseDetail. Both read the exact same real
 * unit->topics tree (`questionService.syllabusTree`) and, if the coaching has
 * set one, the same study plan — the student view additionally gets a
 * "Practice this unit" deep link per unit.
 */
export function Syllabus({ scope }: { scope: 'coaching' | 'student' }) {
  const [, params] = useRoute(scope === 'coaching' ? '/coaching/courses/:id/syllabus' : '/student/courses/:id/syllabus');
  const [course, setCourse] = useState<Course | null>(null);
  const [tree, setTree] = useState<{ unit: string; topics: string[] }[] | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    courseService.get(params.id).then(async (c) => {
      if (!c) return;
      setCourse(c);
      const [t, p] = await Promise.all([questionService.syllabusTree(c.id), studyPlanService.get(c.id)]);
      setTree(t);
      setPlan(p);
    });
  }, [params?.id]);

  if (!course || !tree) return <Skeleton className="skeleton-page" />;

  const backHref = scope === 'coaching' ? `/coaching/courses/${course.id}` : `/student/courses/${course.id}`;
  const planItemForUnit = (unit: string) => plan?.items.find((i) => i.unit === unit);

  return (
    <>
      <PageHeader
        eyebrow="Syllabus"
        title={course.name}
        description="Every unit and topic in this course's question bank."
        action={
          <Link href={backHref} className="btn btn-ghost">
            <ArrowLeft size={14} /> Back
          </Link>
        }
      />

      {scope === 'coaching' && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Study plan</h2>
              <p>{plan ? 'Target dates for this course are set below.' : 'No study plan set yet for this course.'}</p>
            </div>
            <Link href={`/coaching/courses/${course.id}#study-plan`} className="btn btn-secondary">
              <CalendarClock size={14} /> {plan ? 'Edit study plan' : 'Set a study plan'}
            </Link>
          </div>
        </Card>
      )}

      {tree.length === 0 ? (
        <Card>
          <EmptyState title="No syllabus yet" description="This course's question bank has no questions with units/topics yet." />
        </Card>
      ) : (
        <div className="syllabus-list">
          {tree.map((u) => {
            const item = planItemForUnit(u.unit);
            const status = item ? studyPlanService.statusOf(item.targetDate) : null;
            return (
              <Card key={u.unit} className="syllabus-unit-card">
                <div className="card-title">
                  <div>
                    <h2>
                      <BookOpen size={16} /> {u.unit}
                    </h2>
                    <p>
                      {u.topics.length} topic{u.topics.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="syllabus-unit-meta">
                    {item && (
                      <Badge tone={STATUS_TONE[status!]}>
                        {status} · {new Date(`${item.targetDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Badge>
                    )}
                    {scope === 'student' && (
                      <Link href={`/student/courses/${course.id}/setup?mode=unit&unit=${encodeURIComponent(u.unit)}`} className="btn btn-secondary btn-sm">
                        <Play size={13} /> Practice this unit
                      </Link>
                    )}
                  </div>
                </div>
                <div className="chip-grid">
                  {u.topics.map((t) => (
                    <span className="chip" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
