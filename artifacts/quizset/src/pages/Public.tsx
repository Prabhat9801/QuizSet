import { Link, useLocation } from 'wouter';
import { ArrowRight, BarChart3, BookOpen, Check, ChevronDown, CircleCheck, Layers3, Menu, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
export function Logo(){return <Link href="/" className="landing-brand"><span className="brand-mark">Q</span><span>QuizSet</span></Link>}
export function Landing(){const [faq,setFaq]=useState<number|null>(0); return <div className="landing"><header className="landing-nav"><Logo/><nav><a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav><div><Link href="/login" className="landing-login">Sign in</Link><Link href="/login" className="btn btn-primary">See the workspace <ArrowRight size={15}/></Link></div></header><section className="landing-hero"><div className="hero-copy"><div className="eyebrow">THE OPERATING SYSTEM FOR COACHING</div><h1>Your coaching deserves a <em>platform</em> of its own.</h1><p>Launch a branded exam and learning ecosystem that feels unmistakably yours — from the first question to the final result.</p><div className="hero-actions"><Link href="/login" className="btn btn-primary">Explore QuizSet <ArrowRight size={16}/></Link><a href="#platform" className="text-link">See what’s inside <span>↓</span></a></div><div className="hero-proof"><div className="proof-avatars"><span>RS</span><span>AV</span><span>NJ</span><span>+124</span></div><div><strong>Trusted by ambitious coaching teams</strong><small>Built for coaching teams ready to grow</small></div></div></div><div className="hero-product"><div className="product-window"><div className="product-chrome"><span/><span/><span/><b>Sunrise Academy <i>live workspace</i></b><small>Rahul Sharma <span>RS</span></small></div><div className="product-body"><aside><div className="mini-logo">SA</div><b>Sunrise Academy</b><small>Owner workspace</small>{['Overview','Exams','Students','Live Tests'].map((x,i)=><div className={i===0?'mini-nav active':'mini-nav'} key={x}><span className="mini-icon">{['◈','◫','♙','↗'][i]}</span>{x}</div>)}</aside><main><div className="mini-welcome"><div><small>MONDAY, 14 JULY 2025</small><h3>Good morning, Rajiv</h3><p>Your academy is growing with signal.</p></div><span className="mini-avatar">RS</span></div><div className="mini-stats"><div><small>Revenue</small><strong>₹4.82L</strong><i>+18.4%</i></div><div><small>Students</small><strong>2,540</strong><i>+12.1%</i></div><div><small>Exams</small><strong>28</strong><i>+4.2%</i></div></div><div className="mini-chart"><div className="mini-chart-head"><b>Revenue overview</b><small>Last 30 days⌄</small></div><div className="chart-line"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></div></main></div></div><div className="hero-float"><Sparkles size={15}/><span><strong>Smart insights ready</strong><small>Percentage is trending weak</small></span></div></div></section><section className="logo-strip"><span>MADE FOR COACHING TEAMS WHO THINK LONG-TERM</span><b>Sunrise Academy</b><b>career point</b><b>SUCCESS / INSTITUTE</b><b>EXAMVERSE</b></section><section className="landing-section" id="platform"><div className="section-intro"><div className="eyebrow">ONE SYSTEM. EVERY LAYER.</div><h2>Run the business.<br/><em>Teach with clarity.</em></h2><p>QuizSet brings your exams, students, money, content and insight into one quiet command center.</p></div><div className="feature-grid"><Feature icon={<Layers3/>} num="01" title="Your brand, in every interaction" copy="White-label your coaching experience with colors, logo, domain-ready workspaces and the details that build trust."/><Feature icon={<BarChart3/>} num="02" title="Operate from signal, not noise" copy="Know which exams sell, which topics slip and which learners need a nudge — before the numbers become a problem."/><Feature icon={<BookOpen/>} num="03" title="A better exam experience" copy="Design, publish, sell and analyze exams without stitching together five different tools."/><Feature icon={<Sparkles/>} num="04" title="Intelligence where it matters" copy="Give every learner a useful next step with topic-aware guidance from an AI study companion."/></div></section><section className="dark-band" id="workflow"><div className="section-intro"><div className="eyebrow">FROM IDEA TO IMPACT</div><h2>One connected<br/><em>operating rhythm.</em></h2></div><div className="steps"><Step n="01" title="Shape your space" copy="Set your brand, invite your team and make the workspace yours."/><Step n="02" title="Build your exam engine" copy="Request question banks, configure pricing and publish when ready."/><Step n="03" title="Grow with signal" copy="See revenue, performance and learner momentum in one view."/></div></section><section className="pricing-section" id="pricing"><div className="section-intro centered"><div className="eyebrow">SIMPLE, SERIOUS PRICING</div><h2>Choose the pace<br/><em>you’re ready for.</em></h2><p>Start with the fundamentals. Add scale when your institute is ready for it.</p></div><div className="pricing-grid"><Price name="Starter" price="₹2,999" copy="For a focused institute building its digital foundation." points={['Branded learner workspace','Up to 1,000 students','Exam and question bank tools']}/><Price featured name="Growth" price="₹7,999" copy="For teams turning online exams into a serious channel." points={['Everything in Starter','Up to 5,000 students','Payments and the AI study assistant']}/><Price name="Enterprise" price="Let’s talk" copy="For multi-centre coaching businesses with bigger ambitions." points={['Unlimited learner scale','Multi-centre operations','Priority support and onboarding']}/></div></section><section className="faq-section" id="faq"><div className="section-intro"><div className="eyebrow">QUESTIONS, ANSWERED</div><h2>Clarity before<br/><em>you commit.</em></h2></div><div className="faqs">{['Can QuizSet use our institute’s brand?','Do we need a technical team to run it?','Can students buy exams directly?','Is there a demo workspace?'].map((q,i)=><div className={`faq ${faq===i?'open':''}`} key={q}><button onClick={()=>setFaq(faq===i?null:i)}><span>{q}</span><ChevronDown size={17}/></button>{faq===i&&<p>Yes. QuizSet is designed to be operated by coaching teams, not technical departments. The workspace is ready with your brand, your content and your learner workflows from day one.</p>}</div>)}</div></section><footer><Logo/><span>Your Coaching. Your Brand. Your Exam Platform.</span><small>© 2025 QuizSet. Built for ambitious coaching institutes.</small></footer></div>}
function Feature({icon,num,title,copy}:{icon:any;num:string;title:string;copy:string}){return <div className="feature"><div className="feature-top"><span>{num}</span><span className="feature-icon">{icon}</span></div><h3>{title}</h3><p>{copy}</p><a href="#workflow">Explore the layer <ArrowRight size={13}/></a></div>}
function Step({n,title,copy}:{n:string;title:string;copy:string}){return <div className="step"><span>{n}</span><h3>{title}</h3><p>{copy}</p></div>}
function Price({name,price,copy,points,featured}:{name:string;price:string;copy:string;points:string[];featured?:boolean}){return <div className={`price-card ${featured?'featured':''}`}>{featured&&<span className="price-tag">MOST CHOSEN</span>}<h3>{name}</h3><strong>{price}</strong><small> / month</small><p>{copy}</p>{points.map(p=><div className="price-point" key={p}><Check size={15}/>{p}</div>)}<Link href="/login" className={`btn ${featured?'btn-primary':'btn-ghost'}`}>Start with {name} <ArrowRight size={14}/></Link></div>}
export function Login(){const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [forgot,setForgot]=useState(false);const [error,setError]=useState('');const [loc,setLoc]=useLocation();const {login,toast}=useApp();const quick=(e:string,p:string)=>{setEmail(e);setPassword(p);submit(e,p)};const submit=async(e=email,p=password)=>{try{const {authService}=await import('@/services/mock');const u=await authService.login(e,p);login(u);toast('Welcome back',`Signed in as ${u.name}.`);setLoc(u.role==='platform'?'/platform/dashboard':u.role==='coaching'?'/coaching/dashboard':u.tenantId?'/student/dashboard':'/student/join')}catch(err){setError((err as Error).message)}};return <div className="login-page"><div className="login-visual"><Link href="/" className="login-brand"><span className="brand-mark">Q</span>QuizSet</Link><div className="login-copy"><div className="eyebrow" style={{color:'#82ecf7'}}>THE COACHING OPERATING SYSTEM</div><h1>Your Coaching.<br/>Your Brand.<br/><em>Your Exam Platform.</em></h1><p>A calm, capable workspace for institutes that want to teach better, operate smarter and build something that lasts.</p><div className="login-points"><span>White-label by design</span><span>Built for Indian coaching</span><span>Signal-rich insights</span></div></div><small style={{color:'#8da4d5',fontSize:11}}>A focused demo workspace by QuizSet</small></div><div className="login-form-side"><div className="login-card"><div className="eyebrow">DEMO ACCESS</div><h2>Welcome back.</h2><p>Choose an account or sign in with your demo credentials.</p><form className="login-form" onSubmit={e=>{e.preventDefault();submit()}}><label className="field"><span>Email</span><input data-testid="input-email" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@institute.in" autoComplete="email"/></label><label className="field"><span>Password</span><input data-testid="input-password" value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Enter password" autoComplete="current-password"/></label><div className="remember"><label><input type="checkbox" defaultChecked/> Remember me</label><button type="button" className="forgot" onClick={()=>setForgot(true)}>Forgot password?</button></div>{error&&<div className="login-error">{error}</div>}<Button data-testid="button-login" className="login-submit" type="submit">Sign in to workspace <ArrowRight size={15}/></Button></form><p className="signup-hint">New student? <Link href="/signup">Create an account</Link> and join a coaching with a code.</p><div className="demo-box"><p>One-click demo accounts</p><div className="demo-buttons"><button data-testid="button-demo-platform" onClick={()=>quick('admin@quizset.demo','admin123')}><strong>Platform Owner</strong><span>Command center · admin@quizset.demo</span></button><button data-testid="button-demo-coaching" onClick={()=>quick('owner@sunrise.demo','owner123')}><strong>Coaching Owner</strong><span>Sunrise Academy · owner@sunrise.demo</span></button><button data-testid="button-demo-student" onClick={()=>quick('rahul@student.demo','student123')}><strong>Student</strong><span>Rahul Sharma · learner workspace</span></button></div></div></div></div>{forgot&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>Reset your access</h3><button className="icon-btn" onClick={()=>setForgot(false)}><X size={18}/></button></div><p className="modal-copy">Enter your email and we’ll simulate a secure reset link for this demo workspace.</p><input className="form-input" defaultValue={email} placeholder="you@institute.in"/><div className="form-actions"><Button variant="ghost" onClick={()=>setForgot(false)}>Cancel</Button><Button onClick={()=>{setForgot(false);toast('Reset link simulated','Check your inbox for the next step.','info')}}>Send reset link</Button></div></div></div>}</div>}

export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLoc] = useLocation();
  const { login, toast } = useApp();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Choose a password" autoComplete="new-password" required minLength={4} />
            </label>
            {error && <div className="login-error">{error}</div>}
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