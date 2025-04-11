# OpenAI Realtime API Tools Guide

## Key Discovery: Proper Function/Tool Result Flow

Sending function (tool) results to the OpenAI Realtime API requires a specific flow:

1. First, send the function result using `conversation.item.create`
2. Then trigger the model to continue with `response.create`

This is different from some other OpenAI APIs where you might send a single response with the tool result.

### Correct Implementation

```javascript
const sendResult = (resultData, callId) => {
  // First, send the function result using conversation.item.create
  sendClientEvent({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: resultData.content  // Should be a JSON string
    }
  });
  
  // Then trigger the model to continue with response.create
  sendClientEvent({
    type: "response.create"
  });
};
```

❌ **Incorrect approach** (which was initially used):

```javascript
sendClientEvent({ type: "tool.result", call_id: callId, result: resultData });
```

## Modular Tool System (New Feature)

The application now supports a fully modular tool system where tools can be dynamically enabled or disabled based on environment variables. This means you can:

1. Define tools in the codebase that require specific API keys or services
2. Enable/disable these tools simply by setting environment variables
3. The AI will only see tools that are properly configured

### How It Works

- Each tool specifies which environment variables it requires
- The server reports which environment variables are available (without exposing values)
- The client filters tools based on these requirements
- The AI only receives definitions for enabled tools

## How to Add a New Tool

Adding a new tool is now simplified with the modular system. Follow these steps:

### 1. Define Your Tool in `client/lib/tools.js`

Look for the tools section and add your tool:

```javascript
// --- Tool Definitions and Configuration ---

export const tools = {
  // Existing tools...
  
  // === NEW TOOL TEMPLATE 1 ===
  my_new_tool: {
    // Definition sent to the AI
    definition: {
      type: "function",
      name: "my_new_tool", // Must match the key above
      description: "Description of what the tool does. Be specific about when the AI should use it.",
      parameters: {
        type: "object",
        strict: true,
        properties: {
          param1: {
            type: "string",
            description: "Description of parameter 1",
          },
          param2: {
            type: "number",
            description: "Description of parameter 2",
          },
          // Add more parameters as needed
        },
        required: ["param1"],  // List required parameters
      },
    },
    // Execution logic
    execute: async (args) => {
      try {
        // Implement your tool's functionality here
        console.log("Executing my_new_tool with args:", args);
        
        // For example, call an API or process data
        // const result = await someAsyncFunction(args);
        
        // Return result as JSON string in the content field
        return { 
          status: 'success', 
          content: JSON.stringify({ 
            result: "Your result data here"
          }) 
        }; 
      } catch (error) {
        console.error("Tool execution failed:", error);
        return {
          status: 'error',
          content: JSON.stringify({ error: error.message || "Tool execution failed" })
        };
      }
    },
    // Name of the React component used to render the output
    OutputComponent: 'MyNewToolOutput', 
    
    // IMPORTANT: Specify which environment variables this tool requires
    // The tool will only be enabled if ALL required env vars are set
    requiredEnvVars: ['MY_TOOL_API_KEY'], 
  },

  // === NEW TOOL TEMPLATE 2 ===
  another_tool: {
    definition: {
      type: "function",
      name: "another_tool",
      description: "Description of another tool the AI can use.",
      parameters: {
        type: "object",
        strict: true,
        properties: {
          // Your parameters here
        },
        required: [],
      },
    },
    execute: async (args) => {
      // Implementation
    },
    OutputComponent: 'AnotherToolOutput',
    requiredEnvVars: ['ANOTHER_SERVICE_API_KEY'],
  },

  // Add more tools here...
};
```

### 2. Create an Output Component in `client/components/ToolPanel.jsx`

Add a React component to display your tool's results. Find the OutputComponents section and add your component:

```javascript
// --- Tool Output Components (Should match keys in tool registry's OutputComponent) ---

// Existing components...

function MyNewToolOutput({ toolCall, toolResult, isLoading }) {
  // Include useState for the raw JSON toggle
  const [showRawJson, setShowRawJson] = useState(false);
  
  // Parse arguments from the tool call
  const args = JSON.parse(toolCall.arguments || '{}');
  
  // Get results from toolResult
  let results = null;
  
  // Store the raw JSON for the toggle view
  const rawJsonData = toolResult ? (
    typeof toolResult.data === 'string' 
      ? toolResult.data 
      : JSON.stringify(toolResult.data, null, 2)
  ) : '';
  
  if (toolResult && !isLoading) {
    try {
      if (typeof toolResult.data === 'string') {
        results = JSON.parse(toolResult.data);
      } else {
        results = toolResult.data;
      }
    } catch (error) {
      console.error("Error parsing tool results:", error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold">My Tool: {args.param1}</h3>
        
        {/* Add a toggle button for showing raw JSON data */}
        {toolResult && !isLoading && (
          <button 
            className="text-xs px-2 py-0.5 bg-secondary-100 dark:bg-dark-surface hover:bg-secondary-200 dark:hover:bg-dark-hover rounded"
            onClick={() => setShowRawJson(!showRawJson)}
          >
            {showRawJson ? 'Hide Raw' : 'Show Raw'}
          </button>
        )}
      </div>
      
      {isLoading ? (
        <div className="text-sm text-secondary-500 animate-pulse">Loading results...</div>
      ) : !showRawJson && results ? (
        <div className="bg-secondary-50 dark:bg-dark-surface-alt p-3 rounded">
          {/* Display your formatted results here */}
          <pre className="text-sm overflow-auto">{JSON.stringify(results, null, 2)}</pre>
        </div>
      ) : null}
      
      {/* Raw JSON display */}
      {showRawJson && toolResult && (
        <div className="rounded border border-secondary-200 dark:border-dark-border bg-gray-50 dark:bg-gray-900 p-2 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap">
          <div className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 mb-1">Raw Response:</div>
          {rawJsonData}
        </div>
      )}
      
      {/* Always include a View arguments section */}
      <details className="text-xs text-secondary-500 dark:text-dark-text-secondary mt-2">
        <summary className="cursor-pointer">View arguments</summary>
        <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded overflow-x-auto">
          {JSON.stringify(toolCall?.arguments ? JSON.parse(toolCall.arguments) : {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function AnotherToolOutput({ toolCall, toolResult, isLoading }) {
  // Your render logic here
}

// Add your components to the OutputComponents map
const OutputComponents = {
  // Existing components...
  ColorPaletteOutput,
  WebSearchResultsOutput,
  WebhookResultOutput,
  ErrorOutput,
  
  // Add your new components here
  MyNewToolOutput,
  AnotherToolOutput,
  // ... more components
};
```

### 3. Configure Environment Variables

For your tool to be enabled, you need to set the required environment variables:

1. Add your variables to the `.env` file:
   ```
   # Existing variables
   OPENAI_API_KEY=your_openai_key
   
   # New tool variables
   MY_TOOL_API_KEY=your_api_key_here
   ANOTHER_SERVICE_API_KEY=another_service_key
   ```

2. Update the server configuration endpoint in `server.js` to expose your variable (without its value):
   ```javascript
   app.get('/api/config', (req, res) => {
     res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
     res.setHeader('Pragma', 'no-cache');
     
     const availableEnvVars = {
       SEARXNG_URL: !!process.env.SEARXNG_URL,
       
       // Add your new environment variables here
       MY_TOOL_API_KEY: !!process.env.MY_TOOL_API_KEY,
       ANOTHER_SERVICE_API_KEY: !!process.env.ANOTHER_SERVICE_API_KEY,
     };
     
     res.json({ availableEnvVars });
   });
   ```

### 4. Test Your Tool

1. Set the required environment variables in your `.env` file
2. Restart the server
3. Start a new session
4. Ask the AI to use your tool
5. If your tool is properly configured, it will appear in the list of enabled tools

### 5. Enabling/Disabling Tools

- **To enable a tool**: Set all its required environment variables in your `.env` file
- **To disable a tool**: Comment out or remove the required environment variables
- The system will automatically detect changes and update the AI's available tools

## Tool Requirements

### Tools Without Environment Variables

If your tool doesn't require any API keys or external services, set `requiredEnvVars` to an empty array:

```javascript
requiredEnvVars: [], // This tool will always be enabled
```

### Tools With Multiple Requirements

If your tool needs multiple environment variables, list them all:

```javascript
requiredEnvVars: ['SERVICE_API_KEY', 'SERVICE_REGION', 'SERVICE_ACCOUNT_ID'],
```

The tool will only be enabled if ALL required variables are set.

## Example: Weather API Tool

Here's a complete example of adding a weather API tool:

```javascript
// In client/lib/tools.js
weather: {
  definition: {
    type: "function",
    name: "weather",
    description: "Get the current weather for a location",
    parameters: {
      type: "object",
      strict: true,
      properties: {
        location: {
          type: "string",
          description: "The city and state/country",
        },
      },
      required: ["location"],
    },
  },
  execute: async (args) => {
    try {
      const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${args.location}`);
      if (!response.ok) throw new Error(`Weather API error: ${response.statusText}`);
      const data = await response.json();
      return { 
        status: 'success', 
        content: JSON.stringify(data) 
      };
    } catch (error) {
      return {
        status: 'error',
        content: JSON.stringify({ error: error.message })
      };
    }
  },
  OutputComponent: 'WeatherOutput',
  requiredEnvVars: ['WEATHER_API_KEY'],
},

// In client/components/ToolPanel.jsx
function WeatherOutput({ toolCall, toolResult, isLoading }) {
  const { location } = JSON.parse(toolCall.arguments || '{}');
  // Parse results and render them...
}

// Add to OutputComponents
const OutputComponents = {
  // ...existing components
  WeatherOutput,
};

// In .env file
WEATHER_API_KEY=your_weather_api_key_here

// In server.js
app.get('/api/config', (req, res) => {
  // ...
  const availableEnvVars = {
    // ...other vars
    WEATHER_API_KEY: !!process.env.WEATHER_API_KEY,
  };
  // ...
});
```

## Standardized UI Features for Tool Outputs

To maintain a consistent user experience across all tools, your tool output components should implement the following UI features:

### 1. Raw JSON Toggle

All tool outputs should include a toggle button to show the raw response data. This is essential for debugging and helps users understand exactly what data was returned.

```javascript
function MyToolOutput({ toolCall, toolResult, isLoading }) {
  // Add state for the raw toggle
  const [showRawJson, setShowRawJson] = useState(false);
  
  // Store the raw data for display
  const rawJsonData = toolResult ? (
    typeof toolResult.data === 'string' 
      ? toolResult.data 
      : JSON.stringify(toolResult.data, null, 2)
  ) : '';
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold">Tool Name</h3>
        
        {/* Raw JSON toggle button */}
        {toolResult && !isLoading && (
          <button 
            className="text-xs px-2 py-0.5 bg-secondary-100 dark:bg-dark-surface hover:bg-secondary-200 dark:hover:bg-dark-hover rounded"
            onClick={() => setShowRawJson(!showRawJson)}
          >
            {showRawJson ? 'Hide Raw' : 'Show Raw'}
          </button>
        )}
      </div>
      
      {/* Conditional rendering based on toggle state */}
      {!showRawJson ? (
        /* Formatted output */
      ) : (
        <div className="rounded border border-secondary-200 dark:border-dark-border bg-gray-50 dark:bg-gray-900 p-2 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap">
          <div className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 mb-1">Raw Response:</div>
          {rawJsonData}
        </div>
      )}
    </div>
  );
}
```

### 2. View Arguments Section

All tool outputs should include a collapsible "View arguments" section that displays the exact arguments the AI passed to the tool. This helps with debugging and understanding the AI's intent.

```javascript
{/* View arguments section */}
<details className="text-xs text-secondary-500 dark:text-dark-text-secondary mt-2">
  <summary className="cursor-pointer">View arguments</summary>
  <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded overflow-x-auto">
    {JSON.stringify(toolCall?.arguments ? JSON.parse(toolCall.arguments) : {}, null, 2)}
  </pre>
</details>
```

### 3. Loading State

All tool outputs should handle the loading state gracefully, showing an appropriate loading indicator:

```javascript
{isLoading ? (
  <div className="text-sm text-secondary-500 animate-pulse">
    Loading results...
  </div>
) : (
  /* Your actual output */
)}
```

### 4. Method & Endpoint Display (For API/Webhook Tools)

For tools that call external APIs or webhooks, display the method and endpoint information:

```javascript
<div className="text-xs text-secondary-500 dark:text-dark-text-secondary">
  {method} request to {endpoint}
</div>
```

### 5. Error Handling

Make sure your component can gracefully handle and display errors:

```javascript
if (error) {
  return (
    <div className="py-2 px-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded text-sm text-red-600 dark:text-red-400">
      <div className="font-medium">Error: {error.message}</div>
      {error.details && <div className="mt-1 whitespace-pre-wrap">{error.details}</div>}
    </div>
  );
}
```

## Universal Webhook Tool

If you need to integrate with external services without creating custom tools for each one, consider using the webhook_call tool with the WebhookManager. This allows end-users to configure API endpoints without code changes.

See the [WebhookManager section](#webhook-manager-component) for details.

---

The rest of this documentation covers additional details on the message flow, error handling, and other components of the system.