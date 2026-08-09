import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Redirect, Router as WouterRouter } from 'wouter';
import { AppProvider, roleHome, useApp } from '@/contexts/AppContext';
import { AppShell } from '@/layouts/AppShell';
import { Landing, Login, Signup } from '@/pages/Public';
import { PlatformDashboard, CoachingDashboard, StudentDashboard } from '@/pages/Dashboards';
import { Coachings } from '@/pages/Coachings';
import { QuestionRequests } from '@/pages/QuestionRequests';
import { QuestionBanks } from '@/pages/QuestionBanks';
import { QuestionBankDetail } from '@/pages/QuestionBankDetail';
import { ExamsPage } from '@/pages/Exams';
import { ExamEdit } from '@/pages/ExamEdit';
import { CreateExam } from '@/pages/ExamCreate';
import { StudentsPage } from '@/pages/Students';
import { StudentExams, ExamDetail, Preview } from '@/pages/StudentExamLibrary';
import { QuizSetup } from '@/pages/QuizSetup';
import { Attempt } from '@/pages/Attempt';
import { ResultsHistory, ResultReview, CoachingAttemptReview } from '@/pages/Results';
import { ExamStudentDashboard } from '@/pages/ExamStudentDashboard';
import { LiveTests } from '@/pages/LiveTests';
import { StudentLiveTests, LiveTestAttempt } from '@/pages/StudentLiveTests';
import { NotificationsPage } from '@/pages/Notifications';
import { StudentAI, ChatbotSettings } from '@/pages/AI';
import { PaymentsPage } from '@/pages/Payments';
import { Branding } from '@/pages/Branding';
import { JoinFlow } from '@/pages/JoinFlow';
import { GenericPage } from '@/pages/GenericPage';

const queryClient = new QueryClient();

function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, hasTenant } = useApp();
  const [location] = useLocation();
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to={roleHome(user.role)} />;
  // A student who hasn't joined a coaching yet can only see the join gate —
  // every tenant-scoped page assumes a real tenantId is present.
  if (user.role === 'student' && !hasTenant && location !== '/student/join') return <Redirect to="/student/join" />;
  return <AppShell>{children}</AppShell>;
}

function AppRoute({ component: Component, roles }: { component: any; roles?: string[] }) {
  return (
    <Protected roles={roles}>
      <Component />
    </Protected>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />

        {/* -------------------------------------------------------------- platform */}
        <Route path="/platform/dashboard">{() => <AppRoute component={PlatformDashboard} roles={['platform']} />}</Route>
        <Route path="/platform/coachings">{() => <AppRoute component={Coachings} roles={['platform']} />}</Route>
        <Route path="/platform/question-requests">{() => <AppRoute component={QuestionRequests} roles={['platform']} />}</Route>
        <Route path="/platform/question-banks/:id">{() => <AppRoute component={() => <QuestionBankDetail scope="platform" />} roles={['platform']} />}</Route>
        <Route path="/platform/question-banks">{() => <AppRoute component={() => <QuestionBanks scope="platform" />} roles={['platform']} />}</Route>
        <Route path="/platform/exams">{() => <AppRoute component={() => <ExamsPage scope="platform" />} roles={['platform']} />}</Route>
        <Route path="/platform/payments">{() => <AppRoute component={() => <PaymentsPage scope="platform" />} roles={['platform']} />}</Route>
        <Route path="/platform/notifications">{() => <AppRoute component={NotificationsPage} roles={['platform']} />}</Route>
        <Route path="/platform/settings">{() => <AppRoute component={() => <GenericPage title="Platform settings" />} roles={['platform']} />}</Route>

        {/* -------------------------------------------------------------- coaching */}
        <Route path="/coaching/dashboard">{() => <AppRoute component={CoachingDashboard} roles={['coaching']} />}</Route>
        <Route path="/coaching/exams/create">{() => <AppRoute component={CreateExam} roles={['coaching']} />}</Route>
        <Route path="/coaching/exams/:id/students">{() => <AppRoute component={ExamStudentDashboard} roles={['coaching']} />}</Route>
        <Route path="/coaching/exams/:examId/results/:id">{() => <AppRoute component={CoachingAttemptReview} roles={['coaching']} />}</Route>
        <Route path="/coaching/exams/:id">{() => <AppRoute component={ExamEdit} roles={['coaching']} />}</Route>
        <Route path="/coaching/exams">{() => <AppRoute component={() => <ExamsPage scope="coaching" />} roles={['coaching']} />}</Route>
        <Route path="/coaching/live-tests">{() => <AppRoute component={LiveTests} roles={['coaching']} />}</Route>
        <Route path="/coaching/students">{() => <AppRoute component={StudentsPage} roles={['coaching']} />}</Route>
        <Route path="/coaching/question-banks/:id">{() => <AppRoute component={() => <QuestionBankDetail scope="coaching" />} roles={['coaching']} />}</Route>
        <Route path="/coaching/question-banks">{() => <AppRoute component={() => <QuestionBanks scope="coaching" />} roles={['coaching']} />}</Route>
        <Route path="/coaching/payments">{() => <AppRoute component={() => <PaymentsPage scope="coaching" />} roles={['coaching']} />}</Route>
        <Route path="/coaching/ai">{() => <AppRoute component={ChatbotSettings} roles={['coaching']} />}</Route>
        <Route path="/coaching/notifications">{() => <AppRoute component={NotificationsPage} roles={['coaching']} />}</Route>
        <Route path="/coaching/branding">{() => <AppRoute component={Branding} roles={['coaching']} />}</Route>
        <Route path="/coaching/settings">{() => <AppRoute component={() => <GenericPage title="Coaching settings" />} roles={['coaching']} />}</Route>

        {/* --------------------------------------------------------------- student */}
        <Route path="/student/join">{() => <AppRoute component={JoinFlow} roles={['student']} />}</Route>
        <Route path="/student/dashboard">{() => <AppRoute component={StudentDashboard} roles={['student']} />}</Route>
        <Route path="/student/exams/:id/preview">{() => <AppRoute component={Preview} roles={['student']} />}</Route>
        <Route path="/student/exams/:id/setup">{() => <AppRoute component={QuizSetup} roles={['student']} />}</Route>
        <Route path="/student/exams/:id/attempt">{() => <AppRoute component={Attempt} roles={['student']} />}</Route>
        <Route path="/student/exams/:id">{() => <AppRoute component={ExamDetail} roles={['student']} />}</Route>
        <Route path="/student/exams">{() => <AppRoute component={StudentExams} roles={['student']} />}</Route>
        <Route path="/student/live-tests/:id/attempt">{() => <AppRoute component={LiveTestAttempt} roles={['student']} />}</Route>
        <Route path="/student/live-tests">{() => <AppRoute component={StudentLiveTests} roles={['student']} />}</Route>
        <Route path="/student/results/:id">{() => <AppRoute component={ResultReview} roles={['student']} />}</Route>
        <Route path="/student/results">{() => <AppRoute component={ResultsHistory} roles={['student']} />}</Route>
        <Route path="/student/ai">{() => <AppRoute component={StudentAI} roles={['student']} />}</Route>
        <Route path="/student/notifications">{() => <AppRoute component={NotificationsPage} roles={['student']} />}</Route>
        <Route path="/student/profile">{() => <AppRoute component={() => <GenericPage title="Profile" />} roles={['student']} />}</Route>

        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppProvider>
            <Router />
          </AppProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
