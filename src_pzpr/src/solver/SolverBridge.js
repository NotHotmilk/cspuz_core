var Solver = null;

Module().then(function (mod) {
    Solver = mod;
});

window.solveProblem = function (url) {
    var urlEncoded = new TextEncoder().encode(url);
    var buf = Solver._malloc(urlEncoded.length);
    Solver.HEAPU8.set(urlEncoded, buf);

    var ans = Solver._solve_problem(buf, urlEncoded.length);
    Solver._free(buf);

    var length = Solver.HEAPU8[ans] | (Solver.HEAPU8[ans + 1] << 8) | (Solver.HEAPU8[ans + 2] << 16) | (Solver.HEAPU8[ans + 3] << 24);
    var resultStr = new TextDecoder().decode(Solver.HEAPU8.slice(ans + 4, ans + 4 + length));
    var result = JSON.parse(resultStr.substring(0, resultStr.length));

    return result["description"];
}
