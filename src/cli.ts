// Prueba rápida del traductor desde la terminal:
//   npm run traducir -- "Hello, I need help with my order" es
import { translate } from "./translator.js";

const [text, target = "es"] = process.argv.slice(2);
if (!text) {
  console.error('Uso: npm run traducir -- "texto a traducir" [idioma_destino]');
  process.exit(1);
}

const started = Date.now();
const result = await translate(text, target);
console.log(`[${result.sourceLanguage ?? "sin texto"} -> ${target}] ${result.translation}`);
console.log(`(${Date.now() - started} ms)`);
