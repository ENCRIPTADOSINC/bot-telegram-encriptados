// Bot de Telegram (Fase 2): los clientes escriben al bot en su idioma, los mensajes llegan traducidos
// al chat de agentes, y las respuestas (con "Responder" sobre el mensaje del cliente) vuelven traducidas.
import { Bot, type Context } from "grammy";
import { config } from "./config.js";
import { store } from "./store.js";
import { translate } from "./translator.js";

if (!config.telegramBotToken) {
  console.log("TELEGRAM_BOT_TOKEN no está configurado. Para probar la traducción usa: npm run simulador");
  process.exit(0);
}

const bot = new Bot(config.telegramBotToken);
const languageNames = new Intl.DisplayNames([config.ownerLanguage], { type: "language" });

function languageName(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const isAgentChat = (ctx: Context) => config.agentChatId !== undefined && ctx.chat?.id === config.agentChatId;

/** Idioma base de un usuario según su app de Telegram ("pt-br" -> "pt") */
const appLanguage = (ctx: Context) => ctx.from?.language_code?.split("-")[0];

// Devuelve el id del chat actual, para configurar AGENT_CHAT_ID.
bot.command("miid", (ctx) =>
  ctx.reply(`El ID de este chat es: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }),
);

bot.command("start", async (ctx) => {
  if (isAgentChat(ctx)) {
    await ctx.reply(
      "Este es el chat de agentes. Aquí llegan los mensajes de los clientes traducidos.\n" +
        "Para contestar, usa «Responder» sobre el mensaje del cliente y escribe en español.",
    );
    return;
  }
  const greeting = "¡Hola! 👋 Escríbenos en tu idioma y te responderemos en tu idioma.";
  const language = appLanguage(ctx) ?? "en";
  const text = language === config.ownerLanguage ? greeting : (await translate(greeting, language)).translation;
  await ctx.reply(text);
});

// ── Cliente -> agentes ────────────────────────────────────────────────────────
bot.on("message", async (ctx, next) => {
  if (isAgentChat(ctx)) return next();
  if (ctx.chat.type !== "private") return; // el bot solo atiende clientes por chat privado
  if (config.agentChatId === undefined) {
    await ctx.reply("El bot todavía no está configurado (falta AGENT_CHAT_ID).");
    return;
  }

  const agentChat = config.agentChatId;
  const from = ctx.message.from;
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const original = ctx.message.text ?? ctx.message.caption;

  let language = store.getClient(ctx.chat.id)?.language ?? appLanguage(ctx) ?? "en";
  let body = "";
  if (original) {
    try {
      const result = await translate(original, config.ownerLanguage);
      if (result.sourceLanguage && result.sourceLanguage !== config.ownerLanguage) {
        language = result.sourceLanguage;
      }
      body = escapeHtml(result.translation);
      if (result.translation !== original) {
        body += `\n<blockquote expandable>${escapeHtml(original)}</blockquote>`;
      }
    } catch (err) {
      console.error("Error al traducir mensaje del cliente:", err);
      body = `⚠️ No se pudo traducir. Mensaje original:\n${escapeHtml(original)}`;
    }
  }
  store.setClient(ctx.chat.id, { name, language });

  const username = from.username ? ` @${from.username}` : "";
  const header = `👤 <b>${escapeHtml(name)}</b>${username} · ${languageName(language)}`;
  const text = body ? `${header}\n\n${body}` : header;

  if (ctx.message.text) {
    const sent = await ctx.api.sendMessage(agentChat, text, { parse_mode: "HTML" });
    store.link(ctx.chat.id, sent.message_id);
  } else {
    // Fotos, audios, archivos, stickers...: se copia el contenido y debajo va la traducción del pie de foto.
    const copied = await ctx.api.copyMessage(
      agentChat,
      ctx.chat.id,
      ctx.message.message_id,
      ctx.message.caption ? { caption: "" } : {},
    );
    const sent = await ctx.api.sendMessage(agentChat, text, {
      parse_mode: "HTML",
      reply_parameters: { message_id: copied.message_id },
    });
    store.link(ctx.chat.id, copied.message_id, sent.message_id);
  }
});

// ── Agentes -> cliente ────────────────────────────────────────────────────────
bot.on("message", async (ctx) => {
  const replyTo = ctx.message.reply_to_message;
  const clientChatId = replyTo ? store.clientFor(replyTo.message_id) : undefined;
  if (clientChatId === undefined) {
    // En un grupo los agentes pueden hablar entre ellos; solo se avisa en chat privado.
    if (ctx.chat.type === "private") {
      await ctx.reply("Para contestar a un cliente, usa «Responder» sobre su mensaje.");
    }
    return;
  }

  const client = store.getClient(clientChatId);
  const language = client?.language ?? "en";
  const original = ctx.message.text ?? ctx.message.caption;

  try {
    const translation = original ? (await translate(original, language)).translation : undefined;
    if (ctx.message.text) {
      await ctx.api.sendMessage(clientChatId, translation!);
    } else {
      await ctx.api.copyMessage(clientChatId, ctx.chat.id, ctx.message.message_id, { caption: translation });
    }
    const confirmation = await ctx.reply(
      translation
        ? `✅ Enviado a ${escapeHtml(client?.name ?? "cliente")} en ${languageName(language)}:\n<blockquote>${escapeHtml(translation)}</blockquote>`
        : `✅ Enviado a ${escapeHtml(client?.name ?? "cliente")}`,
      { parse_mode: "HTML", reply_parameters: { message_id: ctx.message.message_id } },
    );
    // Responder a la confirmación también le escribe al mismo cliente.
    store.link(clientChatId, confirmation.message_id);
  } catch (err) {
    console.error("Error al enviar respuesta al cliente:", err);
    await ctx.reply(`⚠️ No se pudo enviar: ${escapeHtml(err instanceof Error ? err.message : String(err))}`, {
      parse_mode: "HTML",
      reply_parameters: { message_id: ctx.message.message_id },
    });
  }
});

bot.catch((err) => console.error("Error en el bot:", err.error));

await bot.start({
  onStart: (me) => {
    console.log(`Bot @${me.username} conectado. Modelo: ${config.claudeModel}`);
    if (config.agentChatId === undefined) {
      console.log("Falta AGENT_CHAT_ID: envía /miid al bot desde tu chat (o grupo de agentes) y ponlo en .env.");
    }
  },
});
