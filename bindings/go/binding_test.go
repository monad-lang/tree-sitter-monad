package tree_sitter_monad_test

import (
	"testing"

	tree_sitter_monad "tangled.org/monad-lang.org/tree-sitter-monad/bindings/go"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_monad.Language())
	if language == nil {
		t.Errorf("Error loading Monad grammar")
	}
}
