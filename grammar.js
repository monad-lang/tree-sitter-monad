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

// Precedence numbers mirror core/src/parser.rs operator_precedence exactly
// (higher number binds tighter). `apply` (juxtaposition application) binds
// tighter than every binary operator.
const PREC = {
  arrow: 3,
  pipe: 5,
  bind: 10,
  dot: 12,
  applicative: 15,
  alt: 20,
  or: 25,
  and: 30,
  compare: 40,
  append: 50,
  shift: 60,
  add: 65,
  mul: 70,
  backtick: 80,
  apply: 90,
}

module.exports = grammar({
  name: "monad",

  extras: $ => [
    $.comment,
    $.doc_comment,
    /\s/,
    /\n/,
  ],

  word: $ => $._identifier,

  conflicts: $ => [
    [$.implicit_param, $._term],
    [$.struct_field, $.implicit_param],
    [$._cons_param, $._term],
  ],

  rules: {
    // Declarations of every kind interleave freely in file order
    // (core/src/parser.rs decls_parser: many0(decl_parser)).
    module: $ => repeat($._decl),

    _expression: $ => choice(
      $.apply,
      $.binary_expression,
      $.arrow,
      $.backtick_call,
      $._term,
    ),

    // `let x := v; let y := w; in body` — always `in`-terminated
    // (core/src/parser.rs let_parser).
    let_binding: $ => seq(
      field('name', $.identifier),
      optional($.type_ascription),
      ':=',
      field('value', $._expression),
      optional(';'),
    ),
    // Each binding owns its own optional trailing `;` (core/src/parser.rs
    // let_parser: `many1` of bindings, each individually `;`-terminated) —
    // do not also separate with sep1, which would double-represent the
    // same semicolon and create an unresolvable shift/reduce ambiguity.
    let: $ => prec.right(seq(
      'let',
      field('bindings', repeat1($.let_binding)),
      'in',
      field('body', $._expression),
    )),

    if_then_else: $ => seq(
      'if',
      field('condition', $._expression),
      'then',
      field('consequence', $._expression),
      'else',
      field('alternative', $._expression),
    ),

    // Left-recursive binary application (curried, matching real
    // core/src/term.rs App/apps — n-ary application really is nested
    // binary App nodes), NOT a flat `repeat1`. A flat
    // `field('arguments', repeat1($._argument))` looks equivalent but, in
    // any context where an outer construct also has a bare-identifier-
    // starting repeat in its FOLLOW set (a `let` binding list, the
    // top-level decl list, ...), silently truncates to a single argument —
    // tree-sitter resolves that boundary "reduce apply now" without ever
    // reporting it as a conflict, so it's not fixable by tuning precedence
    // on the flat form. The left-recursive form doesn't have this failure
    // mode.
    apply: $ => prec.left(PREC.apply, seq(
      field('name', choice($.apply, $._term)),
      field('argument', $._apply_argument),
    )),
    // Same as `_term` but without any `{`-led atom
    // (`implicit_param`/`struct_literal`/`struct_update`). Allowing those
    // as a bare, unparenthesized application argument makes the parser try
    // to extend a return-type/argument chain into any `{` that follows —
    // which collides badly with `def`'s own `{ ... }` do-block-body
    // alternative (`def f (...) : T { stmts }`) and, empirically, wins the
    // GLR tie against the do-block-body far more often across real files
    // than the (rare) case of an unparenthesized struct literal as a call
    // argument actually needs it. A struct literal is still reachable as
    // an argument when parenthesized: `f x (Shape.rect { h := 3 })`.
    _apply_argument: $ => choice(
      $.module_path,
      $.identifier,
      $.number,
      $.hex_number,
      $.float,
      $.string,
      $.char,
      $.hole,
      $.sort,
      $.list,
      $.match_term,
      $.lambda,
      $.quote_term,
      $.macro_call,
      $.parenthesized,
      $.let,
      $.do,
      $.if_then_else,
    ),

    binary_expression: $ => choice(
      prec.left(PREC.pipe, seq($._expression, '|>', $._expression)),
      prec.right(PREC.pipe, seq($._expression, '<|', $._expression)),
      prec.right(PREC.bind, seq($._expression, '>>=', $._expression)),
      prec.right(PREC.dot, seq($._expression, '.', $._expression)),
      prec.left(PREC.applicative, seq($._expression, '<*>', $._expression)),
      prec.left(PREC.alt, seq($._expression, '<|>', $._expression)),
      prec.right(PREC.or, seq($._expression, '||', $._expression)),
      prec.right(PREC.and, seq($._expression, '&&', $._expression)),
      prec.left(PREC.compare, seq($._expression, '==', $._expression)),
      prec.left(PREC.compare, seq($._expression, '!=', $._expression)),
      prec.left(PREC.compare, seq($._expression, '=', $._expression)),
      prec.left(PREC.compare, seq($._expression, '<', $._expression)),
      prec.left(PREC.compare, seq($._expression, '>', $._expression)),
      prec.left(PREC.compare, seq($._expression, '<=', $._expression)),
      prec.left(PREC.compare, seq($._expression, '>=', $._expression)),
      prec.right(PREC.append, seq($._expression, '++', $._expression)),
      prec.right(PREC.append, seq($._expression, '@', $._expression)),
      prec.left(PREC.shift, seq($._expression, '>>', $._expression)),
      prec.left(PREC.shift, seq($._expression, '<<', $._expression)),
      prec.left(PREC.add, seq($._expression, '+', $._expression)),
      prec.left(PREC.add, seq($._expression, '-', $._expression)),
      prec.left(PREC.mul, seq($._expression, '*', $._expression)),
      prec.left(PREC.mul, seq($._expression, '/', $._expression)),
    ),

    // `//` line comments and `/* */` block comments. `///` doc comments are
    // a distinct token (see doc_comment) so highlighting can tell them
    // apart — a `//` immediately followed by a third `/` is NOT an
    // ordinary comment.
    comment: $ => token(choice(
      seq('//', optional(/[^\/\n][^\n]*/)),
      seq('/*', /[\s\S]*?\*\//),
    )),
    doc_comment: $ => token(seq('///', /[^\n]*/)),

    // core/src/parser.rs identifier(): ASCII alpha/underscore start,
    // alphanumeric/underscore continuation.
    _identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    ...attr,
    ...command,
    ...basic.rules,
    ...do_,
    ...term.rules,
  }
});
