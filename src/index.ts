import express, {type Express, type Request, type Response} from "express";
import * as path from "node:path";


const app: Express = express();

app.use("/", express.static(path.join(process.cwd(), "static")));

function randomChoice<T>(list: T[]): T | undefined {
    return list[Math.floor(Math.random() * list.length)];
}

app.get("/get_quote", (req: Request, res: Response) => {
    const quotes = [
        "hello homik",
        "test1",
        "test2",
        "test3",
        "test4"
    ];
    const quote = randomChoice<string>(quotes);
    if (quote !== undefined) res.send(quote);
    res.status(500);
});

app.listen(3000);