import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface McpServerConfig {
    command: string;
    args: string[];
    env?: { [key: string]: string };
}

// VS Code uses "servers" as root key
interface VscodeMcpConfigFile {
    servers: {
        [serverName: string]: McpServerConfig;
    };
}

// Cursor uses "mcpServers" as root key
interface CursorMcpConfigFile {
    mcpServers: {
        [serverName: string]: McpServerConfig;
    };
}

type IdeType = 'vscode' | 'cursor' | 'unknown';

export class McpConfigManager {
    private readonly workspaceConfigPath: string | null;
    private readonly ideType: IdeType;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Detect current IDE
        this.ideType = this.detectIde();
        // Use workspace root for MCP config file
        this.workspaceConfigPath = this.getWorkspaceConfigPath();
    }

    /**
     * Detect the current IDE (VS Code, Cursor, or unknown)
     */
    private detectIde(): IdeType {
        const appName = vscode.env.appName.toLowerCase();
        
        // Check for Cursor
        if (appName.includes('cursor')) {
            return 'cursor';
        }
        
        // Check for VS Code
        if (appName.includes('visual studio code') || appName.includes('code')) {
            return 'vscode';
        }
        
        // Unknown IDE - default to Cursor format (more common)
        return 'unknown';
    }

    /**
     * Get the workspace MCP config file path
     * Uses .vscode/mcp.json for VS Code and .cursor/mcp.json for Cursor
     */
    private getWorkspaceConfigPath(): string | null {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            
            if (this.ideType === 'cursor') {
                return path.join(workspaceRoot, '.cursor', 'mcp.json');
            } else {
                // VS Code or unknown - use .vscode
                return path.join(workspaceRoot, '.vscode', 'mcp.json');
            }
        }
        return null;
    }

    /**
     * Get the config file path (workspace first, fallback to null if no workspace)
     */
    private getConfigFilePath(): string | null {
        return this.workspaceConfigPath;
    }

    /**
     * Read existing MCP config file
     * Supports both VS Code (servers) and Cursor (mcpServers) formats
     */
    private readConfigFile(filePath: string): VscodeMcpConfigFile | CursorMcpConfigFile {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const parsed = JSON.parse(content);
                
                // Check which format is used
                if ('servers' in parsed) {
                    return parsed as VscodeMcpConfigFile;
                } else if ('mcpServers' in parsed) {
                    return parsed as CursorMcpConfigFile;
                }
                
                // If neither format found, return default based on IDE
                if (this.ideType === 'cursor') {
                    return { mcpServers: {} };
                } else {
                    return { servers: {} };
                }
            }
        } catch (error) {
            console.warn(`Failed to read MCP config file ${filePath}:`, error);
        }

        // Return default structure based on IDE
        if (this.ideType === 'cursor') {
            return { mcpServers: {} };
        } else {
            return { servers: {} };
        }
    }

    /**
     * Write MCP config file
     * Uses the appropriate format based on IDE type
     */
    private writeConfigFile(filePath: string, config: VscodeMcpConfigFile | CursorMcpConfigFile): boolean {
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
     * Uses the appropriate schema based on IDE (VS Code uses "servers", Cursor uses "mcpServers")
     */
    public async updateConfig(enabled: boolean): Promise<{ success: boolean; filePath: string | null; message: string }> {
        const configPath = this.getConfigFilePath();
        
        if (!configPath) {
            return {
                success: false,
                filePath: null,
                message: 'No workspace folder found. Please open a workspace folder to use MCP server configuration.'
            };
        }

        const config = this.readConfigFile(configPath);
        const serverConfig = this.getServerConfig();

        if (enabled) {
            // Determine which format to use based on IDE type
            // Priority: detected IDE type > existing file format
            const useCursorFormat = this.ideType === 'cursor' || 
                                   (this.ideType === 'unknown' && 'mcpServers' in config);
            
            if (useCursorFormat) {
                // Cursor format
                const cursorConfig: CursorMcpConfigFile = 'mcpServers' in config 
                    ? (config as CursorMcpConfigFile)
                    : { mcpServers: {} };
                
                if (!cursorConfig.mcpServers) {
                    cursorConfig.mcpServers = {};
                }
                cursorConfig.mcpServers['scpi-manuals'] = serverConfig;

                if (this.writeConfigFile(configPath, cursorConfig)) {
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
                // VS Code format
                const vscodeConfig: VscodeMcpConfigFile = 'servers' in config
                    ? (config as VscodeMcpConfigFile)
                    : { servers: {} };
                
                if (!vscodeConfig.servers) {
                    vscodeConfig.servers = {};
                }
                vscodeConfig.servers['scpi-manuals'] = serverConfig;

                if (this.writeConfigFile(configPath, vscodeConfig)) {
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
            }
        } else {
            // Remove the server config if it exists
            let removed = false;
            
            if ('mcpServers' in config && config.mcpServers['scpi-manuals']) {
                delete config.mcpServers['scpi-manuals'];
                removed = true;
            } else if ('servers' in config && config.servers['scpi-manuals']) {
                delete config.servers['scpi-manuals'];
                removed = true;
            }
            
            if (removed) {
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
        if (this.workspaceConfigPath) {
            return [this.workspaceConfigPath];
        }
        return [];
    }

    /**
     * Check if config file exists
     */
    public hasConfigFile(): boolean {
        if (this.workspaceConfigPath) {
            return fs.existsSync(this.workspaceConfigPath);
        }
        return false;
    }
}
