export type FrameRequester = (callback: FrameRequestCallback) => number;

export function createFrameRenderScheduler<T>(
  render: (value: T) => void,
  requestFrame: FrameRequester = window.requestAnimationFrame.bind(window)
): (value: T) => void {
  let pending = false;
  let latestValue: T;

  return (value: T) => {
    latestValue = value;

    if (pending) {
      return;
    }

    pending = true;
    requestFrame(() => {
      pending = false;
      render(latestValue);
    });
  };
}
