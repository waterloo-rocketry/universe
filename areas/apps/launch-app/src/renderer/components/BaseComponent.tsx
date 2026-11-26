import type { ComponentType as ReactComponentType } from 'react';
import { useState, useRef, useEffect } from 'react';
import '../styles/baseComponent.css';
import type { ChannelData } from '../data/telemetry-context';
import { useWidgetDataHandler } from '../data/WidgetDataHandler';
import ProgressBar from './ProgressBar';
import { Gauge } from './Gauge';
import NumericWidget from './NumericWidget';

/**
 * BaseComponent
 *
 * Parent container for numeric, plot, and gauge widgets. Renders a heading,
 * a status presentation, and a registered visualization for its type.
 *
 * Dashboard responsible for layout only; it creates BaseComponent and
 * BaseComponent renders widgets using channel data from WidgetDataHandler.
 *
 * Props:
 *  - id            Unique, stable identifier for this widget instance.
 *                  Rendered as `data-widget-id`.
 *  - componentType "numeric" | "plot" | "gauge" | "progress-bar". Used for
 *                  deciding what to render
 *  - channels      The channels the widget is subscribing. Can be empty so
 *                  static widgets use the same container and registry.
 *  - title         The title. Nullable. Default is channel signal label.
 *  - config        The config passed to the registered widget
 *  - height        The widget height, passed from dashboard. Nullable
 *  - width         The widget width, passed from dashboard. Nullable
 *
 * Additional properties:
 * - updateConfig   For the widget to update it's individual config
 * - setOverlay     For the widget to display a settings pannel to update config
 *
 * Each status is also a class on the wrapper (`widget--active`, `widget--stale`,
 * etc.) for styling. The wrapper fills its parent, and `.widget__body` takes the
 * remaining space, so size a widget by sizing its parent. Update styling for new
 * types of widgets as needed
 *
 * Example:
 *   <BaseComponent
 *      id={"pressure1"}
 *      componentType='progress-bar'
 *      channels={['test.pressure']}
 *      config={{min: 0, max: 100}}
 *      updateConfig={update_function_from_dashboard}
 *      setOverlay={some_function_from_dashboard}
 *  />
 */

/**
 * The widget types accepted by BaseWidget.
 *
 * Enumerating on this type is not recommended as more types may be added during
 * developing.
 *
 * New types shall be added when a new widget is created
 */
export type ComponentType =
  'numeric' | 'plot' | 'gauge' | 'progress-bar' | 'undefined';

/**
 * The properties that will be passed to the rendering function.
 * This includes the channles subscribed, and the custom config.
 *
 * Note that channels may be null.
 *
 * `width` and `height` are passed from the dashboard. The only purpose
 * of `width` and `height` is for the widget to adjust itself based on
 * the container's size.
 *
 * Note that BaseComponent does not guarentee that the `config` is the
 * type required by the widget. Widgets need to perform a typecheck in
 * the beginning to make sure the type is correct.
 */
export interface WidgetProps {
  /**
   * The channels the widget subscribed. Note that this is created based on config
   * and may not be compatible to the widget if the config is stale.
   */
  channels: (ChannelData | null)[];
  /** The width of the container. Used to adjust layout. */
  width?: number;
  /** The height of the container. Used to adjust layout. */
  height?: number;
  /**
   * The config of the widget. For example: min and max of a progress bar.
   * Note that this needs to be type checked before using.
   */
  config?: object;
}

/**
 * The properties that will be passed to BaseComponent to render the widget
 */
export interface BaseComponentProp {
  /** The globally unique ID of the widget */
  id: string;
  /** The component type of the widget. Used for styling and rendering */
  componentType: ComponentType;
  /** Channel IDs to read. Empty for widgets that do not depend on telemetry. */
  channels: string[];
  /**
   * For testing only. During testing the test harness may choose to override the channels
   * Providing a value will bypass the reading from telemetry provider
   */
  overrideChannels?: (ChannelData | null)[];
  /** The title of the widget. Defaults to the channels the widget is subscribed to */
  title?: string;
  /** The config passed to the widget during rendering */
  config?: object;
  /** The height of the container. Used to adjust layout. */
  height?: number;
  /** The width of the container. Used to adjust layout. */
  width?: number;
  /**
   * The function to update the config
   * For convenience the parameter is the entire `WidgetConfig`. The function may
   * assume width and height are readonly.
   */
  updateConfig: (config?: object) => void;
  /**
   * Unfortunately we cannot provide a way for uniformed overlay rendering
   * because that requires storing a react component as a state, which is an anti-pattern
   * However, we can provide a subscription so we can still ensure only one overlay is present
   * the widget is then responsible for managing the overlay itself.
   *
   * When another component requests to display an overlay, the callback will be invoked
   * and the current widget must honor the callback and close its overlay
   *
   * To cancel the overlay, invoke this without parameters
   */
  requestOverlay: (callback?: () => void) => void;
}

interface MenuPosition {
  visible: boolean;
  x: number;
  y: number;
}

/**
 * The registry widgets must provide when registering themselves.
 */
interface WidgetRegistry {
  /**
   * The rendering function of the widget
   * @param props the property as described
   * @returns the rendered widget
   */
  renderingFunction: ReactComponentType<WidgetProps>;
  /**
   * The available actions (configs) the widget can perform.
   * When the user chose an action, the corresponding function is called.
   *
   * A function to update the config is also supplied.
   *
   * There is also an additional function to set an overlay to display the widget's settings screen.
   */
  availableActions: Record<
    string,
    (
      config: object,
      updateConfig: (config: object) => void,
      requestOverlay: (callback?: () => void) => void,
    ) => void
  >;
  /** The widget can chose an override message when chanenl errors */
  overrideErrorMessage?: string;
}

/**
 * Register all widgets
 */
const registeredWidgets: Record<ComponentType, WidgetRegistry | undefined> = {
  'progress-bar': { renderingFunction: ProgressBar, availableActions: {} },
  gauge: { renderingFunction: Gauge, availableActions: {} },
  numeric: { renderingFunction: NumericWidget, availableActions: {} },
  plot: undefined,
  undefined: undefined,
};

export default function BaseComponent(config: BaseComponentProp) {
  const widget = registeredWidgets[config.componentType];
  const Widget = widget?.renderingFunction;
  const dataRead = useWidgetDataHandler(
    config.channels,
    widget?.overrideErrorMessage,
  );
  const { channels, channelLabels, overlayMessage, componentStatus } =
    config.overrideChannels
      ? {
          channels: config.overrideChannels,
          channelLabels: config.overrideChannels.map(
            (c) => c?.channel.signal.label ?? 'unknown channel',
          ),
          overlayMessage: '',
          componentStatus: 'active',
        }
      : dataRead;

  const suffix =
    componentStatus === 'stale' || componentStatus === 'disconnected'
      ? ` (${componentStatus})`
      : '';
  const heading = config.title ?? channelLabels.join(' | ');

  const [menu, setMenu] = useState<MenuPosition>({
    visible: false,
    x: 0,
    y: 0,
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent the browser's default right-click menu
    setMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
    });
    config.requestOverlay(() =>
      setMenu({
        visible: false,
        x: 0,
        y: 0,
      }),
    );
  };

  // Close the popup when clicking anywhere outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu((prev) => ({ ...prev, visible: false }));
        config.requestOverlay(() => {});
      }
    };

    if (menu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menu.visible, config]);

  const removeWidget = () => {
    if (confirm('Are you sure you want to remove this widget?'))
      config.updateConfig();
  };

  return (
    <section
      className={`widget widget--${config.componentType} widget--${componentStatus}`}
      data-widget-id={config.id}
      aria-label={heading}
      onContextMenu={handleContextMenu}
    >
      <h3>{heading + suffix}</h3>
      <div className="widget__body">
        <div
          className="widget__content"
          aria-hidden={overlayMessage !== null}
          inert={overlayMessage !== null}
        >
          {Widget ? (
            <Widget
              channels={channels}
              width={config.width}
              height={config.height}
              config={config.config}
            />
          ) : (
            'No Content'
          )}
        </div>
        {overlayMessage !== null && (
          <p className="widget__overlay" role="alert">
            {overlayMessage}
          </p>
        )}
      </div>
      {menu.visible && (
        <div
          onClick={(e) => e.stopPropagation()}
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menu.y,
            left: menu.x,
          }}
          className="dashboard-popup"
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <li className="dashboard-popup-item dashboard-popup-not-implemented">
              Change Type
            </li>
            <li className="dashboard-popup-item dashboard-popup-not-implemented">
              Hide
            </li>
            <li
              className="dashboard-popup-item"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={removeWidget}
            >
              Remove
            </li>
          </ul>
          {Object.keys(widget?.availableActions ?? {}).length > 0 && (
            <>
              <hr />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {Object.entries(widget?.availableActions ?? {}).map(
                  (action) => (
                    <li
                      key={`action-${config.id}-${action[0].replace(' ', '')}`}
                      className="dashboard-popup-item"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        action[1](
                          config.config ?? {},
                          config.updateConfig,
                          config.requestOverlay,
                        )
                      }
                    >
                      {action[0]}
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
