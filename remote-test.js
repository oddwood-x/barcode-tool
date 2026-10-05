import {
  Client
} from "@modelcontextprotocol/sdk/client/index.js";

import {
  StreamableHTTPClientTransport
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({
  name: "oddwood-remote-test-client",
  version: "1.0.0"
});

const transport =
  new StreamableHTTPClientTransport(
    new URL("http://localhost:3000/mcp")
  );

try {
  console.log("Connecting to remote MCP server...");

  await client.connect(transport);

  console.log("PASS - Connected");

  const tools =
    await client.listTools();

  console.log(
    "PASS - Tool list received"
  );

  console.log(
    "Available tools:",
    tools.tools.map(tool => tool.name)
  );

  const result =
    await client.callTool({
      name: "analyze_barcode",
      arguments: {
        barcode: "036000291452"
      }
    });

  console.log(
    "PASS - analyze_barcode executed"
  );

  console.log(
    "Tool result:"
  );

  console.log(
    result.content[0].text
  );

  await client.close();

  console.log(
    "PASS - Connection closed"
  );
} catch (error) {
  console.error(
    "FAIL - Remote MCP test failed"
  );

  console.error(error);

  process.exitCode = 1;
}