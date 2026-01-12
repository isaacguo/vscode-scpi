# SCPI Notebook

A comprehensive development and execution environment for SCPI (Standard Commands for Programmable Instruments) in VS Code.

## Features

![ Demo ](assets/scpi.gif)

### Language Support
- **Syntax Highlighting** - Full syntax highlighting for SCPI commands using Tree-sitter parser
- **Intelligent Code Completion** - Auto-completion for SCPI commands including:
  - Common SCPI commands (`*IDN`, `*RST`, `*CLS`, etc.)
  - Subsystem commands (`:SYSTem`, `:MEASure`, etc.)
  - Hierarchical command structure with parameter hints
- **Symbol Navigation** - Navigate through SCPI commands and symbols in your files
- **Diagnostics & Error Checking** - Real-time error detection and validation of SCPI syntax

### Interactive Notebooks
- **SCPI Notebooks** - Create and work with interactive `.scpinb` notebook files
- **Execute SCPI Commands** - Run SCPI commands directly in notebook cells
- **View Results** - See command outputs and responses inline
- **Notebook Toolbar** - Quick access to configuration commands

### Instrument Integration
- **Connection Configuration** - Configure instrument connections (VISA, TCP/IP, USB, etc.)
- **Python Environment Setup** - Configure Python interpreter with pyvisa support
- **VISA Adapter** - Built-in Python adapter for instrument communication via pyvisa

### AI & Context
- **AI Context Support** - Generate AI context for SCPI commands and workflows
- **Command Documentation** - Built-in descriptions and documentation for common SCPI commands
- **MCP Server Integration** - Model Context Protocol (MCP) server for AI assistant integration
  - Automatically provides instrument SCPI manuals to AI assistants (VS Code Copilot, Cursor AI, etc.)
  - Enables AI assistants to generate instrument-specific SCPI commands based on user intent
  - Supports manual indexing and content retrieval for semantic understanding
  - Auto-enabled by default on first installation

### Visual Enhancements
- **Custom File Icons** - Dedicated icon theme for `.scpinb` files
- **Extension Icon** - Professional icon for the extension marketplace

## Requirements

- VS Code version 1.96.0 or higher

## Extension Settings

This extension contributes the following settings:

* `scpi.pythonPath` - Path to the Python interpreter with pyvisa installed (default: `"python"`)
* `scpi.manualDirectory` - Directory containing instrument SCPI manuals (Markdown files). Defaults to `.scpi_doc` in the workspace root
* `scpi.mcpServerEnabled` - Enable the MCP server for AI assistant integration. Enabled by default on first installation

## Commands

The extension provides the following commands:

* **Get SCPI AI Context** - Generate AI context for SCPI commands
* **Configure Instrument Connection** - Set up instrument connection settings
* **Configure Python Environment** - Configure Python interpreter path
* **Setup MCP Server** - Configure manual directory and enable MCP server for AI assistant integration
* **Enable MCP Server** - Enable the MCP server (updates AI assistant configuration automatically)
* **Disable MCP Server** - Disable the MCP server (removes from AI assistant configuration)
* **View MCP Configuration** - View and inspect MCP configuration files for AI assistants

## Known Issues

None at this time.

## Usage

1. **Create a SCPI Notebook**: Create a new file with `.scpinb` extension
2. **Configure Connection**: Use the notebook toolbar to configure your instrument connection
3. **Write SCPI Commands**: Type SCPI commands in notebook cells with full IntelliSense support
4. **Execute Commands**: Run cells to execute SCPI commands and view results
5. **Get AI Context**: Use the command palette to generate AI context for your SCPI workflows

### MCP Server for AI Assistant Integration

The extension includes a Model Context Protocol (MCP) server that provides instrument SCPI manuals to AI assistants, enabling them to generate instrument-specific commands based on user intent.

#### Setup

1. **Automatic Setup (Recommended)**: The MCP server is enabled by default on first installation. It uses the `.scpi_doc` folder in your workspace root to store instrument manuals.

2. **Manual Setup**: 
   - Use the **Setup MCP Server** command from the command palette
   - Select a directory for your instrument manuals (or use the default `.scpi_doc`)
   - Choose to enable the server immediately

3. **Adding Instrument Manuals**:
   - Place Markdown files in the manual directory (default: `.scpi_doc`)
   - Files should follow the naming convention: `{MANUFACTURER}_{MODEL}.md` or `{MANUFACTURER}_{MODEL}_*.md`
   - Example: `Keysight_N6700.md` or `Keysight_N6700_SCPI_Commands.md`
   - The server automatically indexes these files on startup

4. **Using with AI Assistants**:
   - The extension automatically updates AI assistant configuration files (e.g., `~/.cursor/mcp.json` for Cursor AI)
   - When you ask an AI assistant in a SCPI notebook (e.g., "Use DMM to measure DC voltage"), the AI will:
     - List available manuals via the MCP server
     - Identify the correct instrument manual
     - Retrieve the full manual content
     - Generate instrument-specific SCPI commands based on the manual

#### Manual File Format

Instrument manuals should be in Markdown format. The server extracts descriptions from:
- YAML frontmatter with a `description` field
- The first paragraph after the main title (`# Title`)

Example manual structure:
```markdown
---
description: Low-Profile Modular Power Supply
---

# Keysight N6700 SCPI Commands

This manual contains SCPI commands for the Keysight N6700 power supply.

## DC Voltage Measurement
...
```

#### Configuration

- **Manual Directory**: Configure via `scpi.manualDirectory` setting (default: `.scpi_doc`)
- **Enable/Disable**: Use `scpi.mcpServerEnabled` setting or the command palette commands
- **View Config**: Use **View MCP Configuration** command to inspect AI assistant configuration files

## Release Notes

### 0.0.1

- Updated extension name to "SCPI Notebook"
- Reorganized icons into assets folder
- Improved README with comprehensive feature list
- Initial release of SCPI Notebook extension
- **MCP Server Integration**: Added Model Context Protocol (MCP) server for AI assistant integration
  - Automatically provides instrument SCPI manuals to AI assistants
  - Supports manual indexing with lightweight metadata storage
  - Auto-enabled by default on first installation
  - Default manual directory: `.scpi_doc` in workspace root
  - Automatic configuration of AI assistant MCP config files
  - Commands for setup, enable/disable, and configuration viewing

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

See LICENSE file for details.







