export type AgentState = {
  label: "Loading" | "Empty" | "Error" | "Success";
  detail: string;
};

export type ProjectActionCard = {
  owner: string;
  title: string;
  reason: string;
};

export type StageRow = {
  name: string;
  output: string;
  status: string;
  active: boolean;
};

export type TeamMember = {
  name: string;
  role: string;
  capacity: number;
  risk?: boolean;
};
