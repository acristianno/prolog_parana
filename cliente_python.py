#!/usr/bin/env python3
"""Exemplo de INTEGRAÇÃO Python <-> Prolog: o Python faz uma requisição HTTP ao servidor Prolog e usa a resposta (JSON).

    1) inicie o servidor:  iniciar.bat           2) python cliente_python.py
Só usa a biblioteca padrão do Python.
"""
import json
import urllib.parse
import urllib.request

BASE = "http://localhost:8080"


def consultar(rota: str, **params):
    with urllib.request.urlopen(f"{BASE}/api/{rota}?{urllib.parse.urlencode(params)}") as r:
        return json.load(r)


def console(objetivo: str):
    """Envia um objetivo Prolog (texto) ao console e devolve as soluções."""
    req = urllib.request.Request(f"{BASE}/api/prolog", json.dumps({"goal": objetivo}).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


if __name__ == "__main__":
    print("Top 3 deputados federais:")
    for c in consultar("ranking", cargo="deputado_federal", n=3)["linhas"]:
        print(f"  {c['pos']}. {c['urna']:<22} {c['partido']:<8} {c['votos']:>9,} votos".replace(",", "."))

    r = consultar("buscar", q="chiquini")["linhas"][0]
    print(f"\nQuanto {r['urna']} teve de votos? {r['votos']:,}".replace(",", "."))

    print("\nConsulta livre em Prolog: senadores com mais de 2 milhões de votos")
    for s in console("votos_candidato(Nome, senador, V), V > 2000000")["solucoes"]:
        print(f"  {s['Nome']}: {s['V']:,}".replace(",", "."))
