use crate::util;
use cspuz_rs::serializer::{
    problem_to_url, url_to_problem, Choice, Combinator, Grid, HexInt, Optionalize, Spaces,
};
use cspuz_rs::solver::{any, Solver};

#[derive(PartialEq, Eq, Debug, Clone, Copy)]
pub enum ShugakuKind {
    Pillar,
    Aisle,
    Pillow,
    Futon,
}

// +---+---+
// |[ ]    | : West
// +---+---+
//
// +---+---+
// |    [ ]| : East
// +---+---+
//
// +---+
// |   |
// +   +
// |[ ]| : South
// +---+

#[derive(PartialEq, Eq, Debug, Clone, Copy)]
pub enum ShugakuDirection {
    None,
    West,
    East,
    South,
}

pub type Problem = Vec<Vec<Option<i32>>>;

// kind と dir を返す
pub fn solve_shugaku(
    problem: &Problem,
) -> Option<(Vec<Vec<Option<ShugakuKind>>>, Vec<Vec<Option<ShugakuDirection>>>)> {
    let (h, w) = util::infer_shape(problem);

    let mut solver = Solver::new();
    let kind = solver.int_var_2d((h, w), 0, 3);
    let direction = solver.int_var_2d((h, w), 0, 3);

    solver.add_answer_key_int(&kind);
    solver.add_answer_key_int(&direction);

    cspuz_rs::graph::active_vertices_connected_2d(&mut solver, &kind.eq(ShugakuKind::Aisle as i32));
    solver.add_expr(!kind.eq(ShugakuKind::Aisle as i32).conv2d_and((2, 2)));

    // 柱(Pillar)または通路(Aisle)であることと、向きがNoneであることは同値
    solver.add_expr(
        (kind.eq(ShugakuKind::Pillar as i32) | kind.eq(ShugakuKind::Aisle as i32))
            .iff(direction.eq(ShugakuDirection::None as i32)),
    );

    // --- 問題の数字に関するルール ---
    for y in 0..h {
        for x in 0..w {
            match problem[y][x] {
                // 5は柱
                Some(5) => solver.add_expr(kind.at((y, x)).eq(ShugakuKind::Pillar as i32)),
                // その他の数字マス
                Some(n) => {
                    solver.add_expr(kind.at((y, x)).eq(ShugakuKind::Pillar as i32));
                    // 数字は周囲にある枕(Pillow)の数を示す
                    solver.add_expr(
                        kind.four_neighbors((y, x))
                            .eq(ShugakuKind::Pillow as i32)
                            .count_true()
                            .eq(n),
                    );
                }
                // 空白マスは柱ではない
                None => solver.add_expr(kind.at((y, x)).ne(ShugakuKind::Pillar as i32)),
            }
        }
    }

    // --- 布団のルール ---
    for y in 0..h {
        for x in 0..w {
            // 西向きの枕 <=> 1つ右のマスが西向きの布団
            let west_pillow = kind.at((y, x)).eq(ShugakuKind::Pillow as i32)
                & direction.at((y, x)).eq(ShugakuDirection::West as i32);
            if x < w - 1 {
                let west_futon = kind.at((y, x + 1)).eq(ShugakuKind::Futon as i32)
                    & direction.at((y, x + 1)).eq(ShugakuDirection::West as i32);
                solver.add_expr(west_pillow.iff(west_futon));
            } else {
                solver.add_expr(!west_pillow);

                let east_futon = kind.at((y, x)).eq(ShugakuKind::Futon as i32)
                    & direction.at((y, x)).eq(ShugakuDirection::East as i32);
                solver.add_expr(!east_futon);
            }

            // 東向きの枕 <=> 1つ左のマスが東向きの布団
            let east_pillow = kind.at((y, x)).eq(ShugakuKind::Pillow as i32)
                & direction.at((y, x)).eq(ShugakuDirection::East as i32);
            if x > 0 {
                let east_futon = kind.at((y, x - 1)).eq(ShugakuKind::Futon as i32)
                    & direction.at((y, x - 1)).eq(ShugakuDirection::East as i32);
                solver.add_expr(east_pillow.iff(east_futon));
            } else {
                solver.add_expr(!east_pillow);
                let west_futon = kind.at((y, x)).eq(ShugakuKind::Futon as i32)
                    & direction.at((y, x)).eq(ShugakuDirection::West as i32);
                solver.add_expr(!west_futon);
            }

            // 南向きの枕 <=> 1つ上のマスが南向きの布団
            let south_pillow = kind.at((y, x)).eq(ShugakuKind::Pillow as i32)
                & direction.at((y, x)).eq(ShugakuDirection::South as i32);
            if y > 0 {
                let south_futon = kind.at((y - 1, x)).eq(ShugakuKind::Futon as i32)
                    & direction.at((y - 1, x)).eq(ShugakuDirection::South as i32);
                solver.add_expr(south_pillow.iff(south_futon));
            } else {
                solver.add_expr(!south_pillow);
            }

            if y == h - 1 {
                let south_futon = kind.at((y, x)).eq(ShugakuKind::Futon as i32)
                    & direction.at((y, x)).eq(ShugakuDirection::South as i32);
                solver.add_expr(!south_futon);
            }
        }
    }


    // --- 枕と通路の隣接ルール ---
    let neighbor_defs: &[(ShugakuDirection, (&[i32], &[i32]))] = &[
        (
            ShugakuDirection::South,
            (&[-2, 1, -1, 0, -1, 0], &[0, 0, -1, -1, 1, 1]),
        ),
        (
            ShugakuDirection::West,
            (&[0, 0, -1, -1, 1, 1], &[2, -1, 1, 0, 1, 0]),
        ),
        (
            ShugakuDirection::East,
            (&[0, 0, -1, -1, 1, 1], &[-2, 1, -1, 0, -1, 0]),
        ),
    ];

    for y in 0..h {
        for x in 0..w {
            for (dir_key, (dy, dx)) in neighbor_defs {
                let mut neighbor_aisles = vec![];
                for i in 0..dy.len() {
                    let ny = y as i32 + dy[i];
                    let nx = x as i32 + dx[i];

                    if ny >= 0 && ny < h as i32 && nx >= 0 && nx < w as i32 {
                        neighbor_aisles
                            .push(kind.at((ny as usize, nx as usize)).eq(ShugakuKind::Aisle as i32));
                    }
                }
                let is_pillow_with_dir = kind.at((y, x)).eq(ShugakuKind::Pillow as i32)
                    & direction.at((y, x)).eq(*dir_key as i32);
                solver.add_expr(is_pillow_with_dir.imp(any(neighbor_aisles)));
            }
        }
    }


    // if let Some(model) = solver.solve() {
    //     let solved_kind = model.get(&kind);
    //     let solved_direction = model.get(&direction);
    //
    //     // Vec<Vec<i32>>をVec<Vec<Option<Kind>>>に変換
    //     let result_kind: Vec<Vec<Option<Kind>>> = solved_kind
    //         .iter()
    //         .map(|row| {
    //             row.iter()
    //                 .map(|&n| {
    //                     Some(match n {
    //                         0 => Kind::Pillar,
    //                         1 => Kind::Aisle,
    //                         2 => Kind::Pillow,
    //                         3 => Kind::Futon,
    //                         _ => panic!("Unexpected value for Kind: {}", n),
    //                     })
    //                 })
    //                 .collect()
    //         })
    //         .collect();
    //
    //     let result_direction: Vec<Vec<Option<Direction>>> = solved_direction
    //         .iter()
    //         .map(|row| {
    //             row.iter()
    //                 .map(|&n| {
    //                     Some(match n {
    //                         0 => Direction::None,
    //                         1 => Direction::West,
    //                         2 => Direction::East,
    //                         3 => Direction::South,
    //                         _ => panic!("Unexpected value for Direction: {}", n),
    //                     })
    //                 })
    //                 .collect()
    //         })
    //         .collect();
    //
    //     Some((result_kind, result_direction))
    // } else {
    //     None
    // }

    solver.irrefutable_facts().map(|f| {
        (
            f.get(&kind)
                .into_iter()
                .map(|row| {
                    row.into_iter()
                        .map(|v| {
                            v.map(|n| match n {
                                0 => ShugakuKind::Pillar,
                                1 => ShugakuKind::Aisle,
                                2 => ShugakuKind::Pillow,
                                3 => ShugakuKind::Futon,
                                _ => panic!(),
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .collect::<Vec<_>>(),
            f.get(&direction)
                .into_iter()
                .map(|row| {
                    row.into_iter()
                        .map(|v| {
                            v.map(|n| match n {
                                0 => ShugakuDirection::None,
                                1 => ShugakuDirection::West,
                                2 => ShugakuDirection::East,
                                3 => ShugakuDirection::South,
                                _ => panic!(),
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .collect::<Vec<_>>(),
        )
    })
}

// --- シリアライズ/デシリアライズ ---

fn combinator() -> impl Combinator<Problem> {
    Grid::new(Choice::new(vec![
        Box::new(Spaces::new(None, '6')),
        Box::new(Optionalize::new(HexInt)),
    ]))
}

pub fn serialize_problem(problem: &Problem) -> Option<String> {
    problem_to_url(combinator(), "shugaku", problem.clone())
}

pub fn deserialize_problem(url: &str) -> Option<Problem> {
    url_to_problem(combinator(), &["shugaku"], url)
}

// main関数の代わり、またはmain関数から呼び出す

// main関数に下記を追加、または置き換え
// ... solve_shugaku や enums の定義はそのまま ...

/// パズルの問題と解答を見やすくコンソールに表示します。
pub fn print_solution(
    problem: &Problem,
    kind_sol: &Vec<Vec<Option<ShugakuKind>>>,
    dir_sol: &Vec<Vec<Option<ShugakuDirection>>>,
) {
    let (h, w) = util::infer_shape(problem);

    println!("{}", format!("┌{}───┐", "───┬".repeat(w - 1)));

    for y in 0..h {
        let mut line = "│".to_string();
        for x in 0..w {
            let cell_char = match (kind_sol[y][x], dir_sol[y][x]) {
                (Some(ShugakuKind::Pillar), _) => {
                    let clue = problem[y][x]
                        .map(|n| n.to_string())
                        .unwrap_or("?".to_string());
                    format!(" {} ", clue)
                }
                (Some(ShugakuKind::Aisle), _) => " . ".to_string(),
                (Some(ShugakuKind::Pillow), Some(ShugakuDirection::West)) => " ◀ ".to_string(),
                (Some(ShugakuKind::Pillow), Some(ShugakuDirection::East)) => " ▶ ".to_string(),
                (Some(ShugakuKind::Pillow), Some(ShugakuDirection::South)) => " ▼ ".to_string(),
                (Some(ShugakuKind::Futon), _) => " ■ ".to_string(),
                _ => " ? ".to_string(),
            };
            line.push_str(&cell_char);
            line.push('│');
        }
        println!("{}", line);

        if y < h - 1 {
            println!("{}", format!("├{}───┤", "───┼".repeat(w - 1)));
        }
    }

    println!("{}", format!("└{}───┘", "───┴".repeat(w - 1)));
}
