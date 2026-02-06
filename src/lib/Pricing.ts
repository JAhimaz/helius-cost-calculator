export type Method = {
  [method: string]: number;
}

export type MethodPerMB = {
  [method: string]: {
    cost_per_mb: number;
    mb: number;
  };
}

export type Price = {
  credit_costs: {
    rpc_calls: Method;
    das_api_calls: Method;
    webhook_calls: Method;
    zk_compression_api_calls: Method;
    transaction_submission: Method;
    data_streaming: MethodPerMB
  };
  notes: {
    rpc_calls_exceptions: {
      [note: string]: string;
    };
    streaming_billing: {
      [note: string]: string;
    };
    webhook_usage: string;
  };
};

export const Pricing: Price =
  {
  "credit_costs": {
    "rpc_calls": {
      "getBlock": 10,
      "getBlocks": 10,
      "getBlocksWithLimit": 10,
      "getSignaturesForAddress": 10,
      "getTransactionsForAddress": 100,
      "getBlockTime": 10,
      "getTransaction": 10,
      "getInflationReward": 10,
      "archival_methods_general": 10,
      "getProgramAccounts": 10,
      "getMultipleAccounts": 10,
      "getProgramAccountsV2": 1,
      "Standard RPC methods": 1
    },
    "das_api_calls": {
      "getAsset": 10,
      "getAssetProof": 10,
      "getAssetProofBatch": 10,
      "getNftEditions": 10,
      "getAssetsByOwner": 10,
      "getAssetsByAuthority": 10,
      "getAssetsByCreator": 10,
      "getAssetsByGroup": 10,
      "searchAssets": 10,
      "getAssetBatch": 10,
      "getSignaturesForAsset": 10,
      "getTokenAccounts": 10
    },
    "webhook_calls": {
      "webhook_event_sent": 1,
      "webhook_management_actions": 100
    },
    "zk_compression_api_calls": {
      "standard_zk_compression": 10,
      "getValidityProof": 100
    },
    "transaction_submission": {
      "sendTransaction_sender_service": 0,
      "sendTransaction_staked_connection": 1
    },
    "data_streaming": {
      "laserstream_or_enhanced_websocket_data": {
        "cost_per_mb": 3,
        "mb": 0.1
      }
    }
  },
  "notes": {
    "rpc_calls_exceptions": {
      "getTransactionsForAddress": "Costs higher (100 credits) than other RPC methods",
      "batch_or_combined_calls": "Each individual request inside the batch counts toward credits"
    },
    "streaming_billing": {
      "data_streaming_rate": "Data measured in uncompressed MB; costs apply to LaserStream and Enhanced WebSockets usage"
    },
    "webhook_usage": "Events are charged on delivery regardless of endpoint success"
  }
}