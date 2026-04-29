# Desktop Library Management System (Python/PyQt6)

As requested, here is the complete code for the standalone desktop application.

## 1. Requirements
First, create a `requirements.txt` file:
```text
PyQt6==6.6.1
pandas==2.2.0
openpyxl==3.1.2
```

## 2. Python Code (`main.py`)
```python
import sys
import sqlite3
import pandas as pd
from datetime import datetime
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QTabWidget, QWidget, QVBoxLayout, 
    QHBoxLayout, QLabel, QLineEdit, QPushButton, QTableWidget, 
    QTableWidgetItem, QFormLayout, QComboBox, QMessageBox, QHeaderView
)
from PyQt6.QtCore import Qt

class LibrarySystem(QMainWindow):
    def __init__(self):
        super().__init__()
        self.lang = 'ar'  # Default language
        self.init_db()
        self.init_ui()
        self.update_ui_text()

    def init_db(self):
        self.conn = sqlite3.connect('desktop_library.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT, author TEXT, publisher TEXT, 
                classification TEXT, edition TEXT, isbn TEXT, status TEXT DEFAULT 'Available'
            )
        ''')
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS borrowings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER, student_name TEXT, student_id TEXT,
                college TEXT, faculty TEXT, academic_year TEXT,
                borrow_date TEXT, return_date TEXT,
                FOREIGN KEY(book_id) REFERENCES books(id)
            )
        ''')
        self.conn.commit()

    def init_ui(self):
        self.setWindowTitle("Library Pro")
        self.resize(1000, 700)
        
        self.tabs = QTabWidget()
        self.setCentralWidget(self.tabs)

        # Tab 1: Inventory
        self.tab_inventory = QWidget()
        self.layout_inv = QVBoxLayout()
        self.setup_inventory_ui()
        self.tab_inventory.setLayout(self.layout_inv)
        self.tabs.addTab(self.tab_inventory, "")

        # Tab 2: Borrowing
        self.tab_borrowing = QWidget()
        self.layout_bor = QVBoxLayout()
        self.setup_borrowing_ui()
        self.tab_borrowing.setLayout(self.layout_bor)
        self.tabs.addTab(self.tab_borrowing, "")

        # Tab 3: Settings
        self.tab_settings = QWidget()
        self.layout_set = QVBoxLayout()
        self.setup_settings_ui()
        self.tab_settings.setLayout(self.layout_set)
        self.tabs.addTab(self.tab_settings, "")

    def setup_inventory_ui(self):
        form = QFormLayout()
        self.book_fields = {
            'title': QLineEdit(), 'author': QLineEdit(), 'pub': QLineEdit(),
            'class': QLineEdit(), 'ed': QLineEdit(), 'isbn': QLineEdit()
        }
        for label, widget in self.book_fields.items(): form.addRow(label, widget)
        
        btn_save = QPushButton("Save")
        btn_save.clicked.connect(self.add_book)
        form.addRow(btn_save)
        
        self.table_books = QTableWidget()
        self.table_books.setColumnCount(7)
        self.table_books.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        
        self.layout_inv.addLayout(form)
        self.layout_inv.addWidget(self.table_books)
        self.refresh_books()

    def setup_borrowing_ui(self):
        form = QFormLayout()
        self.bor_book_select = QComboBox()
        form.addRow("Book", self.bor_book_select)
        
        self.bor_fields = {
            'name': QLineEdit(), 'sid': QLineEdit(), 'coll': QLineEdit(),
            'faculty': QLineEdit(), 'year': QLineEdit()
        }
        for label, widget in self.bor_fields.items(): form.addRow(label, widget)
        
        btn_borrow = QPushButton("Register")
        btn_borrow.clicked.connect(self.register_borrow)
        form.addRow(btn_borrow)
        
        self.table_bor = QTableWidget()
        self.table_bor.setColumnCount(5)
        self.table_bor.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        
        self.layout_bor.addLayout(form)
        self.layout_bor.addWidget(self.table_bor)
        self.refresh_borrowing()

    def setup_settings_ui(self):
        self.btn_lang = QPushButton("Switch to English")
        self.btn_lang.clicked.connect(self.toggle_lang)
        
        btn_exp_inv = QPushButton("Export Inventory to Excel")
        btn_exp_inv.clicked.connect(lambda: self.export_excel('books'))
        
        btn_exp_bor = QPushButton("Export Borrowing to Excel")
        btn_exp_bor.clicked.connect(lambda: self.export_excel('borrowings'))
        
        self.layout_set.addWidget(self.btn_lang)
        self.layout_set.addWidget(btn_exp_inv)
        self.layout_set.addWidget(btn_exp_bor)

    def toggle_lang(self):
        self.lang = 'en' if self.lang == 'ar' else 'ar'
        self.update_ui_text()

    def update_ui_text(self):
        is_rtl = self.lang == 'ar'
        self.setLayoutDirection(Qt.LayoutDirection.RightToLeft if is_rtl else Qt.LayoutDirection.LeftToRight)
        
        labels = {
            'ar': ["الجرد", "الإعارة", "الإعدادات", "تبديل إلى الانجليزية"],
            'en': ["Inventory", "Borrowing", "Settings", "Switch to Arabic"]
        }
        curr = labels[self.lang]
        self.tabs.setTabText(0, curr[0])
        self.tabs.setTabText(1, curr[1])
        self.tabs.setTabText(2, curr[2])
        self.btn_lang.setText(curr[3])

    def add_book(self):
        data = [w.text() for w in self.book_fields.values()]
        self.cursor.execute("INSERT INTO books (title, author, publisher, classification, edition, isbn) VALUES (?,?,?,?,?,?)", data)
        self.conn.commit()
        self.refresh_books()

    def refresh_books(self):
        self.cursor.execute("SELECT * FROM books")
        rows = self.cursor.fetchall()
        self.table_books.setRowCount(len(rows))
        self.bor_book_select.clear()
        for i, row in enumerate(rows):
            for j, val in enumerate(row):
                self.table_books.setItem(i, j, QTableWidgetItem(str(val)))
            if row[7] == 'Available':
                self.bor_book_select.addItem(row[1], row[0])

    def register_borrow(self):
        book_id = self.bor_book_select.currentData()
        data = [book_id] + [w.text() for w in self.bor_fields.values()] + [datetime.now().strftime("%Y-%m-%d %H:%M")]
        self.cursor.execute("INSERT INTO borrowings (book_id, student_name, student_id, college, faculty, academic_year, borrow_date) VALUES (?,?,?,?,?,?,?)", data)
        self.cursor.execute("UPDATE books SET status='Borrowed' WHERE id=?", (book_id,))
        self.conn.commit()
        self.refresh_books()
        self.refresh_borrowing()

    def refresh_borrowing(self):
        self.cursor.execute("SELECT b.student_name, bk.title, b.borrow_date, b.return_date, b.id FROM borrowings b JOIN books bk ON b.book_id = bk.id")
        rows = self.cursor.fetchall()
        self.table_bor.setRowCount(len(rows))
        for i, row in enumerate(rows):
            for j, val in enumerate(row):
                self.table_bor.setItem(i, j, QTableWidgetItem(str(val)))

    def export_excel(self, table):
        df = pd.read_sql_query(f"SELECT * FROM {table}", self.conn)
        df.to_excel(f"{table}_report.xlsx", index=False)
        QMessageBox.information(self, "Success", f"Data exported to {table}_report.xlsx")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = LibrarySystem()
    window.show()
    sys.exit(app.exec())
```

## 3. Compilation Instructions (PyInstaller)
To compile this script into a single executable for Windows:

1. Install PyInstaller:
   ```bash
   pip install pyinstaller
   ```

2. Run the compilation command:
   ```bash
   pyinstaller --noconsole --onefile --name "LibraryMasterPro" main.py
   ```

- `--noconsole`: Removes the background terminal window.
- `--onefile`: Bundles everything into a single `.exe`.
- `--name`: Sets the final name of the application.

The `.exe` will be located in the `dist/` folder after the process finishes.
