import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Redirect, Router as WouterRouter } from 'wouter';
import { AppProvider, roleHome, useApp } from '@/contexts/AppContext';
import { AppShell } from '@/layouts/AppShell';
import { Landing, Login } from '@/pages/Public';
import { PlatformDashboard, CoachingDashboard, StudentDashboard } from '@/pages/Dashboards';
import { AIPage, Attempt, Branding, Coachings, CreateExam, ExamsPage, ExamDetail, GenericPage, Notifications, Preview, QuestionsPage, StudentsPage, StudentExams, StudyPlan, Support } from '@/pages/Workspace';

const queryClient = new QueryClient();

function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user } = useApp();
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to={roleHome(user.role)} />;
  return <AppShell>{children}</AppShell>;
}
function AppRoute({ component: Component, roles }: { component: any; roles?: string[] }) {
  return <Protected roles={roles}><Component /></Protected>;
}
function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={Landing} />
    <Route path="/login" component={Login} />
    <Route path="/platform/dashboard">{()=><AppRoute component={PlatformDashboard} roles={['platform']}/>}</Route>
    <Route path="/platform/coachings">{()=><AppRoute component={Coachings} roles={['platform']}/>}</Route>
    <Route path="/platform/question-requests">{()=><AppRoute component={()=><GenericPage title="Question requests" description="Review, accept and move every question request through its production stages." icon={BookIcon}/>} roles={['platform']}/>}</Route>
    <Route path="/platform/question-banks">{()=><AppRoute component={()=><QuestionsPage/>} roles={['platform']}/>}</Route>
    <Route path="/platform/exams">{()=><AppRoute component={()=><ExamsPage scope="platform"/>} roles={['platform']}/>}</Route>
    <Route path="/platform/students">{()=><AppRoute component={StudentsPage} roles={['platform']}/>}</Route>
    <Route path="/platform/payments">{()=><AppRoute component={()=><GenericPage title="Payments" description="Understand platform collections, plan health and transaction movement." icon={CreditIcon}/>} roles={['platform']}/>}</Route>
    <Route path="/platform/analytics">{()=><AppRoute component={()=><GenericPage title="Analytics" description="Business and product signals across the QuizSet network." icon={ChartIcon}/>} roles={['platform']}/>}</Route>
    <Route path="/platform/ai-usage">{()=><AppRoute component={()=><GenericPage title="AI usage" description="Keep intelligent assistance useful, measurable and responsible." icon={SparkIcon}/>} roles={['platform']}/>}</Route>
    <Route path="/platform/support">{()=><AppRoute component={Support} roles={['platform']}/>}</Route>
    <Route path="/platform/notifications">{()=><AppRoute component={Notifications} roles={['platform']}/>}</Route>
    <Route path="/platform/settings">{()=><AppRoute component={()=><GenericPage title="Platform settings" description="Your platform defaults, access controls and operating preferences." icon={SettingsIcon}/>} roles={['platform']}/>}</Route>

    <Route path="/coaching/dashboard">{()=><AppRoute component={CoachingDashboard} roles={['coaching']}/>}</Route>
    <Route path="/coaching/exams/create">{()=><AppRoute component={CreateExam} roles={['coaching']}/>}</Route>
    <Route path="/coaching/exams">{()=><AppRoute component={ExamsPage} roles={['coaching']}/>}</Route>
    <Route path="/coaching/live-tests">{()=><AppRoute component={()=><GenericPage title="Live tests" description="Bring your learners into a shared moment with scheduled assessments." icon={LiveIcon}/>} roles={['coaching']}/>}</Route>
    <Route path="/coaching/students">{()=><AppRoute component={StudentsPage} roles={['coaching']}/>}</Route>
    <Route path="/coaching/question-banks">{()=><AppRoute component={QuestionsPage} roles={['coaching']}/>}</Route>
    <Route path="/coaching/payments">{()=><AppRoute component={()=><GenericPage title="Payments" description="Track exam sales and the cash flow behind your learner business." icon={CreditIcon}/>} roles={['coaching']}/>}</Route>
    <Route path="/coaching/analytics">{()=><AppRoute component={()=><GenericPage title="Analytics" description="See where learners improve and where your content can work harder." icon={ChartIcon}/>} roles={['coaching']}/>}</Route>
    <Route path="/coaching/ai">{()=><AppRoute component={AIPage} roles={['coaching']}/>}</Route>
    <Route path="/coaching/notifications">{()=><AppRoute component={Notifications} roles={['coaching']}/>}</Route>
    <Route path="/coaching/support">{()=><AppRoute component={Support} roles={['coaching']}/>}</Route>
    <Route path="/coaching/branding">{()=><AppRoute component={Branding} roles={['coaching']}/>}</Route>
    <Route path="/coaching/settings">{()=><AppRoute component={()=><GenericPage title="Coaching settings" description="Keep your institute’s operations aligned and intentional." icon={SettingsIcon}/>} roles={['coaching']}/>}</Route>

    <Route path="/student/dashboard">{()=><AppRoute component={StudentDashboard} roles={['student']}/>}</Route>
    <Route path="/student/exams/:id/preview">{()=><AppRoute component={Preview} roles={['student']}/>}</Route>
    <Route path="/student/exams/:id/attempt">{()=><AppRoute component={Attempt} roles={['student']}/>}</Route>
    <Route path="/student/exams/:id">{()=><AppRoute component={ExamDetail} roles={['student']}/>}</Route>
    <Route path="/student/exams">{()=><AppRoute component={StudentExams} roles={['student']}/>}</Route>
    <Route path="/student/results">{()=><AppRoute component={()=><GenericPage title="Results" description="Every attempt is a useful signal for your next one." icon={ResultIcon}/>} roles={['student']}/>}</Route>
    <Route path="/student/leaderboard">{()=><AppRoute component={()=><GenericPage title="Leaderboard" description="A friendly view of momentum across your coaching cohort." icon={UsersIcon}/>} roles={['student']}/>}</Route>
    <Route path="/student/study-plan">{()=><AppRoute component={StudyPlan} roles={['student']}/>}</Route>
    <Route path="/student/ai">{()=><AppRoute component={AIPage} roles={['student']}/>}</Route>
    <Route path="/student/performance">{()=><AppRoute component={()=><GenericPage title="Performance" description="Find the topics that deserve your next focused session." icon={ChartIcon}/>} roles={['student']}/>}</Route>
    <Route path="/student/notifications">{()=><AppRoute component={Notifications} roles={['student']}/>}</Route>
    <Route path="/student/support">{()=><AppRoute component={Support} roles={['student']}/>}</Route>
    <Route path="/student/profile">{()=><AppRoute component={()=><GenericPage title="Profile" description="Your learner identity and preferences." icon={UserIcon}/>} roles={['student']}/>}</Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppProvider><Router/></AppProvider></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>; }
function BookIcon(){return <span>▦</span>} function CreditIcon(){return <span>₹</span>} function ChartIcon(){return <span>↗</span>} function SparkIcon(){return <span>✦</span>} function SettingsIcon(){return <span>⚙</span>} function LiveIcon(){return <span>◉</span>} function ResultIcon(){return <span>▥</span>} function UsersIcon(){return <span>♙</span>} function UserIcon(){return <span>◎</span>}
export default App;