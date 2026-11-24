import {
  getChannelStatus,
  getLatestReading,
  type ChannelState,
} from '../data/channel-store';
import '../styles/gauge.css';

interface GaugeProps {
  channel: ChannelState;
  min: number;
  max: number;
  major_intervals?: number; // Max is divided by this to determine the amount of numbers on the gauge, default is 5.
  // So for instance, if max = 100 and this is the default value, you get 0, 20, 40, ..., 100.
  minor_intervals?: number; // Amount of small dashes between numbers, default is 2.
  nowMs: number; // Current time
}

const STARTING_DEGREES = 210; // Where it rests when it's at 0
const TOTAL_ROTATION = 240; // Total rotation of the needle
const CENTER_X = 100;
const CENTER_Y = 100;

function getAngle(value: number, min: number, max: number) {
  // Gauge is from min at 210 to max at -30 degrees from rightward horizontal.
  // So 240 total degrees of rotation. The visual has the angle adjustment.
  let range: 'in' | 'below min' | 'above max';
  let angle = 0;

  if (value < min) {
    range = 'below min';
  } else if (value > max) {
    range = 'above max';
    angle = 240;
  } else {
    range = 'in';
    angle = 240 * ((value - min) / (max - min));
  }

  return {
    angle,
    range,
  };
}

function armLocationFromPolarCoords(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: CENTER_X + radius * Math.cos(radians),
    y: CENTER_Y + radius * Math.sin(radians),
  };
}

export function Gauge({
  channel,
  min,
  max,
  major_intervals = 5,
  minor_intervals = 2,
  nowMs,
}: GaugeProps) {
  const { unit, kind } = channel.signal;
  const status = getChannelStatus(channel, nowMs);
  const latest = getLatestReading(channel);

  // Rejects non numeric channels
  if (kind != 'number') {
    return (
      <div>
        <span>Not a numeric channel!</span>
      </div>
    );
  }

  // Make sure max/min are set and that min < max
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return (
      <div>
        <span>Invalid range!</span>
      </div>
    );
  }

  // Make sure the most recent value is good according to the channel
  let value: number | null = null;
  if (
    latest &&
    latest.quality == 'good' &&
    typeof latest.value == 'number' &&
    Number.isFinite(latest.value)
  ) {
    value = latest.value;
  }

  // Only display angles that exist. If not, it rests at the minimum angle.
  const angle =
    value == null ? getAngle(min, min, max) : getAngle(value, min, max);

  // Actual value for display purposes
  let valueText: string;
  if (value == null || angle == null) {
    valueText = 'N/A'; // No value is there
  } else {
    const roundedValue = Math.round(value * 1000) / 1000; // Rounds to 3 decimal places
    valueText = unit ? `${roundedValue} ${unit}` : String(roundedValue);
  }

  // Ticks + labels
  // -theta is used because the coordinate logic for the styling is from the top left,
  // but the polar system measures it from the bottom left
  const totalTicks = major_intervals * minor_intervals;
  const ticks = Array.from({ length: totalTicks + 1 }, (_, i) => {
    const theta = STARTING_DEGREES - (TOTAL_ROTATION * i) / totalTicks;
    const isMajor = i % minor_intervals === 0;
    const outer = armLocationFromPolarCoords(-theta, 92);
    const inner = armLocationFromPolarCoords(-theta, isMajor ? 80 : 85);
    return { i, outer, inner, isMajor };
  });

  const labels = Array.from({ length: major_intervals + 1 }, (_, i) => {
    const theta = STARTING_DEGREES - (TOTAL_ROTATION * i) / major_intervals;
    const pos = armLocationFromPolarCoords(-theta, 66);
    const labelValue = min + ((max - min) * i) / major_intervals;
    return {
      i,
      pos,
      rotation: 90 - theta, // Tilts the text as it goes around the circle.
      text: String(Math.round(labelValue * 100) / 100),
    };
  });

  return (
    <div className="gauge">
      <div className="gauge_circle">
        <svg viewBox="0 0 200 200" className="gauge_svg">
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r="98"
            className="gauge_face"
            fill={angle.range == 'in' ? 'white' : '#ffa9a9'}
          />

          <g className="gauge_circle_values">
            {ticks.map((t) => (
              <line
                key={t.i}
                x1={t.inner.x}
                y1={t.inner.y}
                x2={t.outer.x}
                y2={t.outer.y}
                className={
                  t.isMajor ? 'gauge_tick gauge_tick_major' : 'gauge_tick'
                }
              />
            ))}
            {labels.map((l) => (
              <text
                key={l.i}
                x={l.pos.x}
                y={l.pos.y}
                transform={`rotate(${l.rotation} ${l.pos.x} ${l.pos.y})`}
                className="gauge_label"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {l.text}
              </text>
            ))}
          </g>

          {/* Needle drawn pointing at +x (right), rotated into place */}
          <g
            className="gauge_circle_hand"
            style={{
              transform: `rotate(${angle.angle - STARTING_DEGREES}deg)`,
            }}
          >
            <polygon
              points="100,95 172,99.5 172,100.5 100,105"
              className="gauge_needle"
            />
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r="6"
              className="gauge_needle"
            />
          </g>
        </svg>

        <div className="gauge_circle_value_display">{valueText}</div>
      </div>

      <div className="gauge_status">
        <div className="gauge_status_text">{status}</div>
      </div>
    </div>
  );
}
