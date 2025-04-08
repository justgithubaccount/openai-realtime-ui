// client/lib/tools.js

// --- Tool Execution Logic ---

// Simulates fetching search results (replace with actual API call later if needed)
// Note: This function is defined here but will be called from ToolPanel
async function fetchSearchResults(query) {
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Search API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.results) {
      console.warn("Search API response missing 'results' property");
    }
    
    return data.results || [];
  } catch (error) {
    console.error("Failed to fetch search results:", error.message);
    // Re-throw the error to be caught by the caller in ToolPanel
    throw error; 
  }
}

// Helper to detect if an endpoint is a SearXNG search endpoint
function isSearxngEndpoint(url = '', key = '', description = '') {
  return url.includes('searx') || 
         url.includes(':8080/search') || 
         key.toLowerCase().includes('searx') ||
         (description && description.toLowerCase().includes('searx'));
}

// Clean search parameters for SearXNG endpoints
function cleanSearxngParams(params) {
  // Remove problematic parameters that break SearXNG searches
  const cleaned = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key !== 'category_general' && key !== 'categories_general') {
      cleaned.append(key, value);
    }
  }
  return cleaned;
}

// Webhook fetching function
async function callWebhook(method, endpointConfig, payload) {
  const url = typeof endpointConfig === 'string' ? endpointConfig : endpointConfig.url;
  const apiKey = typeof endpointConfig === 'object' ? endpointConfig.apiKey : null;
  const description = typeof endpointConfig === 'object' ? endpointConfig.description : '';
  
  // Always enforce the required method from the endpoint config
  const requiredMethod = typeof endpointConfig === 'object' && endpointConfig.method && endpointConfig.method !== 'ANY'
    ? endpointConfig.method
    : method;
  
  // Determine if this is an external URL that needs proxy routing
  const isExternalUrl = url.startsWith('http') && !url.includes(window.location.host);
  
  // For external URLs, route through our proxy
  let targetUrl = url;
  if (isExternalUrl) {
    console.log(`Routing external URL through proxy: ${url}`);
    targetUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  
  console.log(`Making ${requiredMethod} request to webhook endpoint: ${isExternalUrl ? 'proxy -> ' + url : url}`);
  
  try {
    const headers = { 
      'Content-Type': 'application/json'
    };
    
    // Add API key header if present
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    
    let response;
    let finalUrl = targetUrl;
    
    if (requiredMethod === 'GET') {
      // For GET requests with payload, append as query parameters
      if (payload) {
        const params = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => {
          params.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
        
        // Special handling for SearXNG endpoints
        if (isSearxngEndpoint(url, '', description)) {
          const cleanedParams = cleanSearxngParams(params);
          
          if (isExternalUrl) {
            // For external URLs being proxied, add params to the proxy URL
            finalUrl = `${targetUrl}&${cleanedParams.toString()}`;
          } else {
            // For direct URLs, add params to the target URL
            finalUrl = `${url}?${cleanedParams.toString()}`;
          }
          console.log('Using cleaned SearXNG parameters:', finalUrl);
        } else {
          if (isExternalUrl) {
            // For external URLs being proxied, add params to the proxy URL
            finalUrl = `${targetUrl}&${params.toString()}`;
          } else {
            // For direct URLs, add params to the target URL
            finalUrl = `${url}?${params.toString()}`;
          }
        }
      }
      
      response = await fetch(finalUrl, { headers });
    } else {
      // If method is POST, ensure we have a valid payload
      const body = payload ? JSON.stringify(payload) : JSON.stringify({});
      
      // For POST requests, the URL doesn't change (no query params to add)
      response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body,
      });
    }
    
    if (!response.ok) {
      throw new Error(`Webhook request failed with status: ${response.status}`);
    }
    
    // First check content type to determine if it's JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Failed to parse JSON response");
        const text = await response.text();
        return { text: text || "Empty response", _non_json_response: true };
      }
    } else {
      // Not JSON, return as text
      const text = await response.text();
      return { text: text || "Empty response", _non_json_response: true };
    }
  } catch (error) {
    console.error("Webhook request failed:", error.message);
    throw error;
  }
}

// --- Tool Definitions and Configuration ---

export const tools = {
  // --- Display Color Palette Tool ---
  display_color_palette: {
    // Definition sent to the AI
    definition: {
      type: "function",
      name: "display_color_palette",
      description: "Call this function when a user asks for a color palette.",
      parameters: {
        type: "object",
        strict: true,
        properties: {
          theme: {
            type: "string",
            description: "Description of the theme for the color scheme.",
          },
          colors: {
            type: "array",
            description: "Array of five hex color codes based on the theme.",
            items: { type: "string", description: "Hex color code" },
          },
        },
        required: ["theme", "colors"],
      },
    },
    // Execution logic (runs on the client when AI calls the tool)
    execute: async (args) => {
      // This tool doesn't *do* anything async, it just displays args.
      // Return success immediately.
      return { status: 'success', content: JSON.stringify(args) }; 
    },
    // React component used to render the output in ToolPanel
    // We'll define the actual component in ToolPanel for simplicity for now,
    // but ideally, it could be imported here too.
    OutputComponent: 'ColorPaletteOutput', 
  },

  // --- Web Search Tool ---
  web_search: {
    // Definition sent to the AI
    definition: {
      type: "function",
      name: "web_search",
      description: "Call this function to search the web for information.",
      parameters: {
        type: "object",
        strict: true,
        properties: {
          query: {
            type: "string",
            description: "The search query to use.",
          },
        },
        required: ["query"],
      },
    },
    // Execution logic
    execute: async (args) => {
      try {
        if (!args.query || args.query.trim() === '') {
          throw new Error("Search query cannot be empty");
        }
        
        // Calls the fetch function defined above
        const results = await fetchSearchResults(args.query);
        
        // Return minimal data - follow the OpenAI function format
        return { 
          status: 'success', 
          content: JSON.stringify(results) 
        }; 
      } catch (error) {
        console.error("Search failed:", error.message);
        // Return a simple error structure
        return {
          status: 'error',
          content: JSON.stringify({ 
            error: "Search failed", 
            message: error.message 
          })
        };
      }
    },
    // React component used to render the output
    OutputComponent: 'WebSearchResultsOutput', 
  },

  // --- Universal Webhook Tool ---
  webhook_call: {
    // Definition sent to the AI
    definition: {
      type: "function",
      name: "webhook_call",
      description: "Make a call to a user-configured webhook endpoint to trigger actions or retrieve information from external services. IMPORTANT: For POST requests, you MUST include a payload object with all required fields described in the endpoint's description. The following endpoints are available: " + 
        (typeof localStorage !== 'undefined' ? 
          Object.keys(JSON.parse(localStorage.getItem('webhookEndpoints') || '{}')).join(', ') : 
          '[endpoints will be available at runtime]') +
        "\n\nImportant Note: Search endpoints require a payload with a 'query' field containing the search term.",
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
            description: "Key name of the saved endpoint to use. Must match one of the available endpoints exactly: " + 
              (typeof localStorage !== 'undefined' ? 
                Object.keys(JSON.parse(localStorage.getItem('webhookEndpoints') || '{}')).join(', ') : 
                '[endpoints will be available at runtime]'),
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
        
        // If not found with exact key, try normalized versions
        if (!endpointConfig) {
          // Normalize the endpoint key - replace underscores with dashes and make lowercase
          const normalizedKey = args.endpoint_key.replace(/_/g, '-').toLowerCase();
          
          endpointConfig = savedEndpoints[normalizedKey];
          matchingKey = normalizedKey;
          
          // If still not found, try a case-insensitive search
          if (!endpointConfig) {
            const availableKeys = Object.keys(savedEndpoints);
            matchingKey = availableKeys.find(key => 
              key.toLowerCase() === normalizedKey || 
              key.toLowerCase().replace(/_/g, '-') === normalizedKey
            );
            
            if (matchingKey) {
              endpointConfig = savedEndpoints[matchingKey];
            }
          }
        }
        
        if (!endpointConfig) {
          // Return a more helpful error message that includes all available endpoints
          const availableEndpoints = Object.keys(savedEndpoints).join(', ');
          const errorMsg = `Endpoint "${args.endpoint_key}" not found. Available endpoints: ${availableEndpoints || 'None'}`;
          console.error(errorMsg);
          return {
            status: 'error',
            content: JSON.stringify({ 
              error: errorMsg,
              available_endpoints: Object.keys(savedEndpoints)
            })
          };
        }
        
        // Get endpoint description and preferred method
        const description = typeof endpointConfig === 'object' && endpointConfig.description 
          ? endpointConfig.description 
          : null;
          
        const requiredMethod = typeof endpointConfig === 'object' && endpointConfig.method 
          ? endpointConfig.method 
          : 'ANY';
        
        // Determine which HTTP method to use - prioritize endpoint required method
        let actualMethod = requiredMethod !== 'ANY' ? requiredMethod : (args.method || 'GET');
        
        // Flag if we're using a search endpoint (for automatic query handling)
        const isSearchEndpoint = matchingKey.toLowerCase().includes('search') || 
                            (description && description.toLowerCase().includes('search'));
                            
        // Flag if this is a SearXNG endpoint for special handling
        const isSearxEngine = isSearxngEndpoint(
          typeof endpointConfig === 'string' ? endpointConfig : endpointConfig.url,
          matchingKey,
          description
        );
        
        // For POST endpoints, ensure there's a payload
        let actualPayload = args.payload;
        if (actualMethod === 'POST' && !actualPayload) {
          // For search endpoints without payload, try to extract query from args
          if (isSearchEndpoint && args.query) {
            console.log("Auto-creating search payload with query:", args.query);
            actualPayload = { query: args.query };
          } else if (requiredMethod === 'POST') {
            // Only error if the endpoint actually requires POST
            const errorMsg = `POST request to "${matchingKey}" requires a payload. ${description || ''}`;
            console.error(errorMsg);
            return {
              status: 'error',
              content: JSON.stringify({ 
                error: errorMsg,
                endpoint_info: {
                  name: matchingKey,
                  required_method: requiredMethod,
                  description: description
                }
              })
            };
          }
        }
        
        // Special handling for SearXNG - they need POST method for reliable results
        if (isSearxEngine && actualMethod === 'GET' && actualPayload && actualPayload.query) {
          console.log("Switching SearXNG from GET to POST for better compatibility");
          actualMethod = 'POST';
        }
        
        // Create a formatted message about the webhook operation
        console.log(`Calling webhook ${matchingKey} with ${actualMethod} method`);
        
        // Call the webhook with the endpoint config
        const data = await callWebhook(actualMethod, endpointConfig, actualPayload);
        
        // Special handling for search responses
        let responseNote = "Process this data intelligently instead of repeating it verbatim.";
        if (isSearchEndpoint) {
          responseNote = "IMPORTANT: Don't repeat these search results verbatim. Summarize key information and respond in a natural way. If the query yielded no useful results, acknowledge this and offer to try a different search.";
        }
        
        // Return success with data and metadata
        return { 
          status: 'success', 
          content: JSON.stringify({
            endpoint: matchingKey,
            data: data,
            // Include response format information
            ...(data && data._non_json_response && { format: "text" }),
            // Include description and instructions for AI
            endpoint_description: description || "No description available",
            note: responseNote
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

  // --- Add more tools here in the future ---
  // example_tool: {
  //   definition: { ... },
  //   execute: async (args) => { ... },
  //   OutputComponent: 'ExampleToolOutput', 
  // },
};

// Helper to get all tool definitions for the session update
export const getAllToolDefinitions = () => {
  return Object.values(tools).map(tool => tool.definition);
}; 