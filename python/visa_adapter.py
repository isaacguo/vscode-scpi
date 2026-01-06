import sys
import argparse

try:
    import pyvisa
except ImportError:
    print("Error: 'pyvisa' module not found. Please install it using 'pip install pyvisa' or 'pip install pyvisa-py'.", file=sys.stderr)
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('resource', help='VISA resource name')
    parser.add_argument('--timeout', type=int, default=5000, help='Timeout in ms')
    args = parser.parse_args()

    try:
        rm = pyvisa.ResourceManager()
        # Open resource
        inst = rm.open_resource(args.resource)
        inst.timeout = args.timeout
        
        # Read commands from stdin
        # We read all lines first
        lines = sys.stdin.readlines()
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#') or line.startswith('//'):
                continue
                
            # Heuristic for query: contains '?'
            if '?' in line:
                try:
                    response = inst.query(line)
                    print(response.strip())
                except Exception as e:
                    print(f"Error querying '{line}': {e}", file=sys.stderr)
            else:
                try:
                    inst.write(line)
                except Exception as e:
                    print(f"Error writing '{line}': {e}", file=sys.stderr)
            
            sys.stdout.flush()

        inst.close()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

