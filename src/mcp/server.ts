import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ManualManager } from './manual-manager';

// Initialize manual manager
const manualManager = new ManualManager();

// Create MCP server instance
const server = new McpServer({
    name: "scpi-manuals",
    version: "1.0.0"
});

// Register list_manuals tool
server.tool(
    "list_manuals",
    "List all available instrument manuals with metadata (manufacturer, model, description)",
    {}, // No parameters required
    async () => {
        try {
            const manuals = manualManager.getManuals();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(manuals, null, 2)
                    }
                ]
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error listing manuals: ${error.message}`
                    }
                ],
                isError: true
            };
        }
    }
);

// Register get_manual_content tool
server.tool(
    "get_manual_content",
    "Get the full content of a specific instrument manual",
    {
        instrumentName: z.string().describe("The standardized instrument name (e.g., KEYSIGHT_34401A)")
    },
    async ({ instrumentName }) => {
        try {
            if (!instrumentName || typeof instrumentName !== 'string') {
                return {
                    content: [{ type: "text", text: "Invalid instrument name provided" }],
                    isError: true
                };
            }

            const content = await manualManager.getManualContent(instrumentName);
            
            if (!content) {
                return {
                    content: [{ type: "text", text: `Manual not found for instrument: ${instrumentName}` }],
                    isError: true
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: content
                    }
                ]
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error retrieving manual content: ${error.message}`
                    }
                ],
                isError: true
            };
        }
    }
);

async function main() {
    // Get manual directory from environment variable or command line arg
    const manualDir = process.env.SCPI_MANUAL_DIR || process.argv[2];
    
    if (!manualDir) {
        console.error("SCPI_MANUAL_DIR environment variable or argument is required");
        process.exit(1);
    }

    try {
        await manualManager.initialize(manualDir);
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("SCPI MCP Server running on stdio");
    } catch (error) {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    }
}

main();
