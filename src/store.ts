// Almacén mínimo en un archivo JSON: idioma de cada cliente y qué mensaje del chat de agentes
// corresponde a qué cliente (para saber a quién va cada respuesta). Sobrevive a reinicios del bot.
import fs from "node:fs";
import path from "node:path";

export interface ClientInfo {
  name: string;
  language: string;
}

interface Data {
  clients: Record<string, ClientInfo>;
  /** id de mensaje en el chat de agentes -> id del chat del cliente */
  threads: Record<string, number>;
}

const FILE = path.resolve("data", "store.json");

function load(): Data {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as Data;
  } catch {
    return { clients: {}, threads: {} };
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
};
