// Almacén mínimo en un archivo JSON: idioma de cada cliente y qué mensaje del chat de agentes
// corresponde a qué cliente (para saber a quién va cada respuesta). Sobrevive a reinicios del bot.
import fs from "node:fs";
import path from "node:path";

export interface ClientInfo {
  name: string;
  language: string;
  /** Idioma fijado por un agente con /idioma: no cambia aunque el cliente escriba en otro */
  languageLocked?: boolean;
  /** Si el cliente escribió a la cuenta de empresa (Telegram Business), la conexión por la que se le responde */
  businessConnectionId?: string;
  /** Último mensaje del cliente en la cuenta de empresa, para marcarlo como leído al responder */
  lastMessageId?: number;
  /** Fecha (unix, segundos) del último mensaje del cliente */
  lastMessageAt?: number;
}

interface Data {
  clients: Record<string, ClientInfo>;
  /** id de mensaje en el chat de agentes -> id del chat del cliente */
  threads: Record<string, number>;
  /** "<chat de agentes>:<chat del cliente>" -> id del tema del cliente en un grupo con temas */
  topics: Record<string, number>;
}

const FILE = path.resolve("data", "store.json");

function load(): Data {
  try {
    return { clients: {}, threads: {}, topics: {}, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return { clients: {}, threads: {}, topics: {} };
  }
}

const data = load();

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export const store = {
  getClient(chatId: number): ClientInfo | undefined {
    return data.clients[chatId];
  },
  setClient(chatId: number, info: ClientInfo) {
    data.clients[chatId] = info;
    save();
  },
  /** Asocia mensajes del chat de agentes con el cliente al que pertenecen */
  link(clientChatId: number, ...agentMessageIds: number[]) {
    for (const id of agentMessageIds) data.threads[id] = clientChatId;
    save();
  },
  clientFor(agentMessageId: number): number | undefined {
    return data.threads[agentMessageId];
  },
  getTopic(agentChatId: number, clientChatId: number): number | undefined {
    return data.topics[`${agentChatId}:${clientChatId}`];
  },
  setTopic(agentChatId: number, clientChatId: number, topicId: number | undefined) {
    if (topicId === undefined) delete data.topics[`${agentChatId}:${clientChatId}`];
    else data.topics[`${agentChatId}:${clientChatId}`] = topicId;
    save();
  },
  clientForTopic(agentChatId: number, topicId: number): number | undefined {
    const key = Object.keys(data.topics).find(
      (k) => k.startsWith(`${agentChatId}:`) && data.topics[k] === topicId,
    );
    return key === undefined ? undefined : Number(key.split(":")[1]);
  },
};
