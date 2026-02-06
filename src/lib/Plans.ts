export type Plan = {
  id: number;
  name: string;
  price_per_month_usd: number | null;
  monthly_credits: number | null;
  rate_limits: {
    rpc_requests_per_second: number | null;
    send_transactions_per_second: number | null;
    das_requests_per_second: number | null;
  };
  included_features: {
    staked_connections: boolean;
    laserstream_devnet_access: boolean;
    laserstream_mainnet_access: boolean;
    enhanced_websockets: boolean;
    support_level: string;
  };
  additional_credits_cost_per_million_usd: number | null;
  notes?: string;
};


export const Plans: Plan[] = [
  {
      "id": 0,
      "name": "Free",
      "price_per_month_usd": 0,
      "monthly_credits": 1000000,
      "rate_limits": {
        "rpc_requests_per_second": 10,
        "send_transactions_per_second": 1,
        "das_requests_per_second": 2
      },
      "included_features": {
        "staked_connections": false,
        "laserstream_devnet_access": false,
        "laserstream_mainnet_access": false,
        "enhanced_websockets": false,
        "support_level": "Community"
      },
      "additional_credits_cost_per_million_usd": null
    },
    {
      "id": 1,
      "name": "Developer",
      "price_per_month_usd": 49,
      "monthly_credits": 10000000,
      "rate_limits": {
        "rpc_requests_per_second": 50,
        "send_transactions_per_second": 5,
        "das_requests_per_second": 10
      },
      "included_features": {
        "staked_connections": true,
        "laserstream_devnet_access": true,
        "laserstream_mainnet_access": false,
        "enhanced_websockets": false,
        "support_level": "Chat"
      },
      "additional_credits_cost_per_million_usd": 5
    },
    {
      "id": 2,
      "name": "Business",
      "price_per_month_usd": 499,
      "monthly_credits": 100000000,
      "rate_limits": {
        "rpc_requests_per_second": 200,
        "send_transactions_per_second": 50,
        "das_requests_per_second": 50
      },
      "included_features": {
        "staked_connections": true,
        "laserstream_devnet_access": true,
        "laserstream_mainnet_access": false,
        "enhanced_websockets": true,
        "support_level": "Priority Chat"
      },
      "additional_credits_cost_per_million_usd": 5
    },
    {
      "id": 3,
      "name": "Professional",
      "price_per_month_usd": 999,
      "monthly_credits": 200000000,
      "rate_limits": {
        "rpc_requests_per_second": 500,
        "send_transactions_per_second": 100,
        "das_requests_per_second": 100
      },
      "included_features": {
        "staked_connections": true,
        "laserstream_devnet_access": true,
        "laserstream_mainnet_access": true,
        "enhanced_websockets": true,
        "support_level": "Slack & Telegram"
      },
      "additional_credits_cost_per_million_usd": 5
    },
    {
      "id": 4,
      "name": "Enterprise",
      "price_per_month_usd": null,
      "monthly_credits": null,
      "rate_limits": {
        "rpc_requests_per_second": null,
        "send_transactions_per_second": null,
        "das_requests_per_second": null
      },
      "included_features": {
        "staked_connections": true,
        "laserstream_devnet_access": true,
        "laserstream_mainnet_access": true,
        "enhanced_websockets": true,
        "support_level": "Custom SLA"
      },
      "additional_credits_cost_per_million_usd": null,
      "notes": "Contact sales for custom pricing"
    }
  ];