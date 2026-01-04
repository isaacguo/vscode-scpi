import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';
import * as path from 'path';

export class ParserService {
    private parser: Parser | undefined;
    private trees: Map<string, Parser.Tree> = new Map();
    private static instance: ParserService;

    private constructor() {}

    public static getInstance(): ParserService {
        if (!ParserService.instance) {
            ParserService.instance = new ParserService();
        }
        return ParserService.instance;
    }

    public async init(context: vscode.ExtensionContext): Promise<void> {
        try {
            await Parser.init();
            this.parser = new Parser();
            
            const wasmPath = path.join(context.extensionPath, 'node_modules', 'tree-sitter-scpi', 'tree-sitter-scpi.wasm');
            const lang = await Parser.Language.load(wasmPath);
            this.parser.setLanguage(lang);

            // Subscribe to document changes
            context.subscriptions.push(
                vscode.workspace.onDidChangeTextDocument(this.onDocumentChanged.bind(this)),
                vscode.workspace.onDidCloseTextDocument(this.onDocumentClosed.bind(this)),
                vscode.workspace.onDidOpenTextDocument(this.onDocumentOpened.bind(this))
            );

            // Parse currently open documents
            vscode.workspace.textDocuments.forEach(doc => {
                if (doc.languageId === 'scpi') {
                    this.parse(doc);
                }
            });

        } catch (e) {
            console.error('Failed to initialize SCPI parser:', e);
            vscode.window.showErrorMessage('SCPI Language Support: Failed to load parser.');
        }
    }

    public getTree(document: vscode.TextDocument): Parser.Tree | undefined {
        if (document.languageId !== 'scpi') {
            return undefined;
        }
        
        // If not parsed yet, parse it now
        if (!this.trees.has(document.uri.toString())) {
            this.parse(document);
        }
        return this.trees.get(document.uri.toString());
    }

    private parse(document: vscode.TextDocument) {
        if (!this.parser || document.languageId !== 'scpi') {
            return;
        }
        
        const tree = this.parser.parse(document.getText());
        this.trees.set(document.uri.toString(), tree);
    }

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent) {
        if (event.document.languageId === 'scpi') {
            // Incremental parsing is better but full parse is safer for v1
            // For incremental: this.parser.parse(getText(), oldTree, edits)
            // But we need to map VSCode edits to TreeSitter edits.
            // For now, doing full re-parse for simplicity unless performance is an issue.
            this.parse(event.document);
        }
    }

    private onDocumentClosed(document: vscode.TextDocument) {
        this.trees.delete(document.uri.toString());
    }

    private onDocumentOpened(document: vscode.TextDocument) {
        if (document.languageId === 'scpi') {
            this.parse(document);
        }
    }
}

