import React, { useState, useEffect } from 'react';
import { translations, Language } from '../translations';
import { Search, User, BookOpen, ChevronRight, History, Calendar, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface StudentSummary {
  student_id: string;
  student_name: string;
  college_name: string;
  faculty_name: string;
  academic_year: string;
  total_borrows: number;
  active_borrows: number;
}

interface BorrowingRecord {
  id: number;
  book_title: string;
  student_id: string;
  student_name: string;
  borrow_date: string;
  expected_return_date: string;
  return_date: string | null;
}

export default function StudentManager({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [studentHistory, setStudentHistory] = useState<BorrowingRecord[]>([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const res = await fetch('/api/students');
    const data = await res.json();
    setStudents(data);
  };

  const viewHistory = async (studentId: string) => {
    const res = await fetch(`/api/students/${studentId}/history`);
    const history = await res.json();
    setStudentHistory(history);
    setSelectedStudent(studentId);
  };

  const safeFormatDate = (dateStr: string | null | undefined, fmt: string = 'yyyy-MM-dd') => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    try {
      return format(d, fmt);
    } catch (e) {
      return '---';
    }
  };

  const filteredStudents = students.filter(s => 
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    s.student_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.students.title}</h2>
          <p className="text-sm text-slate-500">Track and manage student borrowing behavior</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder={t.students.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => (
          <motion.div 
            key={student.student_id}
            layoutId={student.student_id}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => viewHistory(student.student_id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                <User className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
              </div>
              <div className="flex gap-2">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {student.total_borrows} {t.students.totalBorrows}
                </span>
                {student.active_borrows > 0 && (
                  <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {student.active_borrows} ACTIVE
                  </span>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 leading-tight mb-1">{student.student_name}</h3>
              <p className="text-xs text-slate-400 font-mono mb-3">{student.student_id}</p>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                {student.college_name} - {student.faculty_name}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Year: {student.academic_year}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-blue-600 font-bold text-xs">
              <span>{t.students.viewHistory}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedStudent(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <History className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{students.find(s => s.student_id === selectedStudent)?.student_name}</h3>
                    <p className="text-xs text-slate-400 font-mono">Detailed History for {selectedStudent}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <ChevronRight className="w-5 h-5 rotate-90 md:rotate-0" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {studentHistory.map((record) => (
                  <div key={record.id} className="flex flex-col md:flex-row gap-4 p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{record.book_title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${record.return_date ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
                          {record.return_date ? 'Returned' : 'In Possession'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                         <div className="flex items-center gap-1">
                           <Calendar className="w-3 h-3" />
                           Borrowed: {safeFormatDate(record.borrow_date, 'yyyy-MM-dd HH:mm')}
                         </div>
                         {record.return_date && (
                           <div className="flex items-center gap-1 text-green-600">
                             <CheckCircle className="w-3 h-3" />
                             Returned: {safeFormatDate(record.return_date, 'yyyy-MM-dd HH:mm')}
                           </div>
                         )}
                         {!record.return_date && (
                           <div className="font-bold text-slate-800">
                             Due: {safeFormatDate(record.expected_return_date, 'yyyy-MM-dd')}
                           </div>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
