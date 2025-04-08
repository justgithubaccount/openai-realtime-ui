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

## How to Create a New Tool

Adding a new tool to the application involves these steps:

1. Define the tool in `client/lib/tools.js`
2. Create an output component in `client/components/ToolPanel.jsx`
3. Ensure proper result handling

### 1. Define the Tool in tools.js

Add your tool definition to the `tools` object in `client/lib/tools.js`:

```javascript
export const tools = {
  // Existing tools...
  
  my_new_tool: {
    // Definition sent to the AI
    definition: {
      type: "function",
      name: "my_new_tool",
      description: "Description of what the tool does.",
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
        const result = await someAsyncFunction(args);
        
        // Return result as JSON string in the content field
        return { 
          status: 'success', 
          content: JSON.stringify(result) 
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
  },
};
```

### 2. Create an Output Component in ToolPanel.jsx

Add a React component to display your tool's results:

```javascript
function MyNewToolOutput({ toolCall, toolResult, isLoading }) {
  // Parse arguments from the tool call
  const args = JSON.parse(toolCall.arguments || '{}');
  
  // Get results from toolResult
  let results = null;
  if (toolResult) {
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
        <div>Loading...</div>
      ) : results ? (
        <div>
          {/* Display your results here */}
          <pre>{JSON.stringify(results, null, 2)}</pre>
        </div>
      ) : (
        <div>No results available</div>
      )}
    </div>
  );
}

// Add your component to the OutputComponents map
const OutputComponents = {
  // Existing components...
  MyNewToolOutput,
};
```

### 3. Test Your Tool

1. Start the application 
2. Begin a session with the AI model
3. Ask the AI to use your tool
4. Check the console logs to debug any issues

## Common Issues and Solutions

- **Tool not being recognized**: Make sure the tool name in `definition` matches the key in the `tools` object
- **Results not displaying**: Check that your output component is correctly registered in `OutputComponents`
- **Search results not properly parsed**: Make sure you're handling different data formats (string, array, object)
- **Session ending after tool call**: Ensure you're sending both `conversation.item.create` and `response.create` events

## Example: Implementing a Weather Tool

```javascript
// In tools.js
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
      const weather = await fetchWeatherData(args.location);
      return { 
        status: 'success', 
        content: JSON.stringify(weather) 
      };
    } catch (error) {
      return {
        status: 'error',
        content: JSON.stringify({ error: error.message })
      };
    }
  },
  OutputComponent: 'WeatherOutput',
},

// In ToolPanel.jsx
function WeatherOutput({ toolCall, toolResult, isLoading }) {
  const { location } = JSON.parse(toolCall.arguments || '{}');
  // Parse results and render them...
}
```

## Universal Webhook Tool Implementation

The application now includes a full-featured webhook manager that allows users to configure custom webhooks for the AI to use. This makes the application much more versatile without requiring custom tool development for each integration.

### 1. Webhook Tool Definition in tools.js

```javascript
// In tools.js
webhook_call: {
  // Definition sent to the AI
  definition: {
    type: "function",
    name: "webhook_call",
    description: "Make a call to a user-configured webhook endpoint to trigger actions or retrieve information from external services. IMPORTANT: For POST requests, you MUST include a payload object with all required fields described in the endpoint's description.",
    parameters: {
      type: "object",
      strict: true,
      properties: {
        method: {
          type: "string",
          description: "HTTP method to use for the request. Note: Some endpoints require specific methods regardless of what you specify here.",
          enum: ["GET", "POST"]
        },
        payload: {
          type: "object",
          description: "JSON payload to send with the request (REQUIRED for POST requests). For search endpoints, this MUST include a 'query' field with the specific search term.",
        },
        endpoint_key: {
          type: "string",
          description: "Key name of the saved endpoint to use. Must match one of the available endpoints.",
        }
      },
      required: ["endpoint_key"],
    },
  },
  // Execution logic
  execute: async (args) => {
    try {
      // Get endpoints from localStorage
      const savedEndpoints = JSON.parse(localStorage.getItem('webhookEndpoints') || '{}');
      
      // Check if endpoint key exists exactly as provided first
      let endpointConfig = savedEndpoints[args.endpoint_key];
      let matchingKey = args.endpoint_key;
      
      // If not found with exact key, try normalized versions (like removing underscores)
      if (!endpointConfig) {
        const normalizedKey = args.endpoint_key.replace(/_/g, '-').toLowerCase();
        matchingKey = Object.keys(savedEndpoints).find(key => 
          key.toLowerCase().replace(/_/g, '-') === normalizedKey
        );
        
        if (matchingKey) {
          endpointConfig = savedEndpoints[matchingKey];
        }
      }
      
      if (!endpointConfig) {
        // Return a helpful error message with available endpoints
        const availableEndpoints = Object.keys(savedEndpoints).join(', ');
        throw new Error(`Endpoint "${args.endpoint_key}" not found. Available endpoints: ${availableEndpoints || 'None'}`);
      }
      
      // Handle both old format (string URL) and new format (object with URL, method, etc.)
      const url = typeof endpointConfig === 'string' ? endpointConfig : endpointConfig.url;
      const apiKey = typeof endpointConfig === 'object' ? endpointConfig.apiKey : null;
      const requiredMethod = typeof endpointConfig === 'object' && endpointConfig.method ? endpointConfig.method : 'ANY';
      const description = typeof endpointConfig === 'object' ? endpointConfig.description : '';
      
      // Determine which HTTP method to use
      let actualMethod;
      if (requiredMethod !== 'ANY') {
        // If endpoint has a required method, use it
        actualMethod = requiredMethod;
      } else if (args.method) {
        // If caller specified a method and endpoint supports any method, use caller's method
        actualMethod = args.method.toUpperCase();
      } else {
        // Default to POST if payload is provided, otherwise GET
        actualMethod = args.payload ? 'POST' : 'GET';
      }
      
      // For POST endpoints, ensure there's a payload
      if (actualMethod === 'POST' && !args.payload) {
        // For search endpoints, try to extract query from args
        if (matchingKey.toLowerCase().includes('search') && args.query) {
          args.payload = { query: args.query };
        } else {
          throw new Error(`POST request to "${matchingKey}" requires a payload. ${description || ''}`);
        }
      }
      
      console.log(`Making ${actualMethod} request to ${matchingKey}`);
      
      // Prepare the request options
      const options = {
        method: actualMethod,
        headers: { 'Content-Type': 'application/json' },
      };
      
      // Apply authentication based on method
      const authMethod = endpointConfig.authMethod || 'none';
      switch (authMethod) {
        case 'apiKey':
          if (endpointConfig.apiKey) {
            const headerName = endpointConfig.apiKeyHeaderName || 'X-API-Key';
            options.headers[headerName] = endpointConfig.apiKey;
            console.log(`Using API Key authentication with header: ${headerName}`);
          }
          break;
        
        case 'basicAuth':
          if (endpointConfig.username) {
            const credentials = btoa(`${endpointConfig.username}:${endpointConfig.password || ''}`);
            options.headers['Authorization'] = `Basic ${credentials}`;
            console.log('Using Basic Authentication');
          }
          break;
        
        case 'bearerToken':
          if (endpointConfig.bearerToken) {
            options.headers['Authorization'] = `Bearer ${endpointConfig.bearerToken}`;
            console.log('Using Bearer Token authentication');
          }
          break;
        
        case 'customHeader':
          if (endpointConfig.customHeaderName && endpointConfig.customHeaderValue) {
            options.headers[endpointConfig.customHeaderName] = endpointConfig.customHeaderValue;
            console.log(`Using Custom Header authentication: ${endpointConfig.customHeaderName}`);
          }
          break;
        
        case 'none':
        default:
          console.log('No authentication used');
          break;
      }
      
      // Add payload for POST requests
      if (actualMethod === 'POST' && args.payload) {
        options.body = JSON.stringify(args.payload);
      }
      
      // For GET requests with payload, append as query parameters
      let finalUrl = url;
      if (actualMethod === 'GET' && args.payload) {
        const params = new URLSearchParams();
        Object.entries(args.payload).forEach(([key, value]) => {
          params.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
        finalUrl = `${url}?${params.toString()}`;
      }
      
      // Make the request
      const response = await fetch(finalUrl, options);
      
      if (!response.ok) {
        throw new Error(`Webhook request failed with status: ${response.status}`);
      }
      
      // Parse the response based on content type
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      // Return success with metadata
      return { 
        status: 'success', 
        content: JSON.stringify({
          endpoint: matchingKey,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          data: data,
          endpoint_description: description || "No description available",
        })
      };
    } catch (error) {
      console.error("Webhook tool failed:", error.message);
      return {
        status: 'error',
        content: JSON.stringify({ 
          error: error.message,
          available_endpoints: Object.keys(JSON.parse(localStorage.getItem('webhookEndpoints') || '{}'))
        })
      };
    }
  },
  // React component used to render the output
  OutputComponent: 'WebhookResultOutput', 
},
```

### 2. WebhookResultOutput Component

```javascript
function WebhookResultOutput({ toolCall, toolResult }) {
  const { endpoint_key } = toolCall ? JSON.parse(toolCall.arguments || '{}') : {};
  
  // Skip rendering if no result yet
  if (!toolResult) {
    return (
      <div className="py-2 px-3 text-sm text-secondary-500 animate-pulse">
        Executing webhook call to {endpoint_key || 'endpoint'}...
      </div>
    );
  }
  
  if (toolResult.error) {
    return (
      <div className="py-2 px-3 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded text-sm text-red-600">
        <div className="font-medium">Error: {toolResult.error}</div>
        {toolResult.message && <div className="mt-1 whitespace-pre-wrap">{toolResult.message}</div>}
      </div>
    );
  }
  
  // Parse the webhook response based on the structure
  let result = null;
  let endpoint = endpoint_key;
  let method = toolCall ? JSON.parse(toolCall.arguments || '{}').method : '';
  let status = '';
  let statusText = '';
  let ok = false;
  
  if (toolResult) {
    try {
      if (typeof toolResult.data === 'string') {
        // If data is a JSON string, try to parse it
        const parsedData = JSON.parse(toolResult.data);
        
        if (parsedData.endpoint) {
          endpoint = parsedData.endpoint;
        }
        
        if (parsedData.data) {
          result = parsedData.data;
        } else {
          result = parsedData;
        }
        
        // Extract status info if available
        if (parsedData.status) status = parsedData.status;
        if (parsedData.statusText) statusText = parsedData.statusText;
        if (parsedData.ok !== undefined) ok = parsedData.ok;
      } else if (toolResult.data) {
        // Use data field if it exists
        if (toolResult.data.endpoint) {
          endpoint = toolResult.data.endpoint;
        }
        
        if (toolResult.data.data) {
          result = toolResult.data.data;
        } else {
          result = toolResult.data;
        }
        
        // Extract status info if available
        if (toolResult.data.status) status = toolResult.data.status;
        if (toolResult.data.statusText) statusText = toolResult.data.statusText;
        if (toolResult.data.ok !== undefined) ok = toolResult.data.ok;
      }
    } catch (error) {
      console.error("Error parsing webhook results:", error.message);
      result = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
    }
  }
  
  return (
    <div className="py-2 px-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center ${ok ? 'text-green-600' : 'text-amber-600'}`}>
          <div className="font-semibold">
            {status} {statusText}
          </div>
        </div>
        {endpoint && <div className="text-xs text-secondary-500">
          {method} request to {endpoint}
        </div>}
      </div>
      
      <div className="rounded bg-secondary-50 p-2 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap">
        {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
      </div>
    </div>
  );
}
```

### 3. WebhookManager Component

The application includes a WebhookManager component that allows users to add, edit, and remove webhook endpoints. Key features:

- Configure endpoint keys (used by the AI to reference the webhook)
- Set the webhook URL
- Specify required HTTP method (GET/POST/ANY)
- Choose from multiple authentication methods:
  - **No Authentication**: For public APIs that don't require authentication
  - **API Key**: Send an API key in a custom header (default: X-API-Key)
  - **Basic Auth**: Username/password authentication using the Basic scheme
  - **Bearer Token**: JWT or OAuth token authentication using the Bearer scheme
  - **Custom Header**: Any custom authentication header and value
- Provide detailed descriptions of required payload fields
- Validate inputs to ensure proper configuration
- Store configurations in localStorage for persistence

To use webhooks:

1. Configure webhook endpoints in the Webhook Manager panel
2. For each webhook, provide:
   - Endpoint key (e.g., "weather-api" or "n8n-brave-search")
   - URL (e.g., "https://your-api.com/endpoint")
   - HTTP method requirement (GET, POST, or Any)
   - Authentication method and credentials if needed
   - Detailed description of payload requirements

3. In conversations with the AI, request the webhook by name:
   ```
   Use the n8n-brave-search webhook to search for "latest AI news"
   ```

   The AI will structure the call with the proper parameters:
   ```javascript
   webhook_call({
     endpoint_key: "n8n-brave-search",
     method: "POST",
     payload: {
       query: "latest AI news"
     }
   })
   ```

### 4. Special Handling for Search Endpoints

For search-related webhooks:
- Always use POST method for reliability
- Always include a "query" parameter in the payload
- Make descriptions very explicit about payload requirements

### 5. Webhook Examples with Authentication

Here are some webhook examples showcasing different authentication methods:

1. **Public API (No Authentication):**
   - Key: `random-quote`
   - URL: `https://api.quotable.io/random`
   - Method: GET
   - Auth Method: None
   - Description: "Returns a random quote. No payload required."

2. **Weather API with API Key:**
   - Key: `weather-api`
   - URL: `https://api.weatherapi.com/v1/current.json`
   - Method: GET
   - Auth Method: API Key
   - API Key Header Name: key
   - API Key: your_api_key_here
   - Description: "Get current weather. Required payload: {'q': 'City name or coordinates'}"

3. **GitHub API with Bearer Token:**
   - Key: `github-repos`
   - URL: `https://api.github.com/user/repos`
   - Method: GET
   - Auth Method: Bearer Token
   - Bearer Token: your_github_personal_access_token
   - Description: "List your GitHub repositories. No payload required."

4. **Private API with Basic Auth:**
   - Key: `private-api`
   - URL: `https://api.example.com/data`
   - Method: GET
   - Auth Method: Basic Auth
   - Username: your_username
   - Password: your_password
   - Description: "Access private API data. No payload required."

5. **Custom API with Custom Header:**
   - Key: `custom-api`
   - URL: `https://api.example.com/custom`
   - Method: GET
   - Auth Method: Custom Header
   - Custom Header Name: X-Custom-Auth
   - Custom Header Value: your_custom_token
   - Description: "API using custom authentication header. No payload required."

4. Persist their endpoints between sessions using localStorage 