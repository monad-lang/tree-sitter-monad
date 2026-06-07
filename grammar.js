/**
 * @file Parser for the Monad language
 * @author Anders Christiansen Sørby <anders@sorby.xyz>
 * @license Apache-2.0
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const attr = require('./grammar/attr.js')
const basic = require('./grammar/basic.js')
const command = require('./grammar/command.js')
const do_ = require('./grammar/do.js')
const term = require('./grammar/term.js')
const {sep1} = require('./grammar/util.js')

const PREC = {
  dollar: -5,
  equal: -3,
  compare: -2,
  apply: -1,
  multitype: -1,

  opop: 13,
  or: 14,
  and: 15,
  eqeq: 16,
  plus: 17,
  times: 18,
  unary: 1000,
  power: 20,

  name: 30,
}


module.exports = grammar({
  name: "monad",

  extras: $ => [
    $.comment,
    /\s/,
    /\n/,
  ],



  conflicts: $ => [
    [$._binder_ident],
    [$._binder_ident, $._term],
    [$._let_id_lhs, $._term],
    [$._let_id_lhs],
    [$._simple_binder],
    [$.assign, $._term],
    [$.identifier],
    [$.proj, $._expression],
    [$._class_signature],
    [$._struct_simple_binder, $._binder_ident],
    [$.instance],
    [$.synthetic_hole, $.affine_binder],
    [$._term, $.linear_binder],
  ],

  word: $ => $._identifier,

  rules: {
    // Parser for the Monad language
    module: $ => seq(
      repeat($.use),
      repeat($._command),
    ),
    use: $ => seq('use', field('module', $.identifier)),

    parameters: $ => seq(
      repeat1(
        choice(
          field('name', $.identifier),
          $.hole,
          $._bracketed_binder,
        )
      ),
    ),

    _expression: $ => choice(
      $.apply,
      $.comparison,
      $.let,
      $.binary_expression,
      $.neg,
      $.fun,
      $._term,

      $.do,
      $.if_then_else,
    ),

    let: $ => prec.left(seq(
      'let',
      field('name', $.identifier),
      optional(field('parameters', $.parameters)),
      optional(seq(':', field('type', $._expression))),
      ':=',
      field('value', $._expression),
      choice($._newline, ';'),
      optional(field('body', $._expression)),
    )),

    conditional_when: $ => prec.right(seq(
      'if',
      $._expression,
      'then',
      $._expression,
    )),

    for_in: $ => seq(
      'for',
      $.identifier,
      'in',
      field('iterable', $._expression),
      field('body', $.do),
    ),

    assign: $ => seq(
      field('name', $.identifier),
      ':=',
      field('value', $._expression),
    ),

    let_mut: $ => seq(
      'let', 'mut',
      $.parameters,
      choice($._left_arrow, ':='),
      field('value', $._expression),
    ),

    let_bind: $ => seq(
      'let',
      field('name', $.identifier),
      $._left_arrow,
      field('value', $._expression),
    ),


    fun: $ => prec.right(seq(
      choice('fn', 'λ', '\\'),
      seq(
        $.parameters,
        '=>',
        $._expression,
      ),
    )),

    apply: $ => choice($._apply, $._dollar),

    _apply: $ => prec(PREC.apply, seq(
      field('name', $._term),
      field('arguments', repeat1($._argument)),
    )),

    _dollar: $ => prec.right(PREC.dollar, seq(
      field('name', $._expression),
      '$',
      field('argument', $._expression),
    )),

    neg: $ => prec(PREC.unary, seq('-', $._expression)),

    binary_expression: $ => choice(
      prec.right(PREC.power, seq($._expression, '^', $._expression)),
      prec.left(PREC.times, seq($._expression, '*', $._expression)),
      prec.left(PREC.times, seq($._expression, '/', $._expression)),
      prec.left(PREC.times, seq($._expression, '%', $._expression)),
      prec.left(PREC.plus, seq($._expression, '+', $._expression)),
      prec.left(PREC.plus, seq($._expression, '-', $._expression)),



      prec.left(PREC.or, seq($._expression, '||', $._expression)),
      prec.left(PREC.and, seq($._expression, '&&', $._expression)),
      prec.left(PREC.eqeq, seq($._expression, '==', $._expression)),

      prec.left(PREC.opop, seq($._expression, '++', $._expression)),
      prec.left(PREC.opop, seq($._expression, '::', $._expression)),

      prec.left(PREC.opop, seq($._expression, '|>', $._expression)),
      prec.left(PREC.opop, seq($._expression, '|>.', $._expression)),
      prec.right(PREC.dollar, seq($._expression, '<|', $._expression)),

      prec.left(PREC.opop, seq($._expression, '<|>', $._expression)),
      prec.left(PREC.opop, seq($._expression, '>>', $._expression)),
      prec.left(PREC.opop, seq($._expression, '>>=', $._expression)),
      prec.left(PREC.opop, seq($._expression, '<*>', $._expression)),
      prec.left(PREC.opop, seq($._expression, '<*', $._expression)),
      prec.left(PREC.opop, seq($._expression, '*>', $._expression)),
      prec.left(PREC.opop, seq($._expression, '<$>', $._expression)),

      prec.left(PREC.equal, seq($._expression, '=', $._expression)),
    ),

    comparison: $ => prec.left(PREC.compare, seq(
      $._expression,
      choice(
        '<',
        '>',
        '≤',
        '≥',
        '<=',
        '>=',
      ),
      $._expression,
    )),

    comment: $ => token(choice(
      seq('//', /.*/),
      seq('/*', /[\s\S]*?\*\//),
    )),

    _identifier: $ => /[_a-zA-ZͰ-ϿĀ-ſ\U0001D400-\U0001D7FF][_`'`a-zA-Z0-9Ͱ-ϿĀ-ſ∇!?\u2070-\u209F\U0001D400-\U0001D7FF]*/,
    _escaped_identifier: $ =>  /«[^»]*»/,
    _newline: $ => /\n/,

    ...attr,
    ...command,
    ...basic.rules,
    ...do_,
    ...term.rules,
  }
});
