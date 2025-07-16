use crate::util;
use cspuz_rs::{graph, serializer};
use cspuz_rs::serializer::{Choice, Combinator, Context, FixedLengthHexInt, Optionalize, Size, Spaces, UnlimitedSeq};
use cspuz_rs::solver::Solver;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum KurarinClue {
    None,
    White,
    Gray,
    Black,
}


pub fn solve_kurarin(
    clues: &[Vec<KurarinClue>],
) -> Option<(graph::BoolGridEdgesIrrefutableFacts, Vec<Vec<Option<bool>>>)> {
    let (h_clue, w_clue) = util::infer_shape(clues);
    let h = (h_clue + 1) / 2;
    let w = (w_clue + 1) / 2;

    let mut solver = Solver::new();
    let is_line = &graph::BoolGridEdges::new(&mut solver, (h - 1, w - 1));
    solver.add_answer_key_bool(&is_line.horizontal);
    solver.add_answer_key_bool(&is_line.vertical);

    let is_passed = &graph::single_cycle_grid_edges(&mut solver, is_line);
    let is_black = &solver.bool_var_2d((h, w));
    solver.add_answer_key_bool(is_black);
    solver.add_expr(is_passed ^ is_black);

    for y in 0..h_clue {
        for x in 0..w_clue {
            let b = is_black.slice(((y / 2)..=((y + 1) / 2), (x / 2)..=((x + 1) / 2))).count_true();
            let w = (!is_black).slice(((y / 2)..=((y + 1) / 2), (x / 2)..=((x + 1) / 2))).count_true();

            match clues[y][x] {
                KurarinClue::None => {}
                KurarinClue::White => {
                    solver.add_expr(b.lt(w));
                }
                KurarinClue::Gray => {
                    solver.add_expr(b.eq(w));
                }
                KurarinClue::Black => {
                    solver.add_expr(b.gt(w));
                }
            }
        }
    }

    solver
        .irrefutable_facts()
        .map(|f| (f.get(is_line), f.get(is_black)))
}


impl KurarinClue {
    fn to_digit(self) -> i32 {
        match self {
            KurarinClue::None => 0,
            KurarinClue::Black => 1,
            KurarinClue::Gray => 2,
            KurarinClue::White => 3,
        }
    }

    fn from_digit(digit: i32) -> Self {
        match digit {
            1 => KurarinClue::Black,
            2 => KurarinClue::Gray,
            3 => KurarinClue::White,
            _ => KurarinClue::None,
        }
    }
}

pub type Problem = Vec<Vec<KurarinClue>>;

// --- カスタムコンビネータの定義 ---
/// `kurarin`の盤面データ部分（ドットのペアのシーケンス）を扱うための専用コンビネータ
struct KurarinDataCombinator;

impl Combinator<Problem> for KurarinDataCombinator {
    /// Problem (Vec<Vec<KurarinClue>>) -> URLデータ (Vec<u8>) へのシリアライズ
    fn serialize(&self, ctx: &Context, input: &[Problem]) -> Option<(usize, Vec<u8>)> {
        if input.is_empty() {
            return None;
        }
        let problem = &input[0];
        let height = problem.len();
        if height == 0 {
            // 空の盤面は "0" ではなく空文字列としてエンコードされる
            return Some((1, vec![]));
        }
        let width = problem[0].len();

        // 2DのProblemを1Dにフラット化
        let mut flat: Vec<KurarinClue> = Vec::with_capacity(width * height);
        for row in problem {
            flat.extend(row.iter().copied());
        }

        // 1D配列をペアに分割し、それぞれを4ビットの数値 (Option<i32>) に変換
        let mut pairs = vec![];
        for chunk in flat.chunks(2) {
            let clue1 = chunk[0];
            let clue2 = if chunk.len() > 1 { chunk[1] } else { KurarinClue::None };
            let val = (clue1.to_digit() << 2) | clue2.to_digit();
            if val == 0 {
                pairs.push(None);
            } else {
                pairs.push(Some(val));
            }
        }

        // `genericEncodeNumber16`のロジックを再現する内部コンビネータ
        let inner_combinator = UnlimitedSeq::new(Choice::new(vec![
            Box::new(Optionalize::new(FixedLengthHexInt::new(1))),
            Box::new(Spaces::new(None, 'g')),
        ]));

        // 変換後の中間データ `Vec<Option<i32>>` を使ってシリアライズを実行
        inner_combinator.serialize(ctx, &[pairs])
    }

    /// URLデータ (Vec<u8>) -> Problem (Vec<Vec<KurarinClue>>) へのデシリアライズ
    fn deserialize(&self, ctx: &Context, input: &[u8]) -> Option<(usize, Vec<Problem>)> {
        // Contextから盤面のセルサイズを取得し、ドット盤面のサイズを計算
        let cell_h = ctx.height?;
        let cell_w = ctx.width?;
        let height = (cell_h * 2) - 1;
        let width = (cell_w * 2) - 1;

        // `genericDecodeNumber16`のロジックを再現する内部コンビネータ
        let inner_combinator = UnlimitedSeq::new(Choice::new(vec![
            Box::new(Optionalize::new(FixedLengthHexInt::new(1))),
            Box::new(Spaces::new(None, 'g')),
        ]));

        // デシリアライズして中間データ `Vec<Vec<Option<i32>>>` を取得
        let (n_read, pairs_vec) = inner_combinator.deserialize(ctx, input)?;
        if pairs_vec.is_empty() {
            return None;
        }
        let pairs = &pairs_vec[0];

        // ペアのシーケンスをフラットなKurarinClueのシーケンスに逆変換
        let mut flat = vec![];
        for pair in pairs {
            let val = pair.unwrap_or(0);
            let clue1 = KurarinClue::from_digit((val >> 2) & 3);
            let clue2 = KurarinClue::from_digit(val & 3);
            flat.push(clue1);
            flat.push(clue2);
        }
        flat.truncate(width * height);
        // データが足りない場合はNoneを詰める
        if flat.len() < width * height {
            flat.resize(width * height, KurarinClue::None);
        }

        // 1D配列を2DのProblemに再構成
        let mut problem: Problem = Vec::with_capacity(height);
        for y in 0..height {
            let start = y * width;
            problem.push(flat[start..start + width].to_vec());
        }

        Some((n_read, vec![problem]))
    }
}

/// `kurarin`のURL全体を処理するコンビネータ
fn kurarin_combinator() -> impl Combinator<Problem> {
    // `Size`コンビネータでサイズ情報を処理し、
    // 残りのデータ部分をカスタムコンビネータ `KurarinDataCombinator` に渡す
    Size::new(KurarinDataCombinator)
}

/// URL文字列から`Problem`をデシリアライズします。
pub fn deserialize_problem(url: &str) -> Option<Problem> {
    serializer::url_to_problem(kurarin_combinator(), &["kurarin"], url)
}

/// `Problem`をURL文字列にシリアライズします。
pub fn serialize_problem(problem: &Problem) -> Option<String> {
    // ドット盤面のサイズからセルのサイズを逆算
    let height = (problem.len() + 1) / 2;
    let width = if height > 0 { (problem[0].len() + 1) / 2 } else { 0 };

    let ctx = Context::sized(height, width);
    let (_, body) = kurarin_combinator().serialize(&ctx, &[problem.clone()])?;

    let puzzle_kind = "kurarin";
    let prefix = "https://puzz.link/p?";
    String::from_utf8(body).ok().map(|body_str| {
        format!("{}{}?{}/{}/{}", prefix, puzzle_kind, width, height, body_str)
            .replace("/?","/") // puzz.linkがwidth/heightの前に?を要求しない場合への対応
    })
}