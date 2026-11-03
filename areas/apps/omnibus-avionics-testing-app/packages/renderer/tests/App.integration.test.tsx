import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '@/App'
import { spawn, ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_URL = 'http://localhost:8081'

async function waitForServer(url: string, maxAttempts = 25, intervalMs = 400): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await fetch(url)
            return
        } catch {
            await new Promise((resolve) => setTimeout(resolve, intervalMs))
        }
    }
    throw new Error('Mock server failed to start')
}

describe('App Integration Tests with Mock Server', () => {
    let serverProcess: ChildProcess | null = null

    beforeAll(async () => {
        // Start the mock server
        const serverScript = resolve(__dirname, 'mock-backend/server.ts')
        const repoRoot = resolve(__dirname, '../../../')
        const tsxBin = resolve(repoRoot, 'node_modules/.bin/tsx')
        const tsxCmd = tsxBin + '.cmd'
        const executable = existsSync(tsxCmd) ? tsxCmd : tsxBin
        serverProcess = spawn(executable, [serverScript], {
            shell: true,
            detached: false,
            stdio: 'ignore',
        })

        await waitForServer(`${SERVER_URL}/socket.io/?EIO=4&transport=polling`)
    })

    afterAll(() => {
        // Stop the mock server
        if (serverProcess != null) {
            try {
                serverProcess.kill()
            } catch {
                // Server already stopped, that's fine
            }
        }
    })

    it('successfully connects to mock server', async () => {
        render(
            <App />
        )

        // Open dialog
        const connectButton = screen.getByText(/Connect to Omnibus/i)
        fireEvent.click(connectButton)

        // Enter server address
        const input = screen.getByLabelText(/Server Address/i)
        fireEvent.change(input, { target: { value: SERVER_URL } })

        // Click connect
        const dialogConnectButton = screen.getByRole('button', { name: /^Connect$/i })
        fireEvent.click(dialogConnectButton)

        // Wait for connection
        await waitFor(
            () => {
                expect(
                    screen.getByText(new RegExp(`Connected to ${SERVER_URL}`, 'i'))
                ).toBeDefined()
            },
            { timeout: 5000 }
        )
    })

    it('successfully disconnects from mock server', async () => {
        render(
            <App />
        )

        // Connect first
        const connectButton = screen.getByText(/Connect to Omnibus/i)
        fireEvent.click(connectButton)

        const input = screen.getByLabelText(/Server Address/i)
        fireEvent.change(input, { target: { value: SERVER_URL } })

        const dialogConnectButton = screen.getByRole('button', { name: /^Connect$/i })
        fireEvent.click(dialogConnectButton)

        // Wait for connection
        await waitFor(
            () => {
                expect(screen.getByText(/Connected/i)).toBeDefined()
            },
            { timeout: 5000 }
        )

        // Now disconnect
        const disconnectButton = screen.getByText(/Disconnect/i)
        fireEvent.click(disconnectButton)

        // Verify disconnected
        await waitFor(() => {
            expect(screen.getByText(/Disconnected/i)).toBeDefined()
        })
    })
})
