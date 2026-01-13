import { InstrumentInfo } from './types';

export class InstrumentIdentifier {
    // Regular expression to parse typical SCPI *IDN? response
    // Format: Manufacturer,Model,SerialNumber,FirmwareVersion
    private static readonly IDN_REGEX = /^([^,]+),([^,]+),([^,]+),([^,]+)$/;

    /**
     * Parses the response string from an *IDN? query.
     * @param idnResponse The raw response string from the instrument
     * @returns InstrumentInfo object or null if parsing fails
     */
    public static parseIdnResponse(idnResponse: string): InstrumentInfo | null {
        if (!idnResponse || idnResponse.trim().length === 0) {
            return null;
        }

        const cleanResponse = idnResponse.trim();
        const match = cleanResponse.match(this.IDN_REGEX);

        if (match) {
            return {
                manufacturer: match[1].trim(),
                model: match[2].trim(),
                serialNumber: match[3].trim(),
                firmwareVersion: match[4].trim()
            };
        }

        // Fallback for non-standard responses (try best effort)
        // Some instruments might have fewer fields or different delimiters
        const parts = cleanResponse.split(',');
        if (parts.length >= 2) {
            return {
                manufacturer: parts[0].trim(),
                model: parts[1].trim(),
                serialNumber: parts.length > 2 ? parts[2].trim() : undefined,
                firmwareVersion: parts.length > 3 ? parts[3].trim() : undefined
            };
        }

        return null;
    }

    /**
     * Generates a standardized instrument name string from info.
     * format: MANUFACTURER_MODEL (uppercase)
     */
    public static getInstrumentName(info: InstrumentInfo): string {
        return `${info.manufacturer.toUpperCase().replace(/\s+/g, '_')}_${info.model.toUpperCase().replace(/\s+/g, '_')}`;
    }
}
