const {PREC} = require('./basic.js')
const {sep1} = require('./util.js')

module.exports = {
  _left_arrow: $ => choice('<-', '←'),

  do_return: $ => prec.left(PREC.lead,
    seq('return', field('value', $._expression)),
  ),

  do_let: $ => prec(10, seq(
    'let',
    field('name', $.identifier),
    ':=',
    field('value', $._expression),
  )),

  do_bind: $ => prec(10, seq(
    field('name', $.identifier),
    $._left_arrow,
    field('value', $._expression),
  )),

  _do_statement: $ => choice(
    $.do_return,
    $.do_let,
    $.do_bind,
    $._expression,
  ),

  do: $ => prec(PREC.lead, seq(
    'do',
    '{',
    field('statements', optional(sep1($._do_statement, ';'))),
    '}',
  )),
}
