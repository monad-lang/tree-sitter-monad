const {PREC} = require('./basic.js')
const {sep0, sep1, sep1_, sep2} = require('./util.js')

// `term_inner` in rust/core/src/parser.rs: the atomic/self-terminating term
// forms — usable both as a full expression and as an unparenthesized
// application argument.
module.exports = {
  rules: {
    // core/src/parser.rs identifier(): a letter or `_` starts, alphanumeric
    // or `_` continues (`char::is_alphanumeric`, so Unicode letters count).
    identifier: $ => $._identifier,

    // A dotted name path (`List.append`, `x.field`) — `.`-immediate, tried
    // before the generic `.` binary operator so a bare qualified name parses
    // as one atomic node (rust/core/src/parser.rs name_path_expression).
    //
    // A `::`-qualified reference (`std::list::List.cons`) — the module half
    // is `::`-separated (whitespace tolerated, like the reference parser),
    // the name half `.`-immediate. Once the dotted name part begins, no
    // further `::` may follow (rust/core/src/parser.rs
    // qualified_name_expression).
    module_path: $ => prec(PREC.max, choice(
      sep2($.identifier, token.immediate('.')),
      seq(
        $.identifier,
        repeat1(seq('::', $.identifier)),
        repeat(seq(token.immediate('.'), $.identifier)),
      ),
    )),

    // A leading `-` is only ever part of the literal token itself
    // (immediately adjacent, no space) — there is no generic unary-minus
    // term in the real grammar (rust/core/src/parser.rs num_literal/
    // hex_literal/float_literal each swallow an optional adjacent `-`).
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
    // `[-]digits[.digits][suffix]` — the fraction may be EMPTY (`3.`,
    // matching numeric_literal_frac's zero-digit success), but leading
    // digits are REQUIRED: a digit-less `.5` is not a float in the
    // reference (numeric_literal parses digits before any dot), and
    // allowing it here stole the `.` from `x.0`, misparsing the dot
    // operator as an application argument.
    float: $ => token(seq(
      optional('-'),
      /[0-9]+/,
      '.',
      /[0-9]*/,
      optional(choice('f32', 'f64')),
    )),

    // \n \r \t \b \f \\ \/ \" \' plus braced unicode escapes \u{XXXX}
    // (1-6 hex digits), plus a line-continuation escape (`\` followed by
    // whitespace/newline, discarded) — matching rust/core/src/parser/string.rs.
    quoted_char: $ => token(
      seq(
        '\\',
        choice(
          /u\{[a-fA-F0-9]{1,6}\}/,
          /[\\/"'nrtbf]/,
          /[ \t\r\n]+/,
        ),
      ),
    ),

    string: $ => seq(
      '"',
      repeat(choice($.quoted_char, token.immediate(prec(1, /[^"\n\\]+/)),)),
      '"',
    ),

    // `r"..."` / `r#"..."#` / `r##"..."##` / `r###"..."###` — body verbatim,
    // no escapes. The closer is `"` plus the opener's exact hash count; a
    // regex can't count hashes, so each supported level gets its own
    // alternative whose body alternatives can never span that level's
    // closer (a `"` in the body must be followed by fewer hashes than the
    // closer needs). This matters because tree-sitter's lexer takes the
    // LONGEST token match — a permissive body like `[\s\S]*?` swallows
    // half the file. Reference: parse_raw_string_literal supports any
    // level; only 0..3 are lexed here.
    raw_string: $ => token(choice(
      seq('r', '"', /[^"]*/, '"'),
      seq('r', '#', '"', repeat(choice(/[^"]/, /"[^#]/)), '"', '#'),
      seq('r', '##', '"', repeat(choice(/[^"]/, /"[^#]/, /"#[^#]/)), '"', '##'),
      seq('r', '###', '"', repeat(choice(/[^"]/, /"[^#]/, /"#[^#]/, /"##[^#]/)), '"', '###'),
    )),

    // Exactly one codepoint between the quotes (an escape counts as one).
    char: $ => seq("'", choice($.quoted_char, /[^'\\]/), "'"),
    hole: $ => "_",

    // `Sort 0`, `Sort 1`, ... — a bare non-negative integer level, not a
    // full `number` node (no suffix/sign, rust/core/src/parser.rs
    // sort_parser).
    sort: $ => seq('Sort', field('level', alias(/[0-9]+/, $.number))),

    type_ascription: $ => seq(':', field('type', $._expression)),
    // Per-item optional commas (tuple_or_parens:
    // `many0(terminated(term, opt(char(','))))`), not separators —
    // `(a, b,)` is fine and so is a lone `(a,)`.
    tuple_tail: $ => seq(',', repeat(seq($._expression, optional(',')))),
    parenthesized: $ => seq(
      '(',
      optional(
        seq($._expression, optional(choice($.tuple_tail, $.type_ascription)))
      ),
      ')',
    ),

    // Per-item optional commas (list_literal:
    // `many0(terminated(term, opt(char(','))))`) — `[a, b,]` and even
    // whitespace-separated `[a b]` are accepted, matching the reference
    // parser.
    list: $ => seq('[', repeat(seq($._expression, optional(','))), ']'),

    // `{ field := value, ... } (: Type)?` — struct literal, or
    // `{ base with field := value, ... }` — struct update. The base may be
    // a dotted path or a parenthesized expression
    // (rust/core/src/parser.rs parse_struct_update_base).
    _struct_literal_field: $ => seq(
      field('name', $.identifier),
      ':=',
      field('value', $._expression),
    ),
    // Per-item optional commas (parse_struct_update/
    // struct_or_update_parser: `many0(terminated(field, opt(char(','))))`)
    // — a trailing comma before `}` is fine in both forms.
    struct_literal: $ => seq(
      '{',
      repeat(seq($._struct_literal_field, optional(','))),
      optional($.type_ascription),
      '}',
    ),
    struct_update: $ => seq(
      '{',
      field('base', choice($.module_path, $.identifier, $.parenthesized)),
      'with',
      repeat(seq($._struct_literal_field, optional(','))),
      '}',
    ),

    // Match: three case shapes (rust/core/src/parser.rs match_case_parser).
    // Each case independently allows an optional trailing `,`
    // (match_parser: `many1(case, opt(','))`) — not a shared separator, so
    // a comma after the LAST case is fine too.
    match_term: $ => seq(
      'match',
      field('value', $._expression),
      '{',
      field('cases', repeat(seq($.match_case, optional(',')))),
      '}',
    ),
    constructor_name: $ => sep1($.identifier, token.immediate('.')),
    // One `field` / `field := binder` item (struct_pattern_parser's
    // field_pattern_item); punning (`field` alone) binds to the same name.
    _field_pattern_item: $ => seq(
      field('name', $.identifier),
      optional(seq(':=', field('binder', $.identifier))),
    ),
    // `{ field, other := binder, .. }` — per-item optional commas
    // (struct_pattern_parser:
    // `many0(terminated(field_pattern_item, opt(char(','))))`), then an
    // optional `..` rest. `{ }` alone is legal (zero-field constructor).
    field_pattern: $ => seq(
      '{',
      repeat(seq($._field_pattern_item, optional(','))),
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

    // Lambda: three equivalent glyphs (rust/core/src/parser.rs lambda) —
    // `ꟛ` (U+A7DB), not `λ`. A parameter is a bare name, a parenthesized
    // `(mult? name : Type? := default?)` group, or a destructured
    // `({ x, y } : Type)` binding (lam_param / lam_param_destructurable).
    lambda_param: $ => choice(
      $.identifier,
      seq(
        '(',
        optional($.multiplicity),
        field('name', $.identifier),
        optional($.type_ascription),
        optional(seq(':=', field('default', $._expression))),
        ')',
      ),
      seq('(', field('pattern', $.field_pattern), ':', field('type', $._expression), ')'),
    ),
    lambda: $ => prec.right(-100, seq(
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
    // no prefix = Many). rust/core/src/parser.rs multiplicity_prefix.
    multiplicity: $ => choice('%', '!', '?'),

    // `{ mult? name+ : Type }` — used both as a def/class implicit
    // parameter AND, standalone, as a forall-type term (`{A : Type} -> A`).
    implicit_param: $ => seq(
      '{',
      optional($.multiplicity),
      field('name', $._param_names),
      ':',
      field('type', $._expression),
      '}',
    ),

    // The name list of a parameter group (`{K V : Type}`,
    // `(a b : A)`). A NAMED rule (not an inline repeat1) so the
    // names-vs-application ambiguity at the second juxtaposed identifier
    // is a declarable GLR conflict: [apply, _param_names]. With the
    // inline repeat the conflict pairs with an anonymous helper that
    // cannot be declared, and application always silently wins.
    _param_names: $ => repeat1($.identifier),

    arrow: $ => prec.right(PREC.arrow, seq(
      field('parameter', $._expression),
      '->',
      field('return', $._expression),
    )),

    // No prec wrapper (deliberately): with apply at PREC.apply = 0
    // (grammar.js), the default precedence of every reduce into `_term`
    // already TIES with the shift that continues an application, so
    // tree-sitter reports the conflict and the declared
    // [apply, _term] GLR fork engages; case content then picks the
    // right branch. A positive wrapper here would silently resolve the
    // tie in favor of the reduce and kill the struct-literal-argument
    // path of `match x { ... }`.
    _term: $ => choice(
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
