' Inicia a ponte em segundo plano (sem janela). Se ja houver uma ponte na porta 8765, a nova encerra sozinha.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
If fso.FileExists(pasta & "\node.exe") Then exe = """" & pasta & "\node.exe""" Else exe = "node"
sh.Run exe & " ponte.js", 0, False
