#!/usr/bin/env node
// Exemplo de INTEGRAÇÃO JavaScript <-> Prolog: o Node faz requisições HTTP ao servidor Prolog e usa a resposta (JSON).
//
//     1) inicie o servidor:  iniciar.bat           2) node cliente.mjs
// Não precisa instalar nada (usa o fetch do próprio Node 18+).
const BASE = "http://localhost:8080";
const fmt = (n) => Number(n).toLocaleString("pt-BR");

async function consultar(rota, params = {}) {
  const r = await fetch(`${BASE}/api/${rota}?${new URLSearchParams(params)}`);
  return r.json();
}

/** Envia um objetivo Prolog (texto) ao console e devolve as soluções. */
async function console_(objetivo) {
  const r = await fetch(`${BASE}/api/prolog`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: objetivo }) });
  return r.json();
}

console.log("Top 3 deputados federais:");
for (const c of (await consultar("ranking", { cargo: "deputado_federal", n: 3 })).linhas)
  console.log(`  ${c.pos}. ${c.urna.padEnd(22)} ${c.partido.padEnd(8)} ${fmt(c.votos).padStart(9)} votos`);

const [c] = (await consultar("buscar", { q: "chiquini" })).linhas;
console.log(`\nQuanto ${c.urna} teve de votos? ${fmt(c.votos)}`);

console.log("\nConsulta livre em Prolog: senadores com mais de 2 milhões de votos");
for (const s of (await console_("votos_candidato(Nome, senador, V), V > 2000000")).solucoes)
  console.log(`  ${s.Nome}: ${fmt(s.V)}`);
