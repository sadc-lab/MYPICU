Vendored diagram assets, fetched at image build time.

Do not commit binaries here. `docker/docs/Dockerfile` downloads these
from jsdelivr with pinned versions and serves them from `_static`,
because the host has no internet egress.
