# VHS tape: records the mod gating a production apply, headless.
# Run from the repo root:  vhs demo/demo.tape
# Needs: vhs (brew install vhs), claude on PATH, the stub terraform in demo/fake-infra/bin.

Output demo/demo.gif

Set Shell bash
Set FontSize 15
Set Width 1100
Set Height 640
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set WaitTimeout 90s

Hide
Type "cd demo/fake-infra && export PATH=$PWD/bin:$PATH && clear"
Enter
Type `env -u TMUX -u TMUX_PANE -u CLAUDE_CODE_CHILD_SESSION claude --plugin-dir ../.. --allowedTools "Bash(terraform:*)" --strict-mcp-config`
Enter
Wait+Screen@60s /(trust this folder|Try|Welcome)/
Sleep 1s
# First run in the folder shows a trust dialog whose default is "No, exit": pick "Yes".
# On later runs there is no dialog and Down/Enter at an empty prompt do nothing.
Down
Sleep 500ms
Enter
Sleep 3s
Show

Type "deploy production"
Sleep 800ms
Enter

Wait+Screen@90s /Yes, apply to PROD/
Sleep 2500ms
Down
Sleep 1200ms
Enter

Wait+Screen@60s /· done/
Sleep 4s
