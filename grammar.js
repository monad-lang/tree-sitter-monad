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

// Operator precedence levels live in grammar/basic.js (single source,
// shared with the term rules). See the comment there for why `apply`
// is 0 and every binary operator is negative.
const {PREC} = basic

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
    // `def f { x : A }` — the brace is simultaneously readable as an
    // implicit parameter group and as a brace param block field.
    [$.struct_field, $.implicit_param],
    // A `let x := v` inside a do block is either a `do_let` statement (no
    // `in`) or the prefix of a term-level `let ... in` used as an
    // expression statement — the two only diverge at the `in`, so GLR
    // carries both until then (rust/core/src/parser.rs do_statement's
    // Let arm vs term_inner's let_parser).
    [$.let_binding, $.do_let],
    // `match x { ... }` — the `{` either opens the match's own case list or
    // a struct literal bound as an unparenthesized application argument
    // to the scrutinee's head (`match x { f := v }` is valid monad). The
    // reference parser resolves this by backtracking on content; GLR
    // carries both versions and the struct-literal one dies on
    // non-`field := value` content.
    [$.apply, $._term],
    // `struct Name (a b : Type)`, `def m (a b : A)`, `{K V : Type}` —
    // the second juxtaposed identifier in a cons parameter group
    // continues the name list or feeds an application; the `:` (or its
    // absence) decides on content, like the reference parser's ordered
    // backtrack. (The param_group/implicit_param junctions resolve
    // statically and need no declared conflict.)
    [$.apply, $._cons_param],
    // `def f { x y ... }` — inside a def's brace parameter group the
    // identifier sequence is simultaneously readable as the param name
    // list, a forall-style implicit_param term, or an application in
    // progress (the brace itself forking between param group and term).
    [$.apply, $.implicit_param, $._term],
    // Same junction one level up, when the scrutinee is itself an
    // application (`match f x { ... }`): the completed `apply` reduces
    // to `_expression` (match brace) or extends with a struct-literal
    // argument. Same content-based fork.
    [$.apply, $._expression],
  ],

  rules: {
    // Declarations of every kind interleave freely in file order
    // (rust/core/src/parser.rs decls_parser: many0(decl_parser)).
    module: $ => repeat($._decl),

    // prec(PREC.apply) — the wrapper's precedence must sit at apply's own
    // level (0) so the [apply, _expression] boundary forks (e.g. `match f
    // x { ... }` — reduce the completed application to the scrutinee
    // slot or extend it with a struct-literal argument) are reported as
    // real conflicts and GLR'd on content, exactly like the reference
    // parser's ordered backtracking. The remaining let/lambda/return/if
    // "open body" rules use prec -100 so their closing reduce loses every
    // shift/reduce tie against binary operators (greedy bodies:
    // `let x := 5 in x + 1` binds `x + 1`, not `(let ... in x) + 1`).
    _expression: $ => prec(PREC.apply, choice(
      $.apply,
      $.binary_expression,
      $.arrow,
      $._term,
      $.return_term,
    )),

    // `let x := v; let y := w; in body` — always `in`-terminated
    // (rust/core/src/parser.rs let_parser).
    let_binding: $ => seq(
      field('name', $.identifier),
      optional($.type_ascription),
      ':=',
      field('value', $._expression),
      optional(';'),
    ),
    // Each binding owns its own optional trailing `;` (let_parser:
    // `many1` of bindings, each individually `;`-terminated) — do not also
    // separate with sep1, which would double-represent the same semicolon
    // and create an unresolvable shift/reduce ambiguity.
    let: $ => prec.right(-100, seq(
      'let',
      field('bindings', repeat1($.let_binding)),
      'in',
      field('body', $._expression),
    )),

    if_then_else: $ => prec(-100, seq(
      'if',
      field('condition', $._expression),
      'then',
      field('consequence', $._expression),
      'else',
      field('alternative', $._expression),
    )),

    // Left-recursive binary application (curried, matching real
    // term.rs App/apps — n-ary application really is nested binary App
    // nodes), NOT a flat `repeat1`. A flat
    // `field('arguments', repeat1($._argument))` looks equivalent but, in
    // any context where an outer construct also has a bare-identifier-
    // starting repeat in its FOLLOW set (a `let` binding list, the
    // top-level decl list, ...), silently truncates to a single argument —
    // tree-sitter resolves that boundary "reduce apply now" without ever
    // reporting it as a conflict, so it's not fixable by tuning precedence
    // on the flat form. The left-recursive form doesn't have this failure
    // mode.
    apply: $ => prec.left(PREC.apply, seq(
      field('name', choice(
        $.apply,
        $.module_path,
        $.identifier,
        $.macro_call,
        $.parenthesized,
      )),
      optional(field('hint', $.dict_hint)),
      field('argument', $._apply_argument),
    )),
    // `f #Named.Instance args` — an explicit instance/dictionary hint
    // between the head and the arguments
    // (rust/core/src/parser.rs application). A bare name or a dotted
    // path, not an unparenthesized argument itself.
    dict_hint: $ => seq('#', field('class', choice($.module_path, $.identifier))),
    // `f x (Shape.rect { h := 3 })` and, as in the real application rule
    // (args go through `term_inner`, whose `literal` covers
    // struct_or_update_parser), ALSO unparenthesized: `Shape.rectangle
    // { height := 3 }` is ordinary, pervasive monad. The `def f : T
    // { do-stmts }` body-brace collides with this shape only where the
    // content can't tell them apart — a do statement is never a
    // `field := value` pair, so the GLR fork resolves on content exactly
    // like the reference parser's nom backtracking does.
    _apply_argument: $ => choice(
      $.module_path,
      $.identifier,
      $.number,
      $.hex_number,
      $.float,
      $.string,
      $.raw_string,
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
      $.struct_literal,
      $.struct_update,
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

    // rust/core/src/parser.rs identifier(): letter/underscore start,
    // alphanumeric/underscore continuation (`char::is_alphanumeric`, so
    // Unicode letters are identifiers too).
    _identifier: $ => /[\p{L}_][\p{L}\p{N}_]*/,

    ...attr,
    ...command,
    ...basic.rules,
    ...do_,
    ...term.rules,
  }
});
