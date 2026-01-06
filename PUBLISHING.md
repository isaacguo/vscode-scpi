# Publishing Guide for VS Code Extension

## Prerequisites

1. ✅ Install `vsce`: `npm install -g @vscode/vsce`
2. ✅ Update `package.json` with your publisher name
3. ✅ Create a Personal Access Token (PAT) from Azure DevOps

## Step-by-Step Publishing Instructions

### 1. Update Publisher Name

Edit `package.json` and replace `YOUR_PUBLISHER_NAME` with your actual publisher name (e.g., your GitHub username).

### 2. Create Personal Access Token

1. Go to https://dev.azure.com
2. Sign in with your Microsoft account
3. Click your profile icon → **Security**
4. Click **Personal access tokens** → **+ New Token**
5. Configure:
   - **Name**: e.g., "VS Code Extension Publishing"
   - **Organization**: All accessible organizations
   - **Expiration**: Set as needed (e.g., 1 year)
   - **Scopes**: Select **Marketplace** → **Manage**
6. Click **Create** and **copy the token** (you won't see it again!)

### 3. Login to vsce

```bash
vsce login YOUR_PUBLISHER_NAME
```

When prompted, paste your Personal Access Token.

### 4. Package the Extension

```bash
vsce package
```

This creates a `.vsix` file that you can test locally or publish.

### 5. Test Locally (Optional but Recommended)

1. In VS Code, go to Extensions view
2. Click the `...` menu → **Install from VSIX...**
3. Select the generated `.vsix` file
4. Test your extension thoroughly

### 6. Publish to Marketplace

```bash
vsce publish
```

This will:
- Compile your TypeScript code
- Package the extension
- Upload it to the VS Code Marketplace

### 7. Verify Publication

1. Go to https://marketplace.visualstudio.com/manage
2. Find your extension
3. It may take a few minutes to appear in search results

## Updating Your Extension

For future updates:

1. Update the `version` in `package.json` (use semantic versioning: 0.0.2, 0.1.0, etc.)
2. Run `vsce publish` again

## Important Notes

- The extension ID is: `YOUR_PUBLISHER_NAME.vscode-scpi`
- Once published, users can install it via: `ext install YOUR_PUBLISHER_NAME.vscode-scpi`
- Make sure your README.md and LICENSE files are accurate before publishing
- The `.vscodeignore` file controls what gets included in the package

## Troubleshooting

- **"Publisher not found"**: Make sure you've logged in with `vsce login`
- **"Invalid token"**: Create a new PAT and try again
- **"Version already exists"**: Increment the version number in `package.json`







