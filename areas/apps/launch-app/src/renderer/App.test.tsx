import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('application shell', () => {
  it('renders Launch App and a dashboard placeholder', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Launch App', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dashboard' })).toHaveTextContent(
      'Dashboard coming soon',
    );
  });
});
