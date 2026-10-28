/*  SERVIDOR HTTP — expõe as consultas Prolog como uma API JSON e entrega o dashboard (pasta web/).

        swipl prolog/servidor.pl          (ou iniciar.bat)       e abra  http://localhost:8080

    Rotas:  /api/meta  /api/resumo  /api/ranking  /api/buscar  /api/candidato  /api/partidos
            /api/municipio  /api/regra  /api/prolog
*/
:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_parameters)).
:- use_module(library(http/http_files)).

:- ['base.pl'].
:- ['regras.pl'].
:- ['api.pl'].

:- http_handler(root(.), http_redirect(moved, root('index.html')), []).
:- http_handler(root('index.html'), serve_web('index.html'), []).
:- http_handler(root(static), http_reply_from_files(web(.), []), [prefix]).
:- http_handler(root(api/meta),      h_meta,      []).
:- http_handler(root(api/resumo),    h_resumo,    []).
:- http_handler(root(api/ranking),   h_ranking,   []).
:- http_handler(root(api/buscar),    h_buscar,    []).
:- http_handler(root(api/candidato), h_candidato, []).
:- http_handler(root(api/partidos),  h_partidos,  []).
:- http_handler(root(api/municipio), h_municipio, []).
:- http_handler(root(api/regra),     h_regra,     []).
:- http_handler(root(api/prolog),    h_prolog,    []).

serve_web(Arq, Request) :- http_reply_file(web(Arq), [], Request).

% Cada manipulador lê os parâmetros, chama a regra em api.pl e responde JSON.
responder(Goal) :-
    (   catch(Goal, E, (print_message(error, E), Dict = _{erro: 'erro interno'}, resp(500, Dict)))
    ->  true
    ;   resp(404, _{erro: 'nada encontrado para esses parâmetros'})
    ).
resp(Status, Dict) :-
    format('Status: ~d~n', [Status]),
    reply_json_dict(Dict).

h_meta(_) :- responder(( api_meta(D), reply_json_dict(D) )).

h_resumo(R) :-
    http_parameters(R, [cargo(C, [atom])]),
    responder(( api_resumo(C, D), reply_json_dict(D) )).

h_ranking(R) :-
    http_parameters(R, [cargo(C, [atom]), n(N, [integer, default(10)])]),
    N1 is min(max(N, 1), 200),
    responder(( api_ranking(C, N1, D), reply_json_dict(D) )).

h_buscar(R) :-
    http_parameters(R, [q(Q, [atom]), cargo(C, [atom, default(todos)])]),
    responder(( api_buscar(Q, C, D), reply_json_dict(D) )).

h_candidato(R) :-
    http_parameters(R, [sq(Sq, [integer])]),
    responder(( api_candidato(Sq, D), reply_json_dict(D) )).

h_partidos(R) :-
    http_parameters(R, [cargo(C, [atom])]),
    responder(( api_partidos(C, D), reply_json_dict(D) )).

h_municipio(R) :-
    http_parameters(R, [cargo(C, [atom]), mun(M, [integer])]),
    responder(( api_municipio(C, M, D), reply_json_dict(D) )).

h_regra(R) :-
    http_parameters(R, [nome(N, [atom]), aridade(A, [integer])]),
    responder(( regra_publica(N/A), api_regra(N/A, D), reply_json_dict(D) )).

% só mostramos o código das regras que escrevemos (não dos fatos, que são milhares de linhas)
regra_publica(N/A) :- member(N/A, [ranking/3, votos/3, percentual/2, posicao/2, mais_votado/3, 
                                    votos_partido/3, ranking_partidos/2, pct_no_municipio/3,
                                    vencedor_municipio/4, ranking_municipio/4, municipios_vencidos/2, concentracao/3, reduto/2,
                                    buscar_candidato/2, mesmo_partido/2, melhores_municipios/3]).

h_prolog(Request) :-
    http_read_json_dict(Request, Corpo, []),
    ( get_dict(goal, Corpo, G) -> true ; G = "" ),
    responder(( executar_goal(G, D), reply_json_dict(D) )).

% ----------------------------------------------------------------------------- inicialização
iniciar(Porta) :-
    http_server(http_dispatch, [port(Porta)]),
    format('~nObservatório Eleitoral PR (Prolog) em  http://localhost:~w~n(Ctrl+C duas vezes para encerrar)~n', [Porta]).

:- initialization((current_prolog_flag(argv, Av), ( Av = [P|_], atom_number(P, Porta) -> true ; Porta = 8080 ), iniciar(Porta), thread_get_message(_)), main).
