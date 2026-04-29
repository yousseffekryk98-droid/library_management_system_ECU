import React, { useState, useEffect } from 'react';
import { translations, Language } from '../translations';
import { BookOpen, User, Calendar, History, CheckCircle, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Book {
  id: number;
  title: string;
  quantity: number;
  current_borrows: number;
}

interface BorrowingRecord {
  id: number;
  book_id: number;
  book_title: string;
  student_name: string;
  student_id: string;
  college_name: string;
  faculty_name: string;
  academic_year: string;
  borrow_date: string;
  expected_return_date: string;
  return_date: string | null;
}

export default function BorrowManager({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [borrowing, setBorrowing] = useState<BorrowingRecord[]>([]);
  const [availableBooks, setAvailableBooks] = useState<Book[]>([]);
  const [searchStudent, setSearchStudent] = useState('');
  const [formData, setFormData] = useState({
    book_id: '',
    student_name: '',
    student_id: '',
    college_name: '',
    faculty_name: '',
    academic_year: '',
    duration_days: '7'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [borrowRes, booksRes] = await Promise.all([
      fetch('/api/borrowing'),
      fetch('/api/books')
    ]);
    const borrowData = await borrowRes.json();
    const booksData = await booksRes.json();
    setBorrowing(borrowData);
    setAvailableBooks(booksData.filter((b: Book) => (b.quantity || 1) - (b.current_borrows || 0) > 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/borrowing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      setFormData({
        book_id: '',
        student_name: '',
        student_id: '',
        college_name: '',
        faculty_name: '',
        academic_year: '',
        duration_days: '7'
      });
      fetchData();
    }
  };

  const handleReturn = async (id: number) => {
    const res = await fetch(`/api/return/${id}`, { method: 'POST' });
    if (res.ok) fetchData();
  };

  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '---';
    try {
      return format(d, 'yyyy-MM-dd');
    } catch (e) {
      return '---';
    }
  };

  const getTimeLeft = (expectedDate: string | null | undefined) => {
    if (!expectedDate) return 0;
    const d = new Date(expectedDate);
    if (isNaN(d.getTime())) return 0;
    const diff = d.getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days;
  };

  const filteredHistory = borrowing.filter(r => 
    r.student_name.toLowerCase().includes(searchStudent.toLowerCase()) ||
    r.student_id.toLowerCase().includes(searchStudent.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Borrowing Form */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">{t.borrowing.register}</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.borrowing.selectBook}</label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                value={formData.book_id}
                onChange={(e) => setFormData({ ...formData, book_id: e.target.value })}
              >
                <option value="">-- {t.borrowing.selectBook} --</option>
                {availableBooks.map(book => (
                  <option key={book.id} value={book.id}>
                    {book.title} ({ (book.quantity || 1) - (book.current_borrows || 0) } {t.inventory.available_copies})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.borrowing.studentName}</label>
              <input
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.borrowing.studentId}</label>
              <input
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.borrowing.college}</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.college_name}
                  onChange={(e) => setFormData({ ...formData, college_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.borrowing.faculty}</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.faculty_name}
                  onChange={(e) => setFormData({ ...formData, faculty_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.borrowing.academicYear}</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.academic_year}
                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.borrowing.duration}</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
              >
                <option value="3">3 Days</option>
                <option value="7">7 Days (1 Week)</option>
                <option value="14">14 Days (2 Weeks)</option>
                <option value="30">30 Days (1 Month)</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center justify-center gap-2 mt-4"
            >
              <BookOpen className="w-5 h-5" />
              {t.borrowing.submit}
            </button>
          </form>
        </div>
      </div>

      {/* History List */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900">{t.borrowing.history}</h2>
            </div>
            <div className="relative w-full md:w-64">
               <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                 type="text"
                 placeholder="Search Student ID/Name..."
                 className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded outline-none focus:ring-1 focus:ring-blue-500"
                 value={searchStudent}
                 onChange={(e) => setSearchStudent(e.target.value)}
               />
            </div>
          </div>

          {searchStudent && filteredHistory.length > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between transition-all">
              <div className="text-xs font-bold text-blue-700 flex items-center gap-2">
                <User className="w-3 h-3" />
                STUDENT PROFILE: {searchStudent}
              </div>
              <div className="text-[10px] space-x-3 rtl:space-x-reverse font-bold uppercase text-slate-500">
                <span>Total: {filteredHistory.length}</span>
                <span className="text-red-500">Active: {filteredHistory.filter(r => !r.return_date).length}</span>
                <span className="text-green-600">Returned: {filteredHistory.filter(r => r.return_date).length}</span>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {filteredHistory.map((record) => {
              const timeLeft = getTimeLeft(record.expected_return_date);
              return (
                <div key={record.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{record.book_title}</span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${record.return_date ? 'bg-green-100 text-green-700' : timeLeft < 0 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-blue-100 text-blue-700'}`}>
                        {record.return_date ? t.inventory.available : timeLeft < 0 ? t.borrowing.notReturned : `${timeLeft} ${t.borrowing.timer}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <div className="flex items-center gap-1 font-bold text-slate-700">
                        <User className="w-3 h-3" />
                        {record.student_name} ({record.student_id})
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 px-2 rounded-sm text-[10px] font-bold uppercase">
                        {record.college_name} - {record.faculty_name} ({record.academic_year})
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {t.borrowing.borrowDate}: {safeFormatDate(record.borrow_date)}
                      </div>
                      <div className="flex items-center gap-1 font-bold text-xs text-blue-600">
                        <Calendar className="w-3 h-3" />
                        {t.borrowing.expectedReturn}: {safeFormatDate(record.expected_return_date)}
                      </div>
                      {record.return_date && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          {t.borrowing.returnDate}: {safeFormatDate(record.return_date)}
                        </div>
                      )}
                    </div>
                  </div>
                  {!record.return_date && (
                    <button
                      onClick={() => handleReturn(record.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded hover:bg-blue-700 transition-all font-bold text-xs"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t.borrowing.markReturned}
                    </button>
                  )}
                </div>
              );
            })}
            {borrowing.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-10" />
                No records found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
