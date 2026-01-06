import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { ConnectionService } from './connection';

export class ScpiNotebookController {
    readonly controllerId = 'scpi-visa-controller';
    readonly notebookType = 'scpi-notebook';
    readonly label = 'SCPI VISA Controller';
    readonly supportedLanguages = ['scpi'];

    private readonly _controller: vscode.NotebookController;
    private _executionOrder = 0;

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._controller = vscode.notebooks.createNotebookController(
            this.controllerId,
            this.notebookType,
            this.label
        );

        this._controller.supportedLanguages = this.supportedLanguages;
        this._controller.supportsExecutionOrder = true;
        this._controller.executeHandler = this._execute.bind(this);
    }

    private async _execute(
        cells: vscode.NotebookCell[],
        _notebook: vscode.NotebookDocument,
        _controller: vscode.NotebookController
    ): Promise<void> {
        for (const cell of cells) {
            await this._doExecution(cell, _notebook);
        }
    }

    private async _doExecution(cell: vscode.NotebookCell, notebook: vscode.NotebookDocument): Promise<void> {
        const execution = this._controller.createNotebookCellExecution(cell);
        execution.executionOrder = ++this._executionOrder;
        execution.start(Date.now());

        const config = ConnectionService.getConnectionConfig(notebook);
        if (!config || !config.resourceName) {
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error(new Error('No instrument connected. Please configure connection first.'))
                ])
            ]);
            execution.end(false, Date.now());
            return;
        }

        try {
            // Path to python script
            const scriptPath = path.join(this._context.extensionPath, 'python', 'visa_adapter.py');
            // Assuming python is in PATH. In real app, allow configuration.
            const pythonPath = vscode.workspace.getConfiguration('scpi').get<string>('pythonPath') || 'python';

            const output = await this._runPythonScript(pythonPath, scriptPath, config.resourceName, cell.document.getText(), execution.token);
            
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(output)
                ])
            ]);
            execution.end(true, Date.now());
        } catch (err: any) {
            execution.replaceOutput([
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.error(err)
                ])
            ]);
            execution.end(false, Date.now());
        }
    }

    private _runPythonScript(python: string, script: string, resource: string, commands: string, token: vscode.CancellationToken): Promise<string> {
        return new Promise((resolve, reject) => {
            const process = cp.spawn(python, [script, resource]);
            
            const cancelDisposable = token.onCancellationRequested(() => {
                process.kill();
                reject(new Error('Execution cancelled'));
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                cancelDisposable.dispose();
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `Process exited with code ${code}`));
                }
            });

            process.on('error', (err) => {
                cancelDisposable.dispose();
                reject(err);
            });

            process.stdin.write(commands);
            process.stdin.end();
        });
    }

    dispose() {
        this._controller.dispose();
    }
}

