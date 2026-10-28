/*  REGRAS — o "raciocínio" do sistema.

    Cada regra tem a forma   Cabeca :- Corpo.   (lê-se: "Cabeca é verdade SE Corpo for verdade").
    Os cargos são átomos: presidente, governador, senador, deputado_federal, deputado_estadual.
    Os candidatos são identificados pelo Sq (número sequencial único do TSE).
    Votos = votos válidos de 1º turno (2026), no Paraná.
*/
:- table vencedor_municipio/4.        % memoriza respostas: a pergunta "quem ganhou no município X?" é repetida muitas vezes

% ----------------------------------------------------------------------------- cargos
cargo(presidente).
cargo(governador).
cargo(senador).
cargo(deputado_federal).
cargo(deputado_estadual).

cargo_nome(presidente, 'Presidente').
cargo_nome(governador, 'Governador').
cargo_nome(senador, 'Senador').
cargo_nome(deputado_federal, 'Deputado Federal').
cargo_nome(deputado_estadual, 'Deputado Estadual').

% ----------------------------------------------------------------------------- votos de um candidato
% votos_candidato(?NomeUrna, ?Cargo, ?Votos): "quanto o candidato X teve de votação no cargo Y?"
votos_candidato(NomeUrna, Cargo, Votos) :-
    candidato(Sq, _, NomeUrna, _, _, Cargo, _),
    votos_uf(Sq, Votos).

% votos(?Sq, ?Cargo, ?Votos): o mesmo, a partir do identificador.
votos(Sq, Cargo, Votos) :-
    candidato(Sq, _, _, _, _, Cargo, _),
    votos_uf(Sq, Votos).

% percentual(+Sq, -P): % dos votos válidos do cargo no Paraná.
percentual(Sq, P) :-
    votos(Sq, Cargo, V),
    votos_validos_cargo(Cargo, Total),
    Total > 0,
    P is 100 * V / Total.

mesmo_partido(A, B) :-
    candidato(A, _, _, _, P, _, _),
    candidato(B, _, _, _, P, _, _),
    A \== B.

% ----------------------------------------------------------------------------- rankings
primeiros(N, Lista, Primeiros) :-
    length(Lista, Len),
    ( N >= Len -> Primeiros = Lista ; length(Primeiros, N), append(Primeiros, _, Lista) ).

% ranking(+Cargo, +N, -Lista): os N mais votados do cargo, em pares Votos-Sq, do maior para o menor.
ranking(Cargo, N, Lista) :-
    findall(V-Sq, votos(Sq, Cargo, V), Pares),
    sort(1, @>=, Pares, Ordenados),
    primeiros(N, Ordenados, Lista).

% posicao(+Sq, -Pos): colocação do candidato entre os do mesmo cargo (1 = mais votado).
posicao(Sq, Pos) :-
    votos(Sq, Cargo, V),
    aggregate_all(count, (votos(_, Cargo, V2), V2 > V), Maiores),
    Pos is Maiores + 1.

mais_votado(Cargo, Sq, V) :-
    ranking(Cargo, 1, [V-Sq]).

% ----------------------------------------------------------------------------- partidos
partido(P) :- setof(P0, Sq^N^U^Nu^C^S^candidato(Sq, N, U, Nu, P0, C, S), Ps), member(P, Ps).

% votos_partido(?Partido, +Cargo, -Total): soma dos votos dos candidatos do partido no cargo.
votos_partido(Partido, Cargo, Total) :-
    partido(Partido),
    aggregate_all(sum(V), (candidato(Sq, _, _, _, Partido, Cargo, _), votos_uf(Sq, V)), Total),
    Total > 0.

% ranking_partidos(+Cargo, -Lista): pares Total-Partido, do maior para o menor.
ranking_partidos(Cargo, Lista) :-
    findall(T-P, votos_partido(P, Cargo, T), Pares),
    sort(1, @>=, Pares, Lista).

% ----------------------------------------------------------------------------- municípios
% votos_em(?Sq, ?Mun, ?V): votos do candidato no município (Mun = código TSE).
votos_em(Sq, Mun, V) :- votos_municipio(Sq, Mun, V).

% pct_no_municipio(+Sq, +Mun, -P): % dos votos válidos do cargo naquele município.
pct_no_municipio(Sq, Mun, P) :-
    votos_municipio(Sq, Mun, V),
    candidato(Sq, _, _, _, _, Cargo, _),
    votos_validos_municipio(Cargo, Mun, Total),
    Total > 0,
    P is 100 * V / Total.

% vencedor_municipio(+Cargo, +Mun, -Sq, -V): o mais votado do cargo naquele município.
vencedor_municipio(Cargo, Mun, Sq, V) :-
    aggregate_all(max(V0, S0), ( candidato(S0, _, _, _, _, Cargo, _), votos_municipio(S0, Mun, V0) ), max(V, Sq)).

% ranking_municipio(+Cargo, +Mun, +N, -Lista): os N mais votados no município.
ranking_municipio(Cargo, Mun, N, Lista) :-
    findall(V-Sq, ( candidato(Sq, _, _, _, _, Cargo, _), votos_municipio(Sq, Mun, V) ), Pares),
    sort(1, @>=, Pares, Ordenados),
    primeiros(N, Ordenados, Lista).

% melhores_municipios(+Sq, +N, -Lista): onde o candidato foi mais votado (em votos).
melhores_municipios(Sq, N, Lista) :-
    findall(V-Mun, votos_municipio(Sq, Mun, V), Pares),
    sort(1, @>=, Pares, Ordenados),
    primeiros(N, Ordenados, Lista).

% municipios_vencidos(+Sq, -Lista): municípios onde o candidato foi o mais votado do seu cargo.
municipios_vencidos(Sq, Lista) :-
    candidato(Sq, _, _, _, _, Cargo, _),
    findall(Mun, ( municipio(Mun, _), vencedor_municipio(Cargo, Mun, Sq, _) ), Lista).

% concentracao(+Sq, ?Mun, -P): quanto % de TODOS os votos do candidato vieram daquele município.
concentracao(Sq, Mun, P) :-
    votos_uf(Sq, Total),
    Total > 0,
    votos_municipio(Sq, Mun, V),
    P is 100 * V / Total.

% reduto(+Sq, ?Mun): município que sozinho deu ao candidato mais de 25% da sua votação.
reduto(Sq, Mun) :-
    concentracao(Sq, Mun, P),
    P > 25.

% ----------------------------------------------------------------------------- busca por nome
sem_acento(Entrada, Saida) :-
    downcase_atom(Entrada, Minusculo),
    atom_chars(Minusculo, Cs),
    maplist(tira_acento, Cs, Rs),
    atom_chars(Saida, Rs).

tira_acento(C, R) :-
    (   grupo_acento(R0, Grupo), sub_atom(Grupo, _, 1, _, C) -> R = R0 ; R = C ).

grupo_acento(a, 'àáâãäå').
grupo_acento(e, 'èéêë').
grupo_acento(i, 'ìíîï').
grupo_acento(o, 'òóôõö').
grupo_acento(u, 'ùúûü').
grupo_acento(c, 'ç').
grupo_acento(n, 'ñ').

% buscar_candidato(+Parte, ?Sq): o nome (ou nome de urna) contém o texto, sem diferenciar maiúsculas/acentos.
buscar_candidato(Parte, Sq) :-
    sem_acento(Parte, P),
    P \== '',
    nome_busca(Sq, Nome),
    once(sub_atom(Nome, _, _, _, P)).     % once: o texto pode aparecer 2x (nome + nome de urna) e duplicaria o candidato
