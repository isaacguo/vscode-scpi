export interface InstrumentInfo {
    manufacturer: string;
    model: string;
    serialNumber?: string;
    firmwareVersion?: string;
}

export interface ManualMetadata {
    filePath: string;
    instrumentName: string; // e.g., "KEYSIGHT_34401A"
    manufacturer: string;
    model: string;
    description: string;
    lastModified: number;
}

export interface ManualIndex {
    [instrumentKey: string]: ManualMetadata;
}

export interface McpServerConfig {
    manualDirectory: string;
    enabled: boolean;
}

export interface ScpiCommandInfo {
    command: string;
    description: string;
    parameters?: string[];
}
