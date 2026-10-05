import {
  Client
} from "@modelcontextprotocol/sdk/client/index.js";

import {
  StreamableHTTPClientTransport
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({
  name: "oddwood-unpaid-test-client",
  version: "1.0.0"
});

const transport =
  new StreamableHTTPClientTransport(
    new URL("http://localhost:3001/mcp")
  );

try {
  console.log("Connecting to paid MCP server...");

  await client.connect(transport);

  console.log("PASS - Connected");

  const tools =
    await client.listTools();

  console.log("PASS - Tool list received");

  console.log(
    "Available tools:",
    tools.tools.map(tool => tool.name)
  );

  console.log(
    "\nCalling analyze_barcode WITHOUT payment..."
  );

  const result =
    await client.callTool({
      name: "analyze_barcode",
      arguments: {
        barcode: "036000291452"
      }
    });

  console.log("\nServer response:");
  console.dir(result, {
    depth: null
  });

  await client.close();

} catch (error) {

  console.log(
    "\nServer rejected unpaid call:"
  );

  console.dir(error, {
    depth: null
  });

  try {
    await client.close();
  } catch {
    // Ignore close errors.
  }
}
