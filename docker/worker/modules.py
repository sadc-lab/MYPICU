"""Registry for independently implemented clinical sync modules."""
from dataclasses import dataclass
from importlib import import_module
import os
import re
from typing import Any, Awaitable, Callable, Iterable


@dataclass(frozen=True)
class PreparedBatch:
    persist: Callable[[Any], int]


@dataclass(frozen=True)
class SyncModule:
    name: str
    prepare_batch: Callable[[Any, list[str], dict, dict], PreparedBatch]
    scheduled_cycle: Callable[[list[str]], Awaitable[None]] | None = None


def _configured_names(configured: str | None) -> list[str]:
    names = [name.strip() for name in (configured if configured is not None
                                         else os.getenv('SYNC_MODULES', 'optibrain')).split(',')
             if name.strip()]
    if len(names) != len(set(names)):
        raise ValueError('SYNC_MODULES contains a duplicate module name')
    invalid = [name for name in names if not re.fullmatch(r'[a-z][a-z0-9_]*', name)]
    if invalid:
        raise ValueError('Invalid sync module name(s): ' + ', '.join(invalid))
    return names


def enabled_modules(registry: Iterable[SyncModule], configured: str | None = None) -> list[SyncModule]:
    registered = list(registry)
    available = {module.name: module for module in registered}
    if len(available) != len(registered):
        raise ValueError('Sync module registry contains duplicate names')
    names = _configured_names(configured)
    unknown = sorted(set(names) - available.keys())
    if unknown:
        raise ValueError('Unregistered sync module(s): ' + ', '.join(unknown))
    return [available[name] for name in names]


def load_modules(configured: str | None = None) -> list[SyncModule]:
    modules = []
    for name in _configured_names(configured):
        adapter_name = f'{name}_module'
        try:
            adapter = import_module(adapter_name)
        except ModuleNotFoundError as exc:
            if exc.name == adapter_name:
                raise ValueError(f'Unregistered sync module: {name}') from exc
            raise
        module = getattr(adapter, 'MODULE', None)
        if not isinstance(module, SyncModule) or module.name != name:
            raise TypeError(f'{adapter_name} must export a matching SyncModule as MODULE')
        modules.append(module)
    return modules
