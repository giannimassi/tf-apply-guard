import type { Register } from 'claude-code'

type Env = 'production' | 'staging' | 'unknown'
type Policy = 'ask' | 'allow'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function list(v: unknown, fallback: string): string[] {
  const raw = typeof v === 'string' && v.trim() ? v : fallback
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

const wordAlt = (words: string[]) => `\\b(?:${words.map(escape).join('|')})\\b`

export const register: Register = (on, options) => {
  const commands = list(options.commands, 'terraform,tofu,terragrunt')
  const actions = list(options.actions, 'apply,destroy')
  const prodWords = list(options.prodKeywords, 'prod,production,prd')
  const stagingWords = list(options.stagingKeywords, 'staging,stage,stg,dev,sandbox')
  const stagingPolicy: Policy = options.stagingPolicy === 'allow' ? 'allow' : 'ask'
  const unknownPolicy: Policy = options.unknownPolicy === 'allow' ? 'allow' : 'ask'
  const blockAutoApprove = options.blockAutoApprove !== false

  // One shell segment (no | ; & or newline) naming a watched binary, then a gated action.
  const SEGMENT = `${wordAlt(commands)}[^|;&\\n]*`
  const GATED = new RegExp(`${SEGMENT}${wordAlt(actions)}`)
  const AUTO = new RegExp(`${SEGMENT}-auto-approve\\b`)
  const PROD = new RegExp(wordAlt(prodWords), 'i')
  const STAGING = new RegExp(wordAlt(stagingWords), 'i')

  const classify = (command: string): Env =>
    PROD.test(command) ? 'production' : STAGING.test(command) ? 'staging' : 'unknown'

  const actionOf = (command: string): string =>
    actions.find(a => new RegExp(`${SEGMENT}\\b${escape(a)}\\b`).test(command)) ?? actions[0] ?? 'apply'

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = e.command
    if (!GATED.test(command)) return next(e)

    const action = actionOf(command)
    const env = classify(command)
    const shown = command.length > 300 ? command.slice(0, 300) + '…' : command

    if (blockAutoApprove && AUTO.test(command)) {
      $.ui.toast(`blocked ${action} -auto-approve`)
      return {
        deny: `${$.plugin.name}: -auto-approve is not allowed. Use plan -out=plan.out, then ${action} plan.out, so the plan is reviewed.`,
      }
    }

    const policy: Policy = env === 'production' ? 'ask' : env === 'staging' ? stagingPolicy : unknownPolicy
    $.ui.log(`${action} detected [${env}, ${policy}]: ${shown}`)

    if (policy === 'allow') {
      $.ui.toast(`${action} allowed (${env})`)
      return next(e)
    }

    const isProd = env === 'production'
    const yes = isProd ? `Yes, ${action} to PROD` : 'Approve'
    let answer: string
    try {
      answer = await $.ui.ask(
        isProd ? `PRODUCTION ${action}. Run it?\n\n${shown}` : `${action} (${env}). Run it?\n\n${shown}`,
        {
          options: isProd ? ['Deny', yes] : [yes, 'Deny'],
          header: isProd ? `PROD ${action.toUpperCase()}` : `${action} (${env})`,
        },
      )
    } catch {
      return { deny: `${$.plugin.name}: approval dialog dismissed; ${action} not run.` }
    }

    if (answer !== yes) {
      $.ui.toast(`${action} denied (${env})`)
      return { deny: `${$.plugin.name}: user denied ${action} (${env}). Answer: ${answer}` }
    }

    $.ui.toast(`${action} approved (${env})`)
    $.ui.status(`${action} running [${env}]`)
    const ran = await next(e)
    $.ui.status(undefined)
    return ran
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: guard failed; command not run.` },
  )
}
