// Operator precedences mirror rust/core/src/parser.rs operator_precedence
// (higher number binds tighter) with one global shift: `apply`
// (juxtaposition application) is 0 and every binary operator is
// negative. apply MUST sit at 0: its precedence is compared against
// the default precedence (0) of the shift actions that extend
// application-shaped ambiguities (`match x {`, `(a b : A)` name lists,
// `{K V : Type}` implicit groups). At any positive value tree-sitter
// silently resolves those shift/reduce ties in favor of application
// during generation, which eliminates the other path from the automaton
// entirely — the declared conflicts then come out "unnecessary" and
// `match x { ... }` / multi-name parameter groups can never parse.
// The let/lambda/return/if "open body" rules sit at -100 so their
// closing reduce loses every tie against a binary operator (greedy
// bodies: `let x := 5 in x + 1` binds `x + 1`, not `(let ... in x) + 1`).
const PREC = {
  apply: 0,
  arrow: -87,
  pipe: -85,
  bind: -80,
  dot: -78,
  applicative: -75,
  alt: -70,
  or: -65,
  and: -60,
  compare: -50,
  append: -40,
  shift: -30,
  add: -25,
  mul: -20,

  // Structural precedences (not operator levels)
  max: 1024,
  arg: 1023,
  lead: 1022,
  min: 10,
}
module.exports = {
  PREC,

  rules: {
    // \n \r \t \b \f \\ \/ \" \' plus braced unicode escapes \u{XXXX}
    // (1-6 hex digits), plus a line-continuation escape (`\` followed by
    // whitespace/newline, discarded) — matching core/src/parser/string.rs.
    quoted_char: $ => token(
      seq(
        '\\', choice(
          /u\{[a-fA-F0-9]{1,6}\}/,
          /[\\/"'nrtbf]/,
          /[ \t\r\n]+/,
        ),
      ),
    ),
  }
}
