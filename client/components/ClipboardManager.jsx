import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ClipboardManager() {
  const [clipboardEntries, setClipboardEntries] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [exportData, setExportData] = useState('');
  const [importData, setImportData] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const fileInputRef = useRef(null);
  const customEventRef = useRef(false);
  const currentEntriesRef = useRef([]);
  
  // Load clipboard entries from localStorage
  const loadEntriesFromStorage = () => {
    try {
      const entries = JSON.parse(localStorage.getItem('clipboardHistory') || '[]');
      setClipboardEntries(entries);
      currentEntriesRef.current = entries;
    } catch (error) {
      console.error("Error loading clipboard history:", error);
      setClipboardEntries([]);
      currentEntriesRef.current = [];
    }
  };
  
  // Initial load
  useEffect(() => {
    loadEntriesFromStorage();
    
    // Add storage event listener to detect changes from the clipboard tool
    const handleStorageChange = (e) => {
      if (e.key === 'clipboardHistory') {
        loadEntriesFromStorage();
      }
    };
    
    // Listen for the custom clipboard-updated event
    const handleCustomEvent = (e) => {
      // Set a flag to avoid infinite loops
      if (!customEventRef.current) {
        customEventRef.current = true;
        loadEntriesFromStorage();
        
        // If it's a save action, expand the clipboard manager
        if (e.detail?.action === 'save') {
          setIsCollapsed(false);
        }
        
        // Reset the flag after a timeout
        setTimeout(() => {
          customEventRef.current = false;
        }, 100);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('clipboard-updated', handleCustomEvent);
    
    // Setup polling to check for changes since the storage event only fires in other tabs
    // Use a more efficient polling with lower frequency and a deep comparison
    const intervalId = setInterval(() => {
      try {
        const currentStorageData = localStorage.getItem('clipboardHistory') || '[]';
        const storageEntries = JSON.parse(currentStorageData);
        
        // Simple check - if lengths differ, definitely reload
        if (storageEntries.length !== currentEntriesRef.current.length) {
          loadEntriesFromStorage();
          return;
        }
        
        // More complex check - compare first entry's ID if entries exist
        if (storageEntries.length > 0 && currentEntriesRef.current.length > 0) {
          // If the newest entry ID is different, something changed
          if (storageEntries[0].id !== currentEntriesRef.current[0].id) {
            loadEntriesFromStorage();
          }
        }
      } catch (error) {
        // Silent fail on polling errors
      }
    }, 5000); // Reduced from 2s to 5s for better performance
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('clipboard-updated', handleCustomEvent);
      clearInterval(intervalId);
    };
  }, []);
  
  // Save entries to localStorage whenever they change from within this component
  useEffect(() => {
    // Only save if this component modified the entries (not when loaded from storage)
    if (clipboardEntries.length > 0 || currentEntriesRef.current.length > 0) {
      localStorage.setItem('clipboardHistory', JSON.stringify(clipboardEntries));
      currentEntriesRef.current = clipboardEntries;
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('clipboard-updated', {
        detail: { action: 'update' }
      }));
    }
  }, [clipboardEntries]);
  
  // Force a sync with localStorage on component mount
  useEffect(() => {
    // Load clipboard data from storage on mount
    loadEntriesFromStorage();
    
    // Ensure the storage is initialized if empty
    if (!localStorage.getItem('clipboardHistory')) {
      localStorage.setItem('clipboardHistory', '[]');
    }
  }, []);
  
  // Handler for deleting an entry
  const handleDelete = (id) => {
    setClipboardEntries(prev => prev.filter(entry => entry.id !== id));
  };
  
  // Handler for clearing all entries
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all clipboard entries?')) {
      setClipboardEntries([]);
    }
  };
  
  // Export clipboard to JSON file
  const handleExport = () => {
    const dataStr = JSON.stringify(clipboardEntries, null, 2);
    setExportData(dataStr);
    setShowExport(true);
  };
  
  // Download exported data
  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportData);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "clipboard_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setShowExport(false);
  };
  
  // Import clipboard from JSON
  const handleImport = () => {
    setShowImport(true);
  };
  
  // Process imported data
  const processImport = () => {
    try {
      const importedEntries = JSON.parse(importData);
      if (Array.isArray(importedEntries)) {
        // Merge with existing entries, removing duplicates by ID
        const combinedEntries = [...importedEntries, ...clipboardEntries];
        const uniqueEntries = Array.from(
          new Map(combinedEntries.map(entry => [entry.id, entry])).values()
        );
        // Sort by ID (newest first)
        uniqueEntries.sort((a, b) => b.id - a.id);
        setClipboardEntries(uniqueEntries);
        setShowImport(false);
        setImportData('');
        return true;
      } else {
        alert('Invalid import data: not an array');
        return false;
      }
    } catch (error) {
      alert(`Error importing data: ${error.message}`);
      return false;
    }
  };
  
  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportData(e.target.result);
    };
    reader.readAsText(file);
  };
  
  // Copy entry text to system clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Success alert or toast could go here
      })
      .catch(err => {
        console.error('Error copying text: ', err);
      });
  };
  
  return (
    <div className="border border-secondary-200 dark:border-dark-border bg-white dark:bg-dark-surface rounded-lg overflow-hidden mt-4">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer bg-secondary-50 dark:bg-dark-surface-alt"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-md font-semibold flex items-center">
          Clipboard History 
          {clipboardEntries.length > 0 && (
            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
              {clipboardEntries.length}
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
              className="text-xs px-2 py-1 bg-secondary-100 dark:bg-dark-surface-alt rounded hover:bg-secondary-200 dark:hover:bg-dark-hover"
            >
              Export
            </button>
            <button 
              onClick={handleImport}
              className="text-xs px-2 py-1 bg-secondary-100 dark:bg-dark-surface-alt rounded hover:bg-secondary-200 dark:hover:bg-dark-hover"
            >
              Import
            </button>
            <button 
              onClick={handleClearAll}
              className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              Clear All
            </button>
          </div>
          
          {/* Clipboard Entries */}
          <div className="max-h-96 overflow-y-auto">
            {clipboardEntries.length > 0 ? (
              <div className="space-y-2">
                {clipboardEntries.map(entry => (
                  <div key={entry.id} className="p-3 border border-secondary-100 dark:border-dark-border rounded">
                    <div className="flex justify-between items-start">
                      <div className="text-sm break-all mr-2 flex-1">{entry.text}</div>
                      <div className="flex items-center gap-1">
                        <button 
                          className="text-xs p-1 text-blue-500"
                          title="Copy to system clipboard"
                          onClick={() => copyToClipboard(entry.text)}
                        >
                          Copy
                        </button>
                        <button 
                          className="text-xs p-1 text-red-500"
                          title="Delete entry"
                          onClick={() => handleDelete(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-secondary-500 mt-1">{entry.created}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-secondary-500">
                No clipboard entries found
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50" onClick={() => setShowExport(false)}>
          <div className="bg-white dark:bg-dark-surface p-4 rounded-lg shadow-lg max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h4 className="text-lg font-semibold mb-2">Export Clipboard History</h4>
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
      
      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50" onClick={() => setShowImport(false)}>
          <div className="bg-white dark:bg-dark-surface p-4 rounded-lg shadow-lg max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h4 className="text-lg font-semibold mb-2">Import Clipboard History</h4>
            <div className="mb-4">
              <div className="mb-2">
                <button 
                  className="px-3 py-1 bg-secondary-100 dark:bg-dark-surface-alt rounded"
                  onClick={() => fileInputRef.current.click()}
                >
                  Select File
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept=".json"
                  onChange={handleFileUpload}
                />
              </div>
              <textarea 
                className="w-full h-64 p-2 border rounded dark:bg-dark-surface-alt dark:border-dark-border text-xs font-mono"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON clipboard data here or select a file"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button 
                className="px-3 py-1 bg-secondary-100 dark:bg-dark-surface-alt rounded"
                onClick={() => setShowImport(false)}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-1 bg-blue-500 text-white rounded"
                onClick={processImport}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 