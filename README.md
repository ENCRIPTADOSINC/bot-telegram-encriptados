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
| `npm run dev` | Arranca el bot de Telegram (Fase 2) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |

## Estructura

- `src/translator.ts`: traducción con Claude
- `src/scenario-data.ts`: conversaciones de prueba
- `src/simulator/`: simulador web (Fase 1)
- `src/index.ts`: bot de Telegram (Fase 2)

## Fases

1. **Simulador**: probar la calidad de la traducción sin Telegram. ✅
2. **Bot en Telegram**: probar el flujo con un bot y una cuenta de prueba.
3. **Telegram Business**: conectar el bot a la cuenta Premium que atiende clientes.

> El archivo `.env` contiene claves privadas y nunca se sube al repositorio.
