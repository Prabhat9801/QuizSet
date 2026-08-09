export type Role = 'platform' | 'coaching' | 'student';
export type AuthUser = { id: string; name: string; email: string; role: Role; tenantId?: string };
export type Tenant = { id: string; name: string; initials: string; city: string; students: number; plan: string; primaryColor: string; joinCode: string; owner: string; supportEmail: string };
export type Exam = { id: string; tenantId: string; name: string; type: string; questions: number; duration: number; mrp: number; sale: number; status: 'Published'|'Draft'|'Upcoming'|'Archived'; students: number; preview: number; subject: string };
export type Student = { id: string; name: string; email: string; phone: string; tenantId: string; status: 'Active'|'Pending'|'Suspended'; exams: number; score: number; joined: string };
export type Question = { id: string; text: string; options: string[]; answer: number; explanation: string; topic: string; difficulty: string };
export type Toast = { id: number; title: string; description?: string; tone?: 'success'|'danger'|'info' };