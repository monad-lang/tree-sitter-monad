// do-notation: `do { let name <- action; let x := value; return value }`.
// Both binding forms start with `let`, distinguished by `<-` vs `:=`.
// Statements carry an OPTIONAL trailing `;` each (rust/core/src/parser.rs
// do_statement/do_statements_parser: `opt(char(';'))` per statement) — a
// newline-separated block with no semicolons at all is valid.
//
// `return expr` is also a standalone term (non_app_term's
// return_shorthand_parser), so it lives here as `return_term` and is used
// both inside do blocks and as a full expression — but, matching the
// reference parser, it is NOT an unparenthesized application argument.
module.exports = {
  return_term: $ => prec.right(-100, seq(
    'return',
    field('value', $._expression),
  )),

  do_bind: $ => prec.left(seq(
    'let',
    field('name', $.identifier),
    optional($.type_ascription),
    '<-',
    field('value', $._expression),
  )),

  do_let: $ => prec.left(seq(
    'let',
    field('name', $.identifier),
    optional($.type_ascription),
    ':=',
    field('value', $._expression),
  )),

  _do_statement: $ => choice(
    $.do_bind,
    $.do_let,
    $._expression,
  ),

  _do_statements: $ => repeat1(seq($._do_statement, optional(';'))),

  do: $ => seq(
    'do',
    '{',
    field('statements', optional($._do_statements)),
    '}',
  ),
}
