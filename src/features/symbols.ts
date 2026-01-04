import * as vscode from 'vscode';
import { ParserService } from '../parser';
import { SyntaxNode } from 'web-tree-sitter';

export class ScpiDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[] | vscode.SymbolInformation[]> {
        const tree = ParserService.getInstance().getTree(document);
        if (!tree) {
            return [];
        }

        const symbols: vscode.DocumentSymbol[] = [];
        this.visit(tree.rootNode, symbols);
        return symbols;
    }

    private visit(node: SyntaxNode, parentSymbols: vscode.DocumentSymbol[]) {
        let symbol: vscode.DocumentSymbol | undefined;

        if (node.type === 'program_message' || node.type === 'command_header') {
            const name = node.text;
            const detail = node.type;
            const kind = node.type === 'program_message' ? vscode.SymbolKind.Event : vscode.SymbolKind.Function;
            
            const range = new vscode.Range(
                node.startPosition.row,
                node.startPosition.column,
                node.endPosition.row,
                node.endPosition.column
            );
            const selectionRange = range;

            symbol = new vscode.DocumentSymbol(name, detail, kind, range, selectionRange);
            parentSymbols.push(symbol);
        }

        const targetList = symbol ? symbol.children : parentSymbols;
        for (const child of node.children) {
            this.visit(child, targetList);
        }
    }
}

