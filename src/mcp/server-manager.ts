import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { McpConfigManager } from './mcp-config-manager';

export class McpServerManager {
    private serverProcess: cp.ChildProcess | null = null;
    private restartAttempts = 0;
    private lastRestartTime = 0;
    private readonly MAX_RESTART_ATTEMPTS = 3;
    private readonly RESTART_WINDOW_MS = 60000; // 1 minute
    private isShuttingDown = false;
    private outputChannel: vscode.OutputChannel;
    private configManager: McpConfigManager;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('SCPI MCP Server');
        this.configManager = new McpConfigManager(context);
    }

    public async initialize(): Promise<void> {
        // Register configuration listener
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange.bind(this))
        );

        const enabled = this.isEnabled();
        // Check if enabled and start
        if (enabled) {
            // Update MCP config file on initialization if enabled
            const result = await this.configManager.updateConfig(true);
            if (result.success) {
                this.log(result.message);
            } else {
                this.log(`Warning: ${result.message}`);
            }
            
            await this.startServer();
        }
    }

    private isEnabled(): boolean {
        return vscode.workspace.getConfiguration('scpi').get<boolean>('mcpServerEnabled', true);
    }

    private getManualDirectory(): string {
        const configPath = vscode.workspace.getConfiguration('scpi').get<string>('manualDirectory', '.scpi_doc');
        
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
            
            // Get system node path (not VS Code/Cursor helper)
            const nodePath = this.getNodePath();
            
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
            const enabled = this.isEnabled();
            
            // Update MCP config file
            const result = await this.configManager.updateConfig(enabled);
            if (result.success) {
                this.log(result.message);
            } else {
                this.log(`Warning: ${result.message}`);
                // Show notification but don't block server startup
                if (enabled) {
                    vscode.window.showWarningMessage(
                        `MCP Server started, but failed to update AI assistant config: ${result.message}. You may need to manually configure it.`
                    );
                }
            }
            
            if (enabled) {
                await this.startServer();
            } else {
                await this.stopServer();
            }
        } else if (e.affectsConfiguration('scpi.manualDirectory')) {
            if (this.isEnabled()) {
                this.log('Manual directory changed, restarting server...');
                await this.stopServer();
                
                // Update config file with new directory
                const result = await this.configManager.updateConfig(true);
                if (result.success) {
                    this.log(result.message);
                }
                
                await this.startServer();
            }
        }
    }

    /**
     * Get system node path
     * Tries to find the actual node executable, not the VS Code/Cursor helper
     */
    private getNodePath(): string {
        // Try common system node locations first
        const commonPaths = [
            '/usr/local/bin/node',
            '/usr/bin/node',
            '/opt/homebrew/bin/node'
        ];

        for (const nodePath of commonPaths) {
            if (fs.existsSync(nodePath)) {
                try {
                    const stats = fs.statSync(nodePath);
                    if (stats.isFile() || stats.isSymbolicLink()) {
                        return nodePath;
                    }
                } catch {
                    continue;
                }
            }
        }

        // Try to find node in PATH
        const pathEnv = process.env.PATH || '';
        const pathDirs = pathEnv.split(path.delimiter);
        for (const dir of pathDirs) {
            const nodePath = path.join(dir, 'node');
            if (fs.existsSync(nodePath)) {
                try {
                    const stats = fs.statSync(nodePath);
                    if (stats.isFile() || stats.isSymbolicLink()) {
                        return nodePath;
                    }
                } catch {
                    continue;
                }
            }
        }

        // Fallback: use 'node' command (assumes it's in PATH)
        // This should work in most cases
        return 'node';
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }

    public async dispose(): Promise<void> {
        await this.stopServer();
        this.outputChannel.dispose();
    }
}
