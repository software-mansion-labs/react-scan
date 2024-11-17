import type { FiberRoot } from 'react-reconciler';
import * as React from 'react';
import { instrument } from './instrumentation';
import {
  type ActiveOutline,
  flushOutlines,
  getOutline,
  type PendingOutline,
} from './web/outline';
import { createCanvas } from './web/index';
import { logIntro } from './web/log';
import { createStatus } from './web/toolbar';

interface Options {
  /**
   * Enable/disable scanning
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * Include children of a component applied with withScan
   *
   * @default true
   */
  includeChildren?: boolean;

  /**
   * Run in production
   *
   * @default false
   */
  runInProduction?: boolean;

  /**
   * Log renders to the console
   *
   * @default false
   */
  log?: boolean;

  onCommitStart?: () => void;
  onCommitFinish?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onPaintStart?: () => void;
  onPaintFinish?: () => void;
}

interface Internals {
  onCommitFiberRoot: (rendererID: number, root: FiberRoot) => void;
  isProd: boolean;
  isInIframe: boolean;
  isPaused: boolean;
  componentAllowList: WeakMap<React.ComponentType<any>, Options> | null;
  options: Options;
  scheduledOutlines: PendingOutline[];
  activeOutlines: ActiveOutline[];
}

export const ReactScanInternals: Internals = {
  onCommitFiberRoot: (_rendererID: number, _root: FiberRoot): void => {
    /**/
  },
  get isProd() {
    return (
      '_self' in React.createElement('div') &&
      !ReactScanInternals.options.runInProduction
    );
  },
  isInIframe: window.self !== window.top,
  isPaused: false,
  componentAllowList: null,
  options: {
    enabled: true,
    includeChildren: true,
    runInProduction: false,
    log: false,
  },
  scheduledOutlines: [],
  activeOutlines: [],
};

export const setOptions = (options: Options) => {
  ReactScanInternals.options = {
    ...ReactScanInternals.options,
    ...options,
  };
};

export const getOptions = () => ReactScanInternals.options;

let inited = false;

export const start = () => {
  if (inited) return;
  inited = true;
  const ctx = createCanvas();
  const status = createStatus();
  if (!ctx) return;
  logIntro();

  const { options } = ReactScanInternals;
  instrument({
    onCommitStart() {
      options.onCommitStart?.();
    },
    onRender(fiber, render) {
      const outline = getOutline(fiber, render);
      if (outline) {
        ReactScanInternals.scheduledOutlines.push(outline);
      }

      requestAnimationFrame(() => {
        flushOutlines(ctx, new Map(), status);
      });
    },
    onCommitFinish() {
      options.onCommitFinish?.();
    },
  });
};

export const withScan = <T>(
  component: React.ComponentType<T>,
  options: Options = {},
) => {
  setOptions(options);
  const { isInIframe, isProd, componentAllowList } = ReactScanInternals;
  if (isInIframe || isProd || options.enabled === false) return component;
  if (!componentAllowList) {
    ReactScanInternals.componentAllowList = new WeakMap<
      React.ComponentType<any>,
      Options
    >();
  }
  if (componentAllowList) {
    componentAllowList.set(component, { ...options });
  }

  start();

  return component;
};

export const scan = (options: Options = {}) => {
  setOptions(options);
  const { isInIframe, isProd } = ReactScanInternals;
  if (isInIframe || isProd || options.enabled === false) return;

  start();
};