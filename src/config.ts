function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env.`);
  }
  return value;
}

export const config = {
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  claudeModel: process.env.CLAUDE_MODEL || "claude-haiku-5-5",
  ownerLanguage: process.env.OWNER_LANGUAGE || "es",
  // Opcional hasta la Fase 2 (bot de Telegram)
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
};
