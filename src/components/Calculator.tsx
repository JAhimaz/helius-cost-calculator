"use client";

import { useState } from "react";
import { Pricing } from "@/lib/Pricing";
import { Plan, Plans } from "@/lib/Plans";
import {
  calculateTotalCosts,
  getMethodCreditsPerCall,
  getMethodCreditsPerDay,
} from "@/lib/Calculation";
import { SelectedMethod } from "./types";
import { LucideCheck, LucideX, ArrowUpRight, LucidePlusSquare } from "lucide-react";

const formatCredits = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
const methodControlClass =
  "border border-border rounded p-2 text-sm h-9 w-full transition-colors transition-shadow duration-150 " +
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 hover:border-primary/50";
const disabledControlClass = "opacity-10 cursor-not-allowed";

type PlanCostOption = {
  plan: Plan;
  totalMonthlyUsd: number;
  additionalCreditsNeeded: number;
  additionalCreditsUsd: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  pending?: boolean;
};

type SuggestionResponse = {
  assistant_message: string;
  suggested_methods: SuggestedMethod[];
  sources_used: string[];
  replace_existing_methods?: boolean;
};

type SuggestedMethod = {
  methodType: keyof typeof Pricing.credit_costs;
  methodName: string;
  callRate: number;
  callFrequency: "minute" | "day";
  mb?: number | null;
};

const MILLION_CREDITS = 1_000_000;

function getPlanCostOption(plan: Plan, monthlyCreditsNeeded: number): PlanCostOption | null {
  if (plan.price_per_month_usd === null || plan.monthly_credits === null) {
    return null;
  }

  if (monthlyCreditsNeeded <= plan.monthly_credits) {
    return {
      plan,
      totalMonthlyUsd: plan.price_per_month_usd,
      additionalCreditsNeeded: 0,
      additionalCreditsUsd: 0,
    };
  }

  if (plan.additional_credits_cost_per_million_usd === null) {
    return null;
  }

  const additionalCreditsNeeded = monthlyCreditsNeeded - plan.monthly_credits;
  const additionalCreditsUsd =
    (additionalCreditsNeeded / MILLION_CREDITS) * plan.additional_credits_cost_per_million_usd;

  return {
    plan,
    totalMonthlyUsd: plan.price_per_month_usd + additionalCreditsUsd,
    additionalCreditsNeeded,
    additionalCreditsUsd,
  };
}

function getCheapestPlanOption(options: PlanCostOption[]): PlanCostOption | null {
  if (options.length === 0) {
    return null;
  }

  return options.reduce((best, option) =>
    option.totalMonthlyUsd < best.totalMonthlyUsd ? option : best,
  );
}

export default function Calculator() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(Plans[0]);
  const [isPlanDetailsOpen, setIsPlanDetailsOpen] = useState(false);
  const [selectedMethods, setSelectedMethods] = useState<SelectedMethod[]>([]);
  const [newMethod, setNewMethod] = useState<SelectedMethod | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<SuggestedMethod[]>([]);
  const [pendingSources, setPendingSources] = useState<string[]>([]);
  const [pendingReplaceExisting, setPendingReplaceExisting] = useState(false);

  const totalCosts = calculateTotalCosts(selectedMethods);
  const monthlyCreditsNeeded = totalCosts.perMonth;
  const isMethodTypeSelected = Boolean(newMethod);
  const isMethodNameSelected = Boolean(newMethod?.methodName);
  const isPerMbMethod = Boolean(newMethod?.isPerMB);
  const canAddMethod =
    Boolean(newMethod) &&
    Boolean(newMethod?.methodName) &&
    (newMethod?.callRate ?? 0) > 0 &&
    (!newMethod?.isPerMB || (newMethod?.mb ?? 0) > 0);

  const selectedPlanCostOption = getPlanCostOption(selectedPlan, monthlyCreditsNeeded);
  const remainingCredits =
    selectedPlan.monthly_credits !== null
      ? selectedPlan.monthly_credits - monthlyCreditsNeeded
      : null;
  const isMonthlyCoverageKnown = remainingCredits !== null;
  const hasEnoughMonthlyCredits = isMonthlyCoverageKnown && remainingCredits >= 0;
  const isMonthlyCreditsShort = isMonthlyCoverageKnown && remainingCredits < 0;

  const higherPlanOptions = Plans.filter((plan) => plan.id > selectedPlan.id)
    .map((plan) => getPlanCostOption(plan, monthlyCreditsNeeded))
    .filter((option): option is PlanCostOption => option !== null);
  const cheapestHigherPlanOption = getCheapestPlanOption(higherPlanOptions);

  const selectedPlanCostDisplay = selectedPlanCostOption
    ? `${formatUsd(selectedPlanCostOption.totalMonthlyUsd)}/month`
    : selectedPlan.price_per_month_usd !== null
      ? `${formatUsd(selectedPlan.price_per_month_usd)}/month (insufficient for required credits)`
      : "Custom pricing (contact sales)";

  let recommendationText: string | null = null;
  if (isMonthlyCreditsShort) {
    const selectedIsViableWithAddOn =
      selectedPlanCostOption !== null && selectedPlanCostOption.additionalCreditsNeeded > 0;

    if (
      selectedIsViableWithAddOn &&
      (!cheapestHigherPlanOption ||
        selectedPlanCostOption.totalMonthlyUsd <= cheapestHigherPlanOption.totalMonthlyUsd)
    ) {
      recommendationText = `(Recommended: stay on ${selectedPlan.name} + ${formatCredits(
        selectedPlanCostOption.additionalCreditsNeeded,
      )} extra credits for ${formatUsd(
        selectedPlanCostOption.additionalCreditsUsd,
      )} additional (${formatUsd(selectedPlanCostOption.totalMonthlyUsd)}/month total))`;
    } else if (cheapestHigherPlanOption) {
      const higherPlanExtraCreditsText =
        cheapestHigherPlanOption.additionalCreditsNeeded > 0
          ? ` + ${formatCredits(cheapestHigherPlanOption.additionalCreditsNeeded)} extra credits`
          : "";

      recommendationText = `(Recommended: ${cheapestHigherPlanOption.plan.name}${higherPlanExtraCreditsText} at ${formatUsd(
        cheapestHigherPlanOption.totalMonthlyUsd,
      )}/month)`;
    } else {
      recommendationText = "(Recommended: Enterprise - contact sales)";
    }
  }

  const buildSelectedMethod = (suggested: SuggestedMethod): SelectedMethod | null => {
    const methodData = Pricing.credit_costs[
      suggested.methodType
    ] as Record<string, number | { cost_per_mb: number; mb: number }>;

    const selectedMethodData = methodData?.[suggested.methodName];
    if (!selectedMethodData) return null;

    if (typeof selectedMethodData === "number") {
      return {
        methodType: suggested.methodType,
        methodName: suggested.methodName,
        methodCost: selectedMethodData,
        isPerMB: false,
        callRate: suggested.callRate,
        callFrequency: suggested.callFrequency,
      };
    }

    return {
      methodType: suggested.methodType,
      methodName: suggested.methodName,
      methodCost: selectedMethodData.cost_per_mb,
      isPerMB: true,
      mb: suggested.mb ?? selectedMethodData.mb,
      mbUnit: selectedMethodData.mb,
      callRate: suggested.callRate,
      callFrequency: suggested.callFrequency,
    };
  };

  const resetChatAndMethods = () => {
    setChatMessages([]);
    setChatInput("");
    setChatError(null);
    setPendingSuggestions([]);
    setPendingSources([]);
    setPendingReplaceExisting(false);
    setSelectedMethods([]);
    setNewMethod(null);
  };

  const handleConfirmSuggestions = () => {
    const nextMethods = pendingSuggestions
      .map((suggested) => buildSelectedMethod(suggested))
      .filter((method): method is SelectedMethod => Boolean(method));

    if (nextMethods.length > 0) {
      setSelectedMethods((prev) =>
        pendingReplaceExisting ? [...nextMethods] : [...prev, ...nextMethods],
      );
    }

    setPendingSuggestions([]);
    setPendingSources([]);
    setPendingReplaceExisting(false);
  };

  const handleCancelSuggestions = () => {
    setPendingSuggestions([]);
    setPendingSources([]);
    setPendingReplaceExisting(false);
  };

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: trimmed },
      { role: "assistant", content: ":lightbulb: Thinking...", pending: true },
    ];

    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const response = await fetch("/api/method-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextMessages,
          selectedMethods: selectedMethods.map((method) => ({
            methodType: method.methodType,
            methodName: method.methodName,
          })),
        }),
      });

      const data = (await response.json()) as SuggestionResponse;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to get a response.");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data?.assistant_message || "No response provided.",
        sources: Array.isArray(data?.sources_used) ? data.sources_used : [],
      };

      setChatMessages((prev) => {
        const updated = [...prev];
        const pendingIndex = updated.findIndex(
          (message) => message.role === "assistant" && message.pending,
        );
        if (pendingIndex >= 0) {
          updated[pendingIndex] = assistantMessage;
          return updated;
        }
        return [...updated, assistantMessage];
      });
      setPendingSuggestions(Array.isArray(data?.suggested_methods) ? data.suggested_methods : []);
      setPendingSources(Array.isArray(data?.sources_used) ? data.sources_used : []);
      setPendingReplaceExisting(Boolean(data?.replace_existing_methods));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Something went wrong.");
      setChatMessages((prev) => prev.filter((message) => !message.pending));
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col w-4xl gap-5 m-auto">
      <span className="text-3xl font-bold mt-10 text-primary">Helius Plan Calculator</span>
      <div>
        <label htmlFor="plan" className="mr-2 text-sm">
          Select a Plan:
        </label>
        <select
          id="plan"
          name="plan"
          className="border border-border rounded p-2 text-sm h-9 cursor-pointer"
          value={selectedPlan.name}
          onChange={(e) =>
            setSelectedPlan(Plans.find((p) => p.name === e.target.value) || Plans[0])
          }
        >
          {Plans.map((plan) => (
            <option key={plan.id} value={plan.name}>
              {plan.name} -{" "}
              {plan.price_per_month_usd !== null ? `$${plan.price_per_month_usd}/month` : "Free"}
            </option>
          ))}
        </select>
      </div>

      {selectedPlan && (
        <div id="selected-plan-details" className="border border-border rounded shadow-md">
          <button
            type="button"
            className="group w-full p-4 flex items-center justify-between text-left cursor-pointer"
            onClick={() => setIsPlanDetailsOpen((prev) => !prev)}
            aria-expanded={isPlanDetailsOpen}
            aria-controls="selected-plan-details-content"
          >
            <span className="text-xl font-semibold text-primary">{selectedPlan.name} Plan Details</span>
            <ArrowUpRight
              className={`w-4 h-4 transition-transform duration-200 group-hover:text-primary ${isPlanDetailsOpen ? "rotate-135 text-primary" : "rotate-90"}`}
            />
          </button>
          <div
            id="selected-plan-details-content"
            className={`grid transition-all duration-300 ease-in-out ${
              isPlanDetailsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 p-4 pt-0">
                <span className="text-sm">Monthly Credits: {selectedPlan.monthly_credits}</span>
                <span className="text-sm">
                  Price: {selectedPlan.price_per_month_usd !== null ? `$${selectedPlan.price_per_month_usd}/month` : "Free"}
                </span>
                <span className="text-sm">
                  Rate Limits:
                  <ul className="list-disc list-inside">
                    <li>
                      RPC Requests per Second:{" "}
                      {selectedPlan.rate_limits.rpc_requests_per_second !== null
                        ? selectedPlan.rate_limits.rpc_requests_per_second
                        : "Unlimited"}
                    </li>
                    <li>
                      Send Transactions per Second:{" "}
                      {selectedPlan.rate_limits.send_transactions_per_second !== null
                        ? selectedPlan.rate_limits.send_transactions_per_second
                        : "Unlimited"}
                    </li>
                    <li>
                      DAS Requests per Second:{" "}
                      {selectedPlan.rate_limits.das_requests_per_second !== null
                        ? selectedPlan.rate_limits.das_requests_per_second
                        : "Unlimited"}
                    </li>
                  </ul>
                </span>
                <span className="text-sm">
                  Included Features:
                  <ul className="list-disc list-inside">
                    <li>
                      Staked Connections:{" "}
                      {selectedPlan.included_features.staked_connections ? (
                        <LucideCheck className="w-4 h-4 inline text-green-500" />
                      ) : (
                        <LucideX className="w-4 h-4 inline text-red-500" />
                      )}
                    </li>
                    <li>
                      Laserstream Devnet Access:{" "}
                      {selectedPlan.included_features.laserstream_devnet_access ? (
                        <LucideCheck className="w-4 h-4 inline text-green-500" />
                      ) : (
                        <LucideX className="w-4 h-4 inline text-red-500" />
                      )}
                    </li>
                    <li>
                      Laserstream Mainnet Access:{" "}
                      {selectedPlan.included_features.laserstream_mainnet_access ? (
                        <LucideCheck className="w-4 h-4 inline text-green-500" />
                      ) : (
                        <LucideX className="w-4 h-4 inline text-red-500" />
                      )}
                    </li>
                    <li>
                      Enhanced Websockets:{" "}
                      {selectedPlan.included_features.enhanced_websockets ? (
                        <LucideCheck className="w-4 h-4 inline text-green-500" />
                      ) : (
                        <LucideX className="w-4 h-4 inline text-red-500" />
                      )}
                    </li>
                    <li>Support Level: {selectedPlan.included_features.support_level}</li>
                  </ul>
                </span>
                <span className="text-sm">
                  Additional Credits Cost per Million:{" "}
                  {selectedPlan.additional_credits_cost_per_million_usd !== null
                    ? `$${selectedPlan.additional_credits_cost_per_million_usd}`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="border border-border rounded p-4 shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-lg font-semibold text-primary">Help Me Build</span>
          <button
            className="border border-border rounded px-3 py-1 text-sm hover:border-primary/60"
            type="button"
            onClick={resetChatAndMethods}
          >
            Reset Chat + Methods
          </button>
        </div>

        <div className="mt-4 h-64 overflow-y-auto border border-border rounded bg-background/40 p-3 text-sm">
          {chatMessages.length === 0 && (
            <div className="text-foreground/50 italic">
              Ask about your dapp and we will suggest Helius methods to add.
            </div>
          )}
          <div className="flex flex-col gap-3">
            {chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded border border-border/60 p-3 ${
                  message.role === "user" ? "bg-primary/5" : "bg-muted/30"
                }`}
              >
                <div className="text-xs uppercase tracking-wide text-foreground/60">
                  {message.role === "user" ? "You" : "Assistant"}
                </div>
                <div className="mt-1 whitespace-pre-line">{message.content}</div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 text-xs text-foreground/60">
                    Sources: {message.sources.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            className={`${methodControlClass} sm:flex-1`}
            placeholder="Describe your dapp and required functionality..."
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            type="button"
            className={`bg-primary text-white rounded px-4 h-9 text-sm ${
              chatLoading ? disabledControlClass : "cursor-pointer"
            }`}
            disabled={chatLoading}
            onClick={handleSendMessage}
          >
            {chatLoading ? "Thinking..." : "Send"}
          </button>
        </div>

        {chatError && (
          <div className="mt-2 text-sm text-error">
            {chatError}
          </div>
        )}

        {pendingSuggestions.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="text-sm font-semibold text-primary">
              Proposed Methods ({pendingSuggestions.length})
            </div>
            {pendingReplaceExisting && (
              <div className="mt-1 text-xs text-foreground/60">
                These will replace your currently selected methods.
              </div>
            )}
            <div className="mt-2 flex flex-col gap-2 text-sm">
              {pendingSuggestions.map((suggestion, index) => (
                <div key={`${suggestion.methodType}-${suggestion.methodName}-${index}`} className="rounded border border-border/60 p-2">
                  <div>
                    <span className="font-semibold">{suggestion.methodType}</span> / {suggestion.methodName}
                  </div>
                  <div className="text-xs text-foreground/70">
                    Calls: {formatCredits(suggestion.callRate)}{" "}
                    {suggestion.callFrequency === "minute" ? "per minute" : "per day"}
                    {suggestion.mb ? ` | MB: ${formatCredits(suggestion.mb)}` : ""}
                  </div>
                </div>
              ))}
            </div>
            {pendingSources.length > 0 && (
              <div className="mt-2 text-xs text-foreground/60">
                Sources used: {pendingSources.join(", ")}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="bg-primary text-white rounded px-4 h-9 text-sm"
                onClick={handleConfirmSuggestions}
              >
                Confirm and Add Methods
              </button>
              <button
                type="button"
                className="border border-border rounded px-4 h-9 text-sm hover:border-primary/60"
                onClick={handleCancelSuggestions}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="border border-border rounded p-4 shadow-md">
        <span className="text-lg font-semibold text-primary"><LucidePlusSquare className="w-5 h-5 inline mr-1" /> Add New Method</span>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mt-4 items-end">
          <div className="flex flex-col gap-1 xl:col-span-2">
            <label htmlFor="methodType" className="text-xs text-foreground/80">
              Method Type
            </label>
            <select
              id="methodType"
              name="methodType"
              value={newMethod?.methodType ?? ""}
              className={`${methodControlClass} cursor-pointer`}
              onChange={(e) => {
                const methodType = e.target.value as keyof typeof Pricing.credit_costs;
                if (!methodType) {
                  setNewMethod(null);
                  return;
                }

                setNewMethod({
                  methodType,
                  methodName: "",
                  methodCost: 0,
                  isPerMB: false,
                  callRate: 0,
                  callFrequency: "day",
                });
              }}
            >
              <option value="">Select Method Type</option>
              {Object.keys(Pricing.credit_costs).map((methodType) => (
                <option key={methodType} value={methodType}>
                  {methodType}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 xl:col-span-1">
            <label htmlFor="methodName" className="text-xs text-foreground/80">
              Method Name
            </label>
            <select
              id="methodName"
              value={newMethod?.methodName ?? ""}
              name="methodName"
              disabled={!isMethodTypeSelected}
              className={`${methodControlClass} ${
                !isMethodTypeSelected ? disabledControlClass : "cursor-pointer"
              }`}
              onChange={(e) => {
                if (!newMethod) return;
                const methodName = e.target.value;
                const methodData = Pricing.credit_costs[
                  newMethod.methodType
                ] as Record<string, number | { cost_per_mb: number; mb: number }>;

                const selectedMethodData = methodData[methodName];

                if (typeof selectedMethodData === "number") {
                  setNewMethod({
                    ...newMethod,
                    methodName,
                    methodCost: selectedMethodData,
                    isPerMB: false,
                    mb: undefined,
                    mbUnit: undefined,
                  });
                  return;
                }

                if (selectedMethodData) {
                  setNewMethod({
                    ...newMethod,
                    methodName,
                    methodCost: selectedMethodData.cost_per_mb,
                    isPerMB: true,
                    mb: selectedMethodData.mb,
                    mbUnit: selectedMethodData.mb,
                  });
                }
              }}
            >
              <option value="">Select Method Name</option>
              {newMethod &&
                Object.keys(Pricing.credit_costs[newMethod.methodType]).map((methodName) => (
                  <option key={methodName} value={methodName}>
                    {methodName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="callFrequency" className="text-xs text-foreground/80">
              Frequency
            </label>
            <select
              id="callFrequency"
              name="callFrequency"
              value={newMethod?.callFrequency ?? "day"}
              disabled={!isMethodNameSelected}
              className={`${methodControlClass} ${
                !isMethodNameSelected ? disabledControlClass : "cursor-pointer"
              }`}
              onChange={(e) => {
                if (!newMethod) return;
                const callFrequency = e.target.value as "minute" | "day";
                setNewMethod({
                  ...newMethod,
                  callFrequency,
                });
              }}
            >
              <option value="minute">Per Minute</option>
              <option value="day">Per Day</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="callRate" className="text-xs text-foreground/80">
              {newMethod?.callFrequency === "minute" ? "Calls Per Minute" : "Calls Per Day"}
            </label>
            <input
              id="callRate"
              type="number"
              min="0"
              step="any"
              value={newMethod?.callRate || ""}
              disabled={!isMethodNameSelected}
              className={`${methodControlClass} ${!isMethodNameSelected ? disabledControlClass : ""}`}
              onChange={(e) => {
                if (!newMethod) return;
                const callRate = parseFloat(e.target.value) || 0;
                setNewMethod({
                  ...newMethod,
                  callRate,
                });
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="mb" className="text-xs text-foreground/80">
              MB
            </label>
            <input
              id="mb"
              type="number"
              min="0"
              step="any"
              value={newMethod?.mb ?? ""}
              disabled={!isMethodNameSelected || !isPerMbMethod}
              className={`${methodControlClass} ${
                !isMethodNameSelected || !isPerMbMethod ? disabledControlClass : ""
              }`}
              onChange={(e) => {
                if (!newMethod) return;
                const mb = parseFloat(e.target.value) || 0;
                setNewMethod({
                  ...newMethod,
                  mb,
                });
              }}
            />
          </div>

          <div className="xl:col-span-6 flex justify-end">
            <button
              disabled={!canAddMethod}
              className={`bg-primary text-white rounded px-4 h-9 w-full text-sm ${
                canAddMethod ? "cursor-pointer" : disabledControlClass
              }`}
              onClick={() => {
                if (!newMethod || !canAddMethod) return;
                setSelectedMethods((prev) => [...prev, newMethod]);
                setNewMethod(null);
              }}
            >
              Add Method
            </button>
          </div>
        </div>
      </div>

      {selectedMethods.length === 0 && (
        <div className="text-center text-foreground/20 italic">
          No methods selected. Please add methods to see cost calculations.
        </div>
      )}

      {selectedMethods.length > 0 && (
        <div className="border border-border rounded p-4 shadow-md mb-8">
          <span className="text-lg font-semibold text-primary">Selected Methods</span>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Credits/Call</th>
                  <th className="py-2 pr-3">Calls</th>
                  <th className="py-2 pr-3">Frequency</th>
                  <th className="py-2 pr-3">MB</th>
                  <th className="py-2 pr-3">Credits/Day</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedMethods.map((method, index) => (
                  <tr key={`${method.methodType}-${method.methodName}-${index}`} className="border-b border-border/60">
                    <td className="py-2 pr-3">{method.methodType}</td>
                    <td className="py-2 pr-3">{method.methodName}</td>
                    <td className="py-2 pr-3">{formatCredits(getMethodCreditsPerCall(method))}</td>
                    <td className="py-2 pr-3">{formatCredits(method.callRate)}</td>
                    <td className="py-2 pr-3">
                      {method.callFrequency === "minute" ? "Per Minute" : "Per Day"}
                    </td>
                    <td className="py-2 pr-3">{method.isPerMB ? formatCredits(method.mb ?? 0) : "-"}</td>
                    <td className="py-2 pr-3">{formatCredits(getMethodCreditsPerDay(method))}</td>
                    <td className="py-2">
                      <button
                        className="border border-border rounded px-2 py-1"
                        onClick={() => {
                          setSelectedMethods((prev) => prev.filter((_, i) => i !== index));
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <span className="text-lg font-semibold text-primary">Total Cost of Selected Methods</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 text-sm">
              <div>Per minute: <span className="font-mono text-primary">{formatCredits(totalCosts.perMinute)}</span> credits</div>
              <div>Per hour: <span className="font-mono text-primary">{formatCredits(totalCosts.perHour)}</span> credits</div>
              <div>Per day: <span className="font-mono text-primary">{formatCredits(totalCosts.perDay)}</span> credits</div>
              <div>Per week: <span className="font-mono text-primary">{formatCredits(totalCosts.perWeek)}</span> credits</div>
              <div>Per month: <span className="font-mono text-primary">{formatCredits(totalCosts.perMonth)}</span> credits</div>
              <div>Per year: <span className="font-mono text-primary">{formatCredits(totalCosts.perYear)}</span> credits</div>
            </div>
            <div className="mt-3 text-sm">
              Overall Monthly Cost (USD): <span className="font-mono text-primary">{selectedPlanCostDisplay}</span>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <span className="text-lg font-semibold text-primary">Selected Plan Coverage (Monthly)</span>
            <div className="flex flex-col gap-2 mt-3 text-sm">
              <div>Selected plan: {selectedPlan.name}</div>
              <div>Monthly credits needed: <span className="font-mono text-primary">{formatCredits(monthlyCreditsNeeded)}</span></div>
              <div>
                Plan monthly credits:{" "}
                {selectedPlan.monthly_credits !== null
                  ? <span className="font-mono text-primary">{formatCredits(selectedPlan.monthly_credits)}</span>
                  : "Custom / Contact sales"}
              </div>
              <div>
                Enough credits this month:{" "}
                {hasEnoughMonthlyCredits ? (
                  <LucideCheck className="w-4 h-4 inline text-success" aria-label="Enough credits" />
                ) : isMonthlyCreditsShort ? (
                  <LucideX className="w-4 h-4 inline text-error" aria-label="Not enough credits" />
                ) : (
                  "N/A"
                )}
              </div>
              <div>
                Remaining credits:{" "}
                <span
                  className={
                    hasEnoughMonthlyCredits
                      ? "text-success font-mono"
                      : isMonthlyCreditsShort
                        ? "text-error font-mono"
                        : "text-foreground font-mono"
                  }
                >
                  {remainingCredits !== null ? formatCredits(remainingCredits) : "N/A (custom plan)"}
                </span>{" "}
                {recommendationText && <span>{recommendationText}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
