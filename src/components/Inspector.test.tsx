import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inspector } from './Inspector';
import { createDataset } from '../lib/events';
describe('request inspector', () => {
  it('shows a selected failure, supports saving, and closes with Escape', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const event = createDataset(100).find((e) => e.status >= 500)!;
    const save = vi.fn();
    const close = vi.fn();
    const user = userEvent.setup();
    render(<Inspector event={event} saved={false} onBookmark={save} onClose={close} />);
    expect(screen.getByRole('complementary', { name: 'Request inspector' })).toBeTruthy();
    expect(screen.getByLabelText('Simulated response body').textContent).toContain(
      'upstream_unavailable',
    );
    await user.click(screen.getByRole('button', { name: 'Save request' }));
    expect(save).toHaveBeenCalledOnce();
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledOnce();
  });
});
