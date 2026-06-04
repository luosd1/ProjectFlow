"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Compass,
  GitBranch,
  ListTodo,
  Users,
  Rocket,
  ClipboardCheck,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  PlayCircle,
  Loader2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProjectState, AgentEvent } from "@/lib/types";
import type { AgentAction } from "./project-actions";
import type { ProjectView } from "./project-sidebar";

const ALL_AGENT_ACTIONS: {
  id: AgentAction;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  { id: "clarify", label: "方向澄清", icon: Compass, description: "明确项目目标和边界" },
  { id: "plan", label: "阶段计划", icon: GitBranch, description: "生成阶段计划和时间线" },
  { id: "breakdown", label: "任务拆解", icon: ListTodo, description: "将阶段拆解为具体任务" },
  { id: "assign", label: "分工推荐", icon: Users, description: "根据技能推荐分工" },
  { id: "push", label: "主动推进", icon: Rocket, description: "分析进度并推进项目" },
  { id: "analyze-checkins", label: "签到分析", icon: ClipboardCheck, description: "分析团队签到状态" },
  { id: "risk-analysis", label: "风险分析", icon: AlertTriangle, description: "识别潜在风险" },
  { id: "replan", label: "计划调整", icon: RefreshCw, description: "根据现状调整计划" },
];

const VIEW_RECOMMENDATIONS: Record<
  ProjectView,
  { action: AgentAction; reason: string } | null
> = {
  overview: { action: "push", reason: "查看当前进度并获取推进建议" },
  direction: { action: "clarify", reason: "完善项目方向卡" },
  stages: { action: "plan", reason: "生成或优化阶段计划" },
  "my-tasks": { action: "push", reason: "获取任务推进建议" },
  "team-tasks": { action: "assign", reason: "优化团队分工" },
  checkin: { action: "analyze-checkins", reason: "分析签到数据" },
  risks: { action: "risk-analysis", reason: "识别新风险" },
  retro: { action: "push", reason: "生成项目复盘报告" },
};

interface AgentSidebarProps {
  state: ProjectState;
  pendingAction?: AgentAction | null;
  actionSuccess?: string | null;
  actionError?: string | null;
  onRunAgent: (action: AgentAction) => void;
  onResetDemo?: () => void | Promise<void>;
}

export function AgentSidebar({
  state,
  pendingAction,
  actionSuccess,
  actionError,
  onRunAgent,
  onResetDemo,
}: AgentSidebarProps) {
  const searchParams = useSearchParams();
  const currentView = (searchParams.get("view") as ProjectView) || "overview";
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [expandedAction, setExpandedAction] = useState<AgentAction | null>(null);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  // Keyboard shortcut: Ctrl+J to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "j") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  const isExpanded = !collapsed || hovered;
  const recommendation = VIEW_RECOMMENDATIONS[currentView];

  // Get recent activity from timeline
  const recentEvents = state.timeline.slice(0, 5);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    return `${diffDays}天前`;
  };

  const getEventIcon = (eventType: AgentEvent["event_type"]) => {
    switch (eventType) {
      case "clarify":
        return Compass;
      case "plan":
        return GitBranch;
      case "breakdown":
        return ListTodo;
      case "assign":
        return Users;
      case "push":
        return Rocket;
      case "checkin":
        return ClipboardCheck;
      case "risk":
        return AlertTriangle;
      case "replan":
        return RefreshCw;
      default:
        return Sparkles;
    }
  };

  const getEventLabel = (eventType: AgentEvent["event_type"]) => {
    const action = ALL_AGENT_ACTIONS.find((a) => a.id === eventType);
    return action?.label || eventType;
  };

  return (
    <motion.aside
      className={cn(
        "relative flex h-screen flex-col border-l border-neutral-200/70 bg-bg-sidebar transition-all duration-200 ease-out",
        isExpanded ? "w-80" : "w-12"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={false}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        className="absolute -left-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-sm transition hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-moss/30"
        aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        {collapsed ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>

      {/* Header */}
      <div className="flex h-14 items-center gap-2 border-b border-neutral-100 px-3">
        <Bot className="h-5 w-5 shrink-0 text-moss" />
        <AnimatePresence>
          {isExpanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap text-sm font-semibold text-neutral-900"
            >
              Agent
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-3"
            >
              {/* Context-Aware Recommendation */}
              {recommendation && (
                <div className="mb-4 rounded-xl border border-moss/20 bg-moss/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-moss">
                    <Sparkles className="h-3.5 w-3.5" />
                    当前建议
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-600">
                    {recommendation.reason}
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-2 h-7 w-full bg-moss text-xs text-white hover:bg-moss/90"
                    disabled={Boolean(pendingAction)}
                    onClick={() => onRunAgent(recommendation.action)}
                  >
                    {pendingAction === recommendation.action ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <PlayCircle className="mr-1 h-3 w-3" />
                    )}
                    {pendingAction === recommendation.action
                      ? "运行中..."
                      : ALL_AGENT_ACTIONS.find(
                          (a) => a.id === recommendation.action
                        )?.label}
                  </Button>
                </div>
              )}

              {/* All Actions */}
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  所有操作
                </h3>
                <div className="space-y-1">
                  {ALL_AGENT_ACTIONS.map((action) => {
                    const isExpandedAction = expandedAction === action.id;
                    const isPending = pendingAction === action.id;
                    return (
                      <div key={action.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAction(
                              isExpandedAction ? null : action.id
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-moss/30",
                            isExpandedAction
                              ? "bg-neutral-50 text-neutral-900"
                              : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                          )}
                        >
                          <action.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-left">
                            {action.label}
                          </span>
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 shrink-0 transition-transform",
                              isExpandedAction && "rotate-90"
                            )}
                          />
                        </button>
                        <AnimatePresence>
                          {isExpandedAction && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-2 pb-2 pt-1">
                                <p className="mb-2 text-xs text-neutral-500">
                                  {action.description}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-full text-xs"
                                  disabled={Boolean(pendingAction)}
                                  onClick={() => {
                                    onRunAgent(action.id);
                                    setExpandedAction(null);
                                  }}
                                >
                                  {isPending ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <PlayCircle className="mr-1 h-3 w-3" />
                                  )}
                                  {isPending ? "运行中..." : "执行"}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status messages */}
              {actionSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-start gap-2 rounded-lg border border-moss/20 bg-moss/10 p-2.5 text-xs text-moss"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{actionSuccess}</span>
                </motion.div>
              )}
              {actionError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-start gap-2 rounded-lg border border-coral/20 bg-coral/10 p-2.5 text-xs text-coral"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{actionError}</span>
                </motion.div>
              )}

              {/* Recent Activity */}
              {recentEvents.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    最近活动
                  </h3>
                  <div className="space-y-2">
                    {recentEvents.map((event) => {
                      const Icon = getEventIcon(event.event_type);
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-2 text-xs"
                        >
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                          <div className="min-w-0">
                            <p className="text-neutral-700">
                              {getEventLabel(event.event_type)}
                              {event.user_confirmed && (
                                <span className="ml-1 text-moss">已确认</span>
                              )}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-neutral-400">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(event.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {onResetDemo && (
                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start gap-2 text-xs text-neutral-500 hover:bg-coral/10 hover:text-coral"
                    disabled={Boolean(pendingAction)}
                    onClick={() => onResetDemo()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重置演示数据
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed state: show icons only */}
        {!isExpanded && (
          <div className="flex flex-col items-center gap-2 py-3">
            {ALL_AGENT_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onRunAgent(action.id)}
                disabled={Boolean(pendingAction)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-moss/30",
                  pendingAction === action.id
                    ? "bg-moss/10 text-moss"
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600",
                  pendingAction && pendingAction !== action.id && "opacity-50 cursor-not-allowed"
                )}
                title={action.label}
              >
                {pendingAction === action.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <action.icon className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
