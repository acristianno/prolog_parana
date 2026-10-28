/*  API — transforma as respostas do Prolog em estruturas (dicionários) que o servidor devolve como JSON.

    Cada predicado api_ chama as REGRAS de regras.pl e monta a resposta; o campo `consulta` mostra, em texto,
    o objetivo Prolog que foi executado (é o que o dashboard exibe para o aluno acompanhar o raciocínio).
*/
:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(library(aggregate)).
:- use_module(library(time)).

arred(X, Y) :- Y is round(X * 100) / 100.

nome_mun(Mun, Nome) :- municipio(Mun, Nome), !.
nome_mun(Mun, Mun).

% ----------------------------------------------------------------------------- um candidato como dicionário
cand_dict(Sq, _{sq: Sq, nome: Nome, urna: Urna, numero: Num, partido: Partido, cargo: Cargo, cargo_nome: CargoNome,
                votos: V, pct: Pct}) :-
    candidato(Sq, Nome, Urna, Num, Partido, Cargo, _),
    cargo_nome(Cargo, CargoNome),
    ( votos_uf(Sq, V) -> true ; V = 0 ),
    ( percentual(Sq, P) -> arred(P, Pct) ; Pct = 0 ).

linhas_ranking(Pares, Linhas) :-
    findall(D, ( nth1(I, Pares, _-Sq), cand_dict(Sq, D0), put_dict(pos, D0, I, D) ), Linhas).

goal_texto(Formato, Args, Texto) :- format(atom(Texto), Formato, Args).

% ----------------------------------------------------------------------------- /api/meta
api_meta(_{cargos: Cargos, partidos: Partidos, municipios: Muns, uf: 'PR', turno: 1, ano: 2026}) :-
    findall(_{id: C, nome: N, votos_validos: T, candidatos: Q},
            ( cargo(C), cargo_nome(C, N), votos_validos_cargo(C, T),
              aggregate_all(count, candidato(_, _, _, _, _, C, _), Q) ), Cargos),
    findall(P, partido(P), Partidos),
    findall(_{cod: Cod, nome: Nome}, municipio(Cod, Nome), Muns0),
    sort(nome, @=<, Muns0, Muns).

% ----------------------------------------------------------------------------- /api/resumo
api_resumo(Cargo, _{cargo: Cargo, cargo_nome: N, votos_validos: T, candidatos: Q, mais_votado: Top, consulta: Consulta}) :-
    cargo_nome(Cargo, N),
    votos_validos_cargo(Cargo, T),
    aggregate_all(count, candidato(_, _, _, _, _, Cargo, _), Q),
    mais_votado(Cargo, Sq, _), cand_dict(Sq, Top),
    goal_texto('mais_votado(~w, Sq, Votos), percentual(Sq, Pct)', [Cargo], Consulta).

% ----------------------------------------------------------------------------- /api/ranking
api_ranking(Cargo, N, _{cargo: Cargo, cargo_nome: CN, n: N, linhas: Linhas, consulta: Consulta, regra: 'ranking/3'}) :-
    cargo_nome(Cargo, CN),
    ranking(Cargo, N, Pares),
    linhas_ranking(Pares, Linhas),
    goal_texto('ranking(~w, ~w, Lista)', [Cargo, N], Consulta).

% ----------------------------------------------------------------------------- /api/buscar
api_buscar(Parte, Cargo, _{termo: Parte, cargo: Cargo, linhas: Linhas, consulta: Consulta, regra: 'buscar_candidato/2'}) :-
    findall(V-Sq, ( buscar_candidato(Parte, Sq), candidato(Sq, _, _, _, _, C, _), ( Cargo == todos -> true ; C == Cargo ), votos_uf(Sq, V) ), Pares0),
    sort(1, @>=, Pares0, Pares1),
    primeiros(40, Pares1, Pares),
    linhas_ranking(Pares, Linhas),
    goal_texto('buscar_candidato(~q, Sq), votos(Sq, Cargo, Votos)', [Parte], Consulta).

% ----------------------------------------------------------------------------- /api/candidato
api_candidato(Sq, Dict) :-
    cand_dict(Sq, Base),
    candidato(Sq, _, _, _, Partido, Cargo, _),
    posicao(Sq, Pos),
    votos_validos_cargo(Cargo, TotalCargo),
    ( votos_partido(Partido, Cargo, VP) -> true ; VP = 0 ),
    aggregate_all(count, candidato(_, _, _, _, Partido, Cargo, _), NPart),
    ( federacao(Sq, Fed) -> true ; Fed = '' ),
    ( coligacao(Sq, Col) -> true ; Col = '' ),
    findall(Sq2, mesmo_partido(Sq, Sq2), Colegas),
    length(Colegas, NColegas),
    melhores_municipios(Sq, 10, Melhores),
    findall(_{cod: Mun, nome: Nome, votos: V, pct: Pct},
            ( member(V-Mun, Melhores), nome_mun(Mun, Nome), ( pct_no_municipio(Sq, Mun, P) -> arred(P, Pct) ; Pct = 0 ) ), TopMuns),
    aggregate_all(count, votos_municipio(Sq, _, _), NMunVotos),
    municipios_vencidos(Sq, Vencidos),
    length(Vencidos, NVenc),
    findall(Nome, ( member(M, Vencidos), nome_mun(M, Nome) ), NomesVenc0), msort(NomesVenc0, NomesVenc),
    findall(_{cod: M, nome: Nome, pct: Pct}, ( reduto(Sq, M), nome_mun(M, Nome), concentracao(Sq, M, P2), arred(P2, Pct) ), Redutos),
    goal_texto('votos(~w, Cargo, Votos), percentual(~w, Pct), posicao(~w, Pos), municipios_vencidos(~w, Lista)', [Sq, Sq, Sq, Sq], Consulta),
    Dict = Base.put(_{posicao: Pos, total_cargo: TotalCargo, votos_partido: VP, candidatos_partido: NPart,
                      federacao: Fed, coligacao: Col, colegas: NColegas, top_municipios: TopMuns, municipios_com_votos: NMunVotos,
                      municipios_vencidos: NVenc, nomes_vencidos: NomesVenc, redutos: Redutos, consulta: Consulta}).

% ----------------------------------------------------------------------------- /api/partidos
api_partidos(Cargo, _{cargo: Cargo, cargo_nome: CN, total_validos: Total, linhas: Linhas, consulta: Consulta, regra: 'ranking_partidos/2'}) :-
    cargo_nome(Cargo, CN),
    votos_validos_cargo(Cargo, Total),
    ranking_partidos(Cargo, Pares),
    findall(_{pos: I, partido: P, votos: V, pct: Pct, candidatos: NC},
            ( nth1(I, Pares, V-P), arred(100 * V / Total, Pct),
              aggregate_all(count, candidato(_, _, _, _, P, Cargo, _), NC) ), Linhas),
    goal_texto('ranking_partidos(~w, Lista)', [Cargo], Consulta).

% ----------------------------------------------------------------------------- /api/municipio
api_municipio(Cargo, Mun, _{cargo: Cargo, cargo_nome: CN, cod: Mun, nome: Nome, total_validos: Total, vencedor: Venc, linhas: Linhas,
                            consulta: Consulta, regra: 'vencedor_municipio/4'}) :-
    cargo_nome(Cargo, CN),
    nome_mun(Mun, Nome),
    votos_validos_municipio(Cargo, Mun, Total),
    vencedor_municipio(Cargo, Mun, SqV, _),
    cand_dict(SqV, V0), votos_em(SqV, Mun, VM), arred(100 * VM / Total, PctV),
    Venc = V0.put(_{votos: VM, pct: PctV}),
    ranking_municipio(Cargo, Mun, 15, Pares),
    findall(D, ( nth1(I, Pares, V-Sq), cand_dict(Sq, D0), arred(100 * V / Total, Pct),
                 D = D0.put(_{pos: I, votos: V, pct: Pct}) ), Linhas),
    goal_texto('vencedor_municipio(~w, ~w, Sq, Votos), ranking_municipio(~w, ~w, 15, Lista)', [Cargo, Mun, Cargo, Mun], Consulta).

% ----------------------------------------------------------------------------- /api/regra — mostra o código da regra
% O "listing" do Prolog imprime as cláusulas como estão na memória: ótimo para mostrar a regra ao aluno.
api_regra(Nome/Aridade, _{predicado: Texto, codigo: Codigo}) :-
    format(atom(Texto), '~w/~w', [Nome, Aridade]),
    with_output_to(string(Codigo), listing(Nome/Aridade)).

% ============================================================================= CONSOLE PROLOG (somente leitura)
% O usuário pode digitar um objetivo Prolog. Para não executar nada perigoso, só aceitamos
% combinações dos predicados da lista abaixo (a "lista branca").
permitido(candidato/7).      permitido(votos_uf/2).        permitido(votos_municipio/3).   permitido(municipio/2).
permitido(votos_validos_cargo/2).   permitido(votos_validos_municipio/3).   permitido(federacao/2).   permitido(coligacao/2).
permitido(votos_candidato/3).  permitido(votos/3).         permitido(percentual/2).        
permitido(mesmo_partido/2).    permitido(ranking/3).       permitido(posicao/2).           permitido(mais_votado/3).
                 permitido(votos_partido/3).
permitido(ranking_partidos/2).  permitido(votos_em/3).        permitido(pct_no_municipio/3).
permitido(vencedor_municipio/4).  permitido(ranking_municipio/4).   permitido(melhores_municipios/3).
permitido(municipios_vencidos/2). permitido(concentracao/3).        permitido(reduto/2).   
 permitido(buscar_candidato/2).    permitido(cargo/1).    permitido(partido/1).
permitido(sem_acento/2).
permitido((>)/2).  permitido((<)/2).  permitido((>=)/2).  permitido((=<)/2).  permitido((=:=)/2).  permitido((=\=)/2).
permitido((==)/2). permitido((\==)/2). permitido((=)/2).   permitido(member/2). permitido(length/2).  permitido(nth1/3).
permitido(sum_list/2). permitido(max_list/2). permitido(msort/2).

% dado simples: variável, número, átomo/string, lista ou termo composto só de dados (ex.: V-Sq, sum(V))
dado(X) :- var(X), !.
dado(X) :- atomic(X), !.
dado(X) :- is_list(X), !, maplist(dado, X).
dado(X) :- compound(X), X =.. [_|Args], maplist(dado, Args).

expr_ok(X) :- var(X), !.
expr_ok(X) :- number(X), !.
expr_ok(X) :- compound(X), X =.. [Op|Args], memberchk(Op, [+, -, *, /, max, min, abs]), maplist(expr_ok, Args).

seguro(G) :- var(G), !, fail.
seguro((A, B)) :- !, seguro(A), seguro(B).
seguro((A ; B)) :- !, seguro(A), seguro(B).
seguro((A -> B)) :- !, seguro(A), seguro(B).
seguro(\+ A) :- !, seguro(A).
seguro(findall(T, G, L)) :- !, dado(T), seguro(G), dado(L).
seguro(aggregate_all(Esp, G, R)) :- !, dado(Esp), memberchk(Esp, [count, sum(_), max(_), min(_), bag(_), set(_)]), seguro(G), dado(R).
seguro(X is E) :- !, dado(X), expr_ok(E).
seguro(G) :-
    callable(G), functor(G, N, A), permitido(N/A),
    G =.. [_|Args], maplist(dado, Args).

% executar_goal(+Texto, -Resposta): lê, valida e executa o objetivo (máx. 200 soluções, 5 segundos).
executar_goal(Texto, Resposta) :-
    catch(term_string(Goal, Texto, [variable_names(Nomes)]), E, (erro_texto(E, Msg), Goal = erro(Msg))),
    (   Goal = erro(Msg0)
    ->  Resposta = _{ok: false, erro: Msg0}
    ;   \+ seguro(Goal)
    ->  Resposta = _{ok: false, erro: 'Consulta não permitida: use apenas os predicados da lista (candidato/7, ranking/3, ...).'}
    ;   catch(call_with_time_limit(5, once(findnsols(200, Nomes, Goal, Sols))), Erro, (erro_texto(Erro, Msg1), Sols = erro(Msg1)))
    ->  (   Sols = erro(Msg2)
        ->  Resposta = _{ok: false, erro: Msg2}
        ;   maplist(solucao_json, Sols, Linhas),
            length(Sols, N),
            findall(Nome, member(Nome=_, Nomes), Vars),
            Resposta = _{ok: true, variaveis: Vars, solucoes: Linhas, total: N, limitado: false}
        )
    ;   Resposta = _{ok: true, variaveis: [], solucoes: [], total: 0, limitado: false}
    ).

erro_texto(time_limit_exceeded, 'Tempo limite excedido (5 s).') :- !.
erro_texto(error(syntax_error(Q), _), Msg) :- !, format(string(Msg), 'Erro de sintaxe: ~w', [Q]).
erro_texto(E, Msg) :- message_to_codes_fallback(E, Msg).
message_to_codes_fallback(E, Msg) :- format(string(Msg), '~p', [E]).

solucao_json(Binds, Dict) :-
    findall(K-J, ( member(Nome=Valor, Binds), valor_json(Valor, J), K = Nome ), Pares),
    dict_pairs(Dict, _, Pares).

valor_json(V, J) :- var(V), !, J = '_'.
valor_json(V, V) :- number(V), !.
valor_json(V, V) :- string(V), !.
valor_json(V, V) :- atom(V), \+ memberchk(V, [true, false, null]), !.
valor_json(V, J) :- is_list(V), !, maplist(valor_json, V, J).
valor_json(V, J) :- format(string(J), '~q', [V]).
