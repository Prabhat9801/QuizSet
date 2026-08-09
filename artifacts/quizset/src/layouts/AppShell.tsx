import { Link, useLocation } from 'wouter';
import { Bell, BookOpen, Building2, ChevronDown, CircleHelp, CreditCard, Gauge, GraduationCap, Menu, Palette, Play, Settings, Sparkles, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';

// Nav is intentionally scoped to what's actually built. Removed vs the
// original: global search (Ctrl+K — cut from scope), the platform-owner
// tenant switcher (real tenant isolation now comes only from the logged-in
// user, never a manually switchable value — see AppContext), Analytics /
// AI Usage / Leaderboard / Study plan / Performance / Support (all cut from
// this pass — see CLAUDE.md's "Known gaps" section for the reasoning).
const platformNav = [
  ['/platform/dashboard', 'Dashboard', Gauge],
  ['/platform/coachings', 'Coachings', Building2],
  ['/platform/question-requests', 'Question Requests', BookOpen],
  ['/platform/question-banks', 'Question Banks', BookOpen],
  ['/platform/exams', 'Exams', GraduationCap],
  ['/platform/payments', 'Payments', CreditCard],
  ['/platform/notifications', 'Notifications', Bell],
  ['/platform/settings', 'Settings', Settings],
] as const;

const coachingNav = [
  ['/coaching/dashboard', 'Dashboard', Gauge],
  ['/coaching/exams', 'Exams', GraduationCap],
  ['/coaching/live-tests', 'Live Tests', Play],
  ['/coaching/students', 'Students', Users],
  ['/coaching/question-banks', 'Question Banks', BookOpen],
  ['/coaching/payments', 'Payments', CreditCard],
  ['/coaching/ai', 'AI Assistant', Sparkles],
  ['/coaching/notifications', 'Notifications', Bell],
  ['/coaching/branding', 'Branding', Palette],
  ['/coaching/settings', 'Settings', Settings],
] as const;

const studentNav = [
  ['/student/dashboard', 'Overview', Gauge],
  ['/student/exams', 'Exam library', BookOpen],
  ['/student/live-tests', 'Live Tests', Play],
  ['/student/results', 'Results', GraduationCap],
  ['/student/ai', 'Study companion', Sparkles],
  ['/student/notifications', 'Notifications', Bell],
  ['/student/profile', 'Profile', Settings],
] as const;

export function AppShell({ children }: { children: any }) {
  const { user, tenant, logout } = useApp();
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const isStudent = user?.role === 'student';
  const nav = user?.role === 'platform' ? platformNav : user?.role === 'coaching' ? coachingNav : studentNav;
  const navItems = useMemo(() => nav, [nav]);
  const title = user?.role === 'platform' ? 'Platform command center' : user?.role === 'coaching' ? tenant.name : `${user?.name?.split(' ')[0] || 'Your'}'s learning space`;

  return (
    <div className={`app-shell ${isStudent ? 'student-shell' : ''}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">Q</span>
          <span>QuizSet</span>
          <button className="mobile-close icon-btn" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-dot" style={{ background: user?.role === 'coaching' ? tenant.primaryColor : '#22d3ee' }} />
          <span>{title}</span>
        </div>
        <nav>
          {navItems.map(([href, label, Icon]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={loc === href || loc.startsWith(href + '/') ? 'active' : ''}>
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={16} />
            <span>
              <strong>Build with signal.</strong>
              <small>Insights are ready for review.</small>
            </span>
          </div>
          <button className="logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu icon-btn" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="topbar-title">{title}</span>
          <div className="top-actions">
            <button className="icon-btn">
              <CircleHelp size={18} />
            </button>
            <Link href={user?.role === 'platform' ? '/platform/notifications' : user?.role === 'coaching' ? '/coaching/notifications' : '/student/notifications'} className="icon-btn notification">
              <Bell size={18} />
            </Link>
            <button className="profile-trigger" onClick={() => setProfile(!profile)}>
              <span className="avatar">{user?.name?.split(' ').map((s) => s[0]).join('').slice(0, 2)}</span>
              <span className="profile-name">{user?.name}</span>
              <ChevronDown size={14} />
            </button>
            {profile && (
              <div className="profile-menu">
                <Link href={user?.role === 'platform' ? '/platform/settings' : user?.role === 'coaching' ? '/coaching/settings' : '/student/profile'}>Profile &amp; settings</Link>
                <button onClick={logout}>Sign out</button>
              </div>
            )}
          </div>
        </header>
        <div className="content page-enter">{children}</div>
      </main>

      {isStudent && (
        <nav className="bottom-nav">
          {navItems.slice(0, 5).map(([href, label, Icon]) => (
            <Link key={href} href={href} className={loc === href || loc.startsWith(href + '/') ? 'active' : ''}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
