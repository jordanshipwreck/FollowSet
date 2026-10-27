// Stroke icons on a 24 px grid. currentColor so they follow the text color.
const PATHS: Record<string, string> = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  history: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4.5l3 1.8",
  chart: "M5 20V11M12 20V5M19 20v-6",
  library: "M4 5h4v14H4zM10 5h4v14h-4zM16.5 5.5l3.5.9-3.2 12.9-3.5-.9z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
  play: "M8 5.5v13l11-6.5z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  close: "M6 6l12 12M18 6 6 18",
  pause: "M8 5v14M16 5v14",
  check: "M5 12.5 10 17 19 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  skip: "M6 5.5v13l9-6.5zM18 5v14",
  back: "M18 5.5v13l-9-6.5zM6 5v14",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  copy: "M9 9h10v10H9zM5 15V5h10",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3",
  volume: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.8 2.5-5 .3 1.6 1 2.6 2 3-.6-3 .2-5.5.5-8Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  bolt: "M13 3 5 13.5h6L10 21l8-10.5h-6z",
  camera: "M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  cloud: "M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10a4 4 0 0 1-1 7.98z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  trash: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z",
  up: "M12 19V5M6 11l6-6 6 6",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4M9.5 2.5h5",
  arrowUp: "M7 17 17 7M9 7h8v8",
  dumbbell: "M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11",
};

export function Icon({ name, size = 22, stroke = 1.9 }: { name: keyof typeof PATHS | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={PATHS[name]} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
