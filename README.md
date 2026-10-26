# tf-apply-guard

A Claude Code mod that catches `terraform apply` (and `destroy`) before Claude runs it and asks you to approve, with a separate, deliberately different confirmation for production.

## What it does

- Watches every Bash command Claude is about to run.
- When a watched binary (`terraform`, `tofu`, `terragrunt` by default) is followed by a gated action (`apply`, `destroy`), it classifies the command as **production**, **staging** or **unknown** from keywords in the command text: the `-chdir` path, workspace, profile, var file, anything.
- **Production** always asks. The confirm button reads `Yes, apply to PROD` and is listed second, so a reflexive first pick denies.
- **Staging** and **unknown** ask by default; each can be set to `allow` (run, show a toast) instead.
- `-auto-approve` is denied outright, with a hint back to the model to plan first and apply the saved plan. Can be turned off.
- `plan`, `init`, `validate` and anything else pass through untouched.

A denied or dismissed dialog turns the tool call into a deny the model sees, so it stops and tells you instead of retrying.

## Install

At the prompt of a terminal session:

```
/plugin install tf-apply-guard --marketplace giannimassi/tf-apply-guard
```

Answer `y` to add the marketplace, then pick a scope (user is fine). From a shell: `claude plugin install tf-apply-guard --marketplace giannimassi/tf-apply-guard`.

## Configuration

Set in `/config` under the plugin's name, or in `settings.json` under `pluginConfigs["tf-apply-guard"].options`.

| Option | Default | Meaning |
| --- | --- | --- |
| `commands` | `terraform,tofu,terragrunt` | Binaries to watch (comma-separated). |
| `actions` | `apply,destroy` | Subcommands that need approval. |
| `prodKeywords` | `prod,production,prd` | Whole words that mark a command as production. |
| `stagingKeywords` | `staging,stage,stg,dev,sandbox` | Whole words that mark a command as staging. |
| `stagingPolicy` | `ask` | `ask` or `allow` for staging commands. |
| `unknownPolicy` | `ask` | `ask` or `allow` when no keyword matches. |
| `blockAutoApprove` | `true` | Deny `-auto-approve` without asking. |

Keywords match case-insensitively as whole words anywhere in the command, so `-chdir=envs/production`, `AWS_PROFILE=prod`, `-var-file=prod.tfvars` and `workspace select prod` all count. A command matching both prod and staging keywords is treated as production.

## Limits

- Matching is on the command text, per shell segment (split on `|`, `;`, `&`). `cd envs/production && terraform apply` is caught because the keyword is in the same command string; a wrapper script (`make deploy`) is not.
- Only Bash tool calls are watched; nothing stops a human running terraform in another terminal.
- Any Bash command whose text merely contains a gated pattern (say, a heredoc writing a script) is also gated. That is intentional: the guard reads text, not intent.

## Development

```
claude plugin validate .
claude plugin test .
```

MIT licensed.
