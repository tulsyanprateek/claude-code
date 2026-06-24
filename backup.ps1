$repoPath = "D:\claude_code"
Set-Location $repoPath

git add -A
$status = git status --porcelain
if ($status) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "Auto-backup: $timestamp"
    git push origin master
}
