{ pkgs, lib, config, inputs, ... }:

{
  packages = [ pkgs.tree-sitter ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    pnpm.enable = true;
  };

  languages.rust.enable = true;

  enterTest = ''
    tree-sitter generate
    tree-sitter test
  '';
}
