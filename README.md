# bot-telegram-encriptados

Bot de Telegram para traducir en tiempo real, en ambos sentidos, los chats de atención al cliente de Encriptados.
El cliente escribe en su idioma y tú lo lees en español; tú respondes en español y al cliente le llega en su idioma.
La traducción usa Claude (Haiku 5.5) y detecta el idioma del cliente automáticamente.

## Requisitos

- Node.js 24 o superior
- Una clave de API de Claude ([platform.claude.com](https://platform.claude.com) → API Keys)
- Desde la Fase 2: un bot creado con @BotFather y Telegram Premium en la cuenta que atiende clientes

## Instalación

```bash
npm install
cp .env.example .env   # y completa ANTHROPIC_API_KEY
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run simulador` | Simulador de chat en http://localhost:3000 (cliente y tú, lado a lado, con escenarios de prueba) |
| `npm run traducir -- "texto" es` | Traduce un mensaje desde la terminal |
| `npm run escenarios` | Ejecuta las conversaciones de prueba en varios idiomas |
| `npm run dev` | Arranca el bot de Telegram en tu PC (Fase 2) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |

## Estructura

- `src/translator.ts`: traducción con Claude
- `src/scenario-data.ts`: conversaciones de prueba
- `src/simulator/`: simulador web (Fase 1)
- `src/index.ts`: bot de Telegram (Fase 2)
- `src/store.ts`: idioma de cada cliente y a qué cliente pertenece cada mensaje (`data/store.json`)

## Bot de Telegram (Fase 2)

Los clientes escriben al bot en su idioma. Los mensajes llegan traducidos al **chat de agentes**
(tu chat privado con el bot o un grupo del equipo). Para contestar, usa **Responder** sobre el mensaje
del cliente y escribe en español: al cliente le llega en su idioma.

1. En Telegram, abre **@BotFather**, envía `/newbot` y copia el token en `.env` (`TELEGRAM_BOT_TOKEN`).
2. Arranca el bot con `npm run dev`.
3. Desde el chat de agentes (tu chat con el bot, o un grupo donde agregaste el bot), envía `/miid`.
   Copia el número en `.env` (`AGENT_CHAT_ID`) y reinicia el bot.
4. Desde otra cuenta de Telegram (el "cliente"), abre el bot, envía `/start` y escribe en otro idioma.

Funciona con texto, fotos, audios, archivos y stickers; los pies de foto también se traducen.

### Atender los chats de la cuenta de empresa (Telegram Business)

Para que el bot traduzca los mensajes que los clientes envían a la cuenta de la empresa (por ejemplo
@encriptados) y responda en su nombre. La cuenta necesita Telegram Premium.

1. En **@BotFather**: `/mybots` → el bot → **Bot Settings** → **Business Mode** → activar.
2. En la app de Telegram de la cuenta de empresa: **Ajustes → Telegram Business → Chatbots**,
   escribe el usuario del bot y dale permiso para **responder mensajes** y **marcar mensajes como leídos**
   (así, al contestar desde el chat de agentes, el chat del cliente queda leído en la cuenta de empresa).
3. Los mensajes de los clientes llegan traducidos al chat de agentes igual que antes; al responder,
   el cliente recibe la traducción desde la cuenta de empresa.

### Un tema por cliente (grupo con Temas)

Si el chat de agentes es un grupo con **Temas** activados, el bot crea un tema por cliente y todo lo
que se escribe en ese tema le llega a ese cliente (no hace falta «Responder»). Los mensajes que
empiezan con `//` son notas internas y no se envían. El bot debe ser administrador del grupo con
permiso para **gestionar temas**.

## Fases

1. **Simulador**: probar la calidad de la traducción sin Telegram. ✅
2. **Bot en Telegram**: probar el flujo con un bot y una cuenta de prueba. (en pruebas)
3. **Telegram Business**: conectar el bot a la cuenta Premium que atiende clientes.

> El archivo `.env` contiene claves privadas y nunca se sube al repositorio.
