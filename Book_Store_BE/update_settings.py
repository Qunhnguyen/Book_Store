import os
import glob
import re

postgres_setup = """
import os
import urllib.parse
# Check if we should use Postgres
if os.environ.get('DB_NAME'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME'),
            'USER': os.environ.get('DB_USER', 'postgres'),
            'PASSWORD': urllib.parse.unquote(os.environ.get('DB_PASSWORD', '')),
            'HOST': os.environ.get('DB_HOST', 'postgres'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
"""

for settings_path in glob.glob('*/*/settings.py'):
    with open(settings_path, 'r') as f:
        content = f.read()

    if 'django.db.backends.postgresql' not in content:
        content = re.sub(
            r'DATABASES\s*=\s*\{\s*["\']default["\']:\s*\{\s*["\']ENGINE["\']:\s*["\']django\.db\.backends\.sqlite3["\'],\s*["\']NAME["\']:\s*BASE_DIR\s*/\s*["\']db\.sqlite3["\'],\s*\}\s*\}',
            postgres_setup.strip(),
            content
        )
        with open(settings_path, 'w') as f:
            f.write(content)

print("Settings updated")
