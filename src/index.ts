import { Bot } from "grammy";
import { config } from "./config.js";

// Punto de entrada del bot de Telegram (Fase 2). Por ahora solo comprueba la conexión.
if (!config.telegramBotToken) {
  console.log("TELEGRAM_BOT_TOKEN no está configurado. Para probar la traducción usa: npm run traducir");
  process.exit(0);
}

const bot = new Bot(config.telegramBotToken);

bot.command("start", (ctx) => ctx.reply("Bot de traducción de Encriptados activo."));

bot.catch((err) => console.error("Error en el bot:", err.error));

await bot.start({
  onStart: (me) => console.log(`Bot @${me.username} conectado. Modelo: ${config.claudeModel}`),
});
