# OpenAI Realtime API Tools Guide

## Key Discovery: Proper Function/Tool Result Flow

We discovered that sending function (tool) results to the OpenAI Realtime API requires a specific flow:

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
  // Parse arguments from the tool call
  const args = JSON.parse(toolCall.arguments || '{}');
  
  // Get results from toolResult
  let results = null;
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
      <h3 className="text-md font-semibold">My Tool: {args.param1}</h3>
      
      {isLoading ? (
        <div className="text-sm text-secondary-500 animate-pulse">Loading results...</div>
      ) : results ? (
        <div className="bg-secondary-50 dark:bg-dark-surface-alt p-3 rounded">
          {/* Display your results here */}
          <pre className="text-sm overflow-auto">{JSON.stringify(results, null, 2)}</pre>
        </div>
      ) : (
        <div className="text-sm text-secondary-500">No results available</div>
      )}
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

## Universal Webhook Tool

If you need to integrate with external services without creating custom tools for each one, consider using the webhook_call tool with the WebhookManager. This allows end-users to configure API endpoints without code changes.

See the [WebhookManager section](#webhook-manager-component) for details.

---

The rest of this documentation covers additional details on the message flow, error handling, and other components of the system.

[original content continues below...]