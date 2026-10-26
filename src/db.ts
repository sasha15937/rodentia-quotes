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
    CREATE TABLE IF NOT EXISTS reactions (
        quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        visitor TEXT NOT NULL,
        kind TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (quote_id, visitor, kind)
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

export const REACTION_KINDS = ["fire", "heartfire", "heart", "arrowheart", "cry"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const isReactionKind = (k: string): k is ReactionKind =>
    (REACTION_KINDS as readonly string[]).includes(k);

export type Quote = {
    id: number;
    type: "single" | "dialog";
    status: "pending" | "approved";
    date: string;
    lines: { author: string; text: string }[];
    tags: string[];
    reactions: Record<string, number>; // сколько каких реакций
    mine: string[];                    // какие поставил этот посетитель
    total: number;                     // всего реакций
};

type ReactionCountRow = { quote_id: number; kind: string; n: number };
type MineRow = { quote_id: number; kind: string };

const loadQuotes = (status: Quote["status"] | null, visitor = ""): Quote[] => {
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

    const counts = db
        .prepare(`SELECT r.quote_id, r.kind, COUNT(*) AS n FROM reactions r
              JOIN quotes q ON q.id = r.quote_id ${where}
              GROUP BY r.quote_id, r.kind`)
        .all(...params) as ReactionCountRow[];

    const mine = db
        .prepare("SELECT quote_id, kind FROM reactions WHERE visitor = ?")
        .all(visitor) as MineRow[];

    return quotes.map((q) => {
        const reactions: Record<string, number> = {};
        for (const c of counts) {
            if (c.quote_id === q.id) reactions[c.kind] = c.n;
        }
        return {
            id: q.id,
            type: q.type,
            status: q.status,
            date: q.created_at,
            lines: lines.filter((l) => l.quote_id === q.id).map((l) => ({ author: l.author, text: l.text })),
            tags: tags.filter((t) => t.quote_id === q.id).map((t) => t.name),
            reactions,
            mine: mine.filter((m) => m.quote_id === q.id).map((m) => m.kind),
            total: Object.values(reactions).reduce((a, b) => a + b, 0),
        };
    });
};

export const getApprovedQuotes = (visitor = ""): Quote[] => loadQuotes("approved", visitor);
export const getAllQuotes = (): Quote[] => loadQuotes(null);

type QuoteRow = {
    id: number;
    type: "single" | "dialog";
    status: "pending" | "approved";
    created_at: string;
};

export const approveQuote = (id: number): boolean =>
    db.prepare("UPDATE quotes SET status = 'approved' WHERE id = ?").run(id).changes > 0;

export const deleteQuote = (id: number): boolean =>
    db.prepare("DELETE FROM quotes WHERE id = ?").run(id).changes > 0;

const dayNumber = (dateKey: string): number =>
    Math.floor(Date.parse(dateKey + "T00:00:00Z") / 86400000);

// перемешивает число, чтобы соседние дни давали несвязанные результаты
const mix = (n: number): number => {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
};

let dayCache: { dateKey: string; id: number } | null = null;

export const getQuoteOfTheDay = (dateKey: string, visitor = ""): Quote | null => {
    const all = loadQuotes("approved", visitor).sort((a, b) => a.id - b.id);
    // дальше без изменений
    if (all.length === 0) return null;

    const cached = dayCache;
    if (cached && cached.dateKey === dateKey) {
        const same = all.find((q) => q.id === cached.id);
        if (same) return same; // сегодня уже выбрана, и она всё ещё опубликована
    }

    const picked = all[mix(dayNumber(dateKey)) % all.length];
    if (!picked) return null;
    dayCache = { dateKey, id: picked.id };
    return picked;
};

const quoteIsApproved = db.prepare("SELECT 1 FROM quotes WHERE id = ? AND status = 'approved'");
const findReaction = db.prepare(
    "SELECT 1 FROM reactions WHERE quote_id = ? AND visitor = ? AND kind = ?"
);
const addReaction = db.prepare("INSERT INTO reactions (quote_id, visitor, kind) VALUES (?, ?, ?)");
const removeReaction = db.prepare(
    "DELETE FROM reactions WHERE quote_id = ? AND visitor = ? AND kind = ?"
);

type ToggleResult = "added" | "removed" | "missing";

const toggleReactionTx = db.transaction(
    (quoteId: number, visitor: string, kind: ReactionKind): ToggleResult => {
        if (!quoteIsApproved.get(quoteId)) return "missing"; // реакции только на опубликованные
        if (findReaction.get(quoteId, visitor, kind)) {
            removeReaction.run(quoteId, visitor, kind);
            return "removed";
        }
        addReaction.run(quoteId, visitor, kind);
        return "added";
    }
);

export const toggleReaction = (quoteId: number, visitor: string, kind: ReactionKind): ToggleResult =>
    toggleReactionTx(quoteId, visitor, kind);

export const getReactionState = (
    quoteId: number,
    visitor: string
): { reactions: Record<string, number>; mine: string[] } => {
    const rows = db
        .prepare("SELECT kind, COUNT(*) AS n FROM reactions WHERE quote_id = ? GROUP BY kind")
        .all(quoteId) as { kind: string; n: number }[];
    const mine = db
        .prepare("SELECT kind FROM reactions WHERE quote_id = ? AND visitor = ?")
        .all(quoteId, visitor) as { kind: string }[];
    return {
        reactions: Object.fromEntries(rows.map((r) => [r.kind, r.n])),
        mine: mine.map((m) => m.kind),
    };
};

export type TopQuote = Quote & { score: number };

export const getTopQuotes = (period: "month" | "all", visitor = "", limit = 10): TopQuote[] => {
    const since = period === "month" ? "AND r.created_at >= strftime('%Y-%m-01', 'now')" : "";
    const rows = db
        .prepare(`SELECT r.quote_id AS id, COUNT(*) AS score FROM reactions r
              JOIN quotes q ON q.id = r.quote_id
              WHERE q.status = 'approved' ${since}
              GROUP BY r.quote_id
              ORDER BY score DESC, r.quote_id DESC
              LIMIT ?`)
        .all(limit) as { id: number; score: number }[];

    const byId = new Map(loadQuotes("approved", visitor).map((q) => [q.id, q]));
    const result: TopQuote[] = [];
    for (const row of rows) {
        const quote = byId.get(row.id);
        if (quote) result.push({ ...quote, score: row.score });
    }
    return result;
};