import * as vscode from 'vscode';
import { ParserService } from './parser';
import { ScpiCompletionItemProvider } from './features/completion';
import { ScpiDiagnostics } from './features/diagnostics';
import { ScpiDocumentSymbolProvider } from './features/symbols';
import { ScpiAIContext } from './ai/context';
import { ScpiNotebookSerializer } from './notebook/serializer';
import { ScpiNotebookController } from './notebook/controller';
import { ConnectionService } from './notebook/connection';

export async function activate(context: vscode.ExtensionContext) {
    console.log('SCPI extension is now active!');

    // Register Notebook Serializer - REGISTER FIRST to avoid race conditions
    context.subscriptions.push(
        vscode.workspace.registerNotebookSerializer(
            'scpi-notebook',
            new ScpiNotebookSerializer(),
            { transientOutputs: true }
        )
    );

    // Register Notebook Controller
    context.subscriptions.push(new ScpiNotebookController(context));

    // Register Connection Command
    context.subscriptions.push(
        vscode.commands.registerCommand('scpi.configureConnection', async (notebook: vscode.NotebookDocument) => {
             if (!notebook) {
                 const editor = vscode.window.activeNotebookEditor;
                 if (editor && editor.notebook.notebookType === 'scpi-notebook') {
                     notebook = editor.notebook;
                 }
             }
             
             if (notebook) {
                 await ConnectionService.configureConnection(notebook);
             } else {
                 vscode.window.showErrorMessage('No active SCPI notebook found.');
             }
        })
    );

    // Initialize Parser
    await ParserService.getInstance().init(context);

    // Register Completion Provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('scpi', new ScpiCompletionItemProvider(), ':', '*')
    );

    // Register Diagnostics
    new ScpiDiagnostics(context);

    // Register Document Symbol Provider
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider('scpi', new ScpiDocumentSymbolProvider())
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('scpi.getAIContext', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const context = ScpiAIContext.getContextAtCursor(editor.document, editor.selection.active);
                console.log('AI Context:', context);
                vscode.window.showInformationMessage(`Current SCPI Context: ${JSON.stringify(context, null, 2)}`);
                return context;
            }
            return null;
        })
    );
}

export function deactivate() {}
