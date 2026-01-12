import * as vscode from 'vscode';
import * as path from 'path';
import { ParserService } from './parser';
import { ScpiCompletionItemProvider } from './features/completion';
import { ScpiDiagnostics } from './features/diagnostics';
import { ScpiDocumentSymbolProvider } from './features/symbols';
import { ScpiAIContext } from './ai/context';
import { ScpiNotebookSerializer } from './notebook/serializer';
import { ScpiNotebookController } from './notebook/controller';
import { ConnectionService } from './notebook/connection';
import { McpServerManager } from './mcp/server-manager';

export async function activate(context: vscode.ExtensionContext) {
    console.log('SCPI extension is now active!');

    // Initialize MCP Server Manager
    const mcpServerManager = new McpServerManager(context);
    await mcpServerManager.initialize();
    context.subscriptions.push(mcpServerManager);

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
        vscode.commands.registerCommand('scpi.configureConnection', async (notebook?: vscode.NotebookDocument) => {
             if (!notebook) {
                 const editor = vscode.window.activeNotebookEditor;
                 if (editor && editor.notebook.notebookType === 'scpi-notebook') {
                     notebook = editor.notebook;
                 }
             }
             
             if (notebook) {
                 // Validate notebook has URI
                 if (!notebook.uri) {
                     // Try to get notebook from workspace
                     const editor = vscode.window.activeNotebookEditor;
                     if (editor && editor.notebook.uri && editor.notebook.notebookType === 'scpi-notebook') {
                         notebook = editor.notebook;
                     } else {
                         vscode.window.showErrorMessage('Invalid notebook: missing URI. Please ensure the notebook is properly opened.');
                         return;
                     }
                 }
                 try {
                     await ConnectionService.configureConnection(notebook);
                 } catch (err: any) {
                     console.error('Error in configureConnection:', err);
                     vscode.window.showErrorMessage(`Failed to configure instrument connection: ${err}`);
                 }
             } else {
                 vscode.window.showErrorMessage('No active SCPI notebook found.');
             }
        })
    );

    // Register Python Environment Command
    context.subscriptions.push(
        vscode.commands.registerCommand('scpi.configurePythonEnvironment', async (notebook?: vscode.NotebookDocument) => {
             if (!notebook) {
                 const editor = vscode.window.activeNotebookEditor;
                 if (editor && editor.notebook.notebookType === 'scpi-notebook') {
                     notebook = editor.notebook;
                 }
             }
             
             if (notebook) {
                 try {
                     await ConnectionService.configurePythonEnvironment(notebook);
                 } catch (err: any) {
                     console.error('Error in configurePythonEnvironment:', err);
                     vscode.window.showErrorMessage(`Failed to configure Python environment: ${err}`);
                 }
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

    // Register Setup MCP Server Command
    context.subscriptions.push(
        vscode.commands.registerCommand('scpi.setupMcpServer', async () => {
            // 1. Select Manual Directory
            const currentDir = vscode.workspace.getConfiguration('scpi').get<string>('manualDirectory', '.scpi');
            
            const selection = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Manual Directory',
                title: 'Select Directory for SCPI Manuals'
            });

            if (selection && selection.length > 0) {
                const selectedPath = selection[0].fsPath;
                // Try to make it relative to workspace if possible
                let configPath = selectedPath;
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    if (selectedPath.startsWith(workspacePath)) {
                        configPath = path.relative(workspacePath, selectedPath);
                    }
                }

                await vscode.workspace.getConfiguration('scpi').update('manualDirectory', configPath, vscode.ConfigurationTarget.Global);
                
                // 2. Enable Server
                const enable = await vscode.window.showQuickPick(['Yes', 'No'], {
                    placeHolder: 'Enable MCP Server now?',
                    title: 'Enable SCPI MCP Server'
                });

                if (enable === 'Yes') {
                    await vscode.workspace.getConfiguration('scpi').update('mcpServerEnabled', true, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`MCP Server configured and enabled. Manual directory: ${configPath}`);
                } else {
                    vscode.window.showInformationMessage(`MCP Server configured (but not enabled). Manual directory: ${configPath}`);
                }
            }
        })
    );
}

export function deactivate() {}
