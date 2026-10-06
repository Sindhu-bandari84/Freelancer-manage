import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'freelancer-workflow-'))
const port = await new Promise((resolve, reject) => {
  const server = net.createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port: availablePort } = server.address()
    server.close((error) => error ? reject(error) : resolve(availablePort))
  })
})
const serverProcess = spawn(process.execPath, ['src/server.js'], {
  cwd: backendDirectory,
  env: {
    ...process.env,
    PORT: String(port),
    DATABASE_FILE: path.join(temporaryDirectory, 'test.sqlite'),
    JWT_SECRET: 'workflow-test-secret',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverOutput = ''
let uploadedFilePath = ''
serverProcess.stdout.on('data', (chunk) => { serverOutput += chunk.toString() })
serverProcess.stderr.on('data', (chunk) => { serverOutput += chunk.toString() })
const api = `http://127.0.0.1:${port}/api`

async function waitForServer() {
  const deadline = Date.now() + 10_000
  let lastError
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`API server exited early.\n${serverOutput}`)
    try {
      const response = await fetch(`${api}/health`, { signal: AbortSignal.timeout(300) })
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`API server did not become ready: ${lastError?.message || 'no health response'}.\n${serverOutput}`)
}

after(async () => {
  if (serverProcess.exitCode === null) {
    const exited = once(serverProcess, 'exit')
    serverProcess.kill()
    await exited
  }
  if (uploadedFilePath) fs.rmSync(uploadedFilePath, { force: true })
  fs.rmSync(temporaryDirectory, { recursive: true, force: true })
})

test('supports the required client-to-payment workflow and its business rules', async () => {
  await waitForServer()

  const loginResponse = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'freelancer@demo.com', password: 'demo123' }),
  })
  assert.equal(loginResponse.status, 200)
  const { token } = await loginResponse.json()
  const authHeaders = { Authorization: `Bearer ${token}` }
  const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }

  const clientResponse = await fetch(`${api}/clients`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Workflow Test Client', email: 'workflow@example.com', company: 'Test Studio' }),
  })
  assert.equal(clientResponse.status, 201)
  let client = await clientResponse.json()
  const editClientResponse = await fetch(`${api}/clients/${client.id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ name: 'Updated Workflow Client', email: 'workflow@example.com', company: 'Updated Studio' }),
  })
  assert.equal(editClientResponse.status, 200)
  client = await editClientResponse.json()
  assert.equal(client.company, 'Updated Studio')

  const projectForm = new FormData()
  projectForm.set('client_id', String(client.id))
  projectForm.set('title', 'Workflow project')
  projectForm.set('description', 'End-to-end workflow test')
  projectForm.set('budget', '1200')
  projectForm.set('deadline', '2026-12-01')
  projectForm.append('attachment', new Blob(['sample deliverable'], { type: 'application/pdf' }), 'deliverable.pdf')
  const projectResponse = await fetch(`${api}/projects`, { method: 'POST', headers: authHeaders, body: projectForm })
  assert.equal(projectResponse.status, 201)
  const project = await projectResponse.json()
  assert.match(project.attachment_url, /^\/uploads\//)
  uploadedFilePath = path.join(backendDirectory, 'uploads', path.basename(project.attachment_url))

  const duplicateResponse = await fetch(`${api}/projects`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ client_id: client.id, title: 'WORKFLOW PROJECT', budget: 1200, deadline: '2026-12-01' }),
  })
  assert.equal(duplicateResponse.status, 409)

  const invalidDateResponse = await fetch(`${api}/projects`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ client_id: client.id, title: 'Invalid date project', budget: 100, deadline: '2026-02-30' }),
  })
  assert.equal(invalidDateResponse.status, 400)

  const taskResponse = await fetch(`${api}/tasks`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ project_id: project.id, title: 'Complete the deliverable', due_date: '2026-11-15' }),
  })
  assert.equal(taskResponse.status, 201)
  const task = await taskResponse.json()
  const prematureCompletionResponse = await fetch(`${api}/projects/${project.id}/status`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ status: 'Completed' }),
  })
  assert.equal(prematureCompletionResponse.status, 400)

  for (const status of ['In Progress', 'Completed']) {
    const taskStatusResponse = await fetch(`${api}/tasks/${task.id}/status`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ status }),
    })
    assert.equal(taskStatusResponse.status, 200)
    assert.equal((await taskStatusResponse.json()).status, status)
  }

  const projectStatusResponse = await fetch(`${api}/projects/${project.id}/status`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ status: 'Completed' }),
  })
  assert.equal(projectStatusResponse.status, 200)

  const overBudgetInvoiceResponse = await fetch(`${api}/invoices`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ project_id: project.id, amount: 1201, due_date: '2026-12-15' }),
  })
  assert.equal(overBudgetInvoiceResponse.status, 400)

  const invoiceResponse = await fetch(`${api}/invoices`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ project_id: project.id, amount: 1000, due_date: '2026-12-15' }),
  })
  assert.equal(invoiceResponse.status, 201)
  const invoice = await invoiceResponse.json()

  const partialPaymentResponse = await fetch(`${api}/payments`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ invoice_id: invoice.id, amount: 250 }),
  })
  assert.equal(partialPaymentResponse.status, 201)
  let listedInvoice = (await (await fetch(`${api}/invoices`, { headers: authHeaders })).json())
    .find((item) => item.id === invoice.id)
  assert.equal(listedInvoice.status, 'Partially Paid')

  const overpaymentResponse = await fetch(`${api}/payments`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ invoice_id: invoice.id, amount: 751 }),
  })
  assert.equal(overpaymentResponse.status, 400)

  const finalPaymentResponse = await fetch(`${api}/payments`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ invoice_id: invoice.id, amount: 750 }),
  })
  assert.equal(finalPaymentResponse.status, 201)
  listedInvoice = (await (await fetch(`${api}/invoices`, { headers: authHeaders })).json())
    .find((item) => item.id === invoice.id)
  assert.equal(listedInvoice.status, 'Paid')

  const dashboardResponse = await fetch(`${api}/dashboard/summary`, { headers: authHeaders })
  assert.equal(dashboardResponse.status, 200)
  assert.equal((await dashboardResponse.json()).earnings, 1000)

  const attachmentResponse = await fetch(`${api}/projects/${project.id}/attachment`, { headers: authHeaders })
  assert.equal(attachmentResponse.status, 200)
  assert.equal(await attachmentResponse.text(), 'sample deliverable')

  const historyResponse = await fetch(`${api}/history?project_id=${project.id}`, { headers: authHeaders })
  assert.equal(historyResponse.status, 200)
  const history = await historyResponse.json()
  assert.ok(history.some((entry) => entry.action === 'Task status updated'))
  assert.ok(history.some((entry) => entry.action === 'Invoice created'))
  assert.ok(history.some((entry) => entry.action === 'Payment recorded'))

  const clientLogin = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client@demo.com', password: 'demo123' }),
  })
  const { token: clientToken } = await clientLogin.json()
  const clientProjectsResponse = await fetch(`${api}/projects`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  })
  assert.equal(clientProjectsResponse.status, 200)
  assert.ok((await clientProjectsResponse.json()).every((item) => item.client_id !== client.id))

  const blockedClientWrite = await fetch(`${api}/clients`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized client', email: 'unauthorized@example.com' }),
  })
  assert.equal(blockedClientWrite.status, 403)
})
