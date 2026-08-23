const {sep1, sep1_} = require('./util.js')

// Top-level declaration grammar, matching core/src/parser.rs def_parser /
// class_def_parser / class_parser / instance_parser / constructor_parser /
// inductive_parser / struct_parser / infix_parser / decl_gen_parser /
// defmacro_parser / use_parser / open_parser.
module.exports = {
  _decl_name: $ => choice($.module_path, $.identifier),

  // A constraint like `Functor F` / `Add A` is just an ordinary
  // application expression syntactically — reuse `_expression` rather than
  // a bespoke rule, since a hand-rolled `class-name identifier*` shape is
  // structurally isomorphic to `apply` and creates pervasive LR conflicts
  // with it wherever both could be reached.
  type_constraint: $ => $._expression,
  type_constraints: $ => seq('[', sep1($.type_constraint, ','), ']'),

  // A type-level parameter on `class`/`type`/`struct`: a bare identifier or
  // a parenthesized, optionally-typed binder group, e.g. `(F : Type -> Type)`.
  _type_param: $ => choice(
    $.identifier,
    seq(
      '(', optional($.multiplicity), repeat1($.identifier),
      optional(seq(':', field('type', $._expression))),
      optional(seq(':=', field('default', $._expression))),
      ')',
    ),
  ),

  // `(mult name+ : Type)` — bare-type-only unnamed field, or a named
  // typed field (core/src/parser.rs cons_param).
  _cons_param: $ => choice(
    $.identifier,
    seq('(', optional($.attributes), repeat1($.identifier), ':', field('type', $._expression), ')'),
    seq('(', optional($.attributes), field('type', $._expression), ')'),
  ),

  // `mult? name : Type (:= default)?` — a struct field, and also the
  // brace-alternative shape for def parameters / constructor fields.
  struct_field: $ => seq(
    optional($.multiplicity),
    field('name', $.identifier),
    ':',
    field('type', $._expression),
    optional(seq(':=', field('default', $._expression))),
  ),

  // `(mult name+ : Type (:= default)?)` — an explicit def/class parameter
  // group.
  param_group: $ => seq(
    '(',
    optional($.multiplicity),
    field('name', repeat1($.identifier)),
    ':',
    field('type', $._expression),
    optional(seq(':=', field('default', $._expression))),
    ')',
  ),
  // Non-empty on purpose — an empty `{}` after a def's parameter position
  // is the (possibly-empty) do-block body form, not a param block.
  param_block: $ => seq('{', sep1_($.struct_field, ','), '}'),

  def: $ => seq(
    optional($.attributes),
    optional($.visibility),
    'def',
    field('name', $._decl_name),
    optional($.type_constraints),
    repeat($.implicit_param),
    field('parameters', choice($.param_block, repeat($.param_group))),
    optional(seq(':', field('return_type', $._expression))),
    optional(choice(
      seq(':=', field('body', $._expression)),
      seq('{', field('body', optional($._do_statements)), '}'),
    )),
  ),

  class: $ => seq(
    'class',
    optional($.type_constraints),
    field('name', $._decl_name),
    repeat($._type_param),
    '{', field('body', repeat($.class_method)), '}',
  ),
  class_method: $ => seq(
    optional($.attributes),
    'def',
    field('name', $.identifier),
    optional($.type_constraints),
    repeat($.implicit_param),
    repeat($._cons_param),
    optional(seq(':', field('type', $._expression))),
    optional(seq(':=', field('default', $._expression))),
  ),

  instance: $ => seq(
    optional($.attributes),
    optional($.visibility),
    'instance',
    repeat($.implicit_param),
    optional($.type_constraints),
    optional(seq(field('name', $._decl_name), ':')),
    field('class', $._decl_name),
    repeat($._term),
    '{', field('body', repeat1($.def)), '}',
  ),

  type_decl: $ => seq(
    optional($.attributes),
    optional($.visibility),
    'type',
    optional($.type_constraints),
    field('name', $._decl_name),
    repeat($._type_param),
    optional(seq(':', field('type', $._expression))),
    '{', field('constructors', optional(sep1_($.constructor, ','))), '}',
  ),
  constructor: $ => seq(
    field('name', $.identifier),
    repeat($.implicit_param),
    choice(
      repeat($._cons_param),
      seq('{', optional(sep1_($.struct_field, ',')), '}'),
    ),
    optional(seq(':', field('type', $._expression))),
  ),

  struct: $ => seq(
    optional($.attributes),
    optional($.visibility),
    'struct',
    optional($.type_constraints),
    field('name', $._decl_name),
    repeat($._cons_param),
    '{', field('fields', optional(sep1_($.struct_field, ','))), '}',
  ),

  _infix_symbol: $ => choice(
    '>>=', '<*>', '<|>', '==', '!=', '>=', '<=', '>>', '<<', '|>', '<|',
    '++', '&&', '||', '>', '<', '=', '*', '/', '+', '-', '.', '@',
  ),
  infix: $ => seq(
    optional($.visibility),
    'infix', '(', field('operator', $._infix_symbol), ')',
    ':=', field('definition', $._decl_name),
  ),

  decls_block: $ => seq('decls', '{', repeat($._decl), '}'),
  _macro_param: $ => choice(
    $.identifier,
    seq('(', optional($.multiplicity), repeat1($.identifier), ':', field('type', $._expression), ')'),
  ),
  defmacro: $ => seq(
    optional($.visibility),
    'defmacro',
    field('name', $._decl_name),
    repeat($._macro_param),
    ':=',
    field('body', choice($.decls_block, $._expression)),
  ),
  // Decl-level macro invocation: `name! arg1 arg2 ...` (distinct from the
  // term-level bare `$.macro_call`, which never takes arguments). A
  // left-recursive binary shape, not a flat `repeat` — see the comment on
  // `apply` in grammar.js for why a flat repeat silently truncates here.
  _macro_call_head: $ => seq(field('name', $.identifier), token.immediate('!')),
  macro_call_decl: $ => choice(
    alias($._macro_call_head, $.macro_call_decl),
    prec.left(1, seq(
      field('call', choice($.macro_call_decl, alias($._macro_call_head, $.macro_call_decl))),
      field('argument', $._term),
    )),
  ),

  use_item: $ => choice(
    '*',
    seq(field('name', $.identifier), 'as', field('alias', $.identifier), field('items', $.use_filter)),
    seq(field('name', $.identifier), field('items', $.use_filter)),
    seq(field('name', $.identifier), 'as', field('alias', $.identifier)),
    field('name', $.identifier),
  ),
  use_filter: $ => seq('{', optional(sep1_($.use_item, ',')), '}'),

  use: $ => seq(
    optional($.attributes),
    optional($.visibility),
    'use',
    field('module', $._decl_name),
    optional(field('filter', $.use_filter)),
  ),
  // No `visibility` on `open` (core/src/parser.rs open_parser has no
  // vis_parser call).
  open: $ => seq(
    optional($.attributes),
    'open',
    field('module', $._decl_name),
    optional(field('filter', $.use_filter)),
    optional(seq('in', field('body', $._decl))),
  ),

  _decl: $ => choice(
    $.def,
    $.class,
    $.instance,
    $.type_decl,
    $.struct,
    $.infix,
    $.defmacro,
    $.decls_block,
    $.macro_call_decl,
    $.use,
    $.open,
  ),
}
