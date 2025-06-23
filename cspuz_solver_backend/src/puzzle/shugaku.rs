use crate::board::{Board, BoardKind, Item, ItemKind};
use crate::uniqueness::is_unique;
use cspuz_rs_puzzles::puzzles::shugaku::{self, ShugakuDirection, ShugakuKind};

pub fn solve(url: &str) -> Result<Board, &'static str> {
    let problem = shugaku::deserialize_problem(url).ok_or("invalid url")?;
    let (kind, direction) = shugaku::solve_shugaku(&problem).ok_or("no answer")?;

    let height = problem.len();
    let width = problem[0].len();
    let mut board = Board::new(
        BoardKind::Grid,
        height,
        width,
        is_unique(&(&kind, &direction)),
    );

    for y in 0..height {
        for x in 0..width {
            if let Some(n) = problem[y][x] {
                board.push(Item::cell(y, x, "black", ItemKind::Circle));
                if 0 <= n && n <= 4 {
                    board.push(Item::cell(y, x, "black", ItemKind::Num(n)));
                }
            } else {
                if let Some(k) = kind[y][x] {
                    match k {
                        ShugakuKind::Aisle => board.push(Item::cell(y, x, "green", ItemKind::Fill)),
                        ShugakuKind::Pillow => {
                            board.push(Item::cell(y, x, "green", ItemKind::ShugakuPillow));
                        }
                        ShugakuKind::Futon => board.push(Item::cell(y, x, "green", ItemKind::ShugakuFuton)),
                        _ => (),
                    }
                }
                if let Some(d) = direction[y][x] {
                    match d {
                        ShugakuDirection::West => {
                            board.push(Item::cell(y, x, "green", ItemKind::ShugakuWest))
                        }
                        ShugakuDirection::East => {
                            board.push(Item::cell(y, x, "green", ItemKind::ShugakuEast))
                        }
                        ShugakuDirection::South => {
                            board.push(Item::cell(y, x, "green", ItemKind::ShugakuSouth))
                        }
                        ShugakuDirection::None => (),
                    }
                }
            }
        }
    }

    Ok(board)
}
