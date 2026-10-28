# Eleições 2026 · Paraná · Consultas em Prolog

Sistema simples, feito para um trabalho de faculdade, que responde **quantos votos cada candidato teve** (presidente, governador, senador, deputado federal e deputado estadual) no **1º turno das eleições de 2026 no Paraná**.

Os dados ficam em **fatos Prolog**, o raciocínio é feito por **regras Prolog** e um **dashboard web** consulta tudo por meio de uma API em Prolog. Há também um console onde o usuário digita as próprias consultas.

## Como funciona

| Camada | Tecnologia | Papel |
|---|---|---|
| Preparação dos dados | Python (`preparar_dados.py`) | Lê os resultados do TSE e gera os fatos Prolog em `dados/` |
| Base de conhecimento | Prolog (`dados/*.pl`) | Fatos: `candidato/7`, `votos_uf/2`, `votos_municipio/3`, `municipio/2`, … |
| Raciocínio | Prolog (`prolog/regras.pl`) | Regras: ranking, percentual, partidos, vencedor por município, redutos, busca |
| API e servidor | Prolog (`prolog/api.pl`, `prolog/servidor.pl`) | Servidor HTTP do SWI-Prolog que devolve JSON |
| Dashboard | HTML + JavaScript (`web/`) | Chama a API, mostra tabelas e exibe a consulta Prolog executada |

Fatos são o que sabemos, regras são o que podemos concluir e consultas são as perguntas:

```prolog
?- votos_candidato('JEFFREY CHIQUINI', deputado_federal, V).
V = 425399.

?- ranking(governador, 3, Lista).
Lista = [3127911-160002540833, 1583764-160002549553, 1465601-160002547666].
```

## Requisitos

- [SWI-Prolog](https://www.swi-prolog.org/Download.html) 9 ou superior (testado com 10.0.2). No Windows: `winget install SWI-Prolog.SWI-Prolog`.
- Um navegador. Python e Node só são necessários para as partes opcionais (cliente de exemplo, regeneração dos dados, teste do navegador).

## Como rodar

```bash
swipl prolog/servidor.pl 8080        # ou, no Windows, iniciar.bat
```

Abra <http://localhost:8080>. A primeira carga leva alguns segundos (cerca de 136 mil fatos); as seguintes usam o cache `.qlf`.

| Comando | O que faz |
|---|---|
| `iniciar.bat` | Sobe o servidor e abre o navegador (Windows) |
| `testar.bat` ou `swipl -q -g run_tests -t halt testes/testes.pl` | Testes unitários das regras (plunit) |
| `swipl prolog/carregar.pl` | Terminal interativo com a base e as regras carregadas |
| `python cliente_python.py` | Exemplo de integração: Python consultando o Prolog por HTTP (servidor ligado) |
| `node testes/e2e_dashboard.mjs` | Teste do dashboard no navegador (precisa do pacote `playwright`) |
| `node testes/exemplos_console.mjs` | Confere que todos os exemplos do console retornam resposta |

## O que o dashboard faz

- **Ranking** por cargo, com resumo (votos válidos, candidatos, mais votado).
- **Buscar candidato** por parte do nome: votos, posição, partido, municípios onde mais votou e redutos.
- **Partidos**: votos por partido em cada cargo.
- **Município**: quem venceu e o ranking local.
- **Console Prolog**: guia rápido de sintaxe, 16 exemplos clicáveis e a lista de predicados. O usuário digita um objetivo, por exemplo `votos_candidato(Nome, senador, V), V > 1000000.`

Cada resposta mostra a **consulta Prolog executada** e o botão **ver regra**, que lista o código da regra com `listing/1`.

O console é somente leitura: aceita apenas os predicados de uma lista permitida, devolve no máximo 200 respostas e tem limite de 5 segundos. `shell/1`, `assert/1`, `open/3`, `call/1` e semelhantes são bloqueados.

## Estrutura

```
dados/            fatos Prolog gerados (candidatos, votos por UF e município, totais)
prolog/
  base.pl         carrega os fatos
  regras.pl       as regras de consulta
  api.pl          respostas em dicionários (JSON) e validação do console
  servidor.pl     servidor HTTP, rotas /api/* e arquivos de web/
  carregar.pl     entrada para uso interativo e testes
web/              dashboard (index.html, app.js, estilo.css)
testes/           plunit, teste do navegador e conferência dos exemplos
preparar_dados.py gerador dos fatos a partir dos resultados do TSE
cliente_python.py exemplo de cliente
```

## Regras principais (`prolog/regras.pl`)

`votos_candidato/3`, `votos/3`, `percentual/2`, `ranking/3`, `posicao/2`, `mais_votado/3`, `mesmo_partido/2`, `votos_partido/3`, `ranking_partidos/2`, `votos_em/3`, `pct_no_municipio/3`, `vencedor_municipio/4` (com *tabling*), `ranking_municipio/4`, `melhores_municipios/3`, `municipios_vencidos/2`, `concentracao/3`, `reduto/2` e `buscar_candidato/2`.

## Integração do Prolog com outras linguagens

Prolog é ótimo para representar conhecimento e raciocinar com fatos, regras e consultas, mas não foi feito para telas e serviços web. Por isso as linguagens se complementam: o Prolog guarda e consulta o conhecimento, e Python, Java, C ou JavaScript montam aplicações, interfaces e APIs. Neste trabalho:

- **Python → Prolog:** o Python prepara os fatos (ETL) e, em `cliente_python.py`, consome o Prolog por HTTP/JSON.
- **JavaScript → Prolog:** o dashboard chama a API do servidor Prolog com `fetch`.
- Outras formas, não usadas aqui: **janus** (ponte oficial Python⇄SWI-Prolog), **pyswip**, **JPL** (Java), a interface de linguagens estrangeiras em **C** e a execução do `swipl` como subprocesso.

Aplicações típicas dessa combinação são IA simbólica, sistemas especialistas, processamento de linguagem natural e planejamento.

## Regenerando os dados (opcional)

Os arquivos de `dados/` já estão no repositório. Para gerá-los de novo é preciso ter os arquivos Parquet dos resultados do TSE (`mart_candidate_result`, `mart_turnout`, `dim_candidate`, `dim_municipality`):

```bash
pip install -r requirements.txt
python preparar_dados.py --marts caminho/para/os/parquet
```

## Roteiro de demonstração

1. Mostrar `dados/candidatos.pl` (fatos) e `prolog/regras.pl` (regras).
2. No terminal: `swipl prolog/carregar.pl` e `?- ranking(governador, 3, L).`
3. No dashboard: Ranking, clicar em um candidato e abrir "ver regra".
4. Aba Município (Curitiba).
5. Console: um exemplo clicável, depois `ranking_partidos(deputado_federal, L).`, e tentar `shell(dir).` (bloqueado).

## Observações e limitações

- Os votos são **votos válidos nominais do 1º turno**, somente no Paraná. Não há dados de 2º turno nem de resultado (eleito ou não) na interface.
- Para deputados, o total de votos válidos inclui os **votos de legenda**; por isso a soma dos candidatos fica um pouco abaixo desse total (os testes verificam isso).
- O candidato é identificado pelo `Sq` (número sequencial do TSE) e o município pelo código TSE, não pelo IBGE.
- O console usa uma lista de predicados permitidos, adequada para uso local e acadêmico, e não é um sandbox para produção.

## Fonte dos dados

Tribunal Superior Eleitoral (TSE), resultados do 1º turno de 2026.
