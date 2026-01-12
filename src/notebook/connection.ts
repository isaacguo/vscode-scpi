import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { InstrumentIdentifier } from '../mcp/instrument-identifier';

export interface ScpiConnectionConfig {
    resourceName: string;
    isSimulation?: boolean;
    instrumentInfo?: {
        manufacturer: string;
        model: string;
        serialNumber?: string;
        firmwareVersion?: string;
    };
}

export interface PythonEnvironmentConfig {
    path: string;
    name?: string;
    version?: string;
}

export class ConnectionService {
    static async configureConnection(notebook: vscode.NotebookDocument): Promise<void> {
        const currentConfig = this.getConnectionConfig(notebook);
        
        // Show QuickPick with connection options
        const connectionType = await vscode.window.showQuickPick([
            {
                label: 'Enter VISA Resource Address',
                description: 'e.g., TCPIP::192.168.1.1::INSTR',
                detail: 'Manually enter the VISA resource address for your instrument'
            },
            {
                label: 'Use Simulation',
                description: 'Use simulated instrument for testing',
                detail: 'Connect to a simulated instrument (useful for testing without hardware)'
            }
        ], {
            placeHolder: 'Select connection type',
            title: 'Configure Instrument Connection'
        });

        if (!connectionType) {
            // User cancelled
            return;
        }

        let resourceName: string | undefined;

        if (connectionType.label === 'Enter VISA Resource Address') {
            // Show input box for manual entry
            resourceName = await vscode.window.showInputBox({
                title: 'VISA Resource Address',
                prompt: 'Enter VISA Resource Name (e.g., TCPIP::192.168.1.1::INSTR)',
                value: currentConfig?.resourceName || '',
                placeHolder: 'TCPIP::192.168.1.1::INSTR',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Resource name cannot be empty';
                    }
                    return null;
                }
            });
        } else if (connectionType.label === 'Use Simulation') {
            // Set simulation resource name - use pyvisa-sim default resource
            // According to pyvisa-sim docs: default resource is ASRL1::INSTR
            resourceName = 'ASRL1::INSTR';
        }

        if (resourceName !== undefined && resourceName.trim().length > 0) {
            const isSimulation = connectionType.label === 'Use Simulation';
            
            // Try to identify instrument via *IDN?
            // Note: This requires running a python script to query *IDN?
            // For now, we will clear any previous instrument info and let it be populated
            // when the user first runs a cell or via a background check if possible.
            // However, since we don't have a persistent connection process here (it's per cell execution),
            // we might want to trigger an IDN query immediately if Python is set up.
            
            // But wait, the plan says "Update src/notebook/connection.ts to automatically identify instrument after connection".
            // Since we don't have an active Python session here, we can't easily query *IDN? without spawning a process.
            // Let's defer *IDN? query to the first execution or try to run a quick check if Python is configured.
            
            // Actually, we can try to use the ScpiNotebookController to run *IDN? if we can access it,
            // but Controller logic is separate. 
            // A better approach: After setting connection, we can try to spawn the python adapter script 
            // just to query *IDN? if python environment is configured.
            
            let instrumentInfo = undefined;
            
            // We'll update the config first
            await this.updateConnectionConfig(notebook, { 
                resourceName: resourceName.trim(),
                isSimulation: isSimulation
            });

            // Try to identify if we have python environment
            const pythonEnv = this.getPythonEnvironment(notebook) || 
                             vscode.workspace.getConfiguration('scpi').get<string>('pythonPath') ? 
                             { path: vscode.workspace.getConfiguration('scpi').get<string>('pythonPath') || 'python' } : undefined;

            if (pythonEnv && pythonEnv.path) {
                try {
                    const idnResponse = await this.queryIdn(pythonEnv.path, resourceName.trim(), isSimulation);
                    const info = InstrumentIdentifier.parseIdnResponse(idnResponse);
                    if (info) {
                        instrumentInfo = info;
                        // Update config again with instrument info
                        await this.updateConnectionConfig(notebook, { 
                            resourceName: resourceName.trim(),
                            isSimulation: isSimulation,
                            instrumentInfo: info
                        });
                        vscode.window.showInformationMessage(`Connected to: ${info.manufacturer} ${info.model}`);
                    }
                } catch (err) {
                    console.warn('Failed to query *IDN?:', err);
                    // Don't fail connection if IDN fails, just warn
                }
            }

            const displayName = isSimulation 
                ? 'Simulation (ASRL1::INSTR)' 
                : resourceName;
            
            if (!instrumentInfo) {
                vscode.window.showInformationMessage(`Instrument connection set to: ${displayName}`);
            }
        }
    }

    private static async queryIdn(pythonPath: string, resourceName: string, isSimulation: boolean): Promise<string> {
        return new Promise((resolve, reject) => {
            // We need to locate the visa_adapter.py script
            // This assumes we are running in the extension context context, but this is a static method.
            // We might need to pass extension context or find path relative to this file.
            // src/notebook/connection.ts -> src/notebook -> src -> root -> python/visa_adapter.py
            // ../../../python/visa_adapter.py from source structure
            // But at runtime: dist/extension.js location...
            // Ideally we should use extensionContext.extensionPath but we don't have it here easily.
            // However, ScpiNotebookController uses: path.join(this._context.extensionPath, 'python', 'visa_adapter.py')
            
            // Let's try to find it relative to __dirname. 
            // In dev: src/notebook/connection.ts
            // In prod: out/src/notebook/connection.js
            
            let scriptPath = path.resolve(__dirname, '../../../python/visa_adapter.py');
            if (!fs.existsSync(scriptPath)) {
                // Try production path
                scriptPath = path.resolve(__dirname, '../../../../python/visa_adapter.py');
            }
            
            // If still not found, we can't run
            if (!fs.existsSync(scriptPath)) {
                reject(new Error(`Adapter script not found at ${scriptPath}`));
                return;
            }

            const { spawn } = require('child_process');
            const args = [scriptPath, resourceName];
            if (isSimulation) {
                args.push('--sim');
            }
            
            const process = spawn(pythonPath, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            process.on('close', (code: number) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(stderr || `Process exited with code ${code}`));
                }
            });

            process.on('error', (err: Error) => {
                reject(err);
            });

            // Write *IDN? command
            process.stdin.write('*IDN?\n');
            process.stdin.end();
        });
    }

    static getConnectionConfig(notebook: vscode.NotebookDocument): ScpiConnectionConfig | undefined {
        if (!notebook.metadata) {
            return undefined;
        }
        return notebook.metadata.connection as ScpiConnectionConfig | undefined;
    }

    static async updateConnectionConfig(notebook: vscode.NotebookDocument, config: ScpiConnectionConfig): Promise<void> {
        if (!notebook.uri) {
            throw new Error('Notebook URI is undefined');
        }
        const edit = new vscode.WorkspaceEdit();
        const newMetadata = { ...(notebook.metadata || {}), connection: config };
        
        // NotebookEdit.updateNotebookMetadata requires the NEW metadata object
        edit.set(notebook.uri, [
            vscode.NotebookEdit.updateNotebookMetadata(newMetadata)
        ]);
        
        await vscode.workspace.applyEdit(edit);
    }

    static getPythonEnvironment(notebook: vscode.NotebookDocument): PythonEnvironmentConfig | undefined {
        if (!notebook.metadata) {
            return undefined;
        }
        return notebook.metadata.pythonEnvironment as PythonEnvironmentConfig | undefined;
    }

    static async updatePythonEnvironment(notebook: vscode.NotebookDocument, config: PythonEnvironmentConfig): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const newMetadata = { ...(notebook.metadata || {}), pythonEnvironment: config };
        
        edit.set(notebook.uri, [
            vscode.NotebookEdit.updateNotebookMetadata(newMetadata)
        ]);
        
        await vscode.workspace.applyEdit(edit);
    }

    static async configurePythonEnvironment(notebook: vscode.NotebookDocument): Promise<void> {
        const currentConfig = this.getPythonEnvironment(notebook);
        
        // Try to use Python extension API first
        const pythonExtension = vscode.extensions.getExtension('ms-python.python');
        
        if (pythonExtension) {
            // Activate extension if not already active
            if (!pythonExtension.isActive) {
                try {
                    await pythonExtension.activate();
                } catch (err) {
                    console.error('Failed to activate Python extension:', err);
                }
            }
            
            try {
                const pythonApi = pythonExtension.exports;
                
                // Method 1: Try to use environments API to get list
                if (pythonApi && pythonApi.environments) {
                    const environments = pythonApi.environments;
                    
                    // Try getKnownEnvironments
                    if (typeof environments.getKnownEnvironments === 'function') {
                        try {
                            const knownEnvs = await environments.getKnownEnvironments();
                            
                            if (knownEnvs && knownEnvs.length > 0) {
                                // Build QuickPick items
                                const items: vscode.QuickPickItem[] = [];
                                
                                for (const env of knownEnvs) {
                                    const envPath = env.executable?.path || env.path;
                                    if (!envPath) continue;
                                    
                                    const envName = env.name || env.envName || path.basename(path.dirname(path.dirname(envPath)));
                                    const version = env.version?.major && env.version?.minor 
                                        ? `${env.version.major}.${env.version.minor}.${env.version.micro || 0}`
                                        : await this.getPythonVersion(envPath);
                                    
                                    items.push({
                                        label: `${envName} (Python ${version})`,
                                        description: envPath,
                                        detail: envPath
                                    });
                                }
                                
                                if (items.length > 0) {
                                    // Add "Select Another Interpreter..." option
                                    items.push({
                                        label: 'Select Another Interpreter...',
                                        description: 'Browse for Python interpreter',
                                        detail: 'Opens Python extension\'s interpreter picker'
                                    });
                                    
                                    const selected = await vscode.window.showQuickPick(items, {
                                        placeHolder: 'Select Python environment for SCPI execution',
                                        title: 'Select Python Environment'
                                    });
                                    
                                    if (selected) {
                                        if (selected.label === 'Select Another Interpreter...') {
                                            // Trigger Python extension's native picker
                                            await vscode.commands.executeCommand('python.setInterpreter');
                                            
                                            // Wait a bit and try to get the newly selected interpreter
                                            await new Promise(resolve => setTimeout(resolve, 1500));
                                            
                                            try {
                                                if (typeof environments.getActiveEnvironmentPath === 'function') {
                                                    const activeEnv = await environments.getActiveEnvironmentPath(notebook.uri);
                                                    if (activeEnv) {
                                                        const envPath = typeof activeEnv === 'string' ? activeEnv : (activeEnv.path || activeEnv.executable?.path);
                                                        if (envPath) {
                                                            const version = await this.getPythonVersion(envPath);
                                                            const name = (typeof activeEnv === 'object' && activeEnv.name) 
                                                                ? activeEnv.name 
                                                                : path.basename(path.dirname(path.dirname(envPath)));
                                                            
                                                            await this.updatePythonEnvironment(notebook, {
                                                                path: envPath,
                                                                name: name,
                                                                version: version
                                                            });
                                                            
                                                            vscode.window.showInformationMessage(`Python environment set to: ${name} (Python ${version})`);
                                                            return;
                                                        }
                                                    }
                                                }
                                            } catch (err) {
                                                console.error('Error getting active environment:', err);
                                                // Fall through to manual input
                                            }
                                        } else {
                                            // Extract path from selected item
                                            const selectedPath = selected.description || '';
                                            if (selectedPath) {
                                                const version = await this.getPythonVersion(selectedPath);
                                                const name = selected.label.split(' (')[0];
                                                
                                                await this.updatePythonEnvironment(notebook, {
                                                    path: selectedPath,
                                                    name: name,
                                                    version: version
                                                });
                                                
                                                vscode.window.showInformationMessage(`Python environment set to: ${name} (Python ${version})`);
                                                return;
                                            }
                                        }
                                    }
                                    // If user cancelled or selection failed, fall through to manual input
                                }
                            }
                        } catch (err) {
                            console.error('Error getting known environments:', err);
                        }
                    }
                    
                    // Method 2: Try to get active environment and show picker
                    if (typeof environments.getActiveEnvironmentPath === 'function') {
                        try {
                            const activeEnv = await environments.getActiveEnvironmentPath(notebook.uri);
                            if (activeEnv && activeEnv.path) {
                                // Show option to use current or select new
                                const choice = await vscode.window.showQuickPick([
                                    {
                                        label: `Use Current: ${activeEnv.name || path.basename(path.dirname(path.dirname(activeEnv.path)))} (${activeEnv.path})`,
                                        description: activeEnv.path
                                    },
                                    {
                                        label: 'Select Different Interpreter...',
                                        description: 'Opens Python extension\'s interpreter picker'
                                    }
                                ], {
                                    placeHolder: 'Select Python environment',
                                    title: 'Select Python Environment'
                                });
                                
                                if (choice) {
                                    if (choice.label.startsWith('Use Current')) {
                                        const version = await this.getPythonVersion(activeEnv.path);
                                        const name = activeEnv.name || path.basename(path.dirname(path.dirname(activeEnv.path)));
                                        
                                        await this.updatePythonEnvironment(notebook, {
                                            path: activeEnv.path,
                                            name: name,
                                            version: version
                                        });
                                        
                                        vscode.window.showInformationMessage(`Python environment set to: ${name} (Python ${version})`);
                                        return;
                                    } else {
                                        // Trigger Python extension's native picker
                                        await vscode.commands.executeCommand('python.setInterpreter');
                                        
                                        // Wait and get the newly selected interpreter
                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                        
                                        const newActiveEnv = await environments.getActiveEnvironmentPath(notebook.uri);
                                        if (newActiveEnv && newActiveEnv.path) {
                                            const version = await this.getPythonVersion(newActiveEnv.path);
                                            const name = newActiveEnv.name || path.basename(path.dirname(path.dirname(newActiveEnv.path)));
                                            
                                            await this.updatePythonEnvironment(notebook, {
                                                path: newActiveEnv.path,
                                                name: name,
                                                version: version
                                            });
                                            
                                            vscode.window.showInformationMessage(`Python environment set to: ${name} (Python ${version})`);
                                            return;
                                        }
                                    }
                                } else {
                                    return;
                                }
                            }
                        } catch (err) {
                            console.error('Error getting active environment path:', err);
                        }
                    }
                }
            } catch (err) {
                console.error('Error using Python extension API:', err);
                // Fall through to manual input
            }
        }
        
        // Fallback: Always show manual input if Python extension methods didn't work
        const pythonPath = await vscode.window.showInputBox({
            title: 'Python Environment',
            prompt: 'Enter path to Python interpreter (e.g., /opt/anaconda3/envs/arto/bin/python)',
            value: currentConfig?.path || vscode.workspace.getConfiguration('scpi').get<string>('pythonPath') || 'python',
            placeHolder: '/path/to/python'
        });
        
        if (pythonPath !== undefined && pythonPath.trim()) {
            // Validate path exists (skip validation for 'python' as it's in PATH)
            if (pythonPath !== 'python' && !fs.existsSync(pythonPath)) {
                vscode.window.showErrorMessage(`Python interpreter not found: ${pythonPath}`);
                return;
            }
            
            const version = await this.getPythonVersion(pythonPath);
            const name = pythonPath === 'python' ? 'system' : path.basename(path.dirname(path.dirname(pythonPath)));
            
            await this.updatePythonEnvironment(notebook, {
                path: pythonPath,
                name: name,
                version: version
            });
            
            vscode.window.showInformationMessage(`Python environment set to: ${name} (Python ${version})`);
        }
    }

    private static async getPythonVersion(pythonPath: string): Promise<string> {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const process = spawn(pythonPath, ['--version']);
            
            let output = '';
            process.stdout.on('data', (data: Buffer) => {
                output += data.toString();
            });
            
            process.on('close', () => {
                // Extract version from output like "Python 3.13.11"
                const match = output.match(/Python (\d+\.\d+\.\d+)/);
                resolve(match ? match[1] : 'unknown');
            });
            
            process.on('error', () => {
                resolve('unknown');
            });
        });
    }
}

