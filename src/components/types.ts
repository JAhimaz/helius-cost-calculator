import { Price } from "@/lib/Pricing";

export type CallFrequency = "minute" | "day";

export type SelectedMethod = {
  // Dynamically get the keys of Method and MethodPerMB
  methodType: keyof Price["credit_costs"];
  methodName: string;
  methodCost: number;
  // If MethodPerMB, include mb fields
  isPerMB: boolean;
  mb?: number;
  mbUnit?: number;
  callRate: number;
  callFrequency: CallFrequency;
};
