#include <tree_sitter/parser.h>

enum TokenType {
  BLOCK_COMMENT,
};

void *tree_sitter_monad_external_scanner_create() {
  return NULL;
}

void tree_sitter_monad_external_scanner_destroy(void *p) {}

unsigned tree_sitter_monad_external_scanner_serialize(void *p, char *buffer) {
  return 0;
}

void tree_sitter_monad_external_scanner_deserialize(void *p, const char *b, unsigned n) {}

bool tree_sitter_monad_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[BLOCK_COMMENT]) {
    if (lexer->lookahead == '/') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '*') {
        lexer->advance(lexer, false);
        int depth = 1;
        while (depth > 0) {
          if (lexer->lookahead == 0) {
            return false;
          }
          if (lexer->lookahead == '/') {
            lexer->advance(lexer, false);
            if (lexer->lookahead == '*') {
              lexer->advance(lexer, false);
              depth++;
            }
          } else if (lexer->lookahead == '*') {
            lexer->advance(lexer, false);
            if (lexer->lookahead == '/') {
              lexer->advance(lexer, false);
              depth--;
            }
          } else {
            lexer->advance(lexer, false);
          }
        }
        lexer->result_symbol = BLOCK_COMMENT;
        return true;
      }
    }
  }
  return false;
}
