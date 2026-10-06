"""Minimize only RADAZ record popups, never the main browser/Viewer window."""
import os
import re
import time

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
    user.IsIconic.argtypes = [wintypes.HWND]
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
    found = []
    @callback_type
    def visit(hwnd, _):
        text = ctypes.create_unicode_buffer(user.GetWindowTextLengthW(hwnd) + 1)
        user.GetWindowTextW(hwnd, text, len(text))
        # The token is added only to a popup created by our own launcher.
        if user.IsWindowVisible(hwnd) and f'RADAZ [{token}] · ' in text.value:
            found.append(hwnd)
        return True
    deadline = time.monotonic() + 1.5
    while True:
        found.clear()
        user.EnumWindows(visit, 0)
        if found:
            for hwnd in found:
                if not user.IsIconic(hwnd): user.ShowWindowAsync(hwnd, 6)  # SW_MINIMIZE
            return {'minimized': True}
        if time.monotonic() >= deadline: return {'minimized': False}
        time.sleep(.05)
