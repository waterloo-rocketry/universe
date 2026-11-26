import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('application shell', () => {
  it('renders Launch App', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'Launch App', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
