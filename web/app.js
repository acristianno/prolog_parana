"use strict";
// Dashboard: só monta telas. Todo o "raciocínio" (rankings, somas, vencedores) é feito pelo Prolog no servidor.
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString("pt-BR");
const pct = (n) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let META = null;

async function api(rota, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`/api/${rota}${qs ? "?" + qs : ""}`);
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro || dados.message || r.status);
  return dados;
}

// Quadro escuro com o objetivo Prolog executado + botão para ver o código da regra.
function quadroProlog(d) {
  const id = "r" + Math.random().toString(36).slice(2, 8);
  const regra = d.regra ? `<button data-regra="${esc(d.regra)}" data-alvo="${id}">ver regra ${esc(d.regra)}</button>` : "";
  return `<div class="prolog"><span class="rot">Consulta Prolog executada</span>${regra}?- ${esc(d.consulta)}.<pre id="${id}" hidden></pre></div>`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-regra]");
  if (!b) return;
  const alvo = $(b.dataset.alvo);
  if (!alvo.hidden) { alvo.hidden = true; return; }
  const [nome, ar] = b.dataset.regra.split("/");
  try { alvo.textContent = (await api("regra", { nome, aridade: ar })).codigo; } catch (x) { alvo.textContent = String(x); }
  alvo.hidden = false;
});

function tabelaCandidatos(linhas, { clicavel = false, maxVotos = null } = {}) {
  const max = maxVotos ?? Math.max(1, ...linhas.map((l) => l.votos));
  const corpo = linhas.map((l) => `<tr class="${clicavel ? "clicavel" : ""}" data-sq="${l.sq}">
      <td class="n">${l.pos ?? ""}</td>
      <td>${esc(l.urna)}<br><span class="dica">${esc(l.nome)}${clicavel ? " · " + esc(l.cargo_nome) : ""}</span></td>
      <td>${esc(l.partido)} <span class="dica">${l.numero}</span></td>
      <td class="n">${fmt(l.votos)}</td><td class="n">${pct(l.pct)}</td>
      <td><div class="barra"><i style="width:${(100 * l.votos / max).toFixed(1)}%"></i></div></td></tr>`).join("");
  return `<table><thead><tr><th class="n">#</th><th>Candidato</th><th>Partido</th><th class="n">Votos</th><th class="n">% válidos</th><th></th></tr></thead><tbody>${corpo}</tbody></table>`;
}
const painel = (titulo, html) => `<div class="painel">${titulo ? `<h3>${titulo}</h3>` : ""}${html}</div>`;
const erro = (e) => `<p class="erro">${esc(e.message || e)}</p>`;
function preencherCargos(sel, extra) {
  sel.innerHTML = (extra || "") + META.cargos.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join("");
}
function debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ----------------------------------------------------------------------------- abas
const carregadas = {};
function mostrarAba(nome) {
  document.querySelectorAll("#abas button").forEach((b) => b.classList.toggle("on", b.dataset.aba === nome));
  document.querySelectorAll(".aba").forEach((s) => (s.hidden = s.id !== "aba-" + nome));
  if (!carregadas[nome]) { carregadas[nome] = true; (iniciais[nome] || (() => {}))(); }
  history.replaceState(null, "", "#" + nome);
}

// ----------------------------------------------------------------------------- ranking + resumo
async function resumo() {
  try {
    const r = await api("resumo", { cargo: $("rk-cargo").value });
    const t = r.mais_votado;
    $("resumo").innerHTML = [
      ["Votos válidos", fmt(r.votos_validos)], ["Candidatos", r.candidatos],
      ["Mais votado", `${esc(t.urna)} · ${fmt(t.votos)}`], ["% do mais votado", pct(t.pct)],
    ].map(([k, v]) => `<div class="cartao"><b>${v}</b><span>${k}</span></div>`).join("");
  } catch (e) { $("resumo").innerHTML = erro(e); }
}
async function ranking() {
  try {
    const d = await api("ranking", { cargo: $("rk-cargo").value, n: $("rk-n").value || 10 });
    $("rk-saida").innerHTML = painel(`${esc(d.cargo_nome)} · ${d.linhas.length} mais votados`, tabelaCandidatos(d.linhas, { clicavel: true })) + quadroProlog(d);
  } catch (e) { $("rk-saida").innerHTML = erro(e); }
  resumo();
}

// ----------------------------------------------------------------------------- buscar
async function buscar() {
  const q = $("bu-q").value.trim();
  $("bu-detalhe").innerHTML = "";
  if (q.length < 2) { $("bu-saida").innerHTML = '<p class="vazio">Digite pelo menos 2 letras.</p>'; return; }
  try {
    const d = await api("buscar", { q, cargo: $("bu-cargo").value });
    $("bu-saida").innerHTML = (d.linhas.length ? painel(`${d.linhas.length} resultado(s) — clique para detalhes`, tabelaCandidatos(d.linhas, { clicavel: true })) : '<p class="vazio">Nenhum candidato encontrado.</p>') + quadroProlog(d);
  } catch (e) { $("bu-saida").innerHTML = erro(e); }
}
async function detalhe(sq, alvo) {
  try {
    const c = await api("candidato", { sq });
    const lista = (arr, f) => arr.map(f).join("");
    $(alvo).innerHTML = painel(`${esc(c.urna)} <span class="dica">${esc(c.nome)}</span>`, `
      <div class="grade">
        <div class="cartao"><b>${fmt(c.votos)}</b><span>votos no Paraná (${pct(c.pct)})</span></div>
        <div class="cartao"><b>${c.posicao}º</b><span>entre ${c.candidatos_partido ? "" : ""}os candidatos a ${esc(c.cargo_nome)}</span></div>
        <div class="cartao"><b>${esc(c.partido)}</b><span>${fmt(c.votos_partido)} votos do partido</span></div>
        <div class="cartao"><b>${c.municipios_com_votos}</b><span>municípios com votos · venceu em ${c.municipios_vencidos}</span></div>
      </div>
      ${c.coligacao ? `<p class="dica">Coligação: ${esc(c.coligacao)}${c.federacao ? " · Federação: " + esc(c.federacao) : ""}</p>` : ""}
      <h3>Onde mais teve votos</h3>
      <table><tbody>${lista(c.top_municipios, (m) => `<tr><td>${esc(m.nome)}</td><td class="n">${fmt(m.votos)}</td><td class="n">${pct(m.pct)} do município</td></tr>`)}</tbody></table>
      ${c.redutos.length ? `<h3>Redutos (município com mais de 25% da votação do candidato)</h3><p>${c.redutos.map((m) => `${esc(m.nome)} (${pct(m.pct)})`).join(", ")}</p>` : ""}
      ${quadroProlog({ consulta: c.consulta, regra: "municipios_vencidos/2" })}`);
    $(alvo).scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) { $(alvo).innerHTML = erro(e); }
}
document.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-sq].clicavel");
  if (tr) detalhe(tr.dataset.sq, $("aba-buscar").hidden ? "rk-detalhe" : "bu-detalhe");
});

// ----------------------------------------------------------------------------- partidos
async function partidos() {
  try {
    const d = await api("partidos", { cargo: $("pa-cargo").value });
    const max = Math.max(1, ...d.linhas.map((l) => l.votos));
    const corpo = d.linhas.map((l) => `<tr><td class="n">${l.pos}</td><td>${esc(l.partido)}</td><td class="n">${fmt(l.votos)}</td><td class="n">${pct(l.pct)}</td>
      <td><div class="barra"><i style="width:${(100 * l.votos / max).toFixed(1)}%"></i></div></td><td class="n">${l.candidatos}</td></tr>`).join("");
    $("pa-saida").innerHTML = painel(`Votos por partido · ${esc(d.cargo_nome)}`, `<table><thead><tr><th class="n">#</th><th>Partido</th><th class="n">Votos</th><th class="n">%</th><th></th><th class="n">Candidatos</th></tr></thead><tbody>${corpo}</tbody></table>`) + quadroProlog(d);
  } catch (e) { $("pa-saida").innerHTML = erro(e); }
}
// ----------------------------------------------------------------------------- município
async function municipio() {
  try {
    const d = await api("municipio", { cargo: $("mu-cargo").value, mun: $("mu-mun").value });
    $("mu-saida").innerHTML = painel(`${esc(d.nome)} · ${esc(d.cargo_nome)} · ${fmt(d.total_validos)} votos válidos`,
      `<p>Vencedor no município: <b>${esc(d.vencedor.urna)}</b> (${esc(d.vencedor.partido)}) com ${fmt(d.vencedor.votos)} votos, ${pct(d.vencedor.pct)}.</p>` + tabelaCandidatos(d.linhas, { clicavel: true })) + quadroProlog(d);
  } catch (e) { $("mu-saida").innerHTML = erro(e); }
}

// ----------------------------------------------------------------------------- console Prolog
const EXEMPLOS = [
  ["1 · Primeiros passos", [
    ["Quantos votos teve o Jeffrey Chiquini?", "votos_candidato('JEFFREY CHIQUINI', deputado_federal, Votos).", "Dois valores conhecidos e uma variável (Votos): o Prolog descobre o que falta."],
    ["Quais candidatos disputaram o governo?", "candidato(_, Nome, Urna, Numero, Partido, governador, _).", "Cada resposta é um candidato. O _ ignora as colunas que não interessam."],
    ["Quem é o candidato número 13 a presidente?", "candidato(_, Nome, Urna, 13, Partido, presidente, _).", "Fixar um valor (13) filtra os fatos."],
    ["Quais candidatos têm 'silva' no nome?", "buscar_candidato(silva, Sq), candidato(Sq, Nome, _, _, Partido, Cargo, _).", "buscar_candidato ignora acentos e maiúsculas."],
  ]],
  ["2 · Combinando condições", [
    ["Senadores com mais de 1 milhão de votos", "votos_candidato(Nome, senador, V), V > 1000000.", "A vírgula é o E lógico: é senador E tem mais de 1 milhão."],
    ["Candidatos do PT a deputado federal e seus votos", "candidato(Sq, _, Urna, _, 'PT', deputado_federal, _), votos_uf(Sq, Votos).", "Sq liga os fatos candidato/7 e votos_uf/2, como uma junção de tabelas."],
    ["Qual a porcentagem do Sergio Moro?", "candidato(Sq, _, 'SERGIO MORO', _, _, governador, _), percentual(Sq, Pct).", "percentual/2 é uma regra: divide os votos do candidato pelos votos válidos do cargo."],
    ["Os 3 mais votados para governador, com nomes", "ranking(governador, 3, Lista), member(Votos-Sq, Lista), candidato(Sq, _, Urna, _, _, _, _).", "ranking/3 devolve uma lista; member/2 percorre a lista, um item por resposta."],
  ]],
  ["3 · Municípios", [
    ["Votos do Chiquini em Curitiba", "candidato(Sq, _, 'JEFFREY CHIQUINI', _, _, _, _), municipio(Mun, 'CURITIBA'), votos_em(Sq, Mun, Votos).", "Mun guarda o código do município e é reaproveitado na terceira condição."],
    ["Quem venceu para governador em Londrina?", "municipio(Mun, 'LONDRINA'), vencedor_municipio(governador, Mun, Sq, Votos), candidato(Sq, _, Urna, _, _, _, _).", "vencedor_municipio/4 escolhe o mais votado daquele município."],
    ["Em quantos municípios o Moro foi o mais votado?", "candidato(Sq, _, 'SERGIO MORO', _, _, governador, _), municipios_vencidos(Sq, Lista), length(Lista, Quantidade).", "length/2 conta os elementos de uma lista."],
    ["Onde o Chiquini concentra mais de 25% dos seus votos?", "candidato(Sq, _, 'JEFFREY CHIQUINI', _, _, _, _), reduto(Sq, Mun), municipio(Mun, Nome).", "reduto/2 é uma regra: um município que sozinho tem mais de 25% da votação do candidato."],
  ]],
  ["4 · Partidos e somas", [
    ["Ranking de partidos para deputado federal", "ranking_partidos(deputado_federal, Lista).", "Lista de pares Votos-Partido, do maior para o menor."],
    ["Total de votos do PT para deputado estadual", "aggregate_all(sum(V), (candidato(Sq, _, _, _, 'PT', deputado_estadual, _), votos_uf(Sq, V)), Total).", "aggregate_all soma o valor V de todas as respostas da consulta interna."],
    ["Quantos candidatos cada cargo tem?", "cargo(Cargo), aggregate_all(count, candidato(_, _, _, _, _, Cargo, _), Quantidade).", "aggregate_all(count, ...) conta as respostas."],
    ["Colegas de partido do Chiquini com mais de 100 mil votos", "candidato(A, _, 'JEFFREY CHIQUINI', _, _, _, _), mesmo_partido(A, B), votos_uf(B, V), V > 100000, candidato(B, _, Urna, _, _, _, _).", "mesmo_partido/2 é uma regra que compara os partidos de dois candidatos."],
  ]],
];
const REFERENCIA = [
  ["candidato(Sq, Nome, Urna, Numero, Partido, Cargo, _)", "fato: um candidato (Sq é o identificador do TSE)"],
  ["votos_uf(Sq, Votos)", "fato: votos do candidato no Paraná inteiro"],
  ["votos_municipio(Sq, Mun, Votos)", "fato: votos do candidato em um município (Mun = código TSE)"],
  ["municipio(Mun, Nome)", "fato: código e nome de cada município"],
  ["votos_validos_cargo(Cargo, Total)", "fato: total de votos válidos do cargo"],
  ["votos_candidato(Urna, Cargo, Votos)", "regra: votos a partir do nome de urna"],
  ["percentual(Sq, Pct)", "regra: % dos votos válidos do cargo"],
  ["ranking(Cargo, N, Lista)", "regra: os N mais votados (pares Votos-Sq)"],
  ["posicao(Sq, Pos)", "regra: colocação entre os candidatos do cargo"],
  ["mesmo_partido(SqA, SqB)", "regra: os dois são do mesmo partido"],
  ["ranking_partidos(Cargo, Lista)", "regra: partidos por votos (pares Votos-Partido)"],
  ["votos_partido(Partido, Cargo, Total)", "regra: soma dos votos do partido"],
  ["votos_em(Sq, Mun, Votos)", "regra: votos do candidato no município"],
  ["pct_no_municipio(Sq, Mun, Pct)", "regra: % do candidato no município"],
  ["vencedor_municipio(Cargo, Mun, Sq, Votos)", "regra: o mais votado do município"],
  ["ranking_municipio(Cargo, Mun, N, Lista)", "regra: os N mais votados do município"],
  ["melhores_municipios(Sq, N, Lista)", "regra: onde o candidato teve mais votos"],
  ["municipios_vencidos(Sq, Lista)", "regra: municípios em que foi o mais votado"],
  ["concentracao(Sq, Mun, Pct) · reduto(Sq, Mun)", "regras: peso do município na votação do candidato; reduto = mais de 25%"],
  ["buscar_candidato(Texto, Sq)", "regra: busca por parte do nome, sem acento"],
  ["member/2 · length/2 · aggregate_all/3 · findall/3", "do próprio Prolog: percorrer lista, contar, somar, juntar respostas"],
];
function console_() {
  $("cn-exemplos").innerHTML = EXEMPLOS.map(([grupo, itens]) => `<div class="ex-grupo"><b>${esc(grupo)}</b>` +
    itens.map(([t, g, dica]) => `<button class="ex" data-goal="${esc(g)}"><span>${esc(t)}</span><code>${esc(g)}</code><small>${esc(dica)}</small></button>`).join("") + "</div>").join("");
  $("cn-exemplos").onclick = (e) => {
    const b = e.target.closest("button.ex");
    if (b) { $("cn-goal").value = b.dataset.goal; rodarConsole(); $("cn-goal").scrollIntoView({ behavior: "smooth", block: "center" }); }
  };
  $("cn-ref").innerHTML = REFERENCIA.map(([a, d]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(d)}</td></tr>`).join("");
}

async function rodarConsole() {
  let goal = $("cn-goal").value.trim().replace(/\.\s*$/, "");
  try {
    const r = await fetch("/api/prolog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }) });
    const d = await r.json();
    if (!d.ok) { $("cn-saida").innerHTML = `<p class="erro">${esc(d.erro || d.message)}</p>`; return; }
    if (!d.solucoes.length) { $("cn-saida").innerHTML = '<div class="prolog">false.</div>'; return; }
    if (!d.variaveis.length) { $("cn-saida").innerHTML = '<div class="prolog">true.</div>'; return; }
    const cab = d.variaveis.map((v) => `<th>${esc(v)}</th>`).join("");
    const lin = d.solucoes.map((s) => `<tr>${d.variaveis.map((v) => `<td>${esc(Array.isArray(s[v]) ? "[" + s[v].join(", ") + "]" : s[v])}</td>`).join("")}</tr>`).join("");
    $("cn-saida").innerHTML = painel(`${d.total} solução(ões)`, `<table><thead><tr>${cab}</tr></thead><tbody>${lin}</tbody></table>`);
  } catch (e) { $("cn-saida").innerHTML = erro(e); }
}

// ----------------------------------------------------------------------------- inicialização
const iniciais = {
  buscar: () => { preencherCargos($("bu-cargo"), '<option value="todos">Todos</option>'); },
  partidos: () => { preencherCargos($("pa-cargo")); $("pa-cargo").value = "deputado_federal"; partidos(); },
  municipio: () => {
    preencherCargos($("mu-cargo")); $("mu-cargo").value = "governador";
    $("mu-mun").innerHTML = META.municipios.map((m) => `<option value="${m.cod}">${esc(m.nome)}</option>`).join("");
    $("mu-mun").value = 75353; municipio();
  },
  console: () => { console_(); rodarConsole(); },
};

async function main() {
  META = await api("meta");
  preencherCargos($("rk-cargo")); $("rk-cargo").value = "governador";
  $("rk-cargo").onchange = ranking; $("rk-n").oninput = debounce(ranking);
  $("bu-q").oninput = debounce(buscar); $("bu-cargo").onchange = buscar;
  $("pa-cargo").onchange = partidos;
  $("mu-cargo").onchange = municipio; $("mu-mun").onchange = municipio;
  $("cn-rodar").onclick = rodarConsole;
  $("cn-goal").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); rodarConsole(); } };
  document.querySelectorAll("#abas button").forEach((b) => (b.onclick = () => mostrarAba(b.dataset.aba)));
  // o clique em linha do ranking mostra o detalhe logo abaixo da tabela
  const det = document.createElement("div"); det.id = "rk-detalhe"; $("aba-ranking").appendChild(det);
  carregadas.ranking = true; ranking();
  const h = location.hash.slice(1);
  if (h && h !== "ranking" && document.getElementById("aba-" + h)) mostrarAba(h);
}
main().catch((e) => { document.body.insertAdjacentHTML("afterbegin", `<p class="erro" style="padding:16px">Servidor Prolog indisponível: ${esc(e.message)}</p>`); });
