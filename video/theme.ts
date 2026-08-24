import type { CSSProperties } from "react";
import { staticFile } from "remotion";

export const colours = {
  paper: "#F5F2EA",
  paperDeep: "#E8E3D2",
  paperLight: "#FBF9F3",
  ink: "#111111",
  inkSoft: "#3A3A3A",
  inkFaint: "#6A6A6A",
  signal: "#B23A12",
  signalBright: "#FF5A1F",
  signalSoft: "#F1D9C9",
  cobalt: "#2447FF",
  cobaltDark: "#1932BE",
  success: "#1B6E3A",
  danger: "#A12622",
  white: "#FFFFFF",
} as const;

export const fonts = {
  display: "PWY Archivo, Archivo Variable, Arial Narrow, sans-serif",
  body: "PWY Archivo, Archivo Variable, Arial Narrow, sans-serif",
  serif: "PWY Serif, Source Serif 4 Variable, Georgia, serif",
  mono: "PWY Mono, Fragment Mono, ui-monospace, monospace",
} as const;

export const frameStyle: CSSProperties = {
  backgroundColor: colours.paper,
  color: colours.ink,
  fontFamily: fonts.body,
  overflow: "hidden",
};

export const hairline = `1px solid ${colours.ink}`;
export const softHairline = `1px solid rgb(17 17 17 / 22%)`;
export const paperShadow = "0 1px 0 rgb(17 17 17 / 12%), 0 18px 50px rgb(17 17 17 / 8%)";

export const fontFaces = `
  @font-face { font-family: "PWY Archivo"; src: url("${staticFile("video/fonts/archivo-variable.woff2")}") format("woff2"); font-weight: 100 900; font-style: normal; font-display: block; }
  @font-face { font-family: "PWY Serif"; src: url("${staticFile("video/fonts/source-serif-4-variable.woff2")}") format("woff2"); font-weight: 200 900; font-style: normal; font-display: block; }
  @font-face { font-family: "PWY Mono"; src: url("${staticFile("video/fonts/fragment-mono.woff2")}") format("woff2"); font-weight: 400; font-style: normal; font-display: block; }
`;

export function orientationScale(width: number, height: number): number {
  return width > height ? width / 1920 : width / 1080;
}

export function isVertical(width: number, height: number): boolean {
  return height > width;
}
