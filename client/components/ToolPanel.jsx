import { useEffect, useState, lazy, Suspense } from "react";
import { AlertCircle } from "lucide-react"; // Only need AlertCircle here now
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { tools, getAllToolDefinitions } from '../lib/tools'; // Import from registry
import WebhookManager from './WebhookManager'; // Import the webhook manager

// --- Lazy loaded SyntaxHighlighter (Keep this) ---
const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter').then(module => ({ default: module.Prism }))
);
const oneDark = lazy(() =>
  import('react-syntax-highlighter/dist/esm/styles/prism').then(module => ({ default: module.oneDark }))
);

function CodeBlock({ inline, className, children }) {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  if (!isClient) return <code className={`${className || ''} bg-secondary-100 dark:bg-dark-surface-alt px-1 py-0.5 rounded`}>{children}</code>;
  const match = /language-(\w+)/.exec(className || '');
  return !inline && match ? (
    <Suspense fallback={<pre className="bg-dark-surface p-2 rounded text-dark-text-secondary text-xs">Loading code style...</pre>}>
      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </Suspense>
  ) : (
    <code className={`${className || ''} bg-secondary-100 dark:bg-dark-surface-alt px-1 py-0.5 rounded`}>{children}</code>
  );
}
// -------------------------------------------------------

// --- Tool Output Components (Should match keys in tool registry's OutputComponent) ---
function ColorPaletteOutput({ toolCall }) { // Changed prop name for consistency
  const { theme, colors } = JSON.parse(toolCall.arguments);
  return (
    <div className="space-y-3">
      <h3 className="text-md font-semibold text-secondary-700 dark:text-dark-text">Color Palette: {theme}</h3>
      <div className="grid grid-cols-5 gap-2">
        {colors.map((color) => (
          <div key={color} className="relative group">
            <div className="w-full h-16 rounded-md border border-secondary-200 dark:border-dark-border shadow-sm" style={{ backgroundColor: color }} />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-md">
              <span className="text-xs font-mono text-white drop-shadow-md">{color}</span>
            </div>
          </div>
        ))}
      </div>
      <details className="text-xs text-secondary-500 dark:text-dark-text-secondary">
        <summary className="cursor-pointer">View arguments</summary>
        <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded overflow-x-auto">{JSON.stringify(toolCall.arguments, null, 2)}</pre>
      </details>
    </div>
  );
}

function WebSearchResultsOutput({ toolCall, toolResult, isLoading }) {
  const { query } = JSON.parse(toolCall.arguments || '{}');
  
  // Parse the results based on the actual structure
  let results = [];
  
  if (toolResult) {
    try {
      // Reduced logging - just log once at the beginning
      console.log("Processing search results:", 
        typeof toolResult.data === 'object' ? '[Object]' : 
        typeof toolResult.data === 'string' ? '[String]' : 
        typeof toolResult.data);
      
      if (typeof toolResult.data === 'string') {
        // If data is a JSON string, parse it
        results = JSON.parse(toolResult.data);
      } else if (Array.isArray(toolResult.data)) {
        // If data is already an array, use it directly
        results = toolResult.data;
      } else if (toolResult.data && typeof toolResult.data === 'object') {
        // If it's an object, check if it has a results property
        if (toolResult.data.results && Array.isArray(toolResult.data.results)) {
          results = toolResult.data.results;
        } else {
          // Just use the object as is
          results = [toolResult.data];
        }
      }
    } catch (error) {
      console.error("Error parsing search results:", error);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-md font-semibold text-secondary-700 dark:text-dark-text">Web Search: "{query}"</h3>
      {isLoading ? (
        <div className="text-sm text-secondary-500 dark:text-dark-text-secondary">Searching...</div>
      ) : results && results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((result, index) => (
            <li key={index} className="text-sm border-b border-secondary-200 dark:border-dark-border pb-2 last:border-b-0">
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                {result.title || "No title"}
              </a>
              <p className="text-xs text-secondary-600 dark:text-dark-text-secondary mt-0.5 line-clamp-2">
                {result.content || "No description available."}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/30 p-3 rounded text-sm">
          <p className="text-secondary-700 dark:text-dark-text-secondary">No results found. The search might have encountered an error or returned no matches.</p>
          <p className="text-secondary-600 dark:text-dark-text-secondary mt-2 text-xs">Suggestion: Try a different search query or check if the search endpoint is working correctly.</p>
        </div>
      )}
      <details className="text-xs text-secondary-500 dark:text-dark-text-secondary">
        <summary className="cursor-pointer">View arguments</summary>
        <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded overflow-x-auto">
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function WebhookResultOutput({ toolCall, toolResult }) {
  const { endpoint_key } = toolCall ? JSON.parse(toolCall.arguments || '{}') : {};
  
  // Skip rendering if no result yet
  if (!toolResult) {
    return (
      <div className="py-2 px-3 text-sm text-secondary-500 dark:text-dark-text-secondary animate-pulse">
        Executing webhook call to {endpoint_key || 'endpoint'}...
      </div>
    );
  }
  
  if (toolResult.error) {
    return (
      <div className="py-2 px-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 rounded text-sm text-red-600 dark:text-red-400">
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
      // Simplified logging - just log once
      console.log("Processing webhook result:", typeof toolResult.data);
      
      if (typeof toolResult.data === 'string') {
        // If data is a JSON string, try to parse it
        const parsedData = JSON.parse(toolResult.data);
        
        // Check if this is the new format with endpoint, data, etc.
        if (parsedData.endpoint) {
          endpoint = parsedData.endpoint;
        }
        
        // Get the actual result data
        if (parsedData.data) {
          result = parsedData.data;
        } else {
          // Fall back to using the entire parsed object as the result
          result = parsedData;
        }
      } else if (toolResult.data) {
        // Use data field if it exists
        
        // Check if data has the new structure with endpoint and data fields
        if (toolResult.data.endpoint) {
          endpoint = toolResult.data.endpoint;
        }
        
        // Get the actual result data
        if (toolResult.data.data) {
          result = toolResult.data.data;
        } else {
          // Fall back to using the entire data object as the result
          result = toolResult.data;
        }
      }
      
      // Extract status info if available
      if (toolResult.status) status = toolResult.status;
      if (toolResult.statusText) statusText = toolResult.statusText;
      if (toolResult.ok !== undefined) ok = toolResult.ok;
      
      // If the result object has these fields, they take precedence
      if (toolResult.data) {
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
        <div className={`flex items-center ${ok ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
          <div className="font-semibold">
            {status} {statusText}
          </div>
        </div>
        {endpoint && <div className="text-xs text-secondary-500 dark:text-dark-text-secondary">
          {method} request to {endpoint}
        </div>}
      </div>
      
      <div className="rounded bg-secondary-50 dark:bg-dark-surface-alt p-2 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap">
        {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
      </div>
    </div>
  );
}

function ErrorOutput({ error }) {
  return (
    <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm font-medium">Tool Error</span>
      </div>
      <p className="text-xs mt-1 text-red-500 dark:text-red-300">{error?.message || "An unknown error occurred."}</p>
    </div>
  );
}

// Map component names (strings from registry) to actual components
const OutputComponents = {
  ColorPaletteOutput,
  WebSearchResultsOutput,
  WebhookResultOutput,
  ErrorOutput,
  // Add other output components here
};
// -------------------------------------------------------

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
  toolsAdded,
  setToolsAdded,
  activeToolCall, // The function_call event itself
  setActiveToolCall,
}) {
  const [toolResult, setToolResult] = useState(null); // Stores { type: 'search_results'/'error', data: ... }
  const [isLoadingTool, setIsLoadingTool] = useState(false);

  // Generate the session update payload only once or when needed
  const sessionUpdatePayload = {
      type: "session.update",
      session: {
          tools: getAllToolDefinitions(), // Get definitions from registry
          tool_choice: "auto",
      },
  };

  // Effect to add tools once session starts
  useEffect(() => {
    if (!isSessionActive) {
      setToolsAdded(false);
      setActiveToolCall(null);
      setToolResult(null);
      setIsLoadingTool(false);
      return;
    }
    const sessionCreatedEvent = events.find(e => e.type === 'session.created');
    if (sessionCreatedEvent && !toolsAdded) {
      console.log("Session created, sending tool definitions...");
      sendClientEvent(sessionUpdatePayload);
      setToolsAdded(true);
    }
  }, [isSessionActive, events, toolsAdded, sendClientEvent, setToolsAdded, setActiveToolCall, sessionUpdatePayload]);

  // Effect to handle incoming function calls from the AI
  useEffect(() => {
    const latestEvent = events[0];
    if (latestEvent?.source === 'server' && latestEvent.response?.output?.[0]?.type === 'function_call') {
      const functionCall = latestEvent.response.output[0];
      const callId = functionCall.call_id;
      const toolName = functionCall.name;

      // Prevent re-processing the same active call
      if (!callId || activeToolCall?.call_id === callId) return;

      // Find the tool in our registry
      const tool = tools[toolName];
      if (!tool) {
        console.warn(`Unknown function call received: ${toolName}`);
        return;
      }

      console.log(`Processing function call: ${toolName} (${callId})`);
      setActiveToolCall(functionCall);
      setToolResult(null);
      setIsLoadingTool(true);

      const sendResult = (resultData) => {
        if (!callId) return; // Should not happen if we reach here
        
        // First, send the function result using conversation.item.create
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: resultData.content
          }
        });
        
        // Then trigger the model to continue with response.create
        sendClientEvent({
          type: "response.create"
        });
      };

      // Execute the tool's logic
      try {
        const args = JSON.parse(functionCall.arguments || '{}'); // Default to empty object if no args
        
        // Use Promise.resolve to handle both sync and async execute functions
        Promise.resolve(tool.execute(args))
          .then(result => {
            // Result should have { status: 'success', content: '...' }
            
            // Debug the result content
            try {
              const parsedContent = JSON.parse(result.content);
              setToolResult({ type: toolName, data: parsedContent }); // Store parsed data for display
            } catch (error) {
              console.error(`Failed to parse ${toolName} result content:`, error.message);
              setToolResult({ type: toolName, data: result.content }); // Store as is if parsing fails
            }
            
            sendResult(result);
          })
          .catch(error => {
            console.error(`${toolName} execution failed:`, error.message);
            const errorData = { message: error.message || `Tool ${toolName} failed` };
            setToolResult({ type: 'error', data: errorData });
            sendResult({ status: 'error', content: JSON.stringify(errorData) });
          })
          .finally(() => setIsLoadingTool(false));

      } catch (error) {
        // Handle argument parsing errors
        console.error(`Failed to parse arguments for ${toolName}:`, error.message);
        const errorData = { message: `Argument parsing error: ${error.message}` };
        setToolResult({ type: 'error', data: errorData });
        setIsLoadingTool(false);
        sendResult({ status: 'error', content: JSON.stringify(errorData) });
      }
    }
  }, [events, sendClientEvent, activeToolCall, setActiveToolCall]);

  // Dynamic rendering based on the active tool call
  const renderToolOutput = () => {
    if (!activeToolCall) return <p className="text-sm text-secondary-500 dark:text-dark-text-secondary">No active tool call.</p>;

    const tool = tools[activeToolCall.name];
    if (!tool) return <ErrorOutput error={{ message: `Unknown tool called: ${activeToolCall.name}`}}/>;

    const OutputComponent = OutputComponents[tool.OutputComponent];
    if (!OutputComponent) return <ErrorOutput error={{ message: `Missing output component for tool: ${activeToolCall.name}`}}/>;
    
    const error = toolResult?.type === 'error' ? toolResult.data : null;
    if (error) return <ErrorOutput error={error} />;

    // Pass the original tool call event and the processed result/loading state
    return <OutputComponent 
             toolCall={activeToolCall} 
             toolResult={toolResult} 
             isLoading={isLoadingTool} 
           />;
  };

  return (
    <section className="h-full w-full flex flex-col gap-4 p-5">
      <h2 className="flex-shrink-0 text-lg font-semibold text-secondary-800 dark:text-dark-text border-b border-secondary-200 dark:border-dark-border pb-2">Tools Panel</h2>
      <div className="flex-1 space-y-4 overflow-y-auto pr-4">
        {!isSessionActive ? (
          <p className="text-sm text-secondary-500 dark:text-dark-text-secondary">Start the session to enable tools.</p>
        ) : !toolsAdded ? (
           <p className="text-sm text-secondary-500 dark:text-dark-text-secondary">Initializing tools...</p>
        ) : (
           renderToolOutput()
        )}
        
        {/* Add the webhook manager component */}
        <WebhookManager />
      </div>
    </section>
  );
}

