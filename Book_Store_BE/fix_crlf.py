import os

def fix_crlf():
    for r, d, f in os.walk('.'):
        if 'wait-for-postgres.sh' in f:
            p = os.path.join(r, 'wait-for-postgres.sh')
            with open(p, 'rb') as f_in:
                data = f_in.read()
            # ONLY write if we actually read data, so we don't truncate
            if data:
                with open(p, 'wb') as f_out:
                    f_out.write(data.replace(b'\r\n', b'\n'))
                print(f"Fixed {p}")
            else:
                print(f"Warning: {p} is empty")

if __name__ == '__main__':
    fix_crlf()
