import os
from pathlib import Path
from string import Template

Path('/generated/envoy.yaml').write_text(Template(Path('/envoy.template.yaml').read_text()).substitute(
    ANON_KEY=os.environ['ANON_KEY'], SERVICE_ROLE_KEY=os.environ['SERVICE_ROLE_KEY']))
