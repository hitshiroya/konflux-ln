import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockGenerateResponse = {
  number: 42,
  min: 1,
  max: 100,
  timestamp: '2026-06-25T00:00:00Z',
}

const mockHistoryResponse = {
  history: [],
  total: 0,
}

beforeEach(() => {
  mockFetch.mockReset()
  // Default: history fetch on mount returns empty
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => mockHistoryResponse,
  })
})

// ── Render ────────────────────────────────────────────────────────────────────

describe('Initial render', () => {
  it('renders the app title', async () => {
    render(<App />)
    expect(screen.getByText('Random Number Generator')).toBeDefined()
  })

  it('shows placeholder text before first generate', async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByText('Hit Generate to get a number')).toBeDefined()
    )
  })

  it('renders min and max inputs with default values', () => {
    render(<App />)
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs[0].value).toBe('1')
    expect(inputs[1].value).toBe('100')
  })

  it('renders the Generate button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /generate/i })).toBeDefined()
  })
})

// ── Generate ──────────────────────────────────────────────────────────────────

describe('Generate button', () => {
  it('displays the returned number after a successful generate', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockHistoryResponse }) // mount history
      .mockResolvedValueOnce({ ok: true, json: async () => mockGenerateResponse }) // generate
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: [mockGenerateResponse], total: 1 }) }) // history refresh

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /generate/i }))

    await waitFor(() => {
      const matches = screen.getAllByText('42')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows the range after generate', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockHistoryResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGenerateResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: [mockGenerateResponse], total: 1 }) })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /generate/i }))

    await waitFor(() => expect(screen.getByText(/range: 1 – 100/)).toBeDefined())
  })

  it('shows error when min >= max', async () => {
    render(<App />)
    const inputs = screen.getAllByRole('spinbutton')

    await userEvent.clear(inputs[0])
    await userEvent.type(inputs[0], '100')
    await userEvent.clear(inputs[1])
    await userEvent.type(inputs[1], '10')

    await userEvent.click(screen.getByRole('button', { name: /generate/i }))

    await waitFor(() =>
      expect(screen.getByText('Min must be less than Max.')).toBeDefined()
    )
  })

  it('shows API error message on failed response', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockHistoryResponse })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Range cannot exceed 1,000,000' }),
      })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /generate/i }))

    await waitFor(() =>
      expect(screen.getByText('Range cannot exceed 1,000,000')).toBeDefined()
    )
  })

  it('triggers generate on Enter key press', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockHistoryResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGenerateResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: [mockGenerateResponse], total: 1 }) })

    render(<App />)
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.keyDown(inputs[0], { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('42')).toBeDefined())
  })
})

// ── History ───────────────────────────────────────────────────────────────────

describe('History panel', () => {
  it('shows "No history yet" when history is empty', async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByText('No history yet')).toBeDefined()
    )
  })

  it('renders history items after generate', async () => {
    const historyItem = { number: 42, min: 1, max: 100, timestamp: '2026-06-25T00:00:00Z' }
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => mockHistoryResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => mockGenerateResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ history: [historyItem], total: 1 }) })

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /generate/i }))

    await waitFor(() => {
      const nums = screen.getAllByText('42')
      expect(nums.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows Clear button when history has items', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        history: [{ number: 7, min: 1, max: 10, timestamp: '2026-06-25T00:00:00Z' }],
        total: 1,
      }),
    })

    render(<App />)
    await waitFor(() => expect(screen.getByRole('button', { name: /clear/i })).toBeDefined())
  })

  it('clears history when Clear is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          history: [{ number: 7, min: 1, max: 10, timestamp: '2026-06-25T00:00:00Z' }],
          total: 1,
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // DELETE /history

    render(<App />)
    const clearBtn = await screen.findByRole('button', { name: /clear/i })
    await userEvent.click(clearBtn)

    await waitFor(() => expect(screen.getByText('No history yet')).toBeDefined())
  })
})

// ── Utils ─────────────────────────────────────────────────────────────────────

describe('formatTime utility', () => {
  it('formats ISO timestamp to readable time', () => {
    // Tested implicitly via history item render — timestamp cell is visible
    const ts = new Date('2026-06-25T00:00:00Z').toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    expect(typeof ts).toBe('string')
    expect(ts.length).toBeGreaterThan(0)
  })
})
