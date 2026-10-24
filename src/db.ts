import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "quotes.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('single', 'dialog')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS quote_tags (
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (quote_id, tag_id)
  );
`);

export type QuoteInput = {
    type: "single" | "dialog";
    lines: { author: string; text: string }[];
    tags: string[];
};

const insertQuote = db.prepare("INSERT INTO quotes (type) VALUES (?)");
const insertLine = db.prepare(
    "INSERT INTO lines (quote_id, position, author, text) VALUES (?, ?, ?, ?)"
);
const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
const linkTag = db.prepare("INSERT OR IGNORE INTO quote_tags (quote_id, tag_id) VALUES (?, ?)");

const writeLinesAndTags = (quoteId: number, q: QuoteInput): void => {
    q.lines.forEach((l, i) => insertLine.run(quoteId, i, l.author, l.text));
    for (const name of q.tags) {
        insertTag.run(name);
        const tag = findTag.get(name) as { id: number };
        linkTag.run(quoteId, tag.id);
    }
};

const createQuoteTx = db.transaction((q: QuoteInput) => {
    const quoteId = Number(insertQuote.run(q.type).lastInsertRowid);
    writeLinesAndTags(quoteId, q);
    return quoteId;
});

export const createQuote = (q: QuoteInput): number => createQuoteTx(q);

const updateType = db.prepare("UPDATE quotes SET type = ? WHERE id = ?");
const deleteLines = db.prepare("DELETE FROM lines WHERE quote_id = ?");
const deleteQuoteTags = db.prepare("DELETE FROM quote_tags WHERE quote_id = ?");

const updateQuoteTx = db.transaction((id: number, q: QuoteInput): boolean => {
    if (updateType.run(q.type, id).changes === 0) return false; // такой цитаты нет
    deleteLines.run(id);
    deleteQuoteTags.run(id);
    writeLinesAndTags(id, q);
    return true;
});

export const updateQuote = (id: number, q: QuoteInput): boolean => updateQuoteTx(id, q);
// type QuoteRow = { id: number; type: "single" | "dialog"; created_at: string };
type LineRow = { quote_id: number; author: string; text: string };
type TagRow = { quote_id: number; name: string };

export type Quote = {
    id: number;
    type: "single" | "dialog";
    status: "pending" | "approved";
    date: string;
    lines: { author: string; text: string }[];
    tags: string[];
};

type QuoteRow = {
    id: number;
    type: "single" | "dialog";
    status: "pending" | "approved";
    created_at: string;
};

const loadQuotes = (status: Quote["status"] | null): Quote[] => {
    const where = status ? "WHERE q.status = ?" : "";
    const params: string[] = status ? [status] : [];

    const quotes = db
        .prepare(`SELECT q.id, q.type, q.status, q.created_at FROM quotes q ${where} ORDER BY q.id DESC`)
        .all(...params) as QuoteRow[];

    const lines = db
        .prepare(`SELECT l.quote_id, l.author, l.text FROM lines l
              JOIN quotes q ON q.id = l.quote_id ${where}
              ORDER BY l.quote_id, l.position`)
        .all(...params) as LineRow[];

    const tags = db
        .prepare(`SELECT qt.quote_id, t.name FROM quote_tags qt
              JOIN tags t ON t.id = qt.tag_id
              JOIN quotes q ON q.id = qt.quote_id ${where}`)
        .all(...params) as TagRow[];

    return quotes.map((q) => ({
        id: q.id,
        type: q.type,
        status: q.status,
        date: q.created_at,
        lines: lines.filter((l) => l.quote_id === q.id).map((l) => ({ author: l.author, text: l.text })),
        tags: tags.filter((t) => t.quote_id === q.id).map((t) => t.name),
    }));
};

export const getApprovedQuotes = (): Quote[] => loadQuotes("approved");
export const getAllQuotes = (): Quote[] => loadQuotes(null);

export const approveQuote = (id: number): boolean =>
    db.prepare("UPDATE quotes SET status = 'approved' WHERE id = ?").run(id).changes > 0;

export const deleteQuote = (id: number): boolean =>
    db.prepare("DELETE FROM quotes WHERE id = ?").run(id).changes > 0;