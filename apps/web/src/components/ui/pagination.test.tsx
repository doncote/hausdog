import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './pagination'

function makePaginationProps(overrides: Partial<Parameters<typeof Pagination>[0]> = {}) {
  return {
    page: 1,
    pages: 3,
    total: 75,
    limit: 25,
    onPageChange: vi.fn(),
    ...overrides,
  }
}

describe('Pagination', () => {
  it('returns null when there is only one page', () => {
    const { container } = render(<Pagination {...makePaginationProps({ pages: 1 })} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when pages is 0', () => {
    const { container } = render(<Pagination {...makePaginationProps({ pages: 0 })} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders range text showing start and end of current page', () => {
    render(<Pagination {...makePaginationProps({ page: 1, pages: 3, total: 75, limit: 25 })} />)
    expect(screen.getByText('1–25 of 75')).toBeTruthy()
  })

  it('calculates start correctly for page 2', () => {
    render(<Pagination {...makePaginationProps({ page: 2, pages: 3, total: 75, limit: 25 })} />)
    expect(screen.getByText('26–50 of 75')).toBeTruthy()
  })

  it('clamps end to total on the last page', () => {
    render(<Pagination {...makePaginationProps({ page: 3, pages: 3, total: 70, limit: 25 })} />)
    expect(screen.getByText('51–70 of 70')).toBeTruthy()
  })

  it('shows current page and total pages', () => {
    render(<Pagination {...makePaginationProps({ page: 2, pages: 5 })} />)
    expect(screen.getByText('2 / 5')).toBeTruthy()
  })

  it('disables previous button on first page', () => {
    render(<Pagination {...makePaginationProps({ page: 1 })} />)
    expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables previous button on pages after the first', () => {
    render(<Pagination {...makePaginationProps({ page: 2 })} />)
    expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables next button on last page', () => {
    render(<Pagination {...makePaginationProps({ page: 3, pages: 3 })} />)
    expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables next button when not on last page', () => {
    render(<Pagination {...makePaginationProps({ page: 2, pages: 3 })} />)
    expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(false)
  })

  it('calls onPageChange with page - 1 when previous is clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...makePaginationProps({ page: 3, pages: 5, onPageChange })} />)
    fireEvent.click(screen.getByLabelText('Previous page'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange with page + 1 when next is clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...makePaginationProps({ page: 2, pages: 5, onPageChange })} />)
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('does not call onPageChange when previous is clicked on first page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...makePaginationProps({ page: 1, onPageChange })} />)
    fireEvent.click(screen.getByLabelText('Previous page'))
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('does not call onPageChange when next is clicked on last page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...makePaginationProps({ page: 3, pages: 3, onPageChange })} />)
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(onPageChange).not.toHaveBeenCalled()
  })
})
