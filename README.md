# tree-sitter-monad

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the **Monad** programming language.

## About

Monad is a functional programming language with support for dependent types, type classes, and algebraic data types. This grammar provides syntax highlighting, code navigation, and structural editing support for Monad source files (`.mo`).

## Features

- **Declarations**: `def`, `type`, `class`, `instance`, `struct`, `infix`, `defmacro`, `use`, `open`, `with`
- **Type system**: Dependent types, implicit `{A : Type}` binders, `[Constraint A]` constraints, `Sort` levels
- **Expressions**: Curried application, lambda (`fn`/`\`), `let ... in`, `if/then/else`, `match`, operator sections via binary operators, `do` notation
- **Modules**: `::`-qualified names (`std::list::List.cons`), `use`/`open` with brace filters
- **Literals**: Suffixed numbers, strings with escapes, raw strings, chars, lists, tuples, struct literals and updates
- **Comments**: Line (`//`), block (`/* */`), doc (`///`)

## Installation

### npm

```bash
npm install tree-sitter-monad
```

### Usage with Node.js

```javascript
const Parser = require("tree-sitter");
const Monad = require("tree-sitter-monad");

const parser = new Parser();
parser.setLanguage(Monad);

const source = `
def add (a : Nat) (b : Nat) : Nat := a + b

type Option A {
  some (a : A),
  none
}
`;

const tree = parser.parse(source);
console.log(tree.rootNode.toString());
```

### Usage with Neovim

Install via your preferred plugin manager:

```lua
-- lazy.nvim
{
  "nvim-treesitter/nvim-treesitter",
  opts = function(_, opts)
    vim.list_extend(opts.ensure_installed, { "monad" })
    vim.list_extend(opts.parsers, {
      monad = {
        install_info = {
          url = "https://tangled.org/monad-lang.org/tree-sitter-monad",
          files = { "src/parser.c" },
          branch = "main",
        },
      },
    })
  end,
}
```

### Usage with Helix

Add to your `languages.toml`:

```toml
[[grammar]]
name = "monad"
source = { git = "https://tangled.org/monad-lang.org/tree-sitter-monad", rev = "main" }
```

Then run `hx --grammar fetch` and `hx --grammar build`.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [tree-sitter CLI](https://tree-sitter.github.io/tree-sitter/creating-parsers)

Or use [devenv](https://devenv.sh):

```bash
devenv shell
```

### Commands

```bash
# Install dependencies
pnpm install

# Generate the parser
pnpm exec tree-sitter generate

# Run tests
pnpm exec tree-sitter test

# Start the playground
pnpm start
```

### Releasing

CI (`.github/workflows/`) tests every pull request and every push to
`main`. A push to `main` also publishes the version recorded in
`package.json`/`Cargo.toml` to npm and crates.io and creates a GitHub
release — but only once per version. To cut a release: bump the version
in **both** `package.json` and `Cargo.toml` (they must match), then push
to `main`. Requires the `NPM_TOKEN` and `CARGO_REGISTRY_TOKEN` secrets.

## Grammar Structure

The grammar is organized into modular files under `grammar/`:

| File | Purpose |
|------|---------|
| `attr.js` | Attribute syntax (`#[...]`) |
| `basic.js` | Basic tokens and precedence constants |
| `command.js` | Top-level declarations (`def`, `type`, `struct`, `class`, etc.) |
| `do.js` | Do notation and monadic constructs |
| `term.js` | Terms and expressions |
| `util.js` | Shared combinators (`sep1`, `sep0`, etc.) |

## Supported Syntax

Every example below is verified against the grammar (see `test/corpus/`).

### Types

```monad
type Bool {
  true,
  false
}

type Result E A {
  ok (a : A),
  err (e : E)
}

type List A {
  empty,
  cons (a : A) (rest : List A) : List A
}
```

Commas between items are optional where the reference parser allows it (bare type constructors, match cases, use items); struct fields and parameterized constructors are comma-separated in practice — like the reference parser, a following identifier would otherwise extend the preceding type or default value as an application.

### Definitions

```monad
def add (a : I64) (b : I64) : I64 := a + b

def const {A : Type} {B : Type} (a : A) (b : B) : A := a

def both (a b : Bool) : Bool := a && b

def not (b : Bool) : Bool := if b then false else true

def length {A : Type} (xs : List A) : I64 :=
  match xs {
    empty => 0,
    cons _ rest => 1 + length rest,
    _ => 0
  }
```

Multi-name parameter groups (`(a b : Bool)`), implicit binders (`{A : Type}`), `_` hole patterns, and all three match-case shapes (bare, named-field, positional) are supported.

### Classes and Instances

```monad
class Show A {
  def show : A -> String
}

class [Eq A] Ord A {
  def compare (a : A) (b : A) : Ordering
}

instance Show I64 {
  def show (n : I64) : String := I64.to_string n
}

instance [Show A] Show (List A) {
  def show (xs : List A) : String := list_show Show.show xs
}
```

### Modules

```monad
use std::list {List.cons, List.length}
use lib::show {Show as ShowClass}

open IO {println, current_time}

open Monads in def wrapped : I64 := 1
```

`use` paths are `::`-separated; `open` takes a dotted name path. Qualified references like `std::list::List.cons` parse as one `module_path` node.

### Infix Operators

```monad
infix (>>=) := Monad.bind
infix (<|) := fun_apply
infix (|>) := apply_fun
infix (++) := append
```

Binary operator precedence mirrors the self-hosted parser's operator table: `|>` `<|` `>>=` `.` `<*>` `<|>` `||` `&&` comparisons (`==` `!=` `<` `>` `<=` `>=`) `++`/`@` shifts `+`/`-` `*`/`/`, with application binding tightest and `->` loosest. Only these operators may be declared; anything else is an "unknown operator".

### Do Notation and Monadic Returns

```monad
def read_pair (get : I64 -> IO I64) : IO I64 :=
  do {
    let x <- get 0;
    let y := x + 1;
    let z <- get y;
    return z
  }

def via_bind : IO Unit :=
  get_line >>= \line => println line
```

Both binding forms start with `let` and are distinguished by `<-` vs `:=`. Semicolons are optional per statement. `return e` is also a plain term outside `do` blocks.

### Lambdas and Let

```monad
def increment : I64 -> I64 := fn x => x + 1

def apply_twice {A : Type} (f : A -> A) (a : A) : A :=
  let b := f a in f b
```

All three lambda spellings (`fn`, `\`, `ꟛ`) parse; bodies extend greedily (`fn x => x + 1` binds `x + 1`).

### Literals

```monad
def samples : List String := [
  "escaped \" and \n and \u{1F600}",
  r"no \ escapes",
  r#"quotes " inside"#,
  "chars:",
  String.of_char 'x'
]

def cfg : Config := {debug := true, timeout := 30}

def updated : Config := {cfg with timeout := 60}

def level : Type := Sort 1
```

Numbers take `i8`..`u64`, `f32`/`f64` suffixes; `0x` hex literals and floats are separate node types. Raw strings support up to three delimiter hashes (`r###"..."###`).

### Attributes and Motes

```monad
#![mote tests]

#[test]
def one_plus_one : Bool := 2 == 1 + 1

#[deprecated {since := "0.2", reason := "use two"}]
def old_name : I64 := 2
```

### Macros and With Blocks

```monad
defmacro derive_eq (name : String) := decls {
  def name_beq (a b : I64) : Bool := a == b
}

with Monadic {
  def pure {A : Type} (a : A) : IO A := IO.pure a
}

derive_debug! Point
```

Decl-level macro calls (`name! args`) and `with`-prefixed declaration blocks are supported.

### Structs and Multiplicity

```monad
struct Config {
  debug : Bool := false,
  timeout : I64 := 30
}

def consume (!x : Resource) : Unit := release x

def maybe_use (?x : Resource) : Unit :=
  if available then use x else noop
```

`%`/`!`/`?` multiplicity prefixes are accepted on binders (Erased/Linear/Affine).

## License

Apache-2.0
