Dim objShell, objFSO, scriptDir, chromePath, args
Set objShell = CreateObject("WScript.Shell")
Set objFSO   = CreateObject("Scripting.FileSystemObject")
scriptDir    = objFSO.GetParentFolderName(WScript.ScriptFullName)
chromePath   = "C:\Program Files\Google\Chrome\Application\chrome.exe"

args = "--remote-debugging-port=9222" & _
       " --user-data-dir=""" & scriptDir & "\chrome-debug-profile""" & _
       " --no-first-run" & _
       " --no-default-browser-check" & _
       " --disable-background-timer-throttling" & _
       " --disable-renderer-backgrounding" & _
       " --disable-backgrounding-occluded-windows" & _
       " --window-position=-32000,-32000" & _
       " --window-size=1,1"

' windowStyle=0  →  process starts with no visible window / no taskbar entry
objShell.Run """" & chromePath & """ " & args, 0, False
