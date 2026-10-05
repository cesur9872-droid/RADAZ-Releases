"""Minimize only RADAZ record popups, never the main browser/Viewer window."""
import os
import re

def minimize_records(token):
    if not isinstance(token, str) or not re.fullmatch(r'RADAZ_RECORDS_[a-f0-9]{32}', token):
        raise ValueError('Pəncərə identifikatoru düzgün deyil')
    if os.name != 'nt':
        return {'minimized': False}
    import ctypes
    from ctypes import wintypes
    user = ctypes.WinDLL('user32', use_last_error=True)
    user.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    user.ShowWindowAsync.argtypes = [wintypes.HWND, ctypes.c_int]
    user.IsWindowVisible.argtypes = [wintypes.HWND]
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
    found = []
    @callback_type
    def visit(hwnd, _):
        text = ctypes.create_unicode_buffer(user.GetWindowTextLengthW(hwnd) + 1)
        user.GetWindowTextW(hwnd, text, len(text))
        # The token is added only to a popup created by our own launcher.
        if user.IsWindowVisible(hwnd) and text.value.startswith(f'RADAZ [{token}] · '):
            found.append(bool(user.ShowWindowAsync(hwnd, 6)))  # SW_MINIMIZE
        return True
    user.EnumWindows(visit, 0)
    return {'minimized': any(found)}
