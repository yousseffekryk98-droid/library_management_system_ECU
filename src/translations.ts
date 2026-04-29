export const translations = {
  en: {
    title: "Library Master Pro",
    tabs: {
      dashboard: "Dashboard",
      inventory: "Inventory & Books",
      borrowing: "Borrowing System",
      students: "Student Management",
      settings: "Settings & Reports"
    },
    dashboard: {
      totalBooks: "Total Books",
      activeBorrowing: "Active Borrows",
      overdue: "Overdue Books",
      activeStudents: "Active Students",
      quickCheckout: "Quick Checkout",
      quickReturn: "Quick Return",
      welcome: "Welcome back, Doctor",
      systemHealth: "System Summary"
    },
    students: {
      title: "Student Database",
      studentId: "Student ID",
      studentName: "Name",
      department: "Dept / College",
      totalBorrows: "Total Records",
      activeBorrows: "Borrowed Now",
      viewHistory: "View All History",
      searchPlaceholder: "Search students by ID or name..."
    },
    inventory: {
      addNew: "Add New Book",
      importSql: "Import SQL Script",
      editBook: "Edit Book",
      bookTitle: "Book Title",
      author: "Author",
      publisher: "Publisher",
      classification: "Classification #",
      edition: "Edition #",
      isbn: "ISBN",
      category: "Category",
      condition: "Condition",
      quantity: "Total Copies",
      available_copies: "Available",
      sector: "Sector / Department",
      shelf: "Shelf Location",
      status: "Status",
      searchPlaceholder: "Search by title, author, or ISBN...",
      actions: "Actions",
      available: "Available",
      borrowed: "Borrowed",
      save: "Save Book",
      cancel: "Cancel",
      importBtn: "Execute SQL Import"
    },
    borrowing: {
      register: "Register Borrowing",
      studentName: "Student Name",
      studentId: "Student ID (Card #)",
      college: "College Name",
      faculty: "Faculty",
      academicYear: "Academic Year",
      selectBook: "Select Available Book",
      duration: "Borrow Duration (Days)",
      borrowDate: "Borrow Date",
      expectedReturn: "Due Date",
      returnDate: "Return Date",
      markReturned: "Mark as Returned",
      history: "Live Borrowing System",
      notReturned: "Overdue",
      submit: "Confirm Borrowing",
      timer: "Days Left"
    },
    settings: {
      language: "Interface Language",
      exportInventory: "Export Inventory to Excel",
      exportBorrowing: "Export Borrowing History to Excel",
      appearance: "System Appearance",
      backup: "Database Backup",
      about: "About System"
    },
    common: {
      loading: "Loading...",
      error: "An error occurred",
      success: "Operation successful",
      deleteConfirm: "Are you sure you want to delete this?"
    }
  },
  ar: {
    title: "لايبراري ماستر برو",
    tabs: {
      dashboard: "لوحة التحكم",
      inventory: "الجرد وإدارة الكتب",
      borrowing: "نظام الإعارة",
      students: "إدارة الطلاب",
      settings: "الإعدادات والتقارير"
    },
    dashboard: {
      totalBooks: "إجمالي الكتب",
      activeBorrowing: "إعارات نشطة",
      overdue: "كتب متأخرة",
      activeStudents: "طلاب مستعيرون",
      quickCheckout: "إعارة سريعة",
      quickReturn: "إرجاع سريع",
      welcome: "مرحباً بك يا دكتور",
      systemHealth: "ملخص حالة النظام"
    },
    students: {
      title: "قاعدة بيانات الطلاب",
      studentId: "رقم الطالب",
      studentName: "الاسم",
      department: "الكلية / الفرقة",
      totalBorrows: "إجمالي العمليات",
      activeBorrows: "الكتب الحالية",
      viewHistory: "عرض السجل بالكامل",
      searchPlaceholder: "بحث عن طالب بالرقم أو الاسم..."
    },
    inventory: {
      addNew: "إضافة كتاب جديد",
      importSql: "استيراد SQL",
      editBook: "تعديل كتاب",
      bookTitle: "اسم الكتاب",
      author: "اسم المؤلف",
      publisher: "دار النشر",
      classification: "رقم التصنيف",
      edition: "رقم الطبعة",
      isbn: "الرقم المعياري (ISBN)",
      category: "الفئة",
      condition: "حالة الكتاب",
      quantity: "إجمالي النسخ",
      available_copies: "المتاح حالياً",
      sector: "القسم / القطاع",
      shelf: "رقم الرف",
      status: "الحالة",
      searchPlaceholder: "بحث بالعنوان، المؤلف، أو ISBN...",
      actions: "الإجراءات",
      available: "متاح",
      borrowed: "مستعار",
      save: "حفظ الكتاب",
      cancel: "إلغاء",
      importBtn: "تنفيذ الاستيراد"
    },
    borrowing: {
      register: "تسجيل عملية إعارة",
      studentName: "اسم الطالب",
      studentId: "رقم الكارنيه",
      college: "اسم الجامعة",
      faculty: "الكلية",
      academicYear: "الفرقة/السنة الدراسية",
      selectBook: "اختر كتاباً متاحاً",
      duration: "مدة الاستعارة (أيام)",
      borrowDate: "وقت الاستعارة",
      expectedReturn: "تاريخ الإرجاع المتوقع",
      returnDate: "وقت الإرجاع",
      markReturned: "تحديد كتم الإرجاع",
      history: "نظام الإعارة المباشر",
      notReturned: "متأخر",
      submit: "تأكيد الإعارة",
      timer: "يوم متبقي"
    },
    settings: {
      language: "لغة الواجهة",
      exportInventory: "تصدير الجرد إلى Excel",
      exportBorrowing: "تصدير سجل الإعارات إلى Excel",
      appearance: "مظهر النظام",
      backup: "نسخ احتياطي للقاعدة",
      about: "حول النظام"
    },
    common: {
      loading: "جاري التحميل...",
      error: "حدث خطأ ما",
      success: "تمت العملية بنجاح",
      deleteConfirm: "هل أنت متأكد من الحذف؟"
    }
  }
};

export type Language = 'en' | 'ar';
