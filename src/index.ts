import express, {type Express, type Request, type Response} from "express";
import * as path from "node:path";


const app: Express = express();

app.use("/", express.static(path.join(process.cwd(), "static")));



app.listen(3000);