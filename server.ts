import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const db = new Database("library.db");

  // Initialize DB Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      classification_number TEXT,
      edition_number TEXT,
      isbn TEXT UNIQUE,
      quantity INTEGER DEFAULT 1,
      sector TEXT,
      shelf_number TEXT,
      status TEXT CHECK(status IN ('Available', 'Borrowed', 'Out of Stock')) DEFAULT 'Available'
    );

    CREATE TABLE IF NOT EXISTS borrowing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      student_name TEXT NOT NULL,
      student_id TEXT NOT NULL,
      college_name TEXT,
      faculty_name TEXT,
      academic_year TEXT,
      borrow_date DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expected_return_date DATETIME,
      return_date DATETIME,
      FOREIGN KEY(book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('current_dr', 'Dr. Mohamed Ali');
  `);

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---

  // Settings
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const map = (settings as any[]).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    res.json(map);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  // Students Aggregation
  app.get("/api/students/:id/history", (req, res) => {
    const history = db.prepare(`
      SELECT b.*, bk.title as book_title, bk.isbn
      FROM borrowing b
      JOIN books bk ON b.book_id = bk.id
      WHERE b.student_id = ?
      ORDER BY b.borrow_date DESC
    `).all(req.params.id);
    res.json(history);
  });
  app.get("/api/students", (req, res) => {
    const students = db.prepare(`
      SELECT 
        student_id, 
        student_name, 
        college_name, 
        faculty_name, 
        academic_year,
        COUNT(*) as total_borrows,
        SUM(CASE WHEN return_date IS NULL THEN 1 ELSE 0 END) as active_borrows
      FROM borrowing
      GROUP BY student_id
      ORDER BY total_borrows DESC
    `).all();
    res.json(students);
  });

  // Bulk SQL Import
  app.post("/api/import-sql", (req, res) => {
    const { sql } = req.body;
    try {
      db.exec(sql);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Books
  app.get("/api/books", (req, res) => {
    const books = db.prepare(`
      SELECT b.*, 
      (SELECT COUNT(*) FROM borrowing WHERE book_id = b.id AND return_date IS NULL) as current_borrows
      FROM books b
    `).all();
    res.json(books);
  });

  app.post("/api/books", (req, res) => {
    const { title, author, publisher, classification_number, edition_number, isbn, quantity, sector, shelf_number } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO books (title, author, publisher, classification_number, edition_number, isbn, quantity, sector, shelf_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title, author, publisher, classification_number, edition_number, isbn, quantity || 1, sector, shelf_number);
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/books/:id", (req, res) => {
    const { title, author, publisher, classification_number, edition_number, isbn, quantity, sector, shelf_number } = req.body;
    db.prepare(`
      UPDATE books SET title=?, author=?, publisher=?, classification_number=?, edition_number=?, isbn=?, quantity=?, sector=?, shelf_number=?
      WHERE id=?
    `).run(title, author, publisher, classification_number, edition_number, isbn, quantity || 1, sector, shelf_number, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/books/:id", (req, res) => {
    db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Borrowing
  app.get("/api/borrowing", (req, res) => {
    const history = db.prepare(`
      SELECT b.*, bk.title as book_title 
      FROM borrowing b 
      JOIN books bk ON b.book_id = bk.id 
      ORDER BY borrow_date DESC
    `).all();
    res.json(history);
  });

  app.post("/api/borrowing", (req, res) => {
    const { book_id, student_name, student_id, college_name, faculty_name, academic_year, duration_days } = req.body;
    
    const expectedReturn = new Date();
    expectedReturn.setDate(expectedReturn.getDate() + parseInt(duration_days || 7));

    const transaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO borrowing (book_id, student_name, student_id, college_name, faculty_name, academic_year, expected_return_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(book_id, student_name, student_id, college_name, faculty_name, academic_year, expectedReturn.toISOString());
      
      db.prepare("UPDATE books SET status = 'Borrowed' WHERE id = ?").run(book_id);
    });
    
    try {
      transaction();
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/return/:id", (req, res) => {
    const borrowingId = req.params.id;
    const transaction = db.transaction(() => {
      const record = db.prepare("SELECT book_id FROM borrowing WHERE id = ?").get() as any;
      if (record) {
        db.prepare("UPDATE borrowing SET return_date = (strftime('%Y-%m-%dT%H:%M:%fZ', \'now\')) WHERE id = ?").run(borrowingId);
        db.prepare("UPDATE books SET status = 'Available' WHERE id = ?").run(record.book_id);
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
