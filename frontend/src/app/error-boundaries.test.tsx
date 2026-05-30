import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "./error";
import Loading from "./loading";

describe("App Router fallback UI", () => {
  it("renders a Chinese error boundary with retry action", () => {
    const reset = vi.fn();

    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "页面暂时不可用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });

  it("renders a Chinese loading state", () => {
    render(<Loading />);

    expect(screen.getByText("正在加载项目状态...")).toBeTruthy();
  });
});
