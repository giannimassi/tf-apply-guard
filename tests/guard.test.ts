import { expect, test } from 'claude-code/testing'

function harness(on: any, answer: string) {
  const asked: string[] = []
  const ran: string[] = []
  on('tool.call', (_: any, e: any) => {
    if (e.tool === 'AskUserQuestion') {
      asked.push(JSON.stringify(e))
      return { result: { answers: { [e.questions[0].question]: answer } } }
    }
    ran.push(e.command)
    return { result: { stdout: 'ok' } }
  })
  return { asked, ran }
}

test('non-gated commands pass through untouched', async ($, on) => {
  const h = harness(on, 'Approve')
  await $.tool.call({ tool: 'Bash', command: 'terraform -chdir=root/environments/production/x plan -out=plan.out' })
  await $.tool.call({ tool: 'Bash', command: 'echo apply production' })
  expect(h.ran.length).toBe(2)
  expect(h.asked.length).toBe(0)
})

test('-auto-approve is denied without asking', async ($, on) => {
  const h = harness(on, 'Approve')
  const r: any = await $.tool.call({ tool: 'Bash', command: 'terraform apply -auto-approve' })
  expect(typeof r.deny).toBe('string')
  expect(h.ran.length).toBe(0)
  expect(h.asked.length).toBe(0)
})

test('prod apply runs only on the explicit prod answer', async ($, on) => {
  const cmd = 'AWS_PROFILE=ops terraform -chdir=root/environments/production/eu apply plan.out'
  const h = harness(on, 'Yes, apply to PROD')
  await $.tool.call({ tool: 'Bash', command: cmd })
  expect(h.ran).toEqual([cmd])
  expect(h.asked.length).toBe(1)
  expect(h.asked[0]).toMatch(/PROD APPLY/)
})

test('destroy is gated too', async ($, on) => {
  const h = harness(on, 'Deny')
  const r: any = await $.tool.call({ tool: 'Bash', command: 'terraform -chdir=envs/production destroy' })
  expect(typeof r.deny).toBe('string')
  expect(h.asked[0]).toMatch(/PROD DESTROY/)
})

test('staging apply denied when the user says Deny', async ($, on) => {
  const h = harness(on, 'Deny')
  const r: any = await $.tool.call({ tool: 'Bash', command: 'terraform -chdir=root/environments/staging/eu apply plan.out' })
  expect(typeof r.deny).toBe('string')
  expect(h.ran.length).toBe(0)
  expect(h.asked[0]).toMatch(/staging/)
})

test('stagingPolicy=allow runs staging without asking, still asks for prod', { options: { stagingPolicy: 'allow' } }, async ($, on) => {
  const h = harness(on, 'Deny')
  await $.tool.call({ tool: 'Bash', command: 'terraform -chdir=envs/staging apply plan.out' })
  expect(h.ran.length).toBe(1)
  expect(h.asked.length).toBe(0)
  const r: any = await $.tool.call({ tool: 'Bash', command: 'terraform -chdir=envs/production apply plan.out' })
  expect(typeof r.deny).toBe('string')
  expect(h.asked.length).toBe(1)
})

test('custom commands, actions and keywords are honoured', { options: { commands: 'pulumi', actions: 'up', prodKeywords: 'live' } }, async ($, on) => {
  const h = harness(on, 'Yes, up to PROD')
  await $.tool.call({ tool: 'Bash', command: 'terraform -chdir=envs/production apply' })
  expect(h.asked.length).toBe(0)
  await $.tool.call({ tool: 'Bash', command: 'pulumi up --stack live' })
  expect(h.asked.length).toBe(1)
  expect(h.asked[0]).toMatch(/PROD UP/)
  expect(h.ran.length).toBe(2)
})

test('blockAutoApprove=false falls back to asking', { options: { blockAutoApprove: false } }, async ($, on) => {
  const h = harness(on, 'Deny')
  const r: any = await $.tool.call({ tool: 'Bash', command: 'terraform -chdir=envs/staging apply -auto-approve' })
  expect(typeof r.deny).toBe('string')
  expect(h.asked.length).toBe(1)
})
