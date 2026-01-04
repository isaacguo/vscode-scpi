export interface ScpiCommand {
    name: string;
    description: string;
    children?: { [key: string]: ScpiCommand };
    isQueryable?: boolean; // Can be used with '?'
    isSettable?: boolean;  // Can be used without '?'
    parameters?: string[];
}

export const COMMON_COMMANDS: { [key: string]: ScpiCommand } = {
    '*CLS': {
        name: '*CLS',
        description: 'Clear Status Command. Clears the event registers in all register groups.',
        isSettable: true,
        isQueryable: false
    },
    '*ESE': {
        name: '*ESE',
        description: 'Standard Event Status Enable Command.',
        isSettable: true,
        isQueryable: true,
        parameters: ['<value>']
    },
    '*ESR': {
        name: '*ESR',
        description: 'Standard Event Status Register Query.',
        isSettable: false,
        isQueryable: true
    },
    '*IDN': {
        name: '*IDN',
        description: 'Identification Query. Returns the instrument identification.',
        isSettable: false,
        isQueryable: true
    },
    '*OPC': {
        name: '*OPC',
        description: 'Operation Complete Command.',
        isSettable: true,
        isQueryable: true
    },
    '*RST': {
        name: '*RST',
        description: 'Reset Command. Resets the instrument to a known state.',
        isSettable: true,
        isQueryable: false
    },
    '*SRE': {
        name: '*SRE',
        description: 'Service Request Enable Command.',
        isSettable: true,
        isQueryable: true,
        parameters: ['<value>']
    },
    '*STB': {
        name: '*STB',
        description: 'Read Status Byte Query.',
        isSettable: false,
        isQueryable: true
    },
    '*TRG': {
        name: '*TRG',
        description: 'Trigger Command.',
        isSettable: true,
        isQueryable: false
    },
    '*WAI': {
        name: '*WAI',
        description: 'Wait-to-Continue Command.',
        isSettable: true,
        isQueryable: false
    }
};

// Example Subsystem Commands (Generic)
export const ROOT_COMMANDS: { [key: string]: ScpiCommand } = {
    ':SYSTem': {
        name: ':SYSTem',
        description: 'System subsystem',
        children: {
            ':ERRor': {
                name: ':ERRor',
                description: 'Error queue',
                isQueryable: true, // :SYST:ERR?
                children: {
                    ':NEXT': {
                        name: ':NEXT',
                        description: 'Read and remove next error',
                        isQueryable: true
                    }
                }
            },
            ':VERSion': {
                name: ':VERSion',
                description: 'SCPI Version',
                isQueryable: true
            }
        }
    },
    ':MEASure': {
        name: ':MEASure',
        description: 'Measure subsystem',
        children: {
            ':VOLTage': {
                name: ':VOLTage',
                description: 'Voltage measurement',
                children: {
                    ':DC': {
                        name: ':DC',
                        description: 'DC Voltage',
                        isQueryable: true,
                        parameters: ['<range>', '<resolution>']
                    },
                    ':AC': {
                        name: ':AC',
                        description: 'AC Voltage',
                        isQueryable: true
                    }
                }
            },
            ':CURRent': {
                name: ':CURRent',
                description: 'Current measurement',
                children: {
                    ':DC': {
                        name: ':DC',
                        description: 'DC Current',
                        isQueryable: true
                    },
                    ':AC': {
                        name: ':AC',
                        description: 'AC Current',
                        isQueryable: true
                    }
                }
            }
        }
    }
};

