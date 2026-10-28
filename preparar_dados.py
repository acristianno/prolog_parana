#!/usr/bin/env python3
"""Etapa de PREPARAÇÃO DOS DADOS (Python): transforma os resultados oficiais do TSE (1º turno de 2026, Paraná)
em FATOS PROLOG (arquivos .pl em dados/).

Python faz o trabalho "braçal" (ler Parquet, limpar texto, agregar) e o Prolog faz o raciocínio (regras e consultas).
Os arquivos gerados já acompanham o projeto: só é preciso rodar este script se quiser regenerar a base.

    pip install duckdb
    python preparar_dados.py --marts caminho/para/os/parquet

Fatos gerados (todos em UTF-8):
    candidato(Sq, Nome, NomeUrna, Numero, Partido, Cargo, Situacao).
    nome_busca(Sq, 'nome sem acento em minúsculas').
    federacao(Sq, 'SIGLA').                 coligacao(Sq, 'NOME DA COLIGAÇÃO').
    votos_uf(Sq, Votos).                    votos no Paraná inteiro
    votos_municipio(Sq, CodMun, Votos).     votos em cada município
    municipio(CodMun, 'NOME').
    votos_validos_cargo(Cargo, Total).      votos válidos do cargo no Paraná (base dos percentuais)
    votos_validos_municipio(Cargo, CodMun, Total).
"""
from __future__ import annotations

import argparse
import re
import unicodedata
from pathlib import Path

import duckdb

CARGOS = {1: "presidente", 3: "governador", 5: "senador", 6: "deputado_federal", 7: "deputado_estadual"}
SITUACOES = {"ELEITO": "eleito", "ELEITO POR QP": "eleito_por_qp", "ELEITO POR MÉDIA": "eleito_por_media",
             "SUPLENTE": "suplente", "NÃO ELEITO": "nao_eleito", "2º TURNO": "segundo_turno"}


def q(texto: str | None) -> str:
    """Átomo Prolog entre aspas simples, com escape de \\ e '."""
    s = (texto or "").replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").strip()
    return f"'{s}'"


def sem_acento(texto: str) -> str:
    s = unicodedata.normalize("NFD", texto or "")
    return re.sub(r"\s+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip().lower()


def escrever(caminho: Path, cabecalho: str, linhas: list[str]) -> None:
    with caminho.open("w", encoding="utf-8", newline="\n") as f:
        f.write(":- encoding(utf8).\n")
        f.write("".join(f"% {l}\n" for l in cabecalho.strip().splitlines()))
        f.write("\n")
        f.write("\n".join(linhas))
        f.write("\n")
    print(f"  {caminho.name}: {len(linhas):,} fatos".replace(",", "."))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--marts", required=True, help="pasta com os arquivos .parquet dos resultados do TSE")
    ap.add_argument("--saida", default="dados")
    a = ap.parse_args()
    marts, out = Path(a.marts), Path(a.saida)
    out.mkdir(exist_ok=True)
    pq = lambda n: f"read_parquet('{(marts / n).as_posix()}')"
    con = duckdb.connect()
    cargos = ",".join(map(str, CARGOS))

    # ------------------------------------------------------------------ candidatos (1º turno, Paraná)
    cand = con.execute(f"""
        SELECT r.candidate_sq, coalesce(d.full_name, r.ballot_name) AS nome, r.ballot_name AS urna, r.candidate_number AS numero,
               r.party_acronym AS partido, r.office_code AS cargo, coalesce(r.result, d.result) AS situacao, r.votes_valid AS votos,
               d.federation_acronym AS federacao, d.coalition_name AS coligacao
        FROM {pq('mart_candidate_result.parquet')} r
        LEFT JOIN (SELECT DISTINCT ON (candidate_sq) * FROM {pq('dim_candidate.parquet')} WHERE round = 1) d ON d.candidate_sq = r.candidate_sq
        WHERE r.round = 1 AND r.uf = 'PR' AND r.level = 'uf' AND r.office_code IN ({cargos})
        ORDER BY r.office_code, r.votes_valid DESC, r.candidate_sq""").fetchall()
    print("Paraná · 1º turno · 2026")
    linhas = []
    for sq, nome, urna, num, partido, cargo, sit, _, _, _ in cand:
        s = SITUACOES.get((sit or "").upper(), "nao_eleito")
        linhas.append(f"candidato({sq}, {q(nome)}, {q(urna)}, {num}, {q(partido)}, {CARGOS[cargo]}, {s}).")
    escrever(out / "candidatos.pl", "candidato(Sq, Nome, NomeUrna, Numero, Partido, Cargo, Situacao).\nFonte: TSE (resultados do 1º turno de 2026, Paraná).", linhas)
    escrever(out / "busca.pl", "nome_busca(Sq, NomeSemAcento): usado para pesquisar candidatos digitando parte do nome.",
             [f"nome_busca({c[0]}, {q(sem_acento(c[1] + ' ' + c[2]))})." for c in cand])
    escrever(out / "agremiacoes.pl", "federacao(Sq, Sigla) e coligacao(Sq, Nome): como o candidato concorreu.",
             [f"federacao({c[0]}, {q(c[8])})." for c in cand if c[8]] + [f"coligacao({c[0]}, {q(c[9])})." for c in cand if c[9] and c[9] != "PARTIDO ISOLADO"])
    escrever(out / "votos_uf.pl", "votos_uf(Sq, Votos): votos válidos do candidato no Paraná inteiro.",
             [f"votos_uf({c[0]}, {c[7]})." for c in cand])

    # ------------------------------------------------------------------ municípios e votos por município
    muns = con.execute(f"SELECT tse_code, name FROM {pq('dim_municipality.parquet')} WHERE uf = 'PR' AND kind = 'municipio' ORDER BY tse_code").fetchall()
    escrever(out / "municipios.pl", "municipio(CodTSE, Nome).", [f"municipio({c}, {q(n)})." for c, n in muns])
    vm = con.execute(f"""
        SELECT candidate_sq, municipality_code, votes_valid FROM {pq('mart_candidate_result.parquet')}
        WHERE round = 1 AND uf = 'PR' AND level = 'municipio' AND office_code IN ({cargos}) AND votes_valid > 0
        ORDER BY candidate_sq, municipality_code""").fetchall()
    escrever(out / "votos_municipio.pl", "votos_municipio(Sq, CodMun, Votos): votos válidos do candidato no município (só linhas com votos > 0).",
             [f"votos_municipio({a}, {b}, {c})." for a, b, c in vm])

    # ------------------------------------------------------------------ totais (base dos percentuais)
    tv = con.execute(f"""SELECT office_code, valid_total FROM {pq('mart_turnout.parquet')}
                         WHERE round = 1 AND uf = 'PR' AND level = 'uf' AND office_code IN ({cargos}) ORDER BY office_code""").fetchall()
    tm = con.execute(f"""SELECT office_code, municipality_code, valid_total FROM {pq('mart_turnout.parquet')}
                         WHERE round = 1 AND uf = 'PR' AND level = 'municipio' AND office_code IN ({cargos}) ORDER BY office_code, municipality_code""").fetchall()
    escrever(out / "totais.pl", "votos_validos_cargo(Cargo, Total) e votos_validos_municipio(Cargo, CodMun, Total).",
             [f"votos_validos_cargo({CARGOS[c]}, {t})." for c, t in tv] + [f"votos_validos_municipio({CARGOS[c]}, {m}, {t})." for c, m, t in tm])


if __name__ == "__main__":
    main()
