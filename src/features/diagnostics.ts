import * as vscode from 'vscode';
import { ParserService } from '../parser';
import { SyntaxNode } from 'web-tree-sitter';

export class ScpiDiagnostics {
    private collection: vscode.DiagnosticCollection;

    constructor(context: vscode.ExtensionContext) {
        this.collection = vscode.languages.createDiagnosticCollection('scpi');
        context.subscriptions.push(this.collection);

        vscode.workspace.onDidChangeTextDocument(e => this.updateDiagnostics(e.document));
        vscode.workspace.onDidOpenTextDocument(doc => this.updateDiagnostics(doc));
    }

    public updateDiagnostics(document: vscode.TextDocument) {
        if (document.languageId !== 'scpi') {
            return;
        }

        const tree = ParserService.getInstance().getTree(document);
        if (!tree) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        this.traverse(tree.rootNode, diagnostics);
        this.collection.set(document.uri, diagnostics);
    }

    private traverse(node: SyntaxNode, diagnostics: vscode.Diagnostic[]) {
        if (node.type === 'ERROR' || node.isMissing()) {
            const range = new vscode.Range(
                node.startPosition.row,
                node.startPosition.column,
                node.endPosition.row,
                node.endPosition.column
            );
            const message = node.isMissing() ? `Missing ${node.type}` : 'Syntax error';
            diagnostics.push(new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error));
        }

        for (const child of node.children) {
            this.traverse(child, diagnostics);
        }
    }
}

