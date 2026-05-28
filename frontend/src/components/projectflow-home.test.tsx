import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ProjectFlowHome } from "./projectflow-home";

describe("ProjectFlowHome", () => {
  it("shows a usable project progress workspace with core UI states", () => {
    render(<ProjectFlowHome />);

    expect(screen.getByRole("heading", { name: "ProjectFlow" })).toBeTruthy();
    expect(screen.getByText("下一步行动")).toBeTruthy();
    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.getByText("Empty")).toBeTruthy();
    expect(screen.getByText("Error")).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
  });
});
