// Simulador de la Fase 1: dos chats lado a lado (cliente y tú) usando el mismo traductor que el bot.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.SIMULATOR_PORT) || 3000;
const ownerLanguage = process.env.OWNER_LANGUAGE || "es";

const app = express();
app.use(express.json());
app.use(express.static(path.join(here, "public")));

app.get("/api/config", (_req, res) => {
  res.json({ ownerLanguage, model: process.env.CLAUDE_MODEL || "claude-haiku-5-5" });
});

app.get("/api/scenarios", async (_req, res) => {
  const { scenarios } = await import("../scenario-data.js");
  res.json(scenarios);
});

app.post("/api/translate", async (req, res) => {
  const { text, target } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || typeof target !== "string") {
    res.status(400).json({ error: "Faltan los campos text y target." });
    return;
  }
  try {
    // Import diferido: el simulador arranca aunque falte la clave y muestra el error en pantalla.
    const { translate } = await import("../translator.js");
    const started = Date.now();
    const result = await translate(text, target);
    res.json({ ...result, ms: Date.now() - started });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(port, () => {
  console.log(`Simulador listo en http://localhost:${port}`);
});
