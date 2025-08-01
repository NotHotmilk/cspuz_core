use crate::util;
use cspuz_rs::graph;
use cspuz_rs::serializer::{
    problem_to_url_with_context, url_to_problem, Choice, Combinator, Context, ContextBasedGrid,
    Dict, MultiDigit, Optionalize, Rooms, Size, Spaces, Tuple2,
};
use cspuz_rs::solver::{all, any, Solver};

enum PieceSet {
    Tetromino,
    Pentomino,
}

fn pentominoes() -> Vec<(char, Vec<(usize, usize)>)> {
    Vec::from([
        ('F', vec![(0, 0), (1, 0), (1, 1), (1, 2), (2, 1)]),
        ('I', vec![(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)]),
        ('L', vec![(0, 0), (0, 1), (0, 2), (0, 3), (1, 0)]),
        ('N', vec![(0, 1), (0, 2), (0, 3), (1, 0), (1, 1)]),
        ('P', vec![(0, 0), (0, 1), (0, 2), (1, 0), (1, 1)]),
        ('T', vec![(0, 0), (0, 1), (0, 2), (1, 1), (2, 1)]),
        ('U', vec![(0, 0), (0, 1), (0, 2), (1, 0), (1, 2)]),
        ('V', vec![(0, 0), (0, 1), (0, 2), (1, 0), (2, 0)]),
        ('W', vec![(0, 0), (1, 0), (1, 1), (2, 1), (2, 2)]),
        ('X', vec![(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)]),
        ('Y', vec![(0, 0), (0, 1), (0, 2), (0, 3), (1, 1)]),
        ('Z', vec![(0, 0), (0, 1), (1, 1), (2, 1), (2, 2)]),
    ])
}

fn tetrominoes() -> Vec<(char, Vec<(usize, usize)>)> {
    Vec::from([
        ('I', vec![(0, 0), (0, 1), (0, 2), (0, 3)]),
        ('L', vec![(0, 0), (1, 0), (2, 0), (0, 1)]),
        ('O', vec![(0, 0), (0, 1), (1, 0), (1, 1)]),
        ('S', vec![(0, 0), (0, 1), (1, 1), (1, 2)]),
        ('T', vec![(0, 0), (0, 1), (0, 2), (1, 1)]),
    ])
}

fn get_pieces(piece_set: PieceSet) -> Vec<(char, Vec<(usize, usize)>)> {
    match piece_set {
        PieceSet::Tetromino => tetrominoes(),
        PieceSet::Pentomino => pentominoes(),
    }
}

fn bbox(piece: &[(usize, usize)]) -> (usize, usize) {
    let mut h = 0;
    let mut w = 0;
    for &(y, x) in piece {
        h = h.max(y + 1);
        w = w.max(x + 1);
    }
    (h, w)
}

fn rotate(piece: &[(usize, usize)]) -> Vec<(usize, usize)> {
    let (h, _w) = bbox(piece);
    piece.iter().map(|&(y, x)| (x, h - y - 1)).collect()
}

fn flip(piece: &[(usize, usize)]) -> Vec<(usize, usize)> {
    let (h, _w) = bbox(piece);
    piece.iter().map(|&(y, x)| (h - y - 1, x)).collect()
}

fn enumerate_variants(piece: &[(usize, usize)]) -> Vec<Vec<(usize, usize)>> {
    let mut cands = vec![];
    cands.push(piece.to_owned());
    for i in 0..3 {
        cands.push(rotate(&cands[i]));
    }
    for i in 0..4 {
        cands.push(flip(&cands[i]));
    }
    cands.sort();
    cands.dedup();

    cands
}

fn adjacent_edges(piece: &[(usize, usize)]) -> (Vec<(usize, usize)>, Vec<(usize, usize)>) {
    let mut horizontal = vec![];
    let mut vertical = vec![];

    for &(y, x) in piece {
        if piece.iter().find(|&&p| p == (y + 1, x)).is_some() {
            horizontal.push((y, x));
        }
        if piece.iter().find(|&&p| p == (y, x + 1)).is_some() {
            vertical.push((y, x));
        }
    }

    (horizontal, vertical)
}

fn solve_polyominous(
    clues: &[Vec<Option<i32>>],
    default_borders: &Option<graph::InnerGridEdges<Vec<Vec<bool>>>>,
    piece_set: PieceSet,
) -> Option<graph::BoolInnerGridEdgesIrrefutableFacts> {
    let (h, w) = util::infer_shape(clues);

    let polyset = get_pieces(piece_set);
    let size_of_set = polyset.len();
    let size_of_piece = polyset[0].1.len();

    let mut solver = Solver::new();
    let kind_ranges = clues
        .iter()
        .map(|row| {
            row.iter()
                .map(|&x| {
                    if x == Some(-1) {
                        (-1, -1)
                    } else {
                        (0, size_of_set as i32 - 1)
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    let kind = &solver.int_var_2d_from_ranges((h, w), &kind_ranges);

    let is_border = graph::BoolInnerGridEdges::new(&mut solver, (h, w));
    solver.add_answer_key_bool(&is_border.horizontal);
    solver.add_answer_key_bool(&is_border.vertical);

    if let Some(default_borders) = default_borders {
        for y in 0..h {
            for x in 0..(w - 1) {
                if default_borders.vertical[y][x] {
                    solver.add_expr(is_border.vertical.at((y, x)));
                }
            }
        }
        for y in 0..(h - 1) {
            for x in 0..w {
                if default_borders.horizontal[y][x] {
                    solver.add_expr(is_border.horizontal.at((y, x)));
                }
            }
        }
    }

    solver.add_expr(
        &is_border.horizontal
            ^ (kind.slice((..(h - 1), ..)).ge(0)
                & (kind.slice((..(h - 1), ..)).eq(kind.slice((1.., ..))))),
    );
    solver.add_expr(
        &is_border.vertical
            ^ (kind.slice((.., ..(w - 1))).ge(0)
                & (kind.slice((.., ..(w - 1))).eq(kind.slice((.., 1..))))),
    );

    let sizes = clues
        .iter()
        .map(|row| {
            row.iter()
                .map(|&x| {
                    if x == Some(-1) {
                        (1, 1)
                    } else {
                        (size_of_piece as i32, size_of_piece as i32)
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    let sizes = &solver.int_var_2d_from_ranges((h, w), &sizes);
    graph::graph_division_2d(&mut solver, sizes, &is_border);

    for y in 0..h {
        for x in 0..w {
            if let Some(id) = clues[y][x] {
                solver.add_expr(kind.at((y, x)).eq(id));
            }
        }
    }

    let poly_variants = polyset
        .iter()
        .map(|(_, pat)| enumerate_variants(pat))
        .collect::<Vec<_>>();
    let poly_adjacent_edges = poly_variants
        .iter()
        .map(|pats| {
            pats.iter()
                .map(|pat| adjacent_edges(pat))
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    for y in 0..h {
        for x in 0..w {
            if clues[y][x] == Some(-1) {
                continue;
            }
            let mut conds = vec![];
            for i in 0..size_of_set {
                for j in 0..poly_variants[i].len() {
                    let (ph, pw) = bbox(&poly_variants[i][j]);
                    for k in 0..size_of_piece {
                        if y < poly_variants[i][j][k].0 || x < poly_variants[i][j][k].1 {
                            continue;
                        }
                        let ty = y - poly_variants[i][j][k].0;
                        let tx = x - poly_variants[i][j][k].1;
                        if ty + ph > h || tx + pw > w {
                            continue;
                        }

                        let mut c = vec![kind.at((y, x)).eq(i as i32)];
                        for &(dy, dx) in &poly_adjacent_edges[i][j].0 {
                            c.push(!is_border.horizontal.at((ty + dy, tx + dx)));
                        }
                        for &(dy, dx) in &poly_adjacent_edges[i][j].1 {
                            c.push(!is_border.vertical.at((ty + dy, tx + dx)));
                        }
                        conds.push(all(c));
                    }
                }
            }

            solver.add_expr(any(conds));
        }
    }

    solver.irrefutable_facts().map(|f| f.get(&is_border))
}

pub fn solve_pentominous(
    clues: &[Vec<Option<i32>>],
    default_borders: &Option<graph::InnerGridEdges<Vec<Vec<bool>>>>,
) -> Option<graph::BoolInnerGridEdgesIrrefutableFacts> {
    solve_polyominous(clues, default_borders, PieceSet::Pentomino)
}

pub fn solve_tetrominous(
    clues: &[Vec<Option<i32>>],
    default_borders: &Option<graph::InnerGridEdges<Vec<Vec<bool>>>>,
) -> Option<graph::BoolInnerGridEdgesIrrefutableFacts> {
    solve_polyominous(clues, default_borders, PieceSet::Tetromino)
}

type Problem = (
    Vec<Vec<Option<i32>>>,
    Option<graph::InnerGridEdges<Vec<Vec<bool>>>>,
);

fn combinator() -> impl Combinator<Problem> {
    Size::new(Tuple2::new(
        ContextBasedGrid::new(Choice::new(vec![
            Box::new(Spaces::new(None, 'g')),
            Box::new(Dict::new(Some(-1), "c")),
            Box::new(Optionalize::new(MultiDigit::new(12, 1))),
        ])),
        Choice::new(vec![
            Box::new(Optionalize::new(Rooms)),
            Box::new(Dict::new(None, "")),
        ]),
    ))
}

pub fn serialize_tetrominous_problem(problem: &Problem) -> Option<String> {
    let (h, w) = util::infer_shape(&problem.0);
    problem_to_url_with_context(
        combinator(),
        "tetrominous",
        problem.clone(),
        &Context::sized(h, w),
    )
}

pub fn deserialize_tetrominous_problem(url: &str) -> Option<Problem> {
    url_to_problem(combinator(), &["tetrominous"], url)
}

pub fn serialize_pentominous_problem(problem: &Problem) -> Option<String> {
    let (h, w) = util::infer_shape(&problem.0);
    problem_to_url_with_context(
        combinator(),
        "pentominous",
        problem.clone(),
        &Context::sized(h, w),
    )
}

pub fn deserialize_pentominous_problem(url: &str) -> Option<Problem> {
    url_to_problem(combinator(), &["pentominous"], url)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn problem_for_tests_pentominous() -> Problem {
        // V: 7, L: 2
        (
            vec![
                vec![Some(7), Some(2), None, None, None],
                vec![None, None, None, None, None],
                vec![None, None, None, None, None],
                vec![None, None, None, None, None],
                vec![None, None, None, None, None],
            ],
            None,
        )
    }

    fn problem_for_tests_tetrominous() -> Problem {
        // S: 3
        (
            vec![
                vec![None, None, None, None],
                vec![None, None, None, None],
                vec![Some(3), None, None, None],
                vec![None, None, None, None],
            ],
            None,
        )
    }

    #[test]
    fn test_pentominous_problem() {
        let (clues, borders) = problem_for_tests_pentominous();
        let ans = solve_pentominous(&clues, &borders);
        assert!(ans.is_some());
        let ans = ans.unwrap();
        let expected = graph::BoolInnerGridEdgesIrrefutableFacts {
            horizontal: crate::util::tests::to_option_bool_2d([
                [0, 0, 1, 1, 1],
                [0, 1, 1, 0, 1],
                [1, 1, 1, 0, 0],
                [0, 0, 1, 1, 0],
            ]),
            vertical: crate::util::tests::to_option_bool_2d([
                [1, 0, 0, 0],
                [1, 1, 0, 0],
                [0, 0, 1, 1],
                [0, 0, 1, 1],
                [0, 1, 0, 0],
            ]),
        };
        assert_eq!(ans, expected);
    }

    #[test]
    fn test_pentominous_serializer() {
        let problem = problem_for_tests_pentominous();
        let url = "https://puzz.link/p?pentominous/5/5/72zi";
        util::tests::serializer_test(
            problem,
            url,
            serialize_pentominous_problem,
            deserialize_pentominous_problem,
        );
    }

    #[test]
    fn test_tetrominous_problem() {
        let (clues, borders) = problem_for_tests_tetrominous();
        let ans = solve_tetrominous(&clues, &borders);
        assert!(ans.is_some());
        let ans = ans.unwrap();
        let expected = graph::BoolInnerGridEdgesIrrefutableFacts {
            horizontal: crate::util::tests::to_option_bool_2d([
                [0, 1, 1, 0],
                [1, 0, 1, 0],
                [1, 1, 0, 0],
            ]),
            vertical: crate::util::tests::to_option_bool_2d([
                [0, 0, 1],
                [1, 0, 1],
                [0, 1, 1],
                [0, 0, 1],
            ]),
        };
        assert_eq!(ans, expected);
    }

    #[test]
    fn test_tetrominous_serializer() {
        let problem = problem_for_tests_tetrominous();
        let url = "https://puzz.link/p?tetrominous/4/4/n3m";
        util::tests::serializer_test(
            problem,
            url,
            serialize_tetrominous_problem,
            deserialize_tetrominous_problem,
        );
    }
}
