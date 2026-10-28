// Confere que todos os exemplos clicáveis do console (web/app.js) retornam ao menos uma resposta.
//   node testes/exemplos_console.mjs   (servidor no ar em :8080)
import fs from "node:fs";
const src = fs.readFileSync(new URL("../web/app.js", import.meta.url), "utf8");
const EX = eval(src.match(/const EXEMPLOS = (\[[\s\S]*?\n\]);\nconst REFERENCIA/)[1]);
let falhas = 0;
for (const [, itens] of EX) {
  for (const [titulo, goal] of itens) {
    const r = await fetch("http://localhost:8080/api/prolog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: goal.replace(/\.$/, "") }) });
    const d = await r.json();
    const bom = d.ok && d.total > 0;
    if (!bom) falhas++;
    console.log(bom ? "ok   " : "FALHA", String(d.total ?? "-").padStart(4), titulo, d.ok ? "" : d.erro);
  }
}
process.exit(falhas ? 1 : 0);
