use crate::util;
use cspuz_rs::serializer::{
    Choice, Combinator, Context, DecInt, Dict, HexInt,
    Optionalize, Seq, Size, Spaces, UnlimitedSeq,
};
use cspuz_rs::solver::Solver;
use cspuz_rs::serializer;

pub fn solve_easyasabc(
    key_size: i32,
    key_up: &[Option<i32>],
    key_right: &[Option<i32>],
    key_down: &[Option<i32>],
    key_left: &[Option<i32>],
    center: &[Vec<Option<i32>>],
) -> Option<Vec<Vec<Option<i32>>>> {
    let (h, w) = util::infer_shape(center);
    if h != w {
        return None;
    }

    const EMPTY: i32 = 0;
    let mut solver = Solver::new();
    let letter = &solver.int_var_2d((h, w), EMPTY, key_size); // 0は空白を表す
    solver.add_answer_key_int(letter);
    
    for x in 0..w {
        for y in 0..h {
            if let Some(n) = center[y][x] {
                solver.add_expr(letter.at((y, x)).eq(n));
            }
        }
    }
    
    for x in 0..w {
        let key_u = key_up.get(x).cloned().unwrap_or(None);
        let key_d = key_down.get(x).cloned().unwrap_or(None);

        for i in 1..=key_size {
            solver.add_expr(letter.slice_fixed_y((x, ..)).eq(i).count_true().eq(1));
        }
        
        let rank = &solver.int_var_1d(h, 0, key_size);
        for y in 0..h {
            if y == 0 {
                solver.add_expr(rank.at(y).eq((letter.at((y, x)).eq(EMPTY)).ite(0, 1)));
            } else {
                solver.add_expr(
                    rank.at(y)
                        .eq((letter.at((y, x)).eq(EMPTY)).ite(rank.at(y - 1), rank.at(y - 1) + 1)),
                );
            }

            if let Some(key_u) = key_u {
                solver.add_expr(
                    (rank.at(y).eq(1) & letter.at((y, x)).ne(EMPTY))
                        .imp(letter.at((y, x)).eq(key_u)),
                );
            }
            if let Some(key_d) = key_d {
                solver.add_expr(
                    (rank.at(y).eq(key_size) & letter.at((y, x)).ne(EMPTY))
                        .imp(letter.at((y, x)).eq(key_d)),
                );
            }
        }
    }
    
    for y in 0..h {
        let key_l = key_left.get(y).cloned().unwrap_or(None);
        let key_r = key_right.get(y).cloned().unwrap_or(None);

        for i in 1..=key_size {
            solver.add_expr(letter.slice_fixed_x((.., y)).eq(i).count_true().eq(1));
        }

        let rank = &solver.int_var_1d(w, 0, key_size);
        for x in 0..w {
            if x == 0 {
                solver.add_expr(rank.at(x).eq((letter.at((y, x)).eq(EMPTY)).ite(0, 1)));
            } else {
                solver.add_expr(
                    rank.at(x)
                        .eq((letter.at((y, x)).eq(EMPTY)).ite(rank.at(x - 1), rank.at(x - 1) + 1)),
                );
            }

            if let Some(key_l) = key_l {
                solver.add_expr(
                    (rank.at(x).eq(1) & letter.at((y, x)).ne(EMPTY))
                        .imp(letter.at((y, x)).eq(key_l)),
                );
            }
            if let Some(key_r) = key_r {
                solver.add_expr(
                    (rank.at(x).eq(key_size) & letter.at((y, x)).ne(EMPTY))
                        .imp(letter.at((y, x)).eq(key_r)),
                );
            }
        }
    }

    solver.irrefutable_facts().map(|f| f.get(letter))
}

pub type Problem = (
    i32,
    Vec<Option<i32>>,      // key_up
    Vec<Option<i32>>,      // key_right
    Vec<Option<i32>>,      // key_down
    Vec<Option<i32>>,      // key_left
    Vec<Vec<Option<i32>>>, // center
);

/// 外周ヒント(`ExCell`)用のデータコンビネータ
fn excell_data_combinator() -> impl Combinator<Vec<Option<i32>>> {
    let item_combinator = Choice::new(vec![
        Box::new(Optionalize::new(HexInt)),
        Box::new(Spaces::new(None, 'g')),
    ]);
    UnlimitedSeq::new(item_combinator)
}

/// 中央盤面(`Cell`)用のデータコンビネータ
fn center_data_combinator() -> impl Combinator<Vec<Option<i32>>> {
    let item_combinator = Choice::new(vec![
        Box::new(Optionalize::new(HexInt)),
        Box::new(Spaces::new(None, 'g')),
        Box::new(Dict::new(Some(-1), ".")),
    ]);
    UnlimitedSeq::new(item_combinator)
}

struct EasyAsAbcCombinator;

impl Combinator<Problem> for EasyAsAbcCombinator {
    fn serialize(&self, ctx: &Context, input: &[Problem]) -> Option<(usize, Vec<u8>)> {
        if input.is_empty() {
            return None;
        }
        let (key_size, key_up, key_right, key_down, key_left, center) = &input[0];

        let mut excell_data: Vec<Option<i32>> = vec![];
        excell_data.extend(key_up.iter().cloned());
        excell_data.extend(key_down.iter().cloned());
        excell_data.extend(key_left.iter().cloned());
        excell_data.extend(key_right.iter().cloned());

        let center_data: Vec<Option<i32>> = center.iter().flat_map(|row| row.clone()).collect();
        let has_center_data = center_data.iter().any(|x| x.is_some());

        let mut result_bytes: Vec<u8> = vec![];
        let (_, indicator_bytes) = DecInt.serialize(ctx, &[*key_size])?;
        result_bytes.extend(indicator_bytes);
        result_bytes.push(b'/');

        let (_, excell_bytes) = excell_data_combinator().serialize(ctx, &[excell_data])?;
        result_bytes.extend(excell_bytes);

        if has_center_data {
            let (_, center_bytes) = center_data_combinator().serialize(ctx, &[center_data])?;
            result_bytes.extend(center_bytes);
        }

        Some((1, result_bytes))
    }

    fn deserialize(&self, ctx: &Context, input: &[u8]) -> Option<(usize, Vec<Problem>)> {
        let slash_pos = input.iter().position(|&c| c == b'/')?;
        let indicator_bytes = &input[..slash_pos];
        let data_bytes = &input[slash_pos + 1..];

        let (_, key_size_vec) = DecInt.deserialize(ctx, indicator_bytes)?;
        let key_size = key_size_vec.get(0).copied().unwrap_or(3);

        let height = ctx.height?;
        let width = ctx.width?;

        // 外周と中央のデータが連結されているため、まず外周の分だけをデコードする
        let excell_len = width * 2 + height * 2;
        let excell_item_combinator = Choice::new(vec![
            Box::new(Optionalize::new(HexInt)),
            Box::new(Spaces::new(None, 'g')),
        ]);
        let (excell_bytes_read, mut excell_data) =
            Seq::new(excell_item_combinator, excell_len).deserialize(ctx, data_bytes)?;
        let mut excell_flat = excell_data.swap_remove(0);

        let key_up = excell_flat.drain(0..width).collect();
        let key_down = excell_flat.drain(0..width).collect();
        let key_left = excell_flat.drain(0..height).collect();
        let key_right = excell_flat.drain(0..height).collect();

        // 残りのバイト列を中央のデータとしてデコードする
        let center_data_bytes = &data_bytes[excell_bytes_read..];
        let center = if !center_data_bytes.is_empty() {
            let (_, mut center_data_vec) =
                center_data_combinator().deserialize(ctx, center_data_bytes)?;
            let mut center_flat = center_data_vec.swap_remove(0);
            if center_flat.len() != width * height {
                center_flat.resize(width * height, None);
            }
            center_flat.chunks(width).map(|r| r.to_vec()).collect()
        } else {
            vec![vec![None; width]; height]
        };

        let problem = (key_size, key_up, key_right, key_down, key_left, center);
        Some((input.len(), vec![problem]))
    }
}

fn easyasabc_combinator() -> impl Combinator<Problem> {
    Size::new(EasyAsAbcCombinator)
}

pub fn deserialize_problem(url: &str) -> Option<Problem> {
    serializer::url_to_problem(easyasabc_combinator(), &["easyasabc"], url)
}

pub fn serialize_problem(problem: &Problem) -> Option<String> {
    let height = problem.4.len();
    let width = problem.1.len();
    if height == 0 || width == 0 {
        return None;
    }

    let ctx = Context::sized(height, width);
    serializer::problem_to_url_with_context(
        easyasabc_combinator(),
        "easyasabc",
        problem.clone(),
        &ctx,
    )
}
