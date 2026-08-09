import { Exam, Question, Student, Tenant, AuthUser } from '@/types';

export const users: AuthUser[] = [
  { id: 'u-admin', name: 'Aarav Mehta', email: 'admin@quizset.demo', role: 'platform' },
  { id: 'u-owner', name: 'Rajiv Sharma', email: 'owner@sunrise.demo', role: 'coaching', tenantId: 'sunrise' },
  { id: 'u-student', name: 'Rahul Sharma', email: 'rahul@student.demo', role: 'student', tenantId: 'sunrise' },
];
export const tenants: Tenant[] = [
  { id:'sunrise', name:'Sunrise Academy', initials:'SA', city:'Raipur', students:2540, plan:'Growth', primaryColor:'#4f46e5', joinCode:'SUNRISE2026', owner:'Rajiv Sharma', supportEmail:'hello@sunriseacademy.in' },
  { id:'career', name:'Career Point', initials:'CP', city:'Kota', students:1890, plan:'Enterprise', primaryColor:'#0891b2', joinCode:'CAREER2026', owner:'Amit Verma', supportEmail:'support@careerpoint.in' },
  { id:'success', name:'Success Institute', initials:'SI', city:'Patna', students:950, plan:'Starter', primaryColor:'#7c3aed', joinCode:'SUCCESS2026', owner:'Neha Jain', supportEmail:'team@successinstitute.in' },
];
export const exams: Exam[] = [
  { id:'ssc-premium', tenantId:'sunrise', name:'SSC CGL Premium Mock Test', type:'Mock Test', questions:100, duration:60, mrp:999, sale:499, status:'Published', students:1248, preview:5, subject:'Quantitative Aptitude' },
  { id:'ssc-practice', tenantId:'sunrise', name:'SSC CGL Practice Set 04', type:'Practice Quiz', questions:30, duration:25, mrp:0, sale:0, status:'Published', students:863, preview:30, subject:'Reasoning' },
  { id:'railway', tenantId:'sunrise', name:'Railway Group D Complete Test', type:'Mock Test', questions:80, duration:55, mrp:699, sale:349, status:'Upcoming', students:0, preview:5, subject:'General Awareness' },
  { id:'banking', tenantId:'career', name:'Banking PO Quant Sprint', type:'Practice Quiz', questions:40, duration:35, mrp:399, sale:199, status:'Published', students:432, preview:5, subject:'Quantitative Aptitude' },
];
export const students: Student[] = [
  { id:'rahul', name:'Rahul Sharma', email:'rahul@student.demo', phone:'+91 98765 43210', tenantId:'sunrise', status:'Active', exams:12, score:78, joined:'12 Jan 2025' },
  { id:'ananya', name:'Ananya Singh', email:'ananya@sunrise.demo', phone:'+91 98111 22445', tenantId:'sunrise', status:'Active', exams:18, score:84, joined:'08 Jan 2025' },
  { id:'vikas', name:'Vikas Kumar', email:'vikas@sunrise.demo', phone:'+91 99200 31876', tenantId:'sunrise', status:'Pending', exams:0, score:0, joined:'Yesterday' },
  { id:'meera', name:'Meera Joshi', email:'meera@sunrise.demo', phone:'+91 98001 10987', tenantId:'sunrise', status:'Suspended', exams:9, score:61, joined:'22 Dec 2024' },
];
export const questions: Question[] = [
  { id:'q1', text:'If the price of an article is ₹500 and it increases by 20%, what is the new price?', options:['₹550','₹580','₹600','₹620'], answer:2, explanation:'20% of ₹500 is ₹100. Add it to the original price for ₹600.', topic:'Percentage', difficulty:'Easy' },
  { id:'q2', text:'A train travels 360 km in 4 hours. What is its average speed?', options:['80 km/h','90 km/h','100 km/h','120 km/h'], answer:1, explanation:'Average speed = distance ÷ time = 360 ÷ 4 = 90 km/h.', topic:'Time & Distance', difficulty:'Easy' },
  { id:'q3', text:'Which number should replace the question mark: 3, 9, 27, 81, ?', options:['162','189','243','324'], answer:2, explanation:'Each term is multiplied by 3.', topic:'Number Series', difficulty:'Medium' },
  { id:'q4', text:'The ratio of two numbers is 3:5 and their sum is 64. Find the smaller number.', options:['18','20','24','28'], answer:2, explanation:'8 parts equal 64, so one part is 8. Smaller number is 3 × 8 = 24.', topic:'Ratio', difficulty:'Medium' },
  { id:'q5', text:'Choose the word most similar in meaning to “Prudent”.', options:['Careless','Wise','Rapid','Proud'], answer:1, explanation:'Prudent means acting with careful thought; wise is the closest meaning.', topic:'Vocabulary', difficulty:'Easy' },
];