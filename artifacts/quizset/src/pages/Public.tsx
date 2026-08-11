import { Link, useLocation } from 'wouter';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  CreditCard,
  Eye,
  EyeOff,
  Flag,
  GraduationCap,
  Layers,
  ListChecks,
  MessageSquare,
  Puzzle,
  Rows3,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import { Badge, Button, Card, Stat } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { formatRupees } from '@/lib/format';

export function Logo() {
  return (
    <Link href="/" className="landing-brand">
      <span className="brand-mark">Q</span>
      <span>QuizSet</span>
    </Link>
  );
}

const MODE_TILES = [
  { icon: Sparkles, label: 'Full', hint: 'Every question in the bank' },
  { icon: ListChecks, label: 'Topic-wise', hint: 'One or more specific topics' },
  { icon: Rows3, label: 'Unit-wise', hint: 'One whole unit at a time' },
  { icon: Layers, label: 'Multi-unit', hint: 'Combine two or more units' },
  { icon: Puzzle, label: 'Custom', hint: 'Mix specific units and topics' },
];

const FAQS = [
  {
    q: 'Will students see QuizSet’s branding, or ours?',
    a: 'Yours. Your name, logo and colors carry through the whole experience — sign-in, dashboard, practice and results. A small "Powered by QuizSet" credit stays in the footer, nothing more.',
  },
  {
    q: 'Do we need a technical team to run this?',
    a: 'No. Courses, pricing, students and live tests are all managed from your own dashboard — no code to write and no server to maintain.',
  },
  {
    q: 'Who writes the questions, and can we review them?',
    a: 'You share your syllabus and requirements, and our team builds the question bank. We review it ourselves first, then hand it to you for your own review and edits — nothing goes live until you finalize it.',
  },
  {
    q: 'What practice modes does a course include?',
    a: 'Every course ships with five modes — Full, Topic-wise, Unit-wise, Multi-unit and Custom — all untimed, at the student’s own pace, with instant right/wrong feedback and explanations.',
  },
  {
    q: 'Are Live Tests the same as regular practice?',
    a: 'No. Live Tests are separate, scheduled, timed sittings with a question palette, mark-for-review and auto-submit. Regular course practice stays untimed — timing only exists inside a Live Test.',
  },
  {
    q: 'How do students pay for a course?',
    a: 'You set the price per course, with an optional strikethrough MRP and a free-preview question count. Students unlock full access after paying, inside their own branded workspace.',
  },
  {
    q: 'Can we see how our students are performing?',
    a: 'Yes — your dashboard shows course-level attempt and accuracy stats, a topic/unit breakdown of where your class is weak, and lets you drill into any individual student’s attempt.',
  },
];

export function Landing() {
  const [faq, setFaq] = useState<number | null>(0);

  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#platform">Platform</a>
          <a href="#workflow">How it works</a>
          <a href="#students">For Students</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div>
          <Link href="/login" className="landing-login">
            Sign in
          </Link>
          <Link href="/login" className="btn btn-primary">
            See the workspace <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* ---------------------------------------------------------- Hero -- */}
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow">A PLATFORM BUILT FOR COACHING INSTITUTES</div>
          <h1>
            Your coaching deserves a <em>platform</em> of its own.
          </h1>
          <p>Launch a branded course and practice experience that feels unmistakably yours — from the first question to the final result.</p>
          <div className="hero-actions">
            <Link href="/login" className="btn btn-primary">
              Explore QuizSet <ArrowRight size={16} />
            </Link>
            <a href="#workflow" className="text-link">
              See how it works <span>↓</span>
            </a>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars">
              <span>RS</span>
              <span>AV</span>
              <span>NJ</span>
              <span>+8</span>
            </div>
            <div>
              <strong>Built for coaching teams who want their own brand</strong>
              <small>No coding, no servers to manage</small>
            </div>
          </div>
        </div>
        <div className="hero-product">
          <span className="mock-tag">Example workspace · illustrative numbers</span>
          <div className="product-window">
            <div className="product-chrome">
              <span />
              <span />
              <span />
              <b>
                Sunrise Academy <i>workspace</i>
              </b>
              <small>
                Rahul Sharma <span>RS</span>
              </small>
            </div>
            <div className="product-body">
              <aside>
                <div className="mini-logo">SA</div>
                <b>Sunrise Academy</b>
                <small>Owner workspace</small>
                {['Overview', 'Courses', 'Students', 'Live Tests'].map((x, i) => (
                  <div className={i === 0 ? 'mini-nav active' : 'mini-nav'} key={x}>
                    <span className="mini-icon">{['◈', '◫', '♙', '↗'][i]}</span>
                    {x}
                  </div>
                ))}
              </aside>
              <main>
                <div className="mini-welcome">
                  <div>
                    <small>MONDAY, 14 JULY 2025</small>
                    <h3>Good morning, Rajiv</h3>
                    <p>Here's how your workspace is doing.</p>
                  </div>
                  <span className="mini-avatar">RS</span>
                </div>
                <div className="mini-stats">
                  <div>
                    <small>Revenue</small>
                    <strong>{formatRupees(18400)}</strong>
                    <i>This month</i>
                  </div>
                  <div>
                    <small>Students</small>
                    <strong>42</strong>
                    <i>+3 this week</i>
                  </div>
                  <div>
                    <small>Courses</small>
                    <strong>3</strong>
                    <i>1 in review</i>
                  </div>
                </div>
                <div className="mini-chart">
                  <div className="mini-chart-head">
                    <b>Practice activity</b>
                    <small>Last 30 days⌄</small>
                  </div>
                  <div className="chart-line">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </main>
            </div>
          </div>
          <div className="hero-float">
            <Sparkles size={15} />
            <span>
              <strong>Topic breakdown ready</strong>
              <small>See where your class is weak</small>
            </span>
          </div>
        </div>
      </section>

      <section className="logo-strip">
        <span>MADE FOR COACHING TEAMS WHO THINK LONG-TERM</span>
        <b>Sunrise Academy</b>
        <b>career point</b>
        <b>SUCCESS / INSTITUTE</b>
        <b>EXAMVERSE</b>
      </section>

      {/* --------------------------------------------------- How it works -- */}
      <section className="dark-band" id="workflow">
        <div className="section-intro">
          <div className="eyebrow">FROM SYLLABUS TO STUDENTS</div>
          <h2>
            How your course<br />
            <em>actually gets built.</em>
          </h2>
          <p>One connected pipeline — from what you send us to what your students see.</p>
        </div>
        <div>
          <div className="steps">
            <Step n="01" title="You share your syllabus" copy="Send your syllabus, exam pattern and any specific instructions for the course." />
            <Step n="02" title="We build your question bank" copy="Our team drafts the full question bank against your syllabus, unit by unit." />
            <Step n="03" title="Our own review pass" copy="Every question is checked internally for accuracy before you ever see it." />
            <Step n="04" title="You review and edit" copy="Your team reads through the bank inside your own dashboard — edit it, fix it, or ask for changes." />
            <Step n="05" title="You finalize" copy="Nothing goes live until you approve it. Finalizing the bank is your explicit call." />
            <Step n="06" title="It goes live, under your brand" copy="Students see the finished course inside your coaching's own branded workspace." />
          </div>
          <div className="recap-grid">
            <div className="recap-card">
              <b>You give us</b>
              <span>Syllabus, exam pattern, requirements</span>
            </div>
            <div className="recap-card">
              <b>We build</b>
              <span>Question bank, full course, practice system</span>
            </div>
            <div className="recap-card">
              <b>You control</b>
              <span>Review, edits, pricing, publishing</span>
            </div>
          </div>
          <p className="workflow-signature">Your Syllabus → Your Requirements → Our Question Bank → Your Final Approval → Your Branded Student Experience.</p>
        </div>
      </section>

      {/* --------------------------------------------------- White label -- */}
      <section className="landing-section" id="platform">
        <div className="section-intro">
          <div className="eyebrow">YOUR BRAND, NOT OURS</div>
          <h2>
            It looks like<br />
            <em>your platform.</em>
          </h2>
          <p>Your name, your logo, your colors — carried through sign-in, dashboard, practice and results, for every student.</p>
          <Feature icon={<Layers />} num="01" title="Your brand, everywhere" copy="Pick your colors once and every screen — yours and your students' — repaints instantly. No design work needed." />
          <Feature icon={<ShieldCheck />} num="02" title="One subtle credit" copy="A small 'Powered by QuizSet' mark stays in the footer. Nothing about the experience says QuizSet before that." />
        </div>
        <div className="brand-showcase">
          <div>
            <div className="brand-preview-window" style={{ '--brand': '#4f46e5' } as React.CSSProperties}>
              <div className="brand-preview-head">
                <span className="preview-logo">SA</span>
                <b>Sunrise Academy</b>
                <small>Student workspace</small>
              </div>
              <div className="brand-preview-hero">
                <span>GOOD MORNING, RAHUL</span>
                <h2>
                  Prepare with intent.
                  <br />
                  Your next score starts here.
                </h2>
                <button>
                  Continue learning <ArrowRight size={13} />
                </button>
              </div>
            </div>
            <span className="powered-by">
              Powered by <b>QuizSet</b>
            </span>
          </div>
          <div>
            <div className="brand-preview-window" style={{ '--brand': '#0891b2' } as React.CSSProperties}>
              <div className="brand-preview-head">
                <span className="preview-logo">CP</span>
                <b>Career Point</b>
                <small>Student workspace</small>
              </div>
              <div className="brand-preview-hero">
                <span>GOOD MORNING, PRIYA</span>
                <h2>
                  Stay consistent.
                  <br />
                  Small steps, every day.
                </h2>
                <button>
                  Continue learning <ArrowRight size={13} />
                </button>
              </div>
            </div>
            <span className="powered-by">
              Powered by <b>QuizSet</b>
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Question bank -- */}
      <section className="landing-section">
        <div className="section-intro">
          <div className="eyebrow">WE BUILD THE CONTENT</div>
          <h2>
            A real question bank,<br />
            <em>not a blank slate.</em>
          </h2>
          <p>Here's what a finished bank looks like before it ever reaches your students.</p>
        </div>
        <Card>
          <div className="card-title">
            <div>
              <h2>SSC CGL 2026 — General Studies</h2>
              <p>Built from the coaching's own syllabus and exam pattern.</p>
            </div>
            <Badge tone="success">Finalized</Badge>
          </div>
          <div className="chip-grid">
            {['History', 'Geography', 'Polity', 'Economy', 'General Science'].map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
          </div>
          <div className="stats-grid" style={{ marginTop: 18 }}>
            <Stat label="Questions" value="1,240" icon={<BookOpen />} />
            <Stat label="Units" value="6" icon={<Layers />} />
            <Stat label="Topics" value="42" icon={<ListChecks />} />
          </div>
          <div className="card-title">
            <div>
              <h2>Difficulty mix</h2>
            </div>
          </div>
          <div className="chip-grid">
            <Badge tone="success">Easy · 420</Badge>
            <Badge tone="warning">Medium · 560</Badge>
            <Badge tone="danger">Hard · 260</Badge>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------ Course + practice modes */}
      <section className="landing-section" id="pricing">
        <div className="section-intro">
          <div className="eyebrow">ONE COURSE, EVERYTHING INCLUDED</div>
          <h2>
            Price it your way.<br />
            <em>Practice comes built in.</em>
          </h2>
          <p>Every course you publish carries its own price and its own complete practice system — automatically, every time.</p>
        </div>
        <Price
          name="SSC CGL 2026 — Tier I"
          price={formatRupees(499)}
          period="one-time access"
          copy="An example of how one coaching priced their flagship course."
          points={[`MRP ${formatRupees(999)} — 50% off`, 'Free preview: 5 questions before buying', 'Every unit and topic included']}
          cta="See a course like this"
          extra={
            <div className="mode-grid" style={{ marginTop: 6, marginBottom: 18 }}>
              {MODE_TILES.map(({ icon: Icon, label, hint }, i) => (
                <div className={`mode-tile ${i === 0 ? 'selected' : ''}`} key={label}>
                  <Icon size={18} />
                  <b>{label}</b>
                  <small>{hint}</small>
                </div>
              ))}
            </div>
          }
        />
      </section>

      {/* -------------------------------------- Student practice experience */}
      <section className="landing-section" id="students">
        <div className="section-intro">
          <div className="eyebrow">WHAT A STUDENT SEES</div>
          <h2>
            Practice that<br />
            <em>teaches as you go.</em>
          </h2>
          <p>One question, four options, and the answer explained the instant a student picks one — no waiting for a report.</p>
        </div>
        <div className="phone-frame">
          <div className="phone-notch">
            <span />
          </div>
          <div className="phone-screen">
            <div className="question-number">PERCENTAGE · MEDIUM</div>
            <p className="question-text">If 40% of a number is 120, what is the number?</p>
            <div className="question-option correct">
              <span className="option-letter">A</span> 300 <Check size={15} />
            </div>
            <div className="question-option wrong">
              <span className="option-letter">B</span> 280
            </div>
            <div className="question-option">
              <span className="option-letter">C</span> 320
            </div>
            <div className="question-option">
              <span className="option-letter">D</span> 260
            </div>
            <div className="explanation">
              <b>Correct!</b>
              <p>40% of x = 120, so x = 120 ÷ 0.4 = 300.</p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Live tests */}
      <section className="landing-section">
        <div className="section-intro">
          <div className="eyebrow">THE ONE TIMED FEATURE</div>
          <h2>
            Live Tests,<br />
            <em>scheduled and timed.</em>
          </h2>
          <p>Separate from regular course practice — a Live Test opens at a set time, runs on a clock, and locks the moment time is up.</p>
          <Feature icon={<Clock3 />} num="01" title="Scheduled, not always-on" copy="A Live Test has its own opening and closing window — students can only attempt it while it's live." />
          <Feature icon={<Flag />} num="02" title="Mark for review, then submit" copy="A question palette shows what's answered, marked or skipped — with auto-submit the instant time runs out." />
        </div>
        <Card>
          <div className="card-title">
            <div>
              <h2>Weekly Mock Test — Set 4</h2>
              <p>18 of 25 questions answered</p>
            </div>
            <div className="timer">
              <Clock3 size={14} /> 18:42
            </div>
          </div>
          <div className="exam-progress">
            <div style={{ width: '72%' }} />
          </div>
          <div className="palette">
            {Array.from({ length: 25 }, (_, i) => (
              <button key={i} className={i === 18 ? 'current' : i === 20 ? 'review' : i < 18 ? 'answered' : ''}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="palette-legend">
            <span>
              <i className="answered-dot" /> Answered
            </span>
            <span>
              <i className="review-dot" /> Marked for review
            </span>
            <span>
              <i className="empty-dot" /> Not attempted
            </span>
          </div>
        </Card>
      </section>

      {/* -------------------------------------- Results + coaching analytics */}
      <section className="landing-section">
        <div className="section-intro">
          <div className="eyebrow">FROM THE COACHING'S DASHBOARD</div>
          <h2>
            See exactly<br />
            <em>where your class stands.</em>
          </h2>
          <p>Course-level stats, a topic-by-topic breakdown of where the class is weak, and any student's own attempt — all in one dashboard.</p>
        </div>
        <div>
          <div className="stats-grid">
            <Stat label="Attempts" value="186" icon={<BarChart3 />} />
            <Stat label="Average accuracy" value="68%" icon={<CircleCheck />} />
            <Stat label="Students attempted" value="34" icon={<Users />} />
          </div>
          <Card>
            <div className="card-title">
              <div>
                <h2>Topic breakdown</h2>
                <p>Where this class needs more practice.</p>
              </div>
            </div>
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
                  <tr>
                    <td>Quantitative Aptitude</td>
                    <td>Percentage</td>
                    <td>120</td>
                    <td>96</td>
                    <td>
                      <Badge tone="success">80%</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td>Quantitative Aptitude</td>
                    <td>Time &amp; Work</td>
                    <td>98</td>
                    <td>49</td>
                    <td>
                      <Badge tone="danger">50%</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td>Reasoning</td>
                    <td>Blood Relations</td>
                    <td>110</td>
                    <td>72</td>
                    <td>
                      <Badge tone="warning">65%</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <div className="card-title">
              <div>
                <h2>Students</h2>
                <p>Drill into any single attempt.</p>
              </div>
            </div>
            <div className="activity-list">
              {[
                { n: 'Rahul Sharma', s: '82% · 41/50 correct' },
                { n: 'Priya Verma', s: '64% · 32/50 correct' },
                { n: 'Aman Gupta', s: '90% · 45/50 correct' },
              ].map((r) => (
                <div className="activity" key={r.n}>
                  <span className="activity-dot" />
                  <div>
                    <b>{r.n}</b>
                    <small>{r.s}</small>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------- Payments -- */}
      <section className="landing-section">
        <div className="section-intro">
          <div className="eyebrow">MONEY IN</div>
          <h2>
            Get paid for<br />
            <em>what you sell.</em>
          </h2>
          <p>Courses, Live Tests and the AI assistant each collect payment on their own — you set every price.</p>
          <span className="mock-tag">Example figures · illustrative</span>
        </div>
        <Card>
          <div className="stats-grid">
            <Stat label="This month" value={formatRupees(18400)} icon={<CreditCard />} />
            <Stat label="Transactions" value="62" icon={<CreditCard />} />
            <Stat label="Products live" value="3" icon={<CreditCard />} />
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Course access · SSC CGL 2026</td>
                  <td>{formatRupees(499)}</td>
                  <td>
                    <Badge tone="success">Success</Badge>
                  </td>
                </tr>
                <tr>
                  <td>Live test · Weekly Mock Set 4</td>
                  <td>{formatRupees(49)}</td>
                  <td>
                    <Badge tone="success">Success</Badge>
                  </td>
                </tr>
                <tr>
                  <td>AI assistant · Monthly</td>
                  <td>{formatRupees(99)}</td>
                  <td>
                    <Badge tone="success">Success</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ---------------------------------------------- AI study assistant -- */}
      <section className="landing-section">
        <div className="section-intro">
          <div className="eyebrow">A STUDY COMPANION, ON YOUR TERMS</div>
          <h2>
            An AI assistant<br />
            <em>you switch on.</em>
          </h2>
          <p>Turn it on for your students, set the monthly price and the number of free messages — you control all three.</p>
          <div className="stats-grid">
            <Stat label="Status" value="On" icon={<MessageSquare />} />
            <Stat label="Price" value={`${formatRupees(49)}/mo`} icon={<CreditCard />} />
            <Stat label="Free messages" value="5" icon={<Sparkles />} />
          </div>
        </div>
        <Card className="chat-card" style={{ minHeight: 'auto' }}>
          <div className="chat-head">
            <div className="ai-avatar">
              <Sparkles size={17} />
            </div>
            <div>
              <b>QuizSet companion</b>
              <small>Focused on your progress</small>
            </div>
            <Badge tone="success">Online</Badge>
          </div>
          <div className="messages">
            <div className="message ai">
              <span>Hi! Ask me about a weak topic, your plan, or an exam strategy.</span>
            </div>
            <div className="message user">
              <span>Give me a shortcut for Percentage</span>
            </div>
            <div className="message ai">
              <span>Sure — to find x% of a number, multiply by x and divide by 100. For 40% of 300: 300 × 0.4 = 120.</span>
            </div>
          </div>
        </Card>
      </section>

      {/* ---------------------------------------------------- Coming soon -- */}
      <section className="landing-section">
        <div className="section-intro">
          <div className="eyebrow">WHAT'S NEXT</div>
          <h2>
            A couple of things<br />
            <em>on the way.</em>
          </h2>
          <p>Not part of the platform yet — flagged here so you know what's coming, not what's live today.</p>
        </div>
        <div className="soon-grid">
          <div className="soon-card">
            <b>
              <GraduationCap size={15} /> Branded certificates <Badge tone="neutral">Coming soon</Badge>
            </b>
            <p>A certificate your coaching issues and signs off on, carrying a small "Powered by QuizSet" credit.</p>
          </div>
          <div className="soon-card">
            <b>
              <Star size={15} /> Student testimonials <Badge tone="neutral">Coming soon</Badge>
            </b>
            <p>Student feedback your coaching approves before it goes public on your own pages.</p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- FAQ -- */}
      <section className="faq-section" id="faq">
        <div className="section-intro">
          <div className="eyebrow">QUESTIONS, ANSWERED</div>
          <h2>
            Clarity before<br />
            <em>you commit.</em>
          </h2>
        </div>
        <div className="faqs">
          {FAQS.map((item, i) => (
            <div className={`faq ${faq === i ? 'open' : ''}`} key={item.q}>
              <button onClick={() => setFaq(faq === i ? null : i)}>
                <span>{item.q}</span>
                <ChevronDown size={17} />
              </button>
              {faq === i && <p>{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------- Final CTA + footer -- */}
      <section className="final-cta">
        <h2>Ready to launch your own platform?</h2>
        <p>Send us your syllabus and see what your branded course looks like — no commitment to start.</p>
        <div className="hero-actions">
          <Link href="/login" className="btn btn-primary">
            Explore QuizSet <ArrowRight size={16} />
          </Link>
          <a href="#faq" className="text-link" style={{ color: '#fff' }}>
            Read the FAQ <span>↓</span>
          </a>
        </div>
      </section>
      <footer>
        <Logo />
        <span>Your Coaching. Your Brand. Your Course Platform.</span>
        <small>© 2025 QuizSet. Built for ambitious coaching institutes.</small>
      </footer>
    </div>
  );
}

function Feature({ icon, num, title, copy }: { icon: ReactNode; num: string; title: string; copy: string }) {
  return (
    <div className="feature">
      <div className="feature-top">
        <span>{num}</span>
        <span className="feature-icon">{icon}</span>
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function Step({ n, title, copy }: { n: string; title: string; copy: string }) {
  return (
    <div className="step">
      <span>{n}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  );
}

function Price({
  name,
  price,
  period = '/ month',
  copy,
  points,
  cta,
  featured,
  extra,
}: {
  name: string;
  price: string;
  period?: string;
  copy: string;
  points: string[];
  cta?: string;
  featured?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className={`price-card ${featured ? 'featured' : ''}`}>
      {featured && <span className="price-tag">MOST CHOSEN</span>}
      <h3>{name}</h3>
      <strong>{price}</strong>
      <small> {period}</small>
      <p>{copy}</p>
      {points.map((p) => (
        <div className="price-point" key={p}>
          <Check size={15} />
          {p}
        </div>
      ))}
      {extra}
      <Link href="/login" className={`btn ${featured ? 'btn-primary' : 'btn-ghost'}`}>
        {cta ?? `Start with ${name}`} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
export function Login(){const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [showPassword,setShowPassword]=useState(false);const [forgot,setForgot]=useState(false);const [error,setError]=useState('');const [loc,setLoc]=useLocation();const {login,toast}=useApp();const quick=(e:string,p:string)=>{setEmail(e);setPassword(p);submit(e,p)};
  // Real Supabase sign-in coexists with the mock demo path rather than
  // replacing it: the mock path is tried first (cheap, synchronous-feeling,
  // and what the one-click demo buttons below rely on), and only on a mock
  // failure — and only when VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are
  // actually configured — does this fall through to a real Supabase sign-in.
  // A real sign-in that succeeds still has no way to resolve a role/tenant
  // until AppContext's session bootstrap fetches the matching profile (see
  // AppContext.tsx), so this just routes home and lets that effect take over.
  const submit=async(e=email,p=password)=>{setError('');try{const {authService}=await import('@/services/mock');const u=await authService.login(e,p);login(u);toast('Welcome back',`Signed in as ${u.name}.`);setLoc(u.role==='platform'?'/platform/dashboard':u.role==='coaching'?'/coaching/dashboard':u.tenantId?'/student/dashboard':'/student/join');return}catch(mockErr){const {isSupabaseConfigured,signInWithPassword}=await import('@/services/supabase');if(!isSupabaseConfigured){setError((mockErr as Error).message);return}try{await signInWithPassword(e,p);toast('Welcome back','Signed in.');setLoc('/student/dashboard')}catch(realErr){setError((realErr as Error).message)}}};return <div className="login-page"><div className="login-visual"><Link href="/" className="login-brand"><span className="brand-mark">Q</span>QuizSet</Link><div className="login-copy"><div className="eyebrow" style={{color:'#82ecf7'}}>THE COACHING OPERATING SYSTEM</div><h1>Your Coaching.<br/>Your Brand.<br/><em>Your Course Platform.</em></h1><p>A calm, capable workspace for institutes that want to teach better, operate smarter and build something that lasts.</p><div className="login-points"><span>White-label by design</span><span>Built for Indian coaching</span><span>Signal-rich insights</span></div></div><small style={{color:'#8da4d5',fontSize:11}}>A focused demo workspace by QuizSet</small></div><div className="login-form-side"><div className="login-card"><div className="eyebrow">DEMO ACCESS</div><h2>Welcome back.</h2><p>Choose an account, or sign in with your demo credentials — or your real account, if this coaching has one.</p><form className="login-form" onSubmit={e=>{e.preventDefault();submit()}}><label className="field"><span>Email</span><input data-testid="input-email" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@institute.in" autoComplete="email"/></label><label className="field"><span>Password</span><div className="password-field"><input data-testid="input-password" value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?'text':'password'} placeholder="Enter password" autoComplete="current-password"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(s=>!s)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><div className="remember"><label><input type="checkbox" defaultChecked/> Remember me</label><button type="button" className="forgot" onClick={()=>setForgot(true)}>Forgot password?</button></div>{error&&<div className="login-error">{error}</div>}<Button data-testid="button-login" className="login-submit" type="submit">Sign in to workspace <ArrowRight size={15}/></Button></form><p className="signup-hint">New student? <Link href="/signup">Create an account</Link> and join a coaching with a code.</p><div className="demo-box"><p>One-click demo accounts</p><div className="demo-buttons"><button data-testid="button-demo-platform" onClick={()=>quick('admin@quizset.demo','admin123')}><strong>Platform Owner</strong><span>Command center · admin@quizset.demo</span></button><button data-testid="button-demo-coaching" onClick={()=>quick('owner@sunrise.demo','owner123')}><strong>Coaching Owner</strong><span>Sunrise Academy · owner@sunrise.demo</span></button><button data-testid="button-demo-student" onClick={()=>quick('rahul@student.demo','student123')}><strong>Student</strong><span>Rahul Sharma · learner workspace</span></button></div></div></div></div>{forgot&&<ForgotPasswordModal initialEmail={email} onClose={()=>setForgot(false)} onDone={()=>{setForgot(false);toast('Password updated','Sign in with your new password.','success')}}/>}</div>}

/**
 * Real 3-step password reset, via Supabase Auth's own recovery-OTP flow
 * (see sendPasswordResetOtp/verifyPasswordResetOtp/updatePassword in
 * services/supabase.ts) — not a simulated toast. Only works for a REAL
 * Supabase account (mock/demo accounts have no email to send to); a demo
 * account attempting this gets a clear error rather than a silently-fake
 * success.
 *   Step 1: enter email -> send a 6-digit code.
 *   Step 2: enter the code -> verifies it and opens a real (short-lived)
 *           recovery session.
 *   Step 3: enter a new password -> sets it on that now-active session.
 */
function ForgotPasswordModal({initialEmail,onClose,onDone}:{initialEmail:string;onClose:()=>void;onDone:()=>void}){
  const [step,setStep]=useState<'email'|'code'|'password'>('email');
  const [email,setEmail]=useState(initialEmail);
  const [code,setCode]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [showNewPassword,setShowNewPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const sendCode=async()=>{
    setError('');setBusy(true);
    try{
      const {isSupabaseConfigured,sendPasswordResetOtp}=await import('@/services/supabase');
      if(!isSupabaseConfigured) throw new Error('Password reset needs a real account — this demo workspace has no email server configured.');
      await sendPasswordResetOtp(email);
      setStep('code');
    }catch(err){setError((err as Error).message)}
    setBusy(false);
  };
  const verifyCode=async()=>{
    setError('');setBusy(true);
    try{
      const {verifyPasswordResetOtp}=await import('@/services/supabase');
      await verifyPasswordResetOtp(email,code);
      setStep('password');
    }catch(err){setError((err as Error).message)}
    setBusy(false);
  };
  const setPassword=async()=>{
    setError('');setBusy(true);
    try{
      const {updatePassword}=await import('@/services/supabase');
      await updatePassword(newPassword);
      onDone();
    }catch(err){setError((err as Error).message)}
    setBusy(false);
  };
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>Reset your password</h3><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
    {step==='email'&&<><p className="modal-copy">Enter your account email — we'll send a 6-digit code to reset your password.</p><input className="form-input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@institute.in"/>{error&&<div className="login-error">{error}</div>}<div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={busy||!email} onClick={sendCode}>{busy?'Sending…':'Send code'}</Button></div></>}
    {step==='code'&&<><p className="modal-copy">We sent a 6-digit code to <b>{email}</b>. Enter it below.</p><input className="form-input" value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456"/>{error&&<div className="login-error">{error}</div>}<div className="form-actions"><Button variant="ghost" onClick={()=>setStep('email')}>Back</Button><Button disabled={busy||code.length<6} onClick={verifyCode}>{busy?'Verifying…':'Verify code'}</Button></div></>}
    {step==='password'&&<><p className="modal-copy">Code verified — choose a new password.</p><div className="password-field"><input className="form-input" value={newPassword} onChange={e=>setNewPassword(e.target.value)} type={showNewPassword?'text':'password'} placeholder="New password" autoComplete="new-password" minLength={6}/><button type="button" className="password-toggle" onClick={()=>setShowNewPassword(s=>!s)} aria-label={showNewPassword?'Hide password':'Show password'}>{showNewPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>{error&&<div className="login-error">{error}</div>}<div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={busy||newPassword.length<6} onClick={setPassword}>{busy?'Saving…':'Set new password'}</Button></div></>}
  </div></div>;
}

export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // Demo mode (the existing behaviour, default and unchanged) creates a
  // mock/localStorage-only student and signs them straight in. Real mode
  // only appears once VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are actually
  // configured — see services/supabase.ts — so nothing changes in this UI
  // for anyone who hasn't set those up. Presented as an explicit toggle
  // rather than silently trying one then the other, because signup — unlike
  // login — creates a NEW account, and guessing which backend to create it
  // in would be a bad guess to get wrong.
  const [mode, setMode] = useState<'demo' | 'real'>('demo');
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [, setLoc] = useLocation();
  const { login, toast } = useApp();

  useEffect(() => {
    import('@/services/supabase').then(({ isSupabaseConfigured }) => setSupabaseConfigured(isSupabaseConfigured));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (mode === 'real') {
      try {
        const { signUpWithPassword } = await import('@/services/supabase');
        const { session } = await signUpWithPassword(email, password, name);
        if (session) {
          // Signed in immediately (email confirmation disabled on this
          // Supabase project). AppContext's session-bootstrap effect will
          // pick this session up and try to load a matching profile — see
          // the profile-creation gap documented in services/supabase.ts:
          // there is no server-side "create my profile" endpoint yet, so
          // `GET /api/profiles/me` will 404 until one exists. Route home
          // regardless; the app degrades to "signed in, no profile yet"
          // rather than erroring.
          toast('Account created', 'Signed in with your new account.');
          setLoc('/student/dashboard');
        } else {
          // No session back from signUp() usually means Supabase's
          // "confirm email" setting is on for this project.
          setInfo('Account created. Check your email to confirm it, then sign in.');
        }
      } catch (err) {
        setError((err as Error).message);
      }
      return;
    }
    try {
      const { authService } = await import('@/services/mock');
      const user = await authService.registerStudent(name, email, password);
      login(user);
      toast('Account created', 'Now join a coaching with a join code, or search for one.');
      setLoc('/student/join');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-visual">
        <Link href="/" className="login-brand">
          <span className="brand-mark">Q</span>QuizSet
        </Link>
        <div className="login-copy">
          <div className="eyebrow" style={{ color: '#82ecf7' }}>
            NEW STUDENT ACCOUNT
          </div>
          <h1>
            Join your coaching.
            <br />
            <em>Start practising today.</em>
          </h1>
          <p>Create an account, then use a join code from your coaching — or search for one — to get access to your exams.</p>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-card">
          <div className="eyebrow">CREATE ACCOUNT</div>
          <h2>Let's get you set up.</h2>
          <p>This creates a student account only — coaching and platform accounts are provisioned separately.</p>
          {supabaseConfigured && (
            <div className="remember" style={{ marginBottom: 4 }}>
              <label>
                <input type="radio" name="signup-mode" checked={mode === 'demo'} onChange={() => setMode('demo')} /> Demo account (this browser only)
              </label>
              <label>
                <input type="radio" name="signup-mode" checked={mode === 'real'} onChange={() => setMode('real')} /> Real account
              </label>
            </div>
          )}
          <form className="login-form" onSubmit={submit}>
            <label className="field">
              <span>Full name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required />
            </label>
            <label className="field">
              <span>Password</span>
              <div className="password-field">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Choose a password" autoComplete="new-password" required minLength={4} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {error && <div className="login-error">{error}</div>}
            {info && !error && <p className="signup-hint">{info}</p>}
            <Button className="login-submit" type="submit">
              Create account <ArrowRight size={15} />
            </Button>
          </form>
          <p className="signup-hint">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}