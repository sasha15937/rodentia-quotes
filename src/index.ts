import express, { type Express, type Request, type Response } from "express";
import * as path from "node:path";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { createQuote, updateQuote, getApprovedQuotes, getAllQuotes, approveQuote, deleteQuote, getQuoteOfTheDay, isReactionKind, toggleReaction, getReactionState, getTopQuotes } from "./db.js";
import "dotenv/config";
import { rateLimit } from "express-rate-limit";



const app: Express = express();

app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 0));
app.use(express.json());
app.use("/", express.static(path.join(process.cwd(), "static"), { extensions: ["html"] }));

app.use(cookieParser());

app.use((req, res, next) => {
    let id = req.cookies?.visitor as string | undefined;
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
        id = randomUUID();
        res.cookie("visitor", id, {
            httpOnly: true,           // скрипт на странице не может прочитать куку
            sameSite: "lax",          // чужие сайты не могут отправлять её от вашего имени
            secure: req.secure,       // на HTTPS кука помечается защищённой
            maxAge: 365 * 24 * 60 * 60 * 1000,
        });
    }
    res.locals.visitor = id;
    next();
});

const createQuoteLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,      // окно в один час
    limit: 10,                      // не больше 10 цитат за окно с одного IP
    skipFailedRequests: true,      // запросы с ошибкой (400) в счёт не идут
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Слишком много цитат с вашего адреса. Попробуйте позже." },
});

app.post("/api/quotes", createQuoteLimiter, (req, res) => {
    const parsed = QuoteInputSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Некорректные данные",
            details: parsed.error.issues.map((i) => i.message),
        });
    }

    const quote = { ...parsed.data, status: "pending" as const };
    const id = createQuote(parsed.data);
    res.status(201).json({ ok: true, id });
});

app.get("/api/quotes", (_req, res) => {
    res.json(getApprovedQuotes(res.locals.visitor as string));
});

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Omsk";

app.get("/api/quote-of-the-day", (_req, res) => {
    // формат "sv-SE" даёт дату как 2026-10-25
    const dateKey = new Date().toLocaleDateString("sv-SE", { timeZone: APP_TIMEZONE });
    const quote = getQuoteOfTheDay(dateKey, res.locals.visitor as string);
    if (!quote) {
        res.status(404).json({ error: "Пока нет цитат" });
        return;
    }
    res.json(quote);
});

const LineSchema = z.object({
    author: z.string().trim().max(40),
    text: z.string().trim().min(1).max(1000),
});

const QuoteInputSchema = z
    .object({
        type: z.enum(["single", "dialog"]),
        lines: z.array(LineSchema).min(1).max(30),
        tags: z
            .array(z.string().trim().toLowerCase().min(1).max(20))
            .max(3)
            .transform((tags) => [...new Set(tags)]), // убрать повторы
    })
    .superRefine((q, ctx) => {
        if (q.type === "single") {
            if (q.lines.length !== 1) {
                ctx.addIssue({ code: "custom", message: "В одиночной цитате должна быть одна реплика" });
            } else if (!q.lines[0]?.author) {
                ctx.addIssue({ code: "custom", message: "Укажите, кто сказал" });
            }
        } else {
            if (q.lines.length < 2) {
                ctx.addIssue({ code: "custom", message: "В диалоге минимум две реплики" });
            }
            if (q.lines.every((l) => !l.author)) {
                ctx.addIssue({ code: "custom", message: "Укажите автора хотя бы у одной реплики" });
            }
        }
    });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const safeEqual = (a: string, b: string): boolean => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
};

// Проверка пароля (HTTP Basic: браузер сам покажет окно входа)
const adminAuth: RequestHandler = (req, res, next) => {
    if (!ADMIN_PASSWORD) {
        res.status(503).send("Админка выключена: не задан ADMIN_PASSWORD");
        return;
    }
    const header = req.headers.authorization ?? "";
    if (header.startsWith("Basic ")) {
        const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
        const password = decoded.slice(decoded.indexOf(":") + 1);
        if (safeEqual(password, ADMIN_PASSWORD)) {
            next();
            return;
        }
    }
    res.set("WWW-Authenticate", 'Basic realm="admin"').status(401).send("Нужен пароль");
};

// Защита от «чужих» сайтов: изменяющие запросы должны нести наш заголовок
const adminCsrf: RequestHandler = (req, res, next) => {
    if (req.method !== "GET" && req.get("x-requested-with") !== "admin") {
        res.status(403).send("Запрещено");
        return;
    }
    next();
};

const admin = express.Router();
admin.use(adminAuth);
admin.use(adminCsrf);
admin.use(express.static(path.join(process.cwd(), "admin"))); // страница админки

admin.get("/api/quotes", (_req, res) => {
    res.json(getAllQuotes());
});

admin.post("/api/quotes/:id/approve", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Плохой id" }); return; }
    res.json({ ok: approveQuote(id) });
});

admin.delete("/api/quotes/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Плохой id" }); return; }
    res.json({ ok: deleteQuote(id) });
});

admin.put("/api/quotes/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Плохой id" }); return; }

    const parsed = QuoteInputSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Некорректные данные",
            details: parsed.error.issues.map((i) => i.message),
        });
        return;
    }

    res.json({ ok: updateQuote(id, parsed.data) });
});

const reactionLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Слишком часто. Подождите минуту." },
});

app.post("/api/quotes/:id/reactions/:kind", reactionLimiter, (req, res) => {
    const id = Number(req.params.id);
    const kind = String(req.params.kind);
    const visitor = res.locals.visitor as string;

    if (!Number.isInteger(id) || !isReactionKind(kind)) {
        res.status(400).json({ error: "Плохой запрос" });
        return;
    }
    const result = toggleReaction(id, visitor, kind);
    if (result === "missing") {
        res.status(404).json({ error: "Цитата не найдена" });
        return;
    }
    res.json({ result, ...getReactionState(id, visitor) });
});

app.get("/api/top", (req, res) => {
    const period = req.query.period === "month" ? "month" : "all";
    res.json(getTopQuotes(period, res.locals.visitor as string));
});

app.use("/admin", admin);

app.listen(3000);