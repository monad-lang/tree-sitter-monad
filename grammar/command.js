const do_ = require('./do.js')
const {min1, sep1} = require('./util.js')


module.exports = {
  _decl_id: $ => field('name', prec(10, choice(
    seq($.identifier, token.immediate('.'), $.identifier),
    $.identifier,
  ))),
  _decl_sig: $ => seq(
    alias(
      repeat(prec.left(choice($._simple_binder_without_type, $._bracketed_binder))),
      $.binders,
    ),
    $._type_spec,
  ),
  _opt_decl_sig: $ => prec.left(min1(
    alias(
      repeat1(prec.left(choice($._simple_binder_without_type, $._bracketed_binder))),
      $.binders,
    ),
    $._type_spec,
  )),
  _decl_val_simple: $ => seq(':=', $._expression),
  _decl_val: $ => field('body', $._decl_val_simple),
  _class_def: $ => seq(
    'def',
    $._decl_id,
    optional($._opt_decl_sig),
    optional($._decl_val),
  ),

  def: $ => seq(
    'def',
    $._decl_id,
    optional($._opt_decl_sig),
    $._decl_val,
  ),

  instance: $ => prec.left(seq(
    'instance',
    optional($._decl_id),
    alias(repeat(choice($._simple_binder_without_type, $._bracketed_binder)), $.binders),
    optional($._type_spec),
    '{',
    field('body', repeat1($.def)),
    '}',
  )),

  _type_constructor: $ => prec(20, seq(
    field('constructor', $.identifier),
    repeat(choice(
      $.implicit_binder,
      $.explicit_binder,
      seq('(', $._expression, ')'),
      $.identifier,
    )),
    optional($._type_spec),
  )),
  _deriving: $ => field('deriving', seq('deriving', sep1($.identifier, ','))),

  _struct_explicit_binder: $ => seq(
    '(',
    field('name', repeat1($.identifier)),
    field('type', optional($._opt_decl_sig)),
    optional($._binder_default),
    ')',
  ),
  _struct_implicit_binder: $ => seq(
    '{',
    field('name', repeat1($.identifier)),
    field('type', $._decl_sig),
    '}',
  ),
  _struct_instance_binder: $ => seq(
    '[',
    field('name', repeat1($.identifier)),
    field('type', $._decl_sig),
    ']',
  ),
  _struct_simple_binder: $ => prec.left(seq(
    field('name', $.identifier),
    field('type', optional($._opt_decl_sig)),
    optional($._binder_default),
  )),
  _struct_field: $ => alias(
    choice(
      alias($._struct_explicit_binder, $.explicit_binder),
      alias($._struct_implicit_binder, $.implicit_binder),
      alias($._struct_instance_binder, $.instance_binder),
      $._struct_simple_binder,
    ), $.field,
  ),
  _struct_constructor: $ => seq($.identifier, '::'),
  _extends: $ => field('extends', seq('extends', sep1($._expression, ','))),
  struct: $ => seq(
    'struct',
    $._decl_id,
    alias(repeat($._bracketed_binder), $.binders),
    optional($._extends),
    optional($._type_spec),
    choice(
      seq(
        '{',
        field('fields', repeat($._struct_field)),
        '}',
      ),
      seq(
        ':=',
        optional($._struct_constructor),
        field('fields', repeat($._struct_field)),
      ),
    ),
    optional($._deriving),
  ),
  type_decl: $ => seq(
    'type',
    $._decl_id,
    repeat(choice(
      $.implicit_binder,
      $.explicit_binder,
      $.identifier,
    )),
    seq(
      '{',
      field('constructors', optional(sep1($._type_constructor, ','))),
      '}',
    ),
    optional($._deriving),
  ),
  _class_signature: $ => seq(
    optional(seq(
      '[',
      sep1($._expression, ','),
      ']',
    )),
    $._decl_id,
    alias(repeat(choice($.identifier, $._bracketed_binder)), $.binders),
  ),
  class: $ => prec.right(1, seq(
    'class',
    $._class_signature,
    optional(
      seq(
        '{',
        field('body', repeat($._class_def)),
        '}',
      ),
    ),
  )),
  _infix_op: $ => seq(
    '(',
    field('operator', choice(
      $.identifier,
      /[^()\s]+/,
    )),
    ')',
  ),
  infix: $ => seq(
    'infix',
    $._infix_op,
    ':=',
    field('definition', $._expression),
  ),

  declaration: $ => choice(
    $.def,
    $.class,
    $.instance,
    $.type_decl,
    $.struct,
    $.infix,
  ),

  open: $ => seq(
    'open',
    repeat1(field('namespace', $.identifier)),
    optional(seq('in', $._command)),
  ),

  // PERFIXME: quoted causes ~2x performance slowdown :/
  quoted: $ => seq('`(', choice($._term, repeat1($._command)), ')'),
  _command_term: $ => choice(
    $.quoted,
  ),

  _command: $ => choice(
    $.declaration,
    $.open,
  ),
}