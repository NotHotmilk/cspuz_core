use cspuz_rs::graph;

use cspuz_rs::serializer::{get_kudamono_url_info_detailed, parse_kudamono_dimension, problem_to_url_with_context, url_to_problem, Combinator, Context, KudamonoBorder, Rooms, Size};

use cspuz_rs::solver::{any, count_true, Solver};

use cspuz_core::custom_constraints::SimpleCustomConstraint;
use std::collections::HashSet;

pub fn solve_anymino(
    borders: &graph::InnerGridEdges<Vec<Vec<bool>>>,
) -> Option<Vec<Vec<Option<bool>>>> {
    let h = borders.vertical.len();
    assert!(h > 0);
    let w = borders.vertical[0].len() + 1;

    let mut solver = Solver::new();
    let is_black = &solver.bool_var_2d((h, w));
    solver.add_answer_key_bool(is_black);

    graph::active_vertices_connected_2d(&mut solver, is_black);
    solver.add_expr(!is_black.conv2d_and((2, 2)));

    let rooms = graph::borders_to_rooms(borders);
    if rooms.len() < 2 {
        return None;
    }
    let mut room_id = vec![vec![0; w]; h];
    for (i, room) in rooms.iter().enumerate() {
        for &(y, x) in room {
            room_id[y][x] = i;
        }
    }

    let room_sizes = &solver.int_var_1d(rooms.len(), 3, (h * w) as i32);
    for i in 0..rooms.len() {
        let room_cells = &rooms[i];

        // --- 制約1: 各部屋の黒マスは連結している ---
        graph::active_vertices_connected_2d_region(&mut solver, &is_black, room_cells);

        // --- 制約2: 各部屋の黒マスの数は指定されたサイズと等しい ---
        let mut black_cell_exprs = Vec::with_capacity(room_cells.len());
        for &(y, x) in room_cells {
            black_cell_exprs.push(is_black.at((y, x)).expr());
        }
        solver.add_expr(count_true(black_cell_exprs).eq(room_sizes.at(i)));

        // --- 制約3: 隣接する部屋との境界に関する制約 ---
        let mut adjacent_constraints = vec![];
        let current_room_id = i;
        for &(y, x) in room_cells {
            // (y, x) の上下左右の隣接セルをループでチェック
            for (dy, dx) in [(0, 1), (1, 0), (0, -1), (-1, 0)] {
                let (ny, nx) = (y as i32 + dy, x as i32 + dx);

                // 盤面の範囲外はスキップ
                if ny < 0 || ny >= h as i32 || nx < 0 || nx >= w as i32 {
                    continue;
                }

                let (ny, nx) = (ny as usize, nx as usize);
                let neighbor_room_id = room_id[ny][nx];
                // 隣接セルが別の部屋の場合、制約候補を追加
                if current_room_id != neighbor_room_id {
                    let constraint = is_black.at((y, x))
                        & is_black.at((ny, nx))
                        & room_sizes
                        .at(current_room_id)
                        .eq(room_sizes.at(neighbor_room_id));

                    adjacent_constraints.push(constraint);
                }
            }
        }

        // この部屋が他の部屋と隣接している場合、
        // 「黒マス同士で接しており、かつ部屋サイズが同じ」という境界が"少なくとも1つ"存在する、という制約を追加。
        if !adjacent_constraints.is_empty() {
            solver.add_expr(any(&adjacent_constraints));
        }
    }

    let constraint = AnyminoConstraint::new(h, w, rooms, room_id);
    solver.add_custom_constraint(Box::new(constraint), is_black);

    solver.irrefutable_facts().map(|f| f.get(is_black))
}

#[derive(PartialEq, Eq, Clone, Copy, Debug)]
enum CellState {
    Black,
    White,
    Undecided,
}

struct AnyminoConstraint {
    height: usize,
    width: usize,
    rooms: Vec<Vec<(usize, usize)>>,
    room_id_map: Vec<Vec<usize>>,
    board: Vec<Vec<CellState>>,
    decision_stack: Vec<(usize, usize)>,
}

impl AnyminoConstraint {
    fn new(
        height: usize,
        width: usize,
        rooms: Vec<Vec<(usize, usize)>>,
        room_id_map: Vec<Vec<usize>>,
    ) -> AnyminoConstraint {
        AnyminoConstraint {
            height,
            width,
            rooms,
            room_id_map,
            board: vec![vec![CellState::Undecided; width]; height],
            decision_stack: vec![],
        }
    }
}

fn adjust_bbox(block: &mut [(i32, i32)]) {
    let mut min_y = i32::MAX;
    let mut min_x = i32::MAX;
    for &(y, x) in block.iter() {
        min_y = min_y.min(y);
        min_x = min_x.min(x);
    }
    for p in block.iter_mut() {
        p.0 -= min_y;
        p.1 -= min_x;
    }
}

fn flip_block(block: &[(i32, i32)]) -> Vec<(i32, i32)> {
    let mut ymax = 0;
    for &(y, _) in block.iter() {
        ymax = ymax.max(y);
    }
    let mut ret = block
        .iter()
        .map(|&(y, x)| (ymax - y, x))
        .collect::<Vec<_>>();
    ret.sort();
    ret
}

fn rotate_block(block: &[(i32, i32)]) -> Vec<(i32, i32)> {
    let mut ymax = 0;
    for &(y, _) in block.iter() {
        ymax = ymax.max(y);
    }

    let mut ret = block
        .iter()
        .map(|&(y, x)| (x, ymax - y))
        .collect::<Vec<_>>();
    ret.sort();
    ret
}

fn normalize_block(mut block: Vec<(i32, i32)>) -> Vec<(i32, i32)> {
    if block.is_empty() {
        return vec![];
    }
    adjust_bbox(&mut block);
    block.sort();

    let mut ret = block.clone();
    for i in 0..4 {
        ret = ret.min(block.clone());
        ret = ret.min(flip_block(&block));
        if i < 3 {
            block = rotate_block(&block);
        }
    }
    ret
}

impl SimpleCustomConstraint for AnyminoConstraint {
    fn initialize_sat(&mut self, num_inputs: usize) {
        assert_eq!(num_inputs, self.height * self.width);
    }

    fn notify(&mut self, index: usize, value: bool) {
        let y = index / self.width;
        let x = index % self.width;
        self.board[y][x] = if value {
            CellState::Black
        } else {
            CellState::White
        };
        self.decision_stack.push((y, x));
    }

    fn find_inconsistency(&mut self) -> Option<Vec<(usize, bool)>> {
        let mut closed_blocks = vec![vec![]; self.rooms.len()];
        let mut black_cells = vec![HashSet::new(); self.rooms.len()];
        let mut white_adjacent_cells = vec![HashSet::new(); self.rooms.len()];
        let mut adjacent_rooms = vec![HashSet::new(); self.rooms.len()];

        for room_id in 0..self.rooms.len() {
            let room_cells = &self.rooms[room_id];
            let mut is_closed = true;

            for &(y, x) in room_cells {
                if self.board[y][x] == CellState::Black {
                    black_cells[room_id].insert((y as i32, x as i32));
                }
            }
            
            for &(y, x) in &black_cells[room_id] {
                for (dy, dx) in [(0, 1), (1, 0), (0, -1), (-1, 0)] {
                    let (ny, nx) = (y + dy, x + dx);
                    if ny < 0 || ny >= self.height as i32 || nx < 0 || nx >= self.width as i32 {
                        continue;
                    }

                    if self.room_id_map[ny as usize][nx as usize] != room_id {
                        if self.board[ny as usize][nx as usize] == CellState::Black {
                            adjacent_rooms[room_id]
                                .insert(self.room_id_map[ny as usize][nx as usize]);
                        }
                    } else if self.board[ny as usize][nx as usize] == CellState::White {
                        white_adjacent_cells[room_id].insert((ny, nx));
                    } else if self.board[ny as usize][nx as usize] == CellState::Undecided {
                        is_closed = false;
                        break;
                    }
                }
                if !is_closed {
                    break;
                }
            }

            if !is_closed || black_cells[room_id].is_empty() {
                continue;
            }

            closed_blocks[room_id] =
                normalize_block(black_cells[room_id].iter().cloned().collect());
        }

        for room_id in 0..self.rooms.len() {
            if closed_blocks[room_id].is_empty() {
                continue;
            }
            if adjacent_rooms.is_empty() {
                continue; 
            }

            for &adjacent_room_id in &adjacent_rooms[room_id] {
                if closed_blocks[adjacent_room_id].is_empty() {
                    continue;
                }

                if closed_blocks[room_id] == closed_blocks[adjacent_room_id] {
                    let mut ret = vec![];
                    for &(y, x) in &black_cells[room_id] {
                        ret.push(((y * self.width as i32 + x) as usize, true));
                    }
                    for &(y, x) in &black_cells[adjacent_room_id] {
                        ret.push(((y * self.width as i32 + x) as usize, true));
                    }
                    for &(y, x) in &white_adjacent_cells[room_id] {
                        ret.push(((y * self.width as i32 + x) as usize, false));
                    }
                    for &(y, x) in &white_adjacent_cells[adjacent_room_id] {
                        ret.push(((y * self.width as i32 + x) as usize, false));
                    }

                    return Some(ret);
                }
            }
        }

        None
    }

    fn undo(&mut self) {
        let (y, x) = self.decision_stack.pop().unwrap();
        self.board[y][x] = CellState::Undecided;
    }
}

type Problem = graph::InnerGridEdges<Vec<Vec<bool>>>;

fn combinator() -> impl Combinator<Problem> {
    Size::new(Rooms)
}

pub fn serialize_problem(problem: &Problem) -> Option<String> {
    let height = problem.vertical.len();
    let width = problem.vertical[0].len() + 1;
    problem_to_url_with_context(
        combinator(),
        "lits",
        problem.clone(),
        &Context::sized(height, width),
    )
}

pub fn deserialize_problem(url: &str) -> Option<Problem> {
    // url_to_problemが失敗した場合、KudamonoのURLを解析して問題を取得する
    if let Some(problem) = url_to_problem(combinator(), &["anymino", "lits"], url) {
        return Some(problem);
    }
    
    let parsed = get_kudamono_url_info_detailed(url)?;
    let (width, height) = parse_kudamono_dimension(parsed.get("W")?)?;

    let ctx = Context::sized_with_kudamono_mode(height, width, true);

    let border;
    if let Some(p) = parsed.get("SIE") {
        border = KudamonoBorder.deserialize(&ctx, p.as_bytes())?.1.pop()?;
    } else {
        border = graph::InnerGridEdges {
            horizontal: vec![vec![false; width]; height - 1],
            vertical: vec![vec![false; width - 1]; height],
        };
    }

    Some(border)
}

