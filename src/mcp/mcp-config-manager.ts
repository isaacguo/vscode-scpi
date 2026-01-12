import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface McpServerConfig {
    command: string;
    args: string[];
    env?: { [key: string]: string };
}

interface McpConfigFile {
    mcpServers: {
        [serverName: string]: McpServerConfig;
    };
}

export class McpConfigManager {
    private readonly configPaths: string[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        // Detect common MCP config file locations
        const homeDir = os.homedir();
        const platform = process.platform;

        // Cursor AI locations
        this.configPaths.push(path.join(homeDir, '.cursor', 'mcp.json'));
        this.configPaths.push(path.join(homeDir, '.config', 'cursor', 'mcp.json'));
        
        // VS Code Copilot locations (if applicable)
        if (platform === 'darwin') {
            this.configPaths.push(path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'));
        } else if (platform === 'win32') {
            this.configPaths.push(path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json'));
        } else {
            this.configPaths.push(path.join(homeDir, '.config', 'Code', 'User', 'mcp.json'));
        }

        // Claude Desktop locations
        this.configPaths.push(path.join(homeDir, '.config', 'claude', 'mcp.json'));
    }

    /**
     * Get the first existing config file path, or the first default path if none exist
     */
    private getConfigFilePath(): string | null {
        // Check if any config file exists
        for (const configPath of this.configPaths) {
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }

        // If none exist, use the first path (Cursor AI default)
        if (this.configPaths.length > 0) {
            return this.configPaths[0];
        }

        return null;
    }

    /**
     * Read existing MCP config file
     */
    private readConfigFile(filePath: string): McpConfigFile {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.warn(`Failed to read MCP config file ${filePath}:`, error);
        }

        // Return default structure
        return { mcpServers: {} };
    }

    /**
     * Write MCP config file
     */
    private writeConfigFile(filePath: string, config: McpConfigFile): boolean {
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write file with pretty formatting
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
            return true;
        } catch (error) {
            console.error(`Failed to write MCP config file ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Get system node path
     * Tries to find the actual node executable, not the VS Code/Cursor helper
     */
    private getNodePath(): string {
        // First, try to find node in common locations
        const platform = process.platform;
        const commonPaths = [
            '/usr/local/bin/node',
            '/usr/bin/node',
            '/opt/homebrew/bin/node',
            process.env.PATH?.split(path.delimiter).map(p => path.join(p, 'node')).find(p => {
                try {
                    return fs.existsSync(p) && fs.statSync(p).isFile();
                } catch {
                    return false;
                }
            })
        ].filter(Boolean) as string[];

        for (const nodePath of commonPaths) {
            if (nodePath && fs.existsSync(nodePath)) {
                try {
                    // Verify it's actually node (not a symlink to something else)
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
        // This is the most reliable approach for MCP config files
        return 'node';
    }

    /**
     * Get server path and arguments
     */
    private getServerConfig(): { command: string; args: string[]; env: { [key: string]: string } } {
        const serverPath = path.join(this.context.extensionPath, 'out', 'src', 'mcp', 'server.js');
        const nodePath = this.getNodePath();
        const manualDir = this.getManualDirectory();

        return {
            command: nodePath,
            args: [serverPath],
            env: {
                SCPI_MANUAL_DIR: manualDir
            }
        };
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

        // Fallback: use absolute path from extension directory
        return path.join(this.context.extensionPath, configPath);
    }

    /**
     * Add or update SCPI MCP server configuration
     */
    public async updateConfig(enabled: boolean): Promise<{ success: boolean; filePath: string | null; message: string }> {
        const configPath = this.getConfigFilePath();
        
        if (!configPath) {
            return {
                success: false,
                filePath: null,
                message: 'Could not determine MCP config file location'
            };
        }

        const config = this.readConfigFile(configPath);

        if (enabled) {
            // Add or update the server config
            const serverConfig = this.getServerConfig();
            config.mcpServers['scpi-manuals'] = serverConfig;

            if (this.writeConfigFile(configPath, config)) {
                return {
                    success: true,
                    filePath: configPath,
                    message: `MCP server configuration added to ${configPath}`
                };
            } else {
                return {
                    success: false,
                    filePath: configPath,
                    message: `Failed to write MCP config file at ${configPath}`
                };
            }
        } else {
            // Remove the server config if it exists
            if (config.mcpServers['scpi-manuals']) {
                delete config.mcpServers['scpi-manuals'];
                
                if (this.writeConfigFile(configPath, config)) {
                    return {
                        success: true,
                        filePath: configPath,
                        message: `MCP server configuration removed from ${configPath}`
                    };
                } else {
                    return {
                        success: false,
                        filePath: configPath,
                        message: `Failed to update MCP config file at ${configPath}`
                    };
                }
            } else {
                return {
                    success: true,
                    filePath: configPath,
                    message: 'MCP server configuration not found (already removed)'
                };
            }
        }
    }

    /**
     * Get list of available config file paths
     */
    public getAvailableConfigPaths(): string[] {
        return this.configPaths;
    }

    /**
     * Check if config file exists
     */
    public hasConfigFile(): boolean {
        return this.configPaths.some(p => fs.existsSync(p));
    }
}
