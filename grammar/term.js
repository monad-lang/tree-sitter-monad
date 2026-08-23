const {PREC} = require('./basic.js')
const {sep0, sep1, sep1_, sep2} = require('./util.js')

// `term_inner` in core/src/parser.rs: the atomic/self-terminating term
// forms — usable both as a full expression and as an unparenthesized
// application argument.
module.exports = {
  rules: {
    // FIXME: see name.cpp for the real definition...
    identifier: $ => $._identifier,

    // Eager dotted-name chain (`IO.println`, `List.append`) — tried before
    // the generic `.` binary operator so a bare qualified name parses as
    // one atomic node (core/src/parser.rs path_expression).
    module_path: $ => prec(PREC.max, sep2($.identifier, token.immediate('.'))),

    // A leading `-` is only ever part of the literal token itself
    // (immediately adjacent, no space) — there is no generic unary-minus
    // term in the real grammar (core/src/parser.rs num_literal/hex_literal/
    // float_literal each swallow an optional adjacent `-`).
    number: $ => token(seq(
      optional('-'),
      /[0-9]+/,
      optional(choice('i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64')),
    )),
    hex_number: $ => token(seq(
      optional('-'),
      choice('0x', '0X'),
      /[0-9a-fA-F]+/,
      optional(choice('i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64')),
    )),
    float: $ => token(seq(
      optional('-'),
      /[0-9]*/,
      '.',
      /[0-9]*/,
      optional(choice('f32', 'f64')),
    )),

    string: $ => seq(
      '"',
      repeat(choice($.quoted_char, token.immediate(prec(1, /[^"\n\\]+/)),)),
      '"',
    ),
    char: $ => seq("'", choice($.quoted_char, /[^']/), "'"),
    hole: $ => "_",

    // `Sort 0`, `Sort 1`, ... — a bare non-negative integer level, not a
    // full `number` node (no suffix/sign, core/src/parser.rs sort_parser).
    sort: $ => seq('Sort', field('level', alias(/[0-9]+/, $.number))),

    type_ascription: $ => seq(':', field('type', $._expression)),
    tuple_tail: $ => seq(',', sep1($._expression, ',')),
    parenthesized: $ => seq(
      '(',
      optional(
        seq($._expression, optional(choice($.tuple_tail, $.type_ascription)))
      ),
      ')',
    ),

    list: $ => seq('[', sep0($._expression, ','), ']'),

    // `{ field := value, ... } (: Type)?`
    _struct_literal_field: $ => seq(
      field('name', $.identifier),
      ':=',
      field('value', $._expression),
    ),
    // Trailing commas are explicitly allowed on struct literals (unlike
    // most other comma-separated lists in the grammar).
    struct_literal: $ => seq(
      '{',
      optional(sep1_($._struct_literal_field, ',')),
      optional($.type_ascription),
      '}',
    ),
    // `{ base with field := value, ... }` — base must be a bare identifier
    // (core/src/parser.rs parse_struct_update).
    struct_update: $ => seq(
      '{',
      field('base', $.identifier),
      'with',
      optional(sep1_($._struct_literal_field, ',')),
      '}',
    ),

    // Match: three case shapes (core/src/parser.rs match_case_parser).
    // Each case independently allows an optional trailing `,`
    // (core/src/parser.rs match_parser: `many1(case, opt(','))`) — not a
    // shared separator, so a comma after the LAST case is fine too.
    match_term: $ => seq(
      'match',
      field('value', $._expression),
      '{',
      field('cases', repeat(seq($.match_case, optional(',')))),
      '}',
    ),
    constructor_name: $ => sep1($.identifier, token.immediate('.')),
    field_pattern: $ => seq(
      '{',
      sep0(seq(
        field('name', $.identifier),
        optional(seq(':=', field('binder', $.identifier))),
      ), ','),
      optional('..'),
      '}',
    ),
    match_case: $ => choice(
      // bare field pattern: { field, .. } => body
      seq(field('pattern', $.field_pattern), '=>', field('body', $._expression)),
      // named + field pattern: ConsName { field, .. } => body
      seq(
        field('constructor', $.constructor_name),
        field('pattern', $.field_pattern),
        '=>', field('body', $._expression),
      ),
      // positional: ConsName x y => body — `_` is a valid wildcard both as
      // the whole constructor pattern and as any individual arg binder.
      seq(
        field('constructor', choice($.constructor_name, $.hole)),
        field('arguments', repeat(choice($.identifier, $.hole))),
        '=>', field('body', $._expression),
      ),
    ),

    // Lambda: three equivalent glyphs (core/src/parser.rs lambda) — `ꟛ`
    // (U+A7DB), not `λ`.
    lambda_param: $ => choice(
      $.identifier,
      $.hole,
      seq('(', optional($.multiplicity), repeat1($.identifier), optional($.type_ascription), ')'),
      field('pattern', $.field_pattern),
    ),
    lambda: $ => prec.right(seq(
      choice('fn', '\\', 'ꟛ'),
      repeat1($.lambda_param),
      '=>',
      field('body', $._expression),
    )),

    quote_term: $ => seq('quote', '{', field('term', $._expression), '}'),

    // Bare macro reference (no args) — `name!`. Decl-level macro *calls*
    // with arguments are `macro_call_decl` in command.js.
    macro_call: $ => seq(field('name', $.identifier), token.immediate('!')),

    // `%`/`!`/`?` multiplicity prefix on a binder (Erased/Linear/Affine;
    // no prefix = Many). core/src/parser.rs multiplicity_prefix.
    multiplicity: $ => choice('%', '!', '?'),

    // `{ mult? name+ : Type }` — used both as a def/class implicit
    // parameter AND, standalone, as a forall-type term (`{A : Type} -> A`).
    implicit_param: $ => seq(
      '{',
      optional($.multiplicity),
      field('name', repeat1($.identifier)),
      ':',
      field('type', $._expression),
      '}',
    ),

    // `x `f` y` — backtick-infix call (documented in reference.md; kept
    // even though the reference parser's own precedence table can't
    // actually reach it through the general operator loop — see
    // operator()/operator_precedence() in core/src/parser.rs).
    backtick_call: $ => prec.left(PREC.arg, seq(
      field('left', $._expression),
      '`', field('operator', $.identifier), '`',
      field('right', $._expression),
    )),

    arrow: $ => prec.right(3, seq(
      field('parameter', $._expression),
      '->',
      field('return', $._expression),
    )),

    _term: $ => choice(
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
      $.struct_update,
      $.struct_literal,
      $.match_term,
      $.lambda,
      $.quote_term,
      $.macro_call,
      $.implicit_param,
      $.parenthesized,
      $.let,
      $.do,
      $.if_then_else,
    ),
  },
}
