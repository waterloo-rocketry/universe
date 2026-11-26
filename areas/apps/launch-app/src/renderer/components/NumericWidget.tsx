import { WidgetProps } from './BaseComponent';

function formatNumber(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : null;
}

/** Shows the latest numeric value of one channel inside the shared container. */
export default function NumericWidget({ channels }: WidgetProps) {
  const channelRead = channels[0];

  if (!channelRead) {
    return <p>Unknown Channel</p>;
  }

  const channel = channelRead.channel;
  const latest = channelRead.latest;
  const text = latest ? formatNumber(latest.value) : null;
  const unit = channel?.signal.unit;

  let content: string;
  if (!latest) {
    content = '--';
  } else if (text === null) {
    content = 'Not a number';
  } else {
    content = unit ? `${text} ${unit}` : text;
  }

  return <p data-testid="numeric-value">{content}</p>;
}
