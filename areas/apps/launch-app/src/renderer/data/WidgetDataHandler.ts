import type { ChannelStatus } from './channel-store';
import { useChannel } from './telemetry-context';

type WidgetStatus = ChannelStatus | 'missing-channel';

/** Later statuses take precedence when a widget reads several channels. */
const statusesBySeverity: WidgetStatus[] = [
  'active',
  'stale',
  'no-data',
  'invalid',
  'missing',
  'disconnected',
  'missing-channel',
];

function getErrorMessage(
  label: string,
  status: WidgetStatus,
  overrideErrorMessage?: string,
): string | null {
  switch (status) {
    case 'no-data':
      return overrideErrorMessage ?? `${label} - No data!`;
    case 'missing':
      return overrideErrorMessage ?? `${label} - Missing data!`;
    case 'invalid':
      return overrideErrorMessage ?? `${label} - Invalid channel data!`;
    case 'missing-channel':
      return overrideErrorMessage ?? `${label} - Channel not found!`;
    default:
      return null;
  }
}

/**
 * Read and summarize widget channels here so the container only handles rendering.
 * Keep the ordered channels alongside their labels, errors, and most severe status.
 */
export function useWidgetDataHandler(
  channelIds: readonly string[],
  overrideErrorMessage?: string,
) {
  const channels = useChannel(channelIds);
  const channelLabels = channels.map(
    (channel, index) => channel?.channel.signal.label ?? channelIds[index],
  );
  const messages = channels
    .map((channel, index) =>
      getErrorMessage(
        channelLabels[index],
        channel?.status ?? 'missing-channel',
        overrideErrorMessage,
      ),
    )
    .filter((message) => message !== null);
  const severity = channels.reduce(
    (highest, channel) =>
      Math.max(
        highest,
        statusesBySeverity.indexOf(channel?.status ?? 'missing-channel'),
      ),
    0,
  );

  return {
    channels,
    channelLabels,
    overlayMessage: messages.length > 0 ? messages.join('\n') : null,
    componentStatus: statusesBySeverity[severity],
  };
}
