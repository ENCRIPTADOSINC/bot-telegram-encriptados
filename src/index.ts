// Bot de Telegram (Fase 2): los clientes escriben en su idioma (al bot o a la cuenta de empresa conectada
// con Telegram Business), los mensajes llegan traducidos al chat de agentes, y las respuestas (con
// "Responder" sobre el mensaje del cliente) vuelven traducidas por la misma vía.
import { Bot, type Context } from "grammy";
import type { Message } from "grammy/types";
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
// Los clientes llegan por dos vías: escribiendo directo al bot, o escribiendo a la cuenta de empresa
// conectada al bot con Telegram Business (Ajustes -> Telegram Business -> Chatbots).

/**
 * Reenvía fotos, audios, archivos... por su file_id. Se usa con Telegram Business, donde copyMessage
 * no sirve para enviar en nombre de la cuenta. Devuelve undefined si el tipo de mensaje no está soportado.
 */
function sendMedia(
  api: Context["api"],
  chatId: number,
  msg: Message,
  options: {
    caption?: string;
    business_connection_id?: string;
    message_thread_id?: number;
    reply_parameters?: { message_id: number };
  },
) {
  const { caption, ...other } = options;
  if (msg.photo) return api.sendPhoto(chatId, msg.photo.at(-1)!.file_id, { ...other, caption });
  if (msg.animation) return api.sendAnimation(chatId, msg.animation.file_id, { ...other, caption });
  if (msg.video) return api.sendVideo(chatId, msg.video.file_id, { ...other, caption });
  if (msg.document) return api.sendDocument(chatId, msg.document.file_id, { ...other, caption });
  if (msg.audio) return api.sendAudio(chatId, msg.audio.file_id, { ...other, caption });
  if (msg.voice) return api.sendVoice(chatId, msg.voice.file_id, { ...other, caption });
  if (msg.video_note) return api.sendVideoNote(chatId, msg.video_note.file_id, other);
  if (msg.sticker) return api.sendSticker(chatId, msg.sticker.file_id, other);
  return undefined;
}

/** El chat de agentes es un grupo con temas: cada cliente tiene su propio tema */
let agentChatHasTopics: boolean | undefined;

/** Tema del cliente en el chat de agentes (lo crea la primera vez), o undefined si el chat no tiene temas */
async function topicFor(api: Context["api"], clientChatId: number, name: string, language: string) {
  const agentChat = config.agentChatId!;
  const existing = store.getTopic(agentChat, clientChatId);
  if (existing !== undefined) return existing;
  agentChatHasTopics ??= (await api.getChat(agentChat)).is_forum === true;
  if (!agentChatHasTopics) return undefined;
  const topic = await api.createForumTopic(agentChat, `${name} · ${languageName(language)}`.slice(0, 128));
  store.setTopic(agentChat, clientChatId, topic.message_thread_id);
  return topic.message_thread_id;
}

/** Si el mensaje trae contenido que se puede enviar (foto, audio, archivo...) */
const sendableMedia = (msg: Message) =>
  Boolean(
    msg.photo || msg.animation || msg.video || msg.document || msg.audio || msg.voice || msg.video_note || msg.sticker,
  );

async function forwardToAgents(ctx: Context, msg: Message, businessConnectionId?: string) {
  const agentChat = config.agentChatId!;
  const clientChatId = msg.chat.id;
  const from = msg.from!;
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const original = msg.text ?? msg.caption;

  let language = store.getClient(clientChatId)?.language ?? from.language_code?.split("-")[0] ?? "en";
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
  store.setClient(clientChatId, { name, language, businessConnectionId });

  const username = from.username ? ` @${from.username}` : "";
  const header = `👤 <b>${escapeHtml(name)}</b>${username} · ${languageName(language)}`;
  const text = body ? `${header}\n\n${body}` : header;

  const deliver = async (topic: number | undefined) => {
    const where = topic === undefined ? {} : { message_thread_id: topic };
    if (msg.text) {
      const sent = await ctx.api.sendMessage(agentChat, text, { parse_mode: "HTML", ...where });
      store.link(clientChatId, sent.message_id);
      return;
    }
    // Fotos, audios, archivos, stickers...: se copia el contenido y debajo va la traducción del pie de foto.
    const copied = businessConnectionId
      ? await sendMedia(ctx.api, agentChat, msg, where)
      : await ctx.api.copyMessage(agentChat, clientChatId, msg.message_id, {
          ...where,
          ...(msg.caption && { caption: "" }),
        });
    const sent = await ctx.api.sendMessage(agentChat, copied ? text : `${text}\n\n<i>(contenido no soportado)</i>`, {
      parse_mode: "HTML",
      ...where,
      ...(copied && { reply_parameters: { message_id: copied.message_id } }),
    });
    store.link(clientChatId, sent.message_id, ...(copied ? [copied.message_id] : []));
  };

  const topic = await topicFor(ctx.api, clientChatId, name, language);
  try {
    await deliver(topic);
  } catch (err) {
    // Si un agente borró el tema del cliente, se crea uno nuevo.
    if (topic === undefined || !String(err).includes("thread not found")) throw err;
    store.setTopic(agentChat, clientChatId, undefined);
    await deliver(await topicFor(ctx.api, clientChatId, name, language));
  }
}

bot.on("message", async (ctx, next) => {
  if (isAgentChat(ctx)) return next();
  if (ctx.chat.type !== "private") return; // el bot solo atiende clientes por chat privado
  if (config.agentChatId === undefined) {
    await ctx.reply("El bot todavía no está configurado (falta AGENT_CHAT_ID).");
    return;
  }
  await forwardToAgents(ctx, ctx.message);
});

bot.on("business_message", async (ctx) => {
  const msg = ctx.businessMessage;
  // En el chat de empresa también llegan los mensajes de la propia cuenta (los que escribe a mano
  // o los que envía el bot en su nombre): solo se reenvían los del cliente.
  if (msg.from?.id !== msg.chat.id) return;
  if (config.agentChatId === undefined) {
    console.log("Mensaje de empresa ignorado: falta AGENT_CHAT_ID.");
    return;
  }
  await forwardToAgents(ctx, msg, ctx.businessConnectionId);
});

// ── Agentes -> cliente ────────────────────────────────────────────────────────
bot.on("message", async (ctx) => {
  const msg = ctx.message;
  // Avisos del sistema (tema creado, renombrado, alguien entró al grupo...) no se envían a nadie.
  if (!msg.text && !msg.caption && !sendableMedia(msg)) return;
  // Notas internas entre agentes: los mensajes que empiezan con // no se envían al cliente.
  if (msg.text?.startsWith("//")) return;

  // En un grupo con temas, todo lo que se escribe en el tema de un cliente le llega a ese cliente;
  // en los demás chats, hay que usar «Responder» sobre un mensaje del cliente.
  const clientChatId =
    msg.is_topic_message && msg.message_thread_id !== undefined
      ? store.clientForTopic(ctx.chat.id, msg.message_thread_id)
      : msg.reply_to_message
        ? store.clientFor(msg.reply_to_message.message_id)
        : undefined;
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
  // Si el cliente escribió a la cuenta de empresa, la respuesta sale desde esa cuenta.
  const business_connection_id = client?.businessConnectionId;

  try {
    const translation = original ? (await translate(original, language)).translation : undefined;
    if (ctx.message.text) {
      await ctx.api.sendMessage(clientChatId, translation!, { business_connection_id });
    } else if (business_connection_id) {
      const sent = await sendMedia(ctx.api, clientChatId, ctx.message, { caption: translation, business_connection_id });
      if (!sent) throw new Error("este tipo de mensaje no se puede enviar por la cuenta de empresa");
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
