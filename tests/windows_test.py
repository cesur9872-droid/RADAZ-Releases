"""Exercise minimize against disposable off-screen windows, never user apps."""
import ctypes
import os
import sys
import time
import unittest
import uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'bridge'))
from radaz_windows import minimize_records

class WindowTests(unittest.TestCase):
    def test_rejects_arbitrary_window_titles(self):
        for value in ('RADAZ', '', None, '../test', 'RADAZ_RECORDS_'+'x'*32):
            with self.assertRaises(ValueError): minimize_records(value)

    @unittest.skipUnless(os.name == 'nt', 'Win32')
    def test_only_named_popup_minimizes(self):
        from ctypes import wintypes as w
        user=ctypes.WinDLL('user32',use_last_error=True)
        user.CreateWindowExW.argtypes=[w.DWORD,w.LPCWSTR,w.LPCWSTR,w.DWORD,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,w.HWND,w.HMENU,w.HINSTANCE,w.LPVOID]
        user.CreateWindowExW.restype=w.HWND
        user.ShowWindow.argtypes=[w.HWND,ctypes.c_int]
        user.IsIconic.argtypes=[w.HWND];user.DestroyWindow.argtypes=[w.HWND]
        token='RADAZ_RECORDS_'+uuid.uuid4().hex
        handles=[]
        try:
            for title in (f'(1) RADAZ [{token}] · Test - Microsoft Edge', 'RADAZ · Unrelated test window'):
                hwnd=user.CreateWindowExW(0x80,'STATIC',title,0xcf0000,-30000,-30000,200,100,None,None,None,None)
                self.assertTrue(hwnd);handles.append(hwnd);user.ShowWindow(hwnd,4)
            self.assertTrue(minimize_records(token)['minimized'])
            deadline=time.monotonic()+2
            while not user.IsIconic(handles[0]) and time.monotonic()<deadline:
                msg=w.MSG()
                while user.PeekMessageW(ctypes.byref(msg),None,0,0,1):
                    user.TranslateMessage(ctypes.byref(msg));user.DispatchMessageW(ctypes.byref(msg))
                time.sleep(.01)
            self.assertTrue(user.IsIconic(handles[0]));self.assertFalse(user.IsIconic(handles[1]))
        finally:
            for hwnd in handles:user.DestroyWindow(hwnd)

if __name__=='__main__':unittest.main()
