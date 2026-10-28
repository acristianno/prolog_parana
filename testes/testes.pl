:- encoding(utf8).
/*  Testes unitários (plunit) das regras.   Rode:   swipl -q -g run_tests -t halt testes/testes.pl
    Os valores esperados foram conferidos contra os dados oficiais (resultados oficiais do TSE).
*/
:- use_module(library(plunit)).
:- ['../prolog/base.pl'].
:- ['../prolog/regras.pl'].
:- ['../prolog/api.pl'].

:- begin_tests(votos).
test(chiquini_votos)      :- votos_candidato('JEFFREY CHIQUINI', deputado_federal, 425399).
test(moro_percentual)     :- candidato(Sq, _, 'SERGIO MORO', _, _, governador, _), percentual(Sq, P), P > 50.0, P < 50.2.
test(ranking_governador, [true(L == [3127911, 1583764, 1465601])]) :- ranking(governador, 3, Pares), findall(V, member(V-_, Pares), L).
test(ranking_ordenado)    :- ranking(deputado_estadual, 50, L), findall(V, member(V-_, L), Vs), msort(Vs, Asc), reverse(Asc, Vs).
test(ranking_tamanho, [true(N == 5)]) :- ranking(senador, 5, L), length(L, N).
test(posicao_do_primeiro, [true(P == 1)]) :- mais_votado(deputado_federal, Sq, _), posicao(Sq, P).
:- end_tests(votos).

:- begin_tests(consistencia).
% a soma dos votos por município tem de fechar com o total do Paraná, candidato a candidato
test(soma_municipios_igual_uf, [forall(member(C, [presidente, governador, senador]))]) :-
    forall(( candidato(Sq, _, _, _, _, C, _), votos_uf(Sq, T) ),
           ( aggregate_all(sum(V), votos_municipio(Sq, _, V), S), S =:= T )).
% majoritários: soma dos candidatos = votos válidos. Proporcionais: os válidos incluem votos de LEGENDA (só no partido),
% então a soma dos candidatos fica abaixo do total.
test(soma_candidatos_majoritarios, [forall(member(C, [presidente, governador, senador]))]) :-
    aggregate_all(sum(V), votos(_, C, V), S), votos_validos_cargo(C, T), S =:= T.
test(soma_candidatos_proporcionais, [forall(member(C, [deputado_federal, deputado_estadual]))]) :-
    aggregate_all(sum(V), votos(_, C, V), S), votos_validos_cargo(C, T), S < T, S > 0.9 * T.
test(percentuais_majoritarios_somam_100, [forall(member(C, [presidente, governador, senador]))]) :-
    aggregate_all(sum(P), ( candidato(Sq, _, _, _, _, C, _), percentual(Sq, P) ), S), abs(S - 100) < 0.01.
test(todo_candidato_tem_cargo_valido) :- forall(candidato(_, _, _, _, _, C, _), cargo(C)).
:- end_tests(consistencia).

:- begin_tests(municipios).
test(moro_venceu_em_curitiba) :- candidato(Sq, _, 'SERGIO MORO', _, _, governador, _), vencedor_municipio(governador, 75353, Sq, _).
test(vencedor_tem_mais_votos) :-
    vencedor_municipio(governador, 75353, _, Max), forall(( candidato(S, _, _, _, _, governador, _), votos_municipio(S, 75353, V) ), V =< Max).
test(redutos_so_acima_de_25) :- forall(( candidato(Sq, _, _, _, _, deputado_federal, _), reduto(Sq, M) ), ( concentracao(Sq, M, P), P > 25 )).
:- end_tests(municipios).

:- begin_tests(busca).
test(sem_acento, [true(S == 'jose conceicao')]) :- sem_acento('JOSÉ Conceição', S).
test(acha_chiquini) :- once(buscar_candidato('chiquini', Sq)), candidato(Sq, _, 'JEFFREY CHIQUINI', _, _, _, _).
test(busca_sem_duplicados) :- findall(Sq, buscar_candidato(lula, Sq), L), sort(L, U), length(L, N), length(U, N).
test(busca_vazia_nao_acha, [fail]) :- buscar_candidato('', _).
:- end_tests(busca).

:- begin_tests(console_seguro).
test(permite_consulta_simples) :- seguro(( votos_candidato(_, senador, V), V > 1000 )).
test(permite_agregacao) :- seguro(aggregate_all(count, candidato(_, _, _, _, _, senador, _), _)).
test(bloqueia_shell, [fail]) :- seguro(shell(dir)).
test(bloqueia_escrita, [fail]) :- seguro(assertz(candidato(1, a, b, 1, c, senador, eleito))).
test(bloqueia_arquivo, [fail]) :- seguro(open('x', write, _)).
test(bloqueia_chamada_disfarcada, [fail]) :- seguro(( ranking(senador, 1, _), call(halt) )).
test(executa_ok) :- executar_goal("ranking(governador, 1, L)", R), R.ok == true.
test(executa_bloqueia) :- executar_goal("halt", R), R.ok == false.
test(erro_de_sintaxe) :- executar_goal("ranking(", R), R.ok == false.
:- end_tests(console_seguro).

:- begin_tests(api).
test(resumo_presidente) :- api_resumo(presidente, D), D.candidatos == 12.
test(candidato_dict) :- candidato(Sq, _, 'JEFFREY CHIQUINI', _, _, _, _), api_candidato(Sq, D), D.votos == 425399.
:- end_tests(api).
