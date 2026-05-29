import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ProjectFlowHome } from "./projectflow-home";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

describe("ProjectFlowHome", () => {
  it("shows the landing page with call-to-action when no workspace is stored", () => {
    render(<ProjectFlowHome />);

    expect(screen.getByRole("heading", { name: /让项目自己告诉你/ })).toBeTruthy();
    expect(screen.getByText("主动推进型项目 Agent")).toBeTruthy();
    expect(screen.getByRole("button", { name: /开始使用/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /加载演示数据/ })).toBeTruthy();
  });
});
