import BaseComponent from './BaseComponent';
import { useChannel } from '../data/telemetry-context';

interface NumericWidgetProps {
  id: string;
  title?: string;
}

function formatNumber(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : null;
}

/** Shows the latest numeric value of one channel inside the shared container. */
export default function NumericWidget({ id, title }: NumericWidgetProps) {
  const data = useChannel(id);
  const channel = data?.channel;
  const latest = data?.latest;
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

  return (
    <BaseComponent
      id={id}
      componentType="numeric"
      channel={channel}
      currentTime={data?.nowMs ?? 0}
      title={title}
    >
      <p data-testid="numeric-value">{content}</p>
    </BaseComponent>
  );
}
