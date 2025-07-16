use crate::puzzles::masyu::MasyuClue;
use crate::util;
use cspuz_rs::graph;
use cspuz_rs::serializer::{
    problem_to_url, url_to_problem, Choice, Combinator, ContextBasedGrid, DecInt, Dict, Grid,
    HexInt, Map, MaybeSkip, MultiDigit, Optionalize, PrefixAndSuffix, Rooms, Size, Spaces, Tuple2,
    Tuple3,
};
use cspuz_rs::solver::{Config, GraphDivisionMode, Solver};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IsowatariClue {
    None,
    White,
    Black,
}

pub fn solve_isowatari(size: i32, clues: &[Vec<i32>]) -> Option<Vec<Vec<Option<bool>>>> {
    let (h, w) = util::infer_shape(clues);

    let mut solver = Solver::new();
    let is_black = &solver.bool_var_2d((h, w));
    
    None
}

type Problem = (i32, Vec<Vec<IsowatariClue>>, Option<Vec<Vec<bool>>>);

fn combinator() -> impl Combinator<Problem> {
    let circle_combinator = ContextBasedGrid::new(Map::new(
        MultiDigit::new(3, 3),
        |x: IsowatariClue| {
            Some(match x {
                IsowatariClue::None => 0,
                IsowatariClue::White => 1,
                IsowatariClue::Black => 2,
            })
        },
        |n: i32| match n {
            0 => Some(IsowatariClue::None),
            1 => Some(IsowatariClue::White),
            2 => Some(IsowatariClue::Black),
            _ => None,
        },
    ));

    let empty_combinator = ContextBasedGrid::new(Map::new(
        MultiDigit::new(2, 5),
        |x| Some(if x { 1 } else { 0 }),
        |x| Some(x == 1),
    ));

    Size::new(Tuple3::new(
        PrefixAndSuffix::new("", DecInt, "/"),
        circle_combinator,
        Choice::new(vec![
            Box::new(Optionalize::new(empty_combinator)),
            Box::new(Dict::new(None, "")),
        ]),
    ))
}

pub fn serialize_problem(problem: &Problem) -> Option<String> {
    problem_to_url(combinator(), "isowatari", problem.clone())
}

pub fn deserialize_problem(url: &str) -> Option<Problem> {
    url_to_problem(combinator(), &["isowatari"], url)
}
