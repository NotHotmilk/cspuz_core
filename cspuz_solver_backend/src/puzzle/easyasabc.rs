use crate::board::{Board, BoardKind, Item, ItemKind};
use crate::uniqueness::is_unique;
use cspuz_rs_puzzles::puzzles::easyasabc;

pub fn solve(url: &str) -> Result<Board, &'static str> {
    let problem = easyasabc::deserialize_problem(url).ok_or("invalid url")?;
    let ans = easyasabc::solve_easyasabc(problem.0, &problem.1, &problem.2, &problem.3, &problem.4, &problem.5).ok_or("no answer")?;

    let height = problem.2.len();
    let width = problem.1.len();
    let mut board = Board::new(BoardKind::Grid, height, width, is_unique(&ans));
    
    for y in 0..height {
        for x in 0..width {
            if let Some(n) = problem.5[y][x] {
                board.push(Item::cell(
                    y,
                    x,
                    "black",
                    ItemKind::Num(n),
                ));
            } else if let Some(n) = ans[y][x] {
                board.push(Item::cell(
                    y,
                    x,
                    "green",
                    if n == 0 {ItemKind::Cross} else {ItemKind::Num(n)},
                ));
            }
        }
    }

    Ok(board)
}