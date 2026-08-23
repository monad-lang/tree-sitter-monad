# tree-sitter-monad

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the **Monad** programming language.

## About

Monad is a functional programming language with support for dependent types, type classes, and algebraic data types. This grammar provides syntax highlighting, code navigation, and structural editing support for Monad source files (`.mo`).

## Features

- **Declarations**: `def`, `type`, `class`, `instance`, `struct`, `infix`
- **Type system**: Dependent types, implicit/explicit binders, type constraints
- **Expressions**: Function application, lambda abstractions, `if/then/else`, `match`, binary operators
- **Do notation**: Monadic sequencing with `do` blocks
- **Comments**: Line (`//`) and block (`/* */`) comments

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

### Types

```monad
type Bool {
  true,
  false
}

type Result E A {
  ok (a: A),
  err (e: E)
}

type List A {
  empty,
  cons (a : A) (List A) : List A
}
```

### Definitions

```monad
def add (a : Nat) (b : Nat) : Nat := a + b

def Bool.not (b : Bool) : Bool := if b then false else true

def List.append (a b : List A) : List A :=
  match a {
    empty => b,
    cons el_a tail => List.cons el_a (List.append tail b)
  }
```

### Classes and Instances

```monad
class Functor (F: Type -> Type) {
  def map (f: A -> B) : (F A) -> F B
}

class [Functor F] Applicative (F: Type -> Type) {
  def pure : A -> F A
  def apply : F (A -> B) -> F A -> F B
}

instance Functor List {
  def map (f : A -> B) (self: List A) : List B :=
    match self {
      empty => List.empty,
      cons a tail => List.cons (f a) (Functor.map f tail)
    }
}
```

### Infix Operators

```monad
infix (>>=) := Monad.bind
infix (<|) := fun_apply
infix (|>) := apply_fun
infix (++) := append
```

### Do Notation

```monad
def example := do {
  let x := getValue;
  y <- transform x;
  return y
}
```

### Linear and Affine Types

```monad
def consume (!x : Resource) : Unit := release x

def maybe_use (?x : Resource) : Unit := if available then use x else noop
```

### Attributes

```monad
#[test]
def test_function : Bool := true

#[native "add"]
def native_add (a b : I64) : I64

#[deprecated {since := "1.0", reason := "use new_function"}]
def old_function := "old"
```

### Struct Field Defaults

```monad
struct Config {
  debug : Bool := false
  timeout : I64 := 30
}
```

### Term Constructors (Bootstrap Compiler)

```monad
Term.hole
Term.type_
Term.con
```

## License

Apache-2.0
