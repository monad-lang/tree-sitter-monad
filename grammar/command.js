const {sep0, sep1, sep1_, sep2} = require('./util.js')

// Top-level declaration grammar, matching rust/core/src/parser.rs
// def_parser / class_def_parser / class_parser / instance_parser /
// constructor_parser / inductive_parser / struct_parser / infix_parser /
// decl_gen_parser / defmacro_parser / use_parser / open_parser /
// with_decl_parser / mote_attr_parser.
module.exports = {
  _decl_name: $ => choice($.module_path, $.identifier),

  // A constraint like `Functor F` / `Add A` is just an ordinary
  // application expression syntactically — reuse `_expression` rather than
  // a bespoke rule, since a hand-rolled `class-name identifier*` shape is
  // structurally isomorphic to `apply` and creates pervasive LR conflicts
  // with it wherever both could be reached.
  type_constraint: $ => $._expression,
  type_constraints: $ => seq('[', sep1($.type_constraint, ','), ']'),

  // A generic parameter on `class`/`type`: a bare identifier or a
  // parenthesized binder — `(mult? name : Type? := default?)`
  // (rust/core/src/parser.rs lam_param, the single-name shape; NOT the
  // multi-name `def_param` group).
  _type_param: $ => choice(
    $.identifier,
    seq(
      '(',
      optional($.multiplicity),
      field('name', $.identifier),
      optional(seq(':', field('type', $._expression))),
      optional(seq(':=', field('default', $._expression))),
      ')',
    ),
  ),

  // `(mult? name+ : Type)` — a bare-type-only unnamed field, or a named
  // typed field (rust/core/src/parser.rs cons_param).
  _cons_param: $ => choice(
    $.identifier,
    seq('(', optional($.attributes), $._param_names, ':', field('type', $._expression), ')'),
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

  // `(mult name+ : Type)` — an explicit def/class parameter group
  // (rust/core/src/parser.rs def_param; no `:=` defaults in this form),
  // or a destructured group `({ x, y } : Type)`.
  param_group: $ => choice(
    seq(
      '(',
      optional($.multiplicity),
      field('name', $._param_names),
      ':',
      field('type', $._expression),
      ')',
    ),
    seq('(', field('pattern', $.field_pattern), ':', field('type', $._expression), ')'),
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
    optional($.attributes),
    optional($.visibility),
    'class',
    optional($.type_constraints),
    field('name', $._decl_name),
    repeat1($._type_param),
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
    // Application-free atoms only (rust/core/src/parser.rs instance_parser
    // takes term_inner args) — no `{`-led forms, so an instance body brace
    // can never be mistaken for an argument.
    repeat($._apply_argument),
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

  // The operator set is exactly the self-hosted op_table
  // (lang/src/parser/op_table.mo): an infix declaration naming anything
  // else is an "unknown operator" parse error there.
  _infix_symbol: $ => choice(
    '>>=', '<*>', '<|>', '==', '!=', '>=', '<=', '>>', '<<', '|>', '<|',
    '++', '&&', '||', '>', '<', '*', '/', '+', '-', '.', '@',
  ),
  // `infix (op) := Dotted.Name` — the self-hosted parser still tolerates
  // an optional `:N` precedence clause but parses and discards it (dead
  // code; undocumented, rejected by the Rust bootstrap parser). Only the
  // documented shape is accepted here.
  infix: $ => seq(
    optional($.visibility),
    'infix', '(', field('operator', $._infix_symbol),
    ')', ':=', field('definition', $._decl_name),
  ),

  decls_block: $ => seq('decls', '{', repeat($._decl), '}'),
  _macro_param: $ => choice(
    $.identifier,
    seq('(', optional($.multiplicity), repeat1($.identifier), ':', field('type', $._expression), ')'),
  ),
  defmacro: $ => seq(
    optional($.attributes),
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

  // `use` module paths are `::`-separated ONLY — the dotted spelling is a
  // parse error in the reference parser (use_path_expression).
  use_path: $ => seq(
    field('segment', $.identifier),
    repeat(seq('::', field('segment', $.identifier))),
  ),
  // A `.`-immediate dotted spelling inside a `use` filter (`List.length`) —
  // an item names a declaration by its spelled name, not a module
  // (rust/core/src/parser.rs use_item_name).
  use_item_name: $ => sep2($.identifier, token.immediate('.')),
  // One `use Module { ... }` item: `*`, a (dotted) name, `name as alias`,
  // or a sub-module import `name { items }` / `name as alias { items }`.
  use_item: $ => choice(
    '*',
    seq(
      field('name', $.identifier),
      optional(seq('as', field('alias', $.identifier))),
      field('items', $.use_filter),
    ),
    seq(
      field('name', choice($.use_item_name, $.identifier)),
      optional(seq('as', field('alias', $.identifier))),
    ),
  ),
  // Items are whitespace- or comma-separated, each with an optional
  // trailing comma (rust/core/src/parser.rs use_brace_items).
  use_filter: $ => seq('{', repeat(seq($.use_item, optional(','))), '}'),

  use: $ => seq(
    optional($.attributes),
    optional('pub'),
    'use',
    field('module', $.use_path),
    optional(field('filter', $.use_filter)),
  ),
  // `open` operates on a dotted name path (`open IO {println}`), never on
  // `::` modules; its filter is `{*}` or a plain name list — no `as`, no
  // nesting (rust/core/src/parser.rs open_module_path_and_filter). A
  // scoped `open M in <decl>` may wrap a def/class/instance/struct/type.
  open_filter: $ => seq(
    '{',
    choice('*', repeat(seq(field('name', $.identifier), optional(',')))),
    '}',
  ),
  open: $ => seq(
    optional($.attributes),
    'open',
    field('module', $._decl_name),
    optional(field('filter', $.open_filter)),
    optional(seq('in', field('body', $._decl))),
  ),

  // `with Dotted.Name { decls }` — prefix every declaration inside with
  // `Dotted.Name.` (rust/core/src/parser.rs with_decl_parser).
  with_decl: $ => seq(
    'with',
    field('prefix', $._decl_name),
    '{', repeat($._decl), '}',
  ),

  _decl: $ => choice(
    $.def,
    $.class,
    $.instance,
    $.type_decl,
    $.struct,
    $.infix,
    $.defmacro,
    $.macro_call_decl,
    $.use,
    $.open,
    $.with_decl,
    $.mote_attr,
  ),
}
