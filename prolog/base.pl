/*  BASE DE CONHECIMENTO — carrega os FATOS gerados pelo JavaScript (pasta dados/).

    Em Prolog, um programa é feito de:
      FATOS    o que sabemos           candidato(280002542287, 'JEFFREY CHIQUINI', ..., deputado_federal, _).
      REGRAS   o que podemos concluir  votos_candidato(Nome, Cargo, V) :- candidato(Sq, _, Nome, _, _, Cargo, _), votos_uf(Sq, V).
      CONSULTAS perguntas              ?- ranking(governador, 3, Lista).
    Este arquivo só reúne os fatos; as regras estão em regras.pl.
*/
:- set_prolog_flag(verbose_load, silent).
:- set_prolog_flag(encoding, utf8).

:- prolog_load_context(directory, Dir),
   file_directory_name(Dir, Raiz),
   asserta(user:file_search_path(projeto, Raiz)),
   asserta(user:file_search_path(dados, projeto(dados))),
   asserta(user:file_search_path(web, projeto(web))).

% Os fatos são declarados "discontiguous" porque cada arquivo traz uma parte deles.
:- discontiguous candidato/7, nome_busca/2, federacao/2, coligacao/2, votos_uf/2, votos_municipio/3,
                 municipio/2, votos_validos_cargo/2, votos_validos_municipio/3.

% qcompile(auto): na primeira vez o SWI-Prolog compila os fatos em .qlf; nas próximas a carga é bem mais rápida.
carregar_fatos :-
    forall(member(Arq, [candidatos, busca, agremiacoes, votos_uf, municipios, votos_municipio, totais]),
           load_files(dados(Arq), [qcompile(auto), silent(true)])).

:- carregar_fatos.
