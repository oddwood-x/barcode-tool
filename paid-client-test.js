import dotenv from "dotenv";

dotenv.config({
  path: ".env.test"
});

import {
  createx402MCPClient
} from "@x402/mcp";

import {
  ExactEvmScheme
} from "@x402/evm/exact/client";

import {
  StreamableHTTPClientTransport
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import {
  privateKeyToAccount
} from "viem/accounts";


const privateKey =
  process.env.TEST_PRIVATE_KEY;

if (!privateKey) {
  throw new Error(
    "TEST_PRIVATE_KEY is missing from .env.test"
  );
}


const account =
  privateKeyToAccount(privateKey);


console.log(
  "Paying test wallet:",
  account.address
);


const client =
  createx402MCPClient({
    name: "oddwood-paying-test-client",

    version: "1.0.0",

    schemes: [
      {
        network: "eip155:84532",

        client:
          new ExactEvmScheme(account)
      }
    ],

    autoPayment: true,

    onPaymentRequested:
      async ({
        paymentRequired
      }) => {

        const requirement =
          paymentRequired.accepts[0];

        console.log(
          "\nPayment requested:"
        );

        console.log(
          "Network:",
          requirement.network
        );

        console.log(
          "Amount:",
          requirement.amount
        );

        console.log(
          "Asset:",
          requirement.asset
        );

        console.log(
          "Pay to:",
          requirement.payTo
        );

        console.log(
          "Approving test payment..."
        );

        return true;
      }
  });


const transport =
  new StreamableHTTPClientTransport(
    new URL(
      "http://localhost:3001/mcp"
    )
  );


try {

  console.log(
    "\nConnecting to paid MCP server..."
  );


  await client.connect(
    transport
  );


  console.log(
    "PASS - Connected"
  );


  const tools =
    await client.listTools();


  console.log(
    "PASS - Tool list received"
  );


  console.log(
    "Available tools:",
    tools.tools.map(
      tool => tool.name
    )
  );


  console.log(
    "\nCalling analyze_barcode..."
  );


  const result =
    await client.callTool(
      "analyze_barcode",
      {
        barcode:
          "036000291452"
      }
    );


  console.log(
    "\nTool response:"
  );


  console.dir(
    result,
    {
      depth: null
    }
  );


  if (
    result.paymentMade === true
  ) {

    console.log(
      "\nPASS - x402 payment made"
    );

    if (
      result.paymentResponse
        ?.transaction
    ) {

      console.log(
        "Transaction:",
        result.paymentResponse
          .transaction
      );
    }

  } else {

    console.log(
      "\nWARNING - No paymentMade flag returned"
    );
  }


  console.log(
    "\nPASS - Paid tool call completed"
  );


  await client.close();


} catch (error) {

  console.error(
    "\nFAIL - Paid MCP test failed"
  );

  console.error(error);

  try {
    await client.close();
  } catch {
    // Ignore close errors.
  }

  process.exitCode = 1;
}
