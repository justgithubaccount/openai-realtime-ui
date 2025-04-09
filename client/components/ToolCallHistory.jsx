import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Download, Trash2 } from "lucide-react";

export default function ToolCallHistory() {
  // No longer need to load or store history internally - will come from props
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [exportData, setExportData] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [toolCallHistory, setToolCallHistory] = useState([]);
  
  // Load history from localStorage only after component mounts
  useEffect(() => {
    const loadHistoryFromStorage = () => {
      try {
        const savedHistory = localStorage.getItem('toolCallHistory');
        if (savedHistory) {
          setToolCallHistory(JSON.parse(savedHistory));
        }
      } catch (e) {
        console.error("Error loading tool call history", e);
      }
    };

    // Initial load
    loadHistoryFromStorage();
    
    // Set up event listener for updates
    const handleHistoryUpdate = () => {
      loadHistoryFromStorage();
    };
    
    window.addEventListener('toolcall-history-updated', handleHistoryUpdate);
    
    // Cleanup
    return () => {
      window.removeEventListener('toolcall-history-updated', handleHistoryUpdate);
    };
  }, []);
  
  // Handle clearing history
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all tool call history?')) {
      // Clear both state and localStorage
      setToolCallHistory([]);
      try {
        localStorage.setItem('toolCallHistory', '[]');
      } catch (e) {
        console.error("Error clearing tool call history", e);
      }
    }
  };
  
  // Handle exporting history
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(toolCallHistory, null, 2);
      setExportData(dataStr);
      setShowExport(true);
    } catch (e) {
      console.error("Error exporting tool call history", e);
    }
  };
  
  // Download exported data
  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportData);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "tool_call_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setShowExport(false);
  };

  return (
    <div className="border border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface rounded-lg overflow-hidden mt-4">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer bg-secondary-50 dark:bg-dark-surface-alt"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-md font-semibold flex items-center">
          Tool Call History 
          {toolCallHistory.length > 0 && (
            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {toolCallHistory.length}
            </span>
          )}
        </h3>
        <div>
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-secondary-500 dark:text-dark-text-secondary" />
          ) : (
            <ChevronUp className="w-5 h-5 text-secondary-500 dark:text-dark-text-secondary" />
          )}
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="p-4">
          {/* Action Buttons */}
          <div className="flex gap-2 mb-3">
            <button 
              onClick={handleExport}
              className="text-xs px-2 py-1 bg-secondary-100 dark:bg-dark-surface-alt rounded hover:bg-secondary-200 dark:hover:bg-dark-hover flex items-center"
            >
              <Download className="w-3 h-3 mr-1" /> Export
            </button>
            <button 
              onClick={handleClearAll}
              className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Clear All
            </button>
          </div>
          
          {/* Tool Call History Entries */}
          <div className="max-h-96 overflow-y-auto">
            {toolCallHistory.length > 0 ? (
              <div className="space-y-2">
                {toolCallHistory.map(entry => (
                  <div key={entry.id} className="p-3 border border-secondary-100 dark:border-dark-border rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        {entry.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 mr-2" />
                        )}
                        <span className="font-medium">{entry.toolName}</span>
                      </div>
                      <div className="text-xs text-secondary-500">{entry.timestamp}</div>
                    </div>
                    
                    {/* Tool Call Arguments */}
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-blue-600 dark:text-blue-400">View Arguments</summary>
                      <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded text-xs overflow-auto">
                        {JSON.stringify(entry.arguments, null, 2)}
                      </pre>
                    </details>
                    
                    {/* Tool Call Result */}
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-blue-600 dark:text-blue-400">
                        {entry.status === 'success' ? 'View Result' : 'View Error'}
                      </summary>
                      <pre className="mt-1 p-2 bg-secondary-100 dark:bg-dark-surface-alt rounded text-xs overflow-auto">
                        {JSON.stringify(entry.result, null, 2)}
                      </pre>
                    </details>
                    
                    {/* API Method and Endpoint (if available) */}
                    {entry.method && entry.endpoint && (
                      <div className="mt-2 text-xs text-secondary-500">
                        {entry.method} request to {entry.endpoint}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-secondary-500 dark:text-dark-text-secondary py-4">
                No tool call history yet
              </div>
            )}
          </div>
          
          {/* Export Modal */}
          {showExport && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50" onClick={() => setShowExport(false)}>
              <div className="bg-white dark:bg-dark-surface p-4 rounded-lg shadow-lg max-w-lg w-full" onClick={e => e.stopPropagation()}>
                <h4 className="text-lg font-semibold mb-2">Export Tool Call History</h4>
                <div className="mb-4">
                  <textarea 
                    className="w-full h-64 p-2 border rounded dark:bg-dark-surface-alt dark:border-dark-border text-xs font-mono"
                    value={exportData}
                    readOnly
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    className="px-3 py-1 bg-secondary-100 dark:bg-dark-surface-alt rounded"
                    onClick={() => setShowExport(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                    onClick={handleDownload}
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 