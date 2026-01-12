import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class McpServerManager {
    private serverProcess: cp.ChildProcess | null = null;
    private restartAttempts = 0;
    private lastRestartTime = 0;
    private readonly MAX_RESTART_ATTEMPTS = 3;
    private readonly RESTART_WINDOW_MS = 60000; // 1 minute
    private isShuttingDown = false;
    private outputChannel: vscode.OutputChannel;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('SCPI MCP Server');
    }

    public async initialize(): Promise<void> {
        // Register configuration listener
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange.bind(this))
        );

        // Check if enabled and start
        if (this.isEnabled()) {
            await this.startServer();
        }
    }

    private isEnabled(): boolean {
        return vscode.workspace.getConfiguration('scpi').get<boolean>('mcpServerEnabled', false);
    }

    private getManualDirectory(): string {
        const configPath = vscode.workspace.getConfiguration('scpi').get<string>('manualDirectory', '.scpi');
        
        if (path.isAbsolute(configPath)) {
            return configPath;
        }

        // Resolve relative to workspace root
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, configPath);
        }

        return '';
    }

    private async startServer(): Promise<void> {
        if (this.serverProcess) {
            return;
        }

        const manualDir = this.getManualDirectory();
        if (!manualDir) {
            this.log('Cannot start server: No workspace folder or manual directory configured');
            return;
        }

        // Validate/Create directory
        if (!fs.existsSync(manualDir)) {
            try {
                await fs.promises.mkdir(manualDir, { recursive: true });
                this.log(`Created manual directory: ${manualDir}`);
            } catch (err) {
                this.log(`Failed to create manual directory: ${err}`);
                vscode.window.showErrorMessage(`SCPI MCP Server: Failed to create manual directory at ${manualDir}`);
                return;
            }
        }

        const serverPath = path.join(this.context.extensionPath, 'out', 'src', 'mcp', 'server.js');
        
        try {
            this.log(`Starting MCP server with manual directory: ${manualDir}`);
            
            // Use the same node executable as VS Code if possible, or 'node' from path
            const nodePath = process.execPath;
            
            this.serverProcess = cp.spawn(nodePath, [serverPath], {
                env: { 
                    ...process.env,
                    SCPI_MANUAL_DIR: manualDir
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.serverProcess.stdout?.on('data', (data) => {
                this.log(`[MCP] ${data.toString().trim()}`);
            });

            this.serverProcess.stderr?.on('data', (data) => {
                this.log(`[MCP Error] ${data.toString().trim()}`);
            });

            this.serverProcess.on('error', (err) => {
                this.log(`Server process error: ${err}`);
                this.handleCrash();
            });

            this.serverProcess.on('exit', (code, signal) => {
                this.log(`Server exited with code ${code} and signal ${signal}`);
                this.serverProcess = null;
                if (!this.isShuttingDown) {
                    this.handleCrash();
                }
            });

            this.log('MCP Server started successfully');
        } catch (err) {
            this.log(`Failed to spawn server process: ${err}`);
            vscode.window.showErrorMessage(`SCPI MCP Server: Failed to start server process`);
        }
    }

    private async stopServer(): Promise<void> {
        if (!this.serverProcess) {
            return;
        }

        this.isShuttingDown = true;
        this.log('Stopping MCP server...');

        return new Promise<void>((resolve) => {
            if (this.serverProcess) {
                // Try graceful shutdown first
                this.serverProcess.kill('SIGTERM');
                
                // Force kill if it doesn't exit within 5 seconds
                const timeout = setTimeout(() => {
                    if (this.serverProcess) {
                        this.log('Server did not exit gracefully, force killing...');
                        this.serverProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);

                this.serverProcess.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            } else {
                resolve();
            }
        }).finally(() => {
            this.serverProcess = null;
            this.isShuttingDown = false;
        });
    }

    private async handleCrash(): Promise<void> {
        if (this.isShuttingDown) return;

        const now = Date.now();
        if (now - this.lastRestartTime > this.RESTART_WINDOW_MS) {
            // Reset attempts if it's been a while
            this.restartAttempts = 0;
        }

        this.restartAttempts++;
        this.lastRestartTime = now;

        if (this.restartAttempts <= this.MAX_RESTART_ATTEMPTS) {
            const delay = Math.pow(2, this.restartAttempts) * 1000;
            this.log(`Attempting restart ${this.restartAttempts}/${this.MAX_RESTART_ATTEMPTS} in ${delay}ms...`);
            
            setTimeout(async () => {
                if (!this.serverProcess && !this.isShuttingDown && this.isEnabled()) {
                    await this.startServer();
                }
            }, delay);
        } else {
            this.log('Max restart attempts reached. Server will not be restarted automatically.');
            vscode.window.showErrorMessage('SCPI MCP Server crashed repeatedly and will not be restarted. Please check the output logs.');
        }
    }

    private async onConfigurationChange(e: vscode.ConfigurationChangeEvent): Promise<void> {
        if (e.affectsConfiguration('scpi.mcpServerEnabled')) {
            if (this.isEnabled()) {
                await this.startServer();
            } else {
                await this.stopServer();
            }
        } else if (e.affectsConfiguration('scpi.manualDirectory')) {
            if (this.isEnabled()) {
                this.log('Manual directory changed, restarting server...');
                await this.stopServer();
                await this.startServer();
            }
        }
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }

    public async dispose(): Promise<void> {
        await this.stopServer();
        this.outputChannel.dispose();
    }
}
