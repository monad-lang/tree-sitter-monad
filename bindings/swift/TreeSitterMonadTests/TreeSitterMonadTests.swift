import XCTest
import SwiftTreeSitter
import TreeSitterMonad

final class TreeSitterMonadTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_monad())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Monad grammar")
    }
}
