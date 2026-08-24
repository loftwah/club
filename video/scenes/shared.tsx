import React from "react";
import { AbsoluteFill } from "remotion";
import { colours, fonts } from "../theme";

export const SceneShell: React.FC<{
  children: React.ReactNode;
  vertical: boolean;
  dark?: boolean;
}> = ({ children, vertical, dark = false }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark ? colours.ink : colours.paper,
        color: dark ? colours.paper : colours.ink,
        fontFamily: fonts.body,
        overflow: "hidden",
        padding: vertical ? "192px 88px" : "72px 100px 66px",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const SceneRail: React.FC<{ left: string; right?: string; inverse?: boolean }> = ({
  left,
  right,
  inverse = false,
}) => {
  const colour = inverse ? "rgb(245 242 234 / 72%)" : colours.inkFaint;
  return (
    <div
      style={{
        alignItems: "center",
        color: colour,
        display: "flex",
        fontFamily: fonts.mono,
        fontSize: 11,
        justifyContent: "space-between",
        letterSpacing: "0.1em",
        position: "relative",
        zIndex: 2,
      }}
    >
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
};

export const SceneTitle: React.FC<{
  children: React.ReactNode;
  vertical?: boolean;
  inverse?: boolean;
}> = ({ children, vertical = false, inverse = false }) => (
  <div
    style={{
      color: inverse ? colours.paper : colours.ink,
      fontFamily: fonts.serif,
      fontSize: vertical ? 58 : 70,
      letterSpacing: "-0.045em",
      lineHeight: 0.91,
      maxWidth: vertical ? "100%" : 760,
    }}
  >
    {children}
  </div>
);

export const SceneRule: React.FC<{ inverse?: boolean }> = ({ inverse = false }) => (
  <div
    style={{
      backgroundColor: inverse ? "rgb(245 242 234 / 42%)" : colours.ink,
      height: 1,
      opacity: 0.55,
      width: "100%",
    }}
  />
);
