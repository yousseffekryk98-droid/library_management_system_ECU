import React, { useState, useEffect } from 'react';
import { translations, Language } from '../translations';
import { supabase } from '../services/supabase-client';
import { Search, Plus, Edit, Trash2, X, Save, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface Book {
  id: number;
  title: string;
  author: string;
  publisher: string;
  classification_number: string;
  edition_number: string;
  isbn: string;
  category: string;
  condition: string;
  quantity: number;
  sector: string;
  shelf_number: string;
  current_borrows: number;
}

export default function BookManager({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Partial<Book> | null>(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [sqlInput, setSqlInput] = useState('');
  const [selectedBookHistory, setSelectedBookHistory] = useState<any[] | null>(null);

  useEffect(() => {
    fetchBooks();
  }, []);

  const viewBookHistory = async (bookId: number) => {
    const { data, error } = await supabase.from('borrowing').select('*').eq('book_id', bookId).order('borrow_date', { ascending: false });
    if (error) {
      console.error('Failed to load history', error);
      setSelectedBookHistory([]);
      return;
    }
    setSelectedBookHistory(data || []);
  };

  const handleSqlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    // Raw SQL import is not available via the client. Advise using migrations or Supabase SQL editor.
    alert('SQL import is disabled in the client. Please run migration SQL on the Supabase project or use the SQL editor.');
    setIsSqlModalOpen(false);
    setSqlInput('');
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

  const fetchBooks = async () => {
    const { data, error } = await supabase.from('books').select('*').order('title', { ascending: true });
    if (error) {
      console.error('Failed to fetch books', error);
      return;
    }
    setBooks(data || []);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBook?.id) {
      const { error } = await supabase.from('books').update(editingBook).eq('id', editingBook.id);
      if (error) return alert('Update failed: ' + error.message);
    } else {
      const { error } = await supabase.from('books').insert(editingBook as any);
      if (error) return alert('Insert failed: ' + error.message);
    }
    setIsModalOpen(false);
    setEditingBook(null);
    fetchBooks();
  };

  const handleDelete = async (id: number) => {
    if (confirm(t.common.deleteConfirm)) {
      const { error } = await supabase.from('books').delete().eq('id', id);
      if (error) return alert('Delete failed: ' + error.message);
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.author.toLowerCase().includes(search.toLowerCase()) ||
    b.isbn.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4`} />
          <input
            type="text"
            placeholder={t.inventory.searchPlaceholder}
            className={`w-full ${lang === 'ar' ? 'pr-10' : 'pl-10'} py-2 bg-slate-50 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none transition-all`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSqlModalOpen(true)}
            className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            <History className="w-4 h-4" />
            {t.inventory.importSql}
          </button>
          <button
            onClick={() => { setEditingBook({}); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t.inventory.addNew}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isSqlModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSqlModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
                <h3 className="text-lg font-bold">{t.inventory.importSql}</h3>
                <button onClick={() => setIsSqlModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSqlImport} className="p-6 space-y-4">
                <p className="text-xs text-slate-500 font-mono italic">
                  -- Bulk import books via raw SQL inserts --<br/>
                  INSERT INTO books (title, author, publisher, isbn) VALUES ('Title', 'Author', 'Pub', 'ISBN');
                </p>
                <textarea
                  className="w-full h-64 px-3 py-2 border border-slate-200 rounded font-mono text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Paste your SQL script here..."
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setIsSqlModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-sm">
                    {t.inventory.cancel}
                  </button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow-lg shadow-blue-100">
                    {t.inventory.importBtn}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left rtl:text-right text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">{t.inventory.bookTitle}</th>
                <th className="px-6 py-4">{t.inventory.author}</th>
                <th className="px-6 py-4">{t.inventory.sector}</th>
                <th className="px-6 py-4">{t.inventory.isbn}</th>
                <th className="px-6 py-4 text-center">{t.inventory.quantity}</th>
                <th className="px-6 py-4 text-right">{t.inventory.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBooks.map((book) => {
                const available = (book.quantity || 1) - (book.current_borrows || 0);
                return (
                  <tr key={book.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{book.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono italic">{book.classification_number}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{book.author}</td>
                    <td className="px-6 py-4">
                       <div className="text-xs font-bold text-slate-700">{book.sector || '---'}</div>
                       <div className="text-[10px] text-blue-500 uppercase">{t.inventory.shelf}: {book.shelf_number || '---'}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{book.isbn}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {available} / {book.quantity || 1} {t.inventory.available_copies}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button 
                        onClick={() => viewBookHistory(book.id)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
                        title="Book History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => { setEditingBook(book); setIsModalOpen(true); }}
                        className="text-blue-600 hover:underline font-bold text-xs"
                      >
                        {lang === 'ar' ? 'تعديل' : 'Edit'}
                      </button>
                      <button 
                        onClick={() => handleDelete(book.id)}
                        className="text-red-500 hover:underline font-bold text-xs"
                      >
                        {lang === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedBookHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedBookHistory(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col"
            >
              <div className="p-6 bg-slate-900 text-white shrink-0 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   <History className="w-5 h-5 text-blue-400" />
                   <div>
                     <h3 className="font-bold">{books.find(b => b.id === selectedBookHistory[0]?.book_id)?.title || 'Book'} History</h3>
                     <p className="text-xs text-slate-400">Past and current borrowers</p>
                   </div>
                 </div>
                 <button onClick={() => setSelectedBookHistory(null)} className="text-slate-400 hover:text-white">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {selectedBookHistory.map((h, i) => (
                  <div key={i} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800">{h.student_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono italic">{h.student_id}</div>
                    </div>
                    <div className="text-right">
                       <div className="text-[10px] uppercase font-bold text-slate-500">Borrowed: {safeFormatDate(h.borrow_date)}</div>
                       {h.return_date ? (
                         <div className="text-[10px] uppercase font-bold text-green-600">Returned: {safeFormatDate(h.return_date)}</div>
                       ) : (
                         <div className="text-[10px] uppercase font-bold text-blue-600">Currently Borrowed</div>
                       )}
                    </div>
                  </div>
                ))}
                {selectedBookHistory.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-sm">No borrowing history for this book yet.</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">{editingBook?.id ? t.inventory.editBook : t.inventory.addNew}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.bookTitle}</label>
                    <input
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.title || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.author}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.author || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.publisher}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.publisher || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, publisher: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.classification}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.classification_number || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, classification_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.edition}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.edition_number || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, edition_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.isbn}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.isbn || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, isbn: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.category}</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.category || 'General'}
                      onChange={(e) => setEditingBook({ ...editingBook, category: e.target.value })}
                    >
                      <option value="General">General</option>
                      <option value="Science">Science</option>
                      <option value="Literature">Literature</option>
                      <option value="History">History</option>
                      <option value="Technology">Technology</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.condition}</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.condition || 'New'}
                      onChange={(e) => setEditingBook({ ...editingBook, condition: e.target.value })}
                    >
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.sector}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.sector || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, sector: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t.inventory.shelf}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingBook?.shelf_number || ''}
                      onChange={(e) => setEditingBook({ ...editingBook, shelf_number: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2 text-center pb-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-3">{t.inventory.quantity}</label>
                    <div className="flex items-center justify-center gap-4">
                      <button 
                        type="button"
                        onClick={() => setEditingBook({ ...editingBook, quantity: Math.max(1, (editingBook?.quantity || 1) - 1) })}
                        className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                      >-</button>
                      <span className="text-2xl font-bold w-12">{editingBook?.quantity || 1}</span>
                      <button 
                        type="button"
                        onClick={() => setEditingBook({ ...editingBook, quantity: (editingBook?.quantity || 1) + 1 })}
                        className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                      >+</button>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {t.inventory.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200"
                  >
                    <Save className="w-4 h-4" />
                    {t.inventory.save}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
