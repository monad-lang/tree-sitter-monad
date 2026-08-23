const {sep1} = require('./util.js')

// do-notation: `do { let name <- action; let x := value; return value }`.
// Both binding forms start with `let`, distinguished by `<-` vs `:=`
// (core/src/parser.rs do_statement). ASCII `<-` only — no unicode arrow.
module.exports = {
  do_return: $ => prec.left(seq(
    'return', field('value', $._expression),
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
    $.do_return,
    $.do_bind,
    $.do_let,
    $._expression,
  ),

  _do_statements: $ => sep1($._do_statement, ';'),

  do: $ => seq(
    'do',
    '{',
    field('statements', optional($._do_statements)),
    '}',
  ),
}
