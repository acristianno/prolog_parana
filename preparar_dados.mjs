#!/usr/bin/env node
// Etapa de PREPARAÇÃO DOS DADOS (JavaScript/Node): transforma os resultados oficiais do TSE (1º turno de 2026, Paraná)
// em FATOS PROLOG (arquivos .pl em dados/).
//
// O JavaScript faz o trabalho "braçal" (ler Parquet, limpar texto, agregar) e o Prolog faz o raciocínio (regras e consultas).
// Os arquivos gerados já acompanham o projeto: só é preciso rodar este script se quiser regenerar a base.
//
//     npm install
//     node preparar_dados.mjs --marts caminho/para/os/parquet [--saida dados]
//
// Fatos gerados (todos em UTF-8):
//     candidato(Sq, Nome, NomeUrna, Numero, Partido, Cargo, Situacao).
//     nome_busca(Sq, 'nome sem acento em minúsculas').
//     federacao(Sq, 'SIGLA').                 coligacao(Sq, 'NOME DA COLIGAÇÃO').
//     votos_uf(Sq, Votos).                    votos no Paraná inteiro
//     votos_municipio(Sq, CodMun, Votos).     votos em cada município
//     municipio(CodMun, 'NOME').
//     votos_validos_cargo(Cargo, Total).      votos válidos do cargo no Paraná (base dos percentuais)
//     votos_validos_municipio(Cargo, CodMun, Total).
import fs from "node:fs";
import path from "node:path";
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

const CARGOS = { 1: "presidente", 3: "governador", 5: "senador", 6: "deputado_federal", 7: "deputado_estadual" };
const SITUACOES = { "ELEITO": "eleito", "ELEITO POR QP": "eleito_por_qp", "ELEITO POR MÉDIA": "eleito_por_media",
                    "SUPLENTE": "suplente", "NÃO ELEITO": "nao_eleito", "2º TURNO": "segundo_turno" };

const args = process.argv.slice(2);
const opcao = (nome, padrao) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : padrao; };
const marts = opcao("--marts");
const saida = opcao("--saida", "dados");
if (!marts) { console.error("uso: node preparar_dados.mjs --marts <pasta com os .parquet> [--saida dados]"); process.exit(1); }

/** Átomo Prolog entre aspas simples, com escape de \ e '. */
const q = (t) => "'" + String(t ?? "").replaceAll("\\", "\\\\").replaceAll("'", "\\'").replace(/\n/g, " ").trim() + "'";
const semAcento = (t) => String(t ?? "").normalize("NFD").replace(/\p{Mn}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
const num = (v) => Number(v);

// As tabelas de resultados cobrem o Brasil todo: filtramos pelo Paraná e lemos só as colunas necessárias (economiza memória).
async function ler(nome, extra = {}) {
  const f = fs.readFileSync(path.join(marts, nome));
  return parquetReadObjects({ file: f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength), compressors, ...extra });
}

function escrever(arquivo, cabecalho, linhas) {
  const topo = ":- encoding(utf8).\n" + cabecalho.trim().split("\n").map((l) => `% ${l}\n`).join("") + "\n";
  fs.writeFileSync(path.join(saida, arquivo), topo + linhas.join("\n") + "\n", "utf8");
  console.log(`  ${arquivo}: ${linhas.length.toLocaleString("pt-BR")} fatos`);
}

fs.mkdirSync(saida, { recursive: true });
const ehCargo = (r) => r.office_code in CARGOS;
const [resultados, dimCand, dimMun, comparecimento] = await Promise.all([
  ler("mart_candidate_result.parquet", { filter: { uf: "PR" }, columns: ["candidate_sq", "ballot_name", "candidate_number", "party_acronym", "office_code", "result", "votes_valid", "round", "uf", "level", "municipality_code"] }),
  ler("dim_candidate.parquet"), ler("dim_municipality.parquet"),
  ler("mart_turnout.parquet", { filter: { uf: "PR" }, columns: ["office_code", "valid_total", "round", "uf", "level", "municipality_code"] })]);

// ------------------------------------------------------------------ candidatos (1º turno, Paraná)
const detalhe = new Map();
for (const d of dimCand) if (num(d.round) === 1 && !detalhe.has(num(d.candidate_sq))) detalhe.set(num(d.candidate_sq), d);

const cand = resultados
  .filter((r) => num(r.round) === 1 && r.uf === "PR" && r.level === "uf" && ehCargo(r))
  .sort((a, b) => num(a.office_code) - num(b.office_code) || num(b.votes_valid) - num(a.votes_valid) || num(a.candidate_sq) - num(b.candidate_sq));

console.log("Paraná · 1º turno · 2026");
escrever("candidatos.pl", "candidato(Sq, Nome, NomeUrna, Numero, Partido, Cargo, Situacao).\nFonte: TSE (resultados do 1º turno de 2026, Paraná).",
  cand.map((r) => {
    const d = detalhe.get(num(r.candidate_sq)) ?? {};
    const sit = SITUACOES[String(r.result ?? d.result ?? "").toUpperCase()] ?? "nao_eleito";
    return `candidato(${r.candidate_sq}, ${q(d.full_name ?? r.ballot_name)}, ${q(r.ballot_name)}, ${r.candidate_number}, ${q(r.party_acronym)}, ${CARGOS[r.office_code]}, ${sit}).`;
  }));
escrever("busca.pl", "nome_busca(Sq, NomeSemAcento): usado para pesquisar candidatos digitando parte do nome.",
  cand.map((r) => `nome_busca(${r.candidate_sq}, ${q(semAcento((detalhe.get(num(r.candidate_sq))?.full_name ?? r.ballot_name) + " " + r.ballot_name))}).`));
const fed = cand.filter((r) => detalhe.get(num(r.candidate_sq))?.federation_acronym);
const col = cand.filter((r) => { const c = detalhe.get(num(r.candidate_sq))?.coalition_name; return c && c !== "PARTIDO ISOLADO"; });
escrever("agremiacoes.pl", "federacao(Sq, Sigla) e coligacao(Sq, Nome): como o candidato concorreu.",
  [...fed.map((r) => `federacao(${r.candidate_sq}, ${q(detalhe.get(num(r.candidate_sq)).federation_acronym)}).`),
   ...col.map((r) => `coligacao(${r.candidate_sq}, ${q(detalhe.get(num(r.candidate_sq)).coalition_name)}).`)]);
escrever("votos_uf.pl", "votos_uf(Sq, Votos): votos válidos do candidato no Paraná inteiro.",
  cand.map((r) => `votos_uf(${r.candidate_sq}, ${r.votes_valid}).`));

// ------------------------------------------------------------------ municípios e votos por município
const muns = dimMun.filter((m) => m.uf === "PR" && m.kind === "municipio").sort((a, b) => num(a.tse_code) - num(b.tse_code));
escrever("municipios.pl", "municipio(CodTSE, Nome).", muns.map((m) => `municipio(${m.tse_code}, ${q(m.name)}).`));
const vm = resultados
  .filter((r) => num(r.round) === 1 && r.uf === "PR" && r.level === "municipio" && ehCargo(r) && num(r.votes_valid) > 0)
  .sort((a, b) => num(a.candidate_sq) - num(b.candidate_sq) || num(a.municipality_code) - num(b.municipality_code));
escrever("votos_municipio.pl", "votos_municipio(Sq, CodMun, Votos): votos válidos do candidato no município (só linhas com votos > 0).",
  vm.map((r) => `votos_municipio(${r.candidate_sq}, ${r.municipality_code}, ${r.votes_valid}).`));

// ------------------------------------------------------------------ totais (base dos percentuais)
const tu = comparecimento.filter((r) => num(r.round) === 1 && r.uf === "PR" && r.level === "uf" && ehCargo(r)).sort((a, b) => num(a.office_code) - num(b.office_code));
const tm = comparecimento.filter((r) => num(r.round) === 1 && r.uf === "PR" && r.level === "municipio" && ehCargo(r))
  .sort((a, b) => num(a.office_code) - num(b.office_code) || num(a.municipality_code) - num(b.municipality_code));
escrever("totais.pl", "votos_validos_cargo(Cargo, Total) e votos_validos_municipio(Cargo, CodMun, Total).",
  [...tu.map((r) => `votos_validos_cargo(${CARGOS[r.office_code]}, ${r.valid_total}).`),
   ...tm.map((r) => `votos_validos_municipio(${CARGOS[r.office_code]}, ${r.municipality_code}, ${r.valid_total}).`)]);
