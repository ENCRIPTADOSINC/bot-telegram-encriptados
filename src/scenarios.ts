// Conversaciones de prueba en varios idiomas. Simula el flujo real:
// el cliente escribe en su idioma -> tú lo lees en español -> respondes en español -> le llega en su idioma.
//   npm run escenarios
import { config } from "./config.js";
import { scenarios, type Scenario } from "./scenario-data.js";
import { translate } from "./translator.js";

async function runScenario(scenario: Scenario): Promise<string> {
  const lines = [`\n━━ ${scenario.name} ━━`];
  let clientLanguage = "en";

  for (const turn of scenario.turns) {
    const started = Date.now();
    if (turn.from === "cliente") {
      const result = await translate(turn.text, config.ownerLanguage);
      if (result.sourceLanguage && result.sourceLanguage !== config.ownerLanguage) {
        clientLanguage = result.sourceLanguage;
      }
      lines.push(`👤 Cliente [${result.sourceLanguage ?? "sin texto"}]: ${turn.text}`);
      lines.push(`   → Tú lees:   ${result.translation}   (${Date.now() - started} ms)`);
    } else {
      const result = await translate(turn.text, clientLanguage);
      lines.push(`🧑‍💼 Tú [${config.ownerLanguage}]: ${turn.text}`);
      lines.push(`   → Cliente lee [${clientLanguage}]: ${result.translation}   (${Date.now() - started} ms)`);
    }
  }
  return lines.join("\n");
}

// Los escenarios corren en paralelo; los turnos de cada uno, en orden.
const results = await Promise.allSettled(scenarios.map(runScenario));
for (const [i, r] of results.entries()) {
  console.log(r.status === "fulfilled" ? r.value : `\n━━ ${scenarios[i].name} ━━\n⚠ Error: ${r.reason}`);
}
