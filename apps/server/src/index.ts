import "dotenv/config";
import express from "express";
import cors from "cors";
import { router } from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(router);

const port = Number(process.env.PORT || 4020);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
