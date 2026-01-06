import * as vscode from 'vscode';

export interface ScpiConnectionConfig {
    resourceName: string;
}

export class ConnectionService {
    static async configureConnection(notebook: vscode.NotebookDocument): Promise<void> {
        const currentConfig = this.getConnectionConfig(notebook);
        
        const resourceName = await vscode.window.showInputBox({
            title: 'Instrument Connection',
            prompt: 'Enter VISA Resource Name (e.g., TCPIP::192.168.1.1::INSTR)',
            value: currentConfig?.resourceName || '',
            placeHolder: 'TCPIP::192.168.1.1::INSTR'
        });

        if (resourceName !== undefined) {
            await this.updateConnectionConfig(notebook, { resourceName });
        }
    }

    static getConnectionConfig(notebook: vscode.NotebookDocument): ScpiConnectionConfig | undefined {
        return notebook.metadata.connection as ScpiConnectionConfig | undefined;
    }

    static async updateConnectionConfig(notebook: vscode.NotebookDocument, config: ScpiConnectionConfig): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const newMetadata = { ...notebook.metadata, connection: config };
        
        // NotebookEdit.updateNotebookMetadata requires the NEW metadata object
        edit.set(notebook.uri, [
            vscode.NotebookEdit.updateNotebookMetadata(newMetadata)
        ]);
        
        await vscode.workspace.applyEdit(edit);
    }
}

