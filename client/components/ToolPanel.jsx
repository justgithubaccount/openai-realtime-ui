import { useEffect, useState, lazy, Suspense, useMemo, useRef } from "react";
import { AlertCircle } from "lucide-react"; // Only need AlertCircle here now
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { tools, getAllToolDefinitions } from '../lib/tools'; // Import from registry
import WebhookManager from './WebhookManager'; // Import the webhook manager
import ClipboardManager from './ClipboardManager'; // Import the clipboard manager
import ToolCallHistory from './ToolCallHistory'; // Import the tool call history component

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
  const { query } = toolCall ? JSON.parse(toolCall.arguments || '{}') : {};
  const [showRawJson, setShowRawJson] = useState(false);
  
  // Parse the results based on the actual structure
  let results = [];
  
  // Store the raw JSON for the toggle view
  const rawJsonData = toolResult ? (
    typeof toolResult.data === 'string' 
      ? toolResult.data 
      : JSON.stringify(toolResult.data, null, 2)
  ) : '';
  
  if (toolResult) {
    try {
      // Reduced logging - just log once at the beginning
      // console.log("Processing search results:", 
      //   typeof toolResult.data === 'object' ? '[Object]' : 
      //   typeof toolResult.data === 'string' ? '[String]' : 
      //   typeof toolResult.data);
      
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
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-secondary-700 dark:text-dark-text">Web Search: "{query}"</h3>
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
        <div className="text-sm text-secondary-500 dark:text-dark-text-secondary">Searching...</div>
      ) : !showRawJson && results && results.length > 0 ? (
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
      ) : !showRawJson ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/30 p-3 rounded text-sm">
          <p className="text-secondary-700 dark:text-dark-text-secondary">No results found. The search might have encountered an error or returned no matches.</p>
          <p className="text-secondary-600 dark:text-dark-text-secondary mt-2 text-xs">Suggestion: Try a different search query or check if the search endpoint is working correctly.</p>
        </div>
      ) : null}
      
      {/* Raw JSON display */}
      {showRawJson && toolResult && (
        <div className="rounded border border-secondary-200 dark:border-dark-border bg-gray-50 dark:bg-gray-900 p-2 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap">
          <div className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 mb-1">Raw Response:</div>
          {rawJsonData}
        </div>
      )}
      
      <details className="text-xs text-secondary-500 dark:text-dark-text-secondary mt-2">
        <summary className="cursor-pointer">View arguments</summary>
        <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded overflow-x-auto">
          {JSON.stringify(toolCall?.arguments ? JSON.parse(toolCall.arguments) : {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function WebhookResultOutput({ toolCall, toolResult }) {
  const { endpoint_key } = toolCall ? JSON.parse(toolCall.arguments || '{}') : {};
  const [showRawJson, setShowRawJson] = useState(false);
  
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
  
  // Store the raw JSON for the toggle view
  const rawJsonData = typeof toolResult.data === 'string' 
    ? toolResult.data 
    : JSON.stringify(toolResult.data, null, 2);
  
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
      // console.log("Processing webhook result:", typeof toolResult.data);
      
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
        <div className="flex items-center gap-2">
          {endpoint && <div className="text-xs text-secondary-500 dark:text-dark-text-secondary">
            {method} request to {endpoint}
          </div>}
          <button 
            className="text-xs px-2 py-0.5 bg-secondary-100 dark:bg-dark-surface hover:bg-secondary-200 dark:hover:bg-dark-hover rounded"
            onClick={() => setShowRawJson(!showRawJson)}
          >
            {showRawJson ? 'Hide Raw' : 'Show Raw'}
          </button>
        </div>
      </div>
      
      {/* Formatted result display */}
      {!showRawJson && (
        <div className="rounded bg-secondary-50 dark:bg-dark-surface-alt p-2 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap">
          {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
        </div>
      )}
      
      {/* Raw JSON display */}
      {showRawJson && (
        <div className="rounded border border-secondary-200 dark:border-dark-border bg-gray-50 dark:bg-gray-900 p-2 max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap">
          <div className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 mb-1">Raw Response:</div>
          {rawJsonData}
        </div>
      )}
      
      {/* View arguments section, similar to WebSearchResultsOutput */}
      <details className="text-xs text-secondary-500 dark:text-dark-text-secondary mt-2">
        <summary className="cursor-pointer">View arguments</summary>
        <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded overflow-x-auto">
          {JSON.stringify(toolCall?.arguments ? JSON.parse(toolCall.arguments) : {}, null, 2)}
        </pre>
      </details>
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

function DateTimeOutput({ toolCall, toolResult, isLoading }) {
  // Parse arguments from the tool call
  const args = JSON.parse(toolCall.arguments || '{}');
  const format = args.format || "iso";
  const timezone = args.timezone || "local";
  
  // Get results from toolResult
  let results = null;
  if (toolResult && !isLoading) {
    try {
      if (typeof toolResult.data === 'string') {
        results = JSON.parse(toolResult.data);
      } else if (toolResult.data) {
        results = toolResult.data;
      }
    } catch (error) {
      console.error("Error parsing datetime results:", error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold">Current Date & Time</h3>
        {results && (
          <div className="text-xs text-secondary-500">
            {results.timezone.toUpperCase()} / {results.format.toUpperCase()}
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="text-sm text-secondary-500 animate-pulse">
          Retrieving current time...
        </div>
      ) : results ? (
        <div className="bg-secondary-50 dark:bg-dark-surface-alt p-3 rounded">
          <div className="text-lg font-mono">{results.current}</div>
          <div className="text-xs text-secondary-500 mt-1">Unix timestamp: {results.timestamp}</div>
        </div>
      ) : (
        <div className="text-sm text-secondary-500">Could not retrieve time information</div>
      )}
    </div>
  );
}

function ClipboardOutput({ toolCall, toolResult, isLoading }) {
  // Parse arguments from the tool call
  const args = JSON.parse(toolCall.arguments || '{}');
  const action = args.action || "";
  
  // Get results from toolResult
  let results = null;
  if (toolResult && !isLoading) {
    try {
      if (typeof toolResult.data === 'string') {
        results = JSON.parse(toolResult.data);
      } else if (toolResult.data) {
        results = toolResult.data;
      }
      
      // If this is a save action and was successful, use a timeout to dispatch events
      // after rendering is complete to avoid React warnings
      if (action === 'save' && results?.success) {
        setTimeout(() => {
          // Create and dispatch a custom event to force update
          const updateEvent = new CustomEvent('clipboard-updated', {
            detail: { action: 'save', entry: results.entry }
          });
          window.dispatchEvent(updateEvent);
        }, 0);
      }
    } catch (error) {
      console.error("Error parsing clipboard results:", error);
    }
  }

  // Function to render a single clipboard entry
  const renderEntry = (entry) => (
    <div key={entry.id} className="border-b border-secondary-100 dark:border-dark-border py-2 last:border-0">
      <div className="flex justify-between items-start">
        <div className="text-sm font-medium break-all mr-2 flex-1">{entry.text}</div>
        <div className="text-xs text-secondary-500 whitespace-nowrap">{entry.created}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold">Clipboard {action.charAt(0).toUpperCase() + action.slice(1)}</h3>
      </div>
      
      {isLoading ? (
        <div className="text-sm text-secondary-500 animate-pulse">
          Processing clipboard...
        </div>
      ) : results ? (
        <div className="bg-secondary-50 dark:bg-dark-surface-alt p-3 rounded">
          {action === 'list' && results.entries && (
            <div className="max-h-96 overflow-y-auto">
              <div className="text-xs text-secondary-500 mb-2">
                Showing {results.entries.length} of {results.total} entries
              </div>
              {results.entries.length > 0 ? (
                <div className="space-y-2">
                  {results.entries.map(renderEntry)}
                </div>
              ) : (
                <div className="text-sm text-secondary-500">Clipboard is empty</div>
              )}
            </div>
          )}
          
          {action === 'get' && results.entry && (
            renderEntry(results.entry)
          )}
          
          {(action === 'save' || action === 'clear' || action === 'delete') && (
            <div className="text-sm">
              {results.message}
              {results.entry && (
                <div className="mt-2">{renderEntry(results.entry)}</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-secondary-500">No clipboard data available</div>
      )}
    </div>
  );
}

// Map component names (strings from registry) to actual components
const OutputComponents = {
  ColorPaletteOutput,
  WebSearchResultsOutput,
  WebhookResultOutput,
  ErrorOutput,
  DateTimeOutput,
  ClipboardOutput,
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
  envVars, // New prop for environment variables
}) {
  const [toolResult, setToolResult] = useState(null); // Stores { type: 'search_results'/'error', data: ... }
  const [isLoadingTool, setIsLoadingTool] = useState(false);

  // Generate the session update payload only once or when needed
  const sessionUpdatePayload = useMemo(() => ({
    type: "session.update",
    session: {
      tools: getAllToolDefinitions(), // Get definitions from registry
      tool_choice: "auto",
    },
  }), [envVars]); // Re-generate when envVars change

  // Effect to update tools when environment variables change
  const [lastSentEnvHash, setLastSentEnvHash] = useState('');
  
  // Effect to add tools once session starts or when env vars change
  useEffect(() => {
    if (!isSessionActive) {
      setToolsAdded(false);
      setActiveToolCall(null);
      setToolResult(null);
      setIsLoadingTool(false);
      return;
    }
    
    // Create a hash of current env vars to detect real changes
    const envHash = JSON.stringify(envVars);
    
    // Check for session created event
    const sessionCreatedEvent = events.find(e => e.type === 'session.created');
    const isSessionNew = sessionCreatedEvent && !toolsAdded;
    
    // Only send updates if:
    // 1. A new session is starting, OR
    // 2. Env vars changed and are different from what we last sent
    if (isSessionNew || (Object.keys(envVars).length > 0 && envHash !== lastSentEnvHash)) {
      // console.log("Updating tool definitions - new session or env vars changed");
      sendClientEvent(sessionUpdatePayload);
      setToolsAdded(true);
      setLastSentEnvHash(envHash);
    }
  }, [isSessionActive, events, toolsAdded, sendClientEvent, setToolsAdded, setActiveToolCall, sessionUpdatePayload, envVars, lastSentEnvHash]);

  // Function to add to tool call history
  const addToToolCallHistory = (toolCall, result, status) => {
    // Extract method and endpoint for API calls
    let method = '';
    let endpoint = '';
    
    // Try to extract method and endpoint info for webhook calls
    if (toolCall.name === 'webhook_call') {
      try {
        const args = JSON.parse(toolCall.arguments || '{}');
        method = args.method || 'GET';
        endpoint = args.endpoint_key || '';
        
        // Try to extract endpoint from result if available
        if (result?.data?.endpoint) {
          endpoint = result.data.endpoint;
        }
      } catch (e) {
        console.error('Error extracting webhook details:', e);
      }
    }
    
    const newEntry = {
      id: Date.now(),
      toolName: toolCall.name,
      status: status, // 'success' or 'error'
      arguments: JSON.parse(toolCall.arguments || '{}'),
      result: result?.data || result,
      timestamp: new Date().toLocaleString(),
      method,
      endpoint
    };
    
    // Directly update localStorage instead of using state
    try {
      if (typeof window !== 'undefined') {
        // Get existing history
        const saved = localStorage.getItem('toolCallHistory');
        const history = saved ? JSON.parse(saved) : [];
        
        // Add new entry to the front
        const updated = [newEntry, ...history];
        
        // Save limited history back to localStorage
        localStorage.setItem('toolCallHistory', JSON.stringify(updated.slice(0, 50)));
        
        // Dispatch a custom event to notify the ToolCallHistory component
        if (typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('toolcall-history-updated'));
        }
      }
    } catch (e) {
      console.error('Error saving tool call history:', e);
    }
  };

  // Effect to handle incoming function calls from the AI
  useEffect(() => {
    const latestEvent = events[0];
    if (latestEvent?.source === 'server' && latestEvent.response?.output?.[0]?.type === 'function_call') {
      const functionCall = latestEvent.response.output[0];
      const callId = functionCall.call_id;
      const toolName = functionCall.name;

      // Prevent re-processing the same active call - NEED TO LOOK AT - IF AI FAILS TO USE WE WANT IT TO TRY AGAIN AND SOMETIMES IT DOESNT LIKE USING A WEBHOOK
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
              
              // Check for error indicators in both parsed content and raw string
              const isError = (
                // Check for common error patterns in parsed objects
                (typeof parsedContent === 'object' && parsedContent.error !== undefined) ||
                (typeof parsedContent === 'object' && parsedContent.status === 'error') ||
                // For webhook calls, check for any error indication in content
                (toolName === 'webhook_call' && String(result.content).toLowerCase().includes('error'))
              );
              
              // Add to history with appropriate status and the parsed content
              addToToolCallHistory(functionCall, { data: parsedContent }, isError ? 'error' : 'success');
            } catch (error) {
              console.error(`Failed to parse ${toolName} result content:`, error.message);
              setToolResult({ type: toolName, data: result.content }); // Store as is if parsing fails
              
              // Check for error indicators in the raw string
              const rawContent = String(result.content).toLowerCase();
              const isRawError = 
                rawContent.includes('error') || 
                rawContent.includes('fail') || 
                rawContent.includes('exception');
              
              // Add to history with appropriate status
              addToToolCallHistory(functionCall, { data: result.content }, isRawError ? 'error' : 'success');
            }
            
            sendResult(result);
          })
          .catch(error => {
            console.error(`${toolName} execution failed:`, error.message);
            const errorData = { message: error.message || `Tool ${toolName} failed` };
            setToolResult({ type: 'error', data: errorData });
            
            // Add error to history
            addToToolCallHistory(functionCall, errorData, 'error');
            
            sendResult({ status: 'error', content: JSON.stringify(errorData) });
          })
          .finally(() => setIsLoadingTool(false));

      } catch (error) {
        // Handle argument parsing errors
        console.error(`Failed to parse arguments for ${toolName}:`, error.message);
        const errorData = { message: `Argument parsing error: ${error.message}` };
        setToolResult({ type: 'error', data: errorData });
        setIsLoadingTool(false);
        
        // Add error to history
        addToToolCallHistory(functionCall, errorData, 'error');
        
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
    <section className="h-full w-full flex flex-col gap-4 p-5 pb-16">
      <div className="flex-shrink-0 flex justify-between items-center border-b border-secondary-200 dark:border-dark-border pb-2">
        <h2 className="text-lg font-semibold text-secondary-800 dark:text-dark-text">Tools Panel</h2>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto pr-2">
        {!isSessionActive ? (
          <p className="text-sm text-secondary-500 dark:text-dark-text-secondary">Start the session to enable tools.</p>
        ) : !toolsAdded ? (
           <p className="text-sm text-secondary-500 dark:text-dark-text-secondary">Initializing tools...</p>
        ) : (
           renderToolOutput()
        )}
        
        {/* Add the webhook and clipboard managers */}
        <div className="space-y-4 mb-8">
          <WebhookManager />
          <ClipboardManager />
          <ToolCallHistory/>
        </div>
      </div>
    </section>
  );
}

