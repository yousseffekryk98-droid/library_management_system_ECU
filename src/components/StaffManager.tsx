import React, { useEffect, useState } from 'react';
import { Crown, GraduationCap, Shield, ShieldCheck, UserCog, UserPlus } from 'lucide-react';
import { Language } from '../translations';
import { supabase } from '../services/supabase-client';

type Staff = { user_id: string; display_name?: string; role: 'admin' | 'librarian' | 'assistant' | 'viewer'; is_active: boolean; created_at?: string };
type Patron = { user_id: string; student_id: string; preferred_language: 'ar' | 'en'; students?: { student_name?: string } };

export default function StaffManager({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [staff, setStaff] = useState<Staff[]>([]);
  const [patrons, setPatrons] = useState<Patron[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [form, setForm] = useState({ user_id: '', display_name: '', role: 'librarian', active: true });
  const [patronForm, setPatronForm] = useState({ user_id: '', student_id: '', language: 'ar' });
  const [bootstrapName, setBootstrapName] = useState('Library Administrator');

  const load = async () => {
    const [{ data: rows, error }, { data: roleData }, { data: patronRows }] = await Promise.all([
      supabase.from('staff_profiles').select('*').order('created_at'),
      supabase.rpc('current_library_role'),
      supabase.from('patron_accounts').select('*, students(student_name)').order('created_at', { ascending: false }).limit(500)
    ]);
    if (!error) setStaff((rows || []) as Staff[]);
    setRole((roleData as string | null) || null);
    setPatrons((patronRows || []) as Patron[]);
  };

  useEffect(() => { load(); }, []);

  const bootstrap = async () => {
    const { data, error } = await supabase.rpc('bootstrap_first_library_admin', { display_name_in: bootstrapName });
    if (error) return alert(error.message);
    if (!data) alert(ar ? 'يوجد مسؤول بالفعل.' : 'An administrator already exists.');
    load();
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.rpc('upsert_staff_profile', {
      user_id_in: form.user_id,
      display_name_in: form.display_name,
      role_in: form.role,
      active_in: form.active
    });
    if (error) return alert(error.message);
    setForm({ user_id: '', display_name: '', role: 'librarian', active: true });
    load();
  };

  const linkPatron = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.rpc('link_patron_account', {
      user_id_in: patronForm.user_id,
      student_id_in: patronForm.student_id,
      language_in: patronForm.language
    });
    if (error) return alert(error.message);
    setPatronForm({ user_id: '', student_id: '', language: 'ar' });
    load();
  };

  const updateExisting = async (member: Staff, patch: Partial<Staff>) => {
    const next = { ...member, ...patch };
    const { error } = await supabase.rpc('upsert_staff_profile', {
      user_id_in: next.user_id,
      display_name_in: next.display_name || '',
      role_in: next.role,
      active_in: next.is_active
    });
    if (error) return alert(error.message);
    load();
  };

  const roleIcon = (r: string) => r === 'admin' ? Crown : r === 'librarian' ? ShieldCheck : Shield;

  return <div className="space-y-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-black">{ar ? 'الموظفون والصلاحيات' : 'Staff & Roles'}</h1><p className="text-sm text-slate-500">{ar ? 'إدارة صلاحيات الموظفين وربط حسابات الطلاب ببوابة الخدمة الذاتية.' : 'Manage staff permissions and link student accounts to the self-service portal.'}</p></div><span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black uppercase text-white">{ar ? 'دورك' : 'Your role'}: {role || 'unassigned'}</span></div>

    {role === 'bootstrap' && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><Crown className="mt-0.5 h-5 w-5 text-amber-600"/><div className="flex-1"><h2 className="font-black text-amber-900">{ar ? 'تهيئة أول مسؤول' : 'Bootstrap first administrator'}</h2><p className="mt-1 text-sm text-amber-800">{ar ? 'لا يوجد ملف موظف حتى الآن. يمكن للحساب الحالي أن يصبح أول مسؤول مرة واحدة فقط.' : 'No staff profile exists yet. The current authenticated account can become the first administrator once.'}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="input flex-1" value={bootstrapName} onChange={e => setBootstrapName(e.target.value)}/><button onClick={bootstrap} className="btn-primary"><Crown className="h-4 w-4"/>{ar ? 'تعيين كمسؤول' : 'Make me admin'}</button></div></div></div></div>}

    <div className="grid gap-6 xl:grid-cols-2">
      <form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><UserPlus className="h-5 w-5 text-blue-600"/><h2 className="font-black">{ar ? 'إضافة/تعديل موظف' : 'Add / update staff'}</h2></div>
        <p className="mb-4 text-xs leading-5 text-slate-500">{ar ? 'أنشئ المستخدم أولاً من Supabase Auth ثم انسخ UUID. كلمات المرور لا تُخزن في جدول الموظفين.' : 'Create the user in Supabase Auth first, then paste the Auth UUID. Passwords are never stored in the staff table.'}</p>
        <div className="space-y-3"><input required className="input font-mono text-xs" placeholder="Auth user UUID" value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}/><input required className="input" placeholder={ar ? 'اسم الموظف' : 'Display name'} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}/><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{['admin','librarian','assistant','viewer'].map(r => <option key={r} value={r}>{r}</option>)}</select><label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}/>{ar ? 'الحساب نشط' : 'Account active'}</label><button className="btn-primary w-full"><UserCog className="h-4 w-4"/>{ar ? 'حفظ الصلاحيات' : 'Save role'}</button></div>
      </form>

      <form onSubmit={linkPatron} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><GraduationCap className="h-5 w-5 text-violet-600"/><h2 className="font-black">{ar ? 'ربط حساب طالب' : 'Link student portal account'}</h2></div>
        <p className="mb-4 text-xs leading-5 text-slate-500">{ar ? 'أنشئ حساب الطالب في Supabase Auth، ثم اربط UUID برقم الطالب. بعد تسجيل الدخول سيظهر له فقط بوابة الطالب وبياناته الخاصة.' : 'Create the student in Supabase Auth, then link that Auth UUID to the student ID. On login they will only see the student portal and their own data.'}</p>
        <div className="space-y-3"><input required className="input font-mono text-xs" placeholder="Student Auth user UUID" value={patronForm.user_id} onChange={e => setPatronForm({ ...patronForm, user_id: e.target.value })}/><input required className="input" placeholder={ar ? 'رقم الطالب' : 'Student ID'} value={patronForm.student_id} onChange={e => setPatronForm({ ...patronForm, student_id: e.target.value })}/><select className="input" value={patronForm.language} onChange={e => setPatronForm({ ...patronForm, language: e.target.value })}><option value="ar">العربية</option><option value="en">English</option></select><button className="btn-secondary w-full"><GraduationCap className="h-4 w-4"/>{ar ? 'ربط ببوابة الطالب' : 'Link portal account'}</button></div>
      </form>
    </div>

    <div className="grid gap-6 2xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">{ar ? 'فريق المكتبة' : 'Library staff'}</h2><p className="text-xs text-slate-500">{staff.length} {ar ? 'حساب موظف' : 'staff profiles'}</p></div><div className="divide-y divide-slate-100">{staff.map(member => { const Icon = roleIcon(member.role); return <div key={member.user_id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100"><Icon className="h-5 w-5 text-blue-600"/></div><div className="min-w-0"><p className="truncate font-bold">{member.display_name || 'Unnamed staff'}</p><p className="truncate font-mono text-[10px] text-slate-400">{member.user_id}</p></div></div><div className="flex flex-wrap items-center gap-2"><select className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold" value={member.role} onChange={e => updateExisting(member, { role: e.target.value as Staff['role'] })}>{['admin','librarian','assistant','viewer'].map(r => <option key={r}>{r}</option>)}</select><button onClick={() => updateExisting(member, { is_active: !member.is_active })} className={`rounded-lg px-3 py-2 text-xs font-black ${member.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{member.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Disabled')}</button></div></div>})}{!staff.length && <p className="p-8 text-center text-sm text-slate-400">{ar ? 'لا توجد ملفات موظفين بعد.' : 'No staff profiles yet.'}</p>}</div></div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-black">{ar ? 'حسابات بوابة الطلاب' : 'Student portal accounts'}</h2><p className="text-xs text-slate-500">{patrons.length} {ar ? 'حساب مرتبط' : 'linked accounts'}</p></div><div className="divide-y divide-slate-100">{patrons.map(p => <div key={p.user_id} className="flex items-center gap-3 p-5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50"><GraduationCap className="h-5 w-5 text-violet-600"/></div><div className="min-w-0"><p className="truncate font-bold">{p.students?.student_name || p.student_id}</p><p className="truncate text-xs text-slate-500">{p.student_id} · {p.preferred_language}</p><p className="truncate font-mono text-[10px] text-slate-400">{p.user_id}</p></div></div>)}{!patrons.length && <p className="p-8 text-center text-sm text-slate-400">{ar ? 'لا توجد حسابات طلاب مرتبطة بعد.' : 'No linked student accounts yet.'}</p>}</div></div>
    </div>
  </div>;
}
