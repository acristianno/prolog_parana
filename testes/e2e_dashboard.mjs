// Teste de ponta a ponta do dashboard (servidor Prolog precisa estar no ar em :8080).
//   node testes/e2e_dashboard.mjs [caminho-para-playwright]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const base = "http://localhost:8080";
let falhas = 0;
const ok = (c, msg) => { console.log((c ? "ok   " : "FALHA") + " " + msg); if (!c) falhas++; };

const nav = await chromium.launch();
const pg = await nav.newPage({ viewport: { width: 1100, height: 900 } });
const erros = [];
pg.on("pageerror", (e) => erros.push(String(e)));
pg.on("console", (m) => m.type() === "error" && erros.push(m.text()));

await pg.goto(base + "/");
await pg.waitForSelector("#rk-saida table");
ok((await pg.textContent("#rk-saida")).includes("SERGIO MORO"), "ranking de governador mostra Sergio Moro");
ok((await pg.textContent("#rk-saida .prolog")).includes("ranking(governador, 10, Lista)"), "mostra a consulta Prolog executada");

await pg.selectOption("#rk-cargo", "presidente");
await pg.waitForFunction(() => document.querySelector("#resumo").textContent.includes("FLAVIO BOLSONARO"));
ok(true, "presidente: resumo mostra o mais votado");

await pg.click('#abas [data-aba="buscar"]');
await pg.fill("#bu-q", "chiquini");
await pg.waitForSelector("#bu-saida tr[data-sq]");
ok((await pg.textContent("#bu-saida")).includes("425.399"), "busca 'chiquini' mostra 425.399 votos");
await pg.click("#bu-saida tr[data-sq]");
await pg.waitForSelector("#bu-detalhe .painel");
ok((await pg.textContent("#bu-detalhe")).includes("Onde mais teve votos"), "detalhe do candidato");

await pg.click('#abas [data-aba="partidos"]');
await pg.waitForSelector("#pa-saida table");
ok((await pg.textContent("#pa-saida")).includes("NOVO"), "partidos: aparece o NOVO");

await pg.click('#abas [data-aba="municipio"]');
await pg.waitForSelector("#mu-saida table");
ok((await pg.textContent("#mu-saida")).includes("CURITIBA"), "município: Curitiba");

await pg.click('#abas [data-aba="console"]');
await pg.waitForSelector("#cn-saida table");
ok((await pg.textContent("#cn-saida")).includes("FILIPEBARROS") || (await pg.textContent("#cn-saida")).includes("FILIPE BARROS"), "console Prolog executa consulta");
await pg.fill("#cn-goal", "shell(dir).");
await pg.click("#cn-rodar");
await pg.waitForSelector("#cn-saida .erro");
ok((await pg.textContent("#cn-saida")).includes("não permitida"), "console bloqueia predicados fora da lista");

ok(erros.length === 0, "sem erros no console do navegador " + erros.join(" | "));
await pg.screenshot({ path: process.env.SHOT || "tela.png", fullPage: true });
await nav.close();
process.exit(falhas ? 1 : 0);
