import * as fs from 'fs';
import * as path from 'path';
import { ManualIndex, ManualMetadata } from './types';

export class ManualManager {
    private index: ManualIndex = {};
    private manualDirectory: string = '';

    constructor() {}

    public async initialize(manualDirectory: string): Promise<void> {
        this.manualDirectory = manualDirectory;
        await this.buildIndex();
    }

    public async rebuildIndex(): Promise<void> {
        await this.buildIndex();
    }

    public getManuals(): ManualMetadata[] {
        return Object.values(this.index);
    }

    public async getManualContent(instrumentName: string): Promise<string | null> {
        const metadata = this.index[instrumentName];
        if (!metadata) {
            return null;
        }

        try {
            // Path validation is already done during indexing, but good to be safe
            if (!this.isSafePath(metadata.filePath)) {
                console.error(`Unsafe file path access attempt: ${metadata.filePath}`);
                return null;
            }
            return await fs.promises.readFile(metadata.filePath, 'utf-8');
        } catch (error) {
            console.error(`Error reading manual file for ${instrumentName}:`, error);
            return null;
        }
    }

    private async buildIndex(): Promise<void> {
        this.index = {};
        
        if (!this.manualDirectory || !fs.existsSync(this.manualDirectory)) {
            console.log(`Manual directory not found or not set: ${this.manualDirectory}`);
            return;
        }

        try {
            const files = await fs.promises.readdir(this.manualDirectory);
            
            for (const file of files) {
                if (path.extname(file).toLowerCase() === '.md') {
                    const filePath = path.join(this.manualDirectory, file);
                    
                    if (!this.isSafePath(filePath)) {
                        continue;
                    }

                    const fileName = path.basename(file, '.md');
                    // Match {MANUFACTURER}_{MODEL} or {MANUFACTURER}_{MODEL}_* format
                    // This allows files like "Keysight_N6700.md" or "Keysight_N6700_SCPI_Commands.md"
                    const match = fileName.match(/^([A-Z0-9]+)_([A-Z0-9]+)(?:_|$)/i);
                    
                    if (match) {
                        const manufacturer = match[1].toUpperCase();
                        const model = match[2].toUpperCase();
                        const instrumentName = `${manufacturer}_${model}`;
                        
                        try {
                            const stats = await fs.promises.stat(filePath);
                            const description = await this.extractDescription(filePath);
                            
                            this.index[instrumentName] = {
                                filePath,
                                instrumentName,
                                manufacturer,
                                model,
                                description,
                                lastModified: stats.mtimeMs
                            };
                        } catch (err) {
                            console.error(`Error processing file ${file}:`, err);
                        }
                    } else {
                        console.warn(`File ${file} does not match naming convention {MANUFACTURER}_{MODEL}.md`);
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning manual directory:', error);
        }
    }

    private async extractDescription(filePath: string): Promise<string> {
        try {
            // Read first 2KB roughly to get header info
            const buffer = Buffer.alloc(2048);
            const handle = await fs.promises.open(filePath, 'r');
            const { bytesRead } = await handle.read(buffer, 0, 2048, 0);
            await handle.close();
            
            const content = buffer.toString('utf-8', 0, bytesRead);
            const lines = content.split('\n');
            
            // 1. Check for YAML frontmatter
            if (lines[0]?.trim() === '---') {
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i]?.trim() === '---') break;
                    const descMatch = lines[i].match(/^description:\s*(.+)$/i);
                    if (descMatch) {
                        return descMatch[1].trim();
                    }
                }
            }

            // 2. Look for first paragraph after main title
            let titleFound = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('# ')) {
                    titleFound = true;
                    continue;
                }
                
                if (titleFound && line.length > 0 && !line.startsWith('#') && !line.startsWith('---')) {
                    return line;
                }
            }

            return '';
        } catch (error) {
            console.error(`Error extracting description from ${filePath}:`, error);
            return '';
        }
    }

    private isSafePath(targetPath: string): boolean {
        const resolvedPath = path.resolve(targetPath);
        const resolvedRoot = path.resolve(this.manualDirectory);
        return resolvedPath.startsWith(resolvedRoot);
    }
}
