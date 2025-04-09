import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react"; // Import icons for expand/collapse
import Button from "./Button";
import CryptoJS from 'crypto-js';

// Add a simple Tooltip component
function Tooltip({ text, children }) {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="inline-block relative">
      <span
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </span>
      {isVisible && (
        <div className="absolute z-50 w-72 p-3 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded shadow-lg border border-gray-200 dark:border-gray-700" style={{ top: "calc(100% + 10px)", left: "-20px", right: "auto" }}>
          {text}
          <div className="absolute top-0 left-4 -translate-y-1/2 w-2 h-2 rotate-45 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700"></div>
        </div>
      )}
    </div>
  );
}

export default function WebhookManager() {
  const [webhookEndpoints, setWebhookEndpoints] = useState({});
  const [formData, setFormData] = useState({
    key: "",
    url: "",
    method: "ANY",
    authMethod: "none", // Default to no authentication
    apiKeyHeaderName: "X-API-Key", // Default header name
    apiKey: "",
    username: "",
    password: "",
    bearerToken: "",
    customHeaderName: "",
    customHeaderValue: "",
    description: "",
  });
  const [errorMessage, setErrorMessage] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isTipsExpanded, setIsTipsExpanded] = useState(false); // Tips collapsed by default
  const fileInputRef = useRef(null); // Reference for hidden file input
  const [showEncryptModal, setShowEncryptModal] = useState(false);
  const [encryptPassword, setEncryptPassword] = useState("");
  const [decryptPassword, setDecryptPassword] = useState("");
  const [showDecryptModal, setShowDecryptModal] = useState(false);
  const [fileToImport, setFileToImport] = useState(null);

  // Load saved endpoints on component mount
  useEffect(() => {
    const savedEndpoints = localStorage.getItem("webhookEndpoints");
    if (savedEndpoints) {
      try {
        setWebhookEndpoints(JSON.parse(savedEndpoints));
      } catch (e) {
        console.error("Error loading webhook endpoints", e);
        setErrorMessage("Failed to load saved webhook endpoints");
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear relevant error when user makes a change
    if (formErrors[name]) {
      setFormErrors({...formErrors, [name]: null});
    }
  };

  // Validate and normalize endpoint key to prevent common issues
  const formatEndpointKey = (key) => {
    // Replace spaces with hyphens and trim whitespace
    return key.trim().replace(/\s+/g, '-').toLowerCase();
  };

  // Validate the form before submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const errors = {};
    
    // Validate endpoint key
    if (!formData.key.trim()) {
      errors.key = "Endpoint key is required";
    } else if (formData.key.includes('_')) {
      errors.key = "Please use hyphens (-) instead of underscores (_)";
    }
    
    // Validate URL
    if (!formData.url.trim()) {
      errors.url = "URL is required";
    } else {
      try {
        new URL(formData.url); // Validates URL format
      } catch (e) {
        errors.url = "Please enter a valid URL";
      }
    }
    
    // For POST endpoints, strongly encourage a description
    if (formData.method === "POST" && (!formData.description || formData.description.trim().length < 10)) {
      errors.description = "Please provide a detailed description for POST endpoints, including required payload fields";
    }
    
    // For search endpoints, provide specific guidance
    if (formData.key.toLowerCase().includes('search') && (!formData.description || !formData.description.toLowerCase().includes('query'))) {
      errors.description = "For search endpoints, please specify that a 'query' field is required in the payload";
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    // Continue with form submission if validation passes
    addOrUpdateEndpoint();
  };

  const addOrUpdateEndpoint = () => {
    try {
      // Validate form fields
      if (!formData.key.trim()) {
        throw new Error("Endpoint key is required");
      } else if (formData.key.includes('_')) {
        throw new Error("Endpoint key should not contain underscores");
      }
      
      if (!formData.url.trim()) {
        throw new Error("URL is required");
      }
      
      try {
        new URL(formData.url); // Validates URL format
      } catch (urlError) {
        throw new Error("Please enter a valid URL");
      }
      
      // Warn about missing payload info for POST endpoints
      if (formData.method === "POST" && (!formData.description || formData.description.trim().length < 10)) {
        if (!window.confirm("POST endpoints should include payload details in the description. Continue anyway?")) {
          return;
        }
      }
      
      // Check if search endpoint has 'query' in description
      if (formData.key.toLowerCase().includes('search') && (!formData.description || !formData.description.toLowerCase().includes('query'))) {
        if (!window.confirm("Search endpoints should mention 'query' parameter in the description. Continue anyway?")) {
          return;
        }
      }
      
      const formattedKey = formatEndpointKey(formData.key);
      
      // When editing, preserve existing credentials if masked
      let apiKey = formData.apiKey;
      let password = formData.password;
      let bearerToken = formData.bearerToken;
      let customHeaderValue = formData.customHeaderValue;
      
      // If we're editing an existing webhook
      if (editingKey && webhookEndpoints[editingKey]) {
        const existingConfig = webhookEndpoints[editingKey];
        
        // Don't overwrite credentials with masked placeholders
        if (formData.apiKey === '••••••••••••••••' && existingConfig.apiKey) {
          apiKey = existingConfig.apiKey;
        }
        
        if (formData.password === '••••••••••••••••' && existingConfig.password) {
          password = existingConfig.password;
        }
        
        if (formData.bearerToken === '••••••••••••••••' && existingConfig.bearerToken) {
          bearerToken = existingConfig.bearerToken;
        }
        
        if (formData.customHeaderValue === '••••••••••••••••' && 
            (existingConfig.customHeaderName.toLowerCase().includes('token') || 
             existingConfig.customHeaderName.toLowerCase().includes('key') || 
             existingConfig.customHeaderName.toLowerCase().includes('auth'))) {
          customHeaderValue = existingConfig.customHeaderValue;
        }
      }
      
      // Create updated endpoints object
      const updatedEndpoints = {
        ...webhookEndpoints,
        [formattedKey]: {
          url: formData.url,
          method: formData.method,
          authMethod: formData.authMethod,
          apiKeyHeaderName: formData.apiKeyHeaderName,
          apiKey: apiKey,
          username: formData.username,
          password: password,
          bearerToken: bearerToken,
          customHeaderName: formData.customHeaderName,
          customHeaderValue: customHeaderValue,
          description: formData.description,
        },
      };
      
      // If we're renaming the endpoint key
      if (editingKey && editingKey !== formattedKey) {
        delete updatedEndpoints[editingKey];
      }
      
      // Update state and localStorage
      setWebhookEndpoints(updatedEndpoints);
      localStorage.setItem("webhookEndpoints", JSON.stringify(updatedEndpoints));
      
      // Reset form and editing state
      resetForm();
      setEditingKey(null);
      setErrorMessage(`Webhook endpoint ${formattedKey} has been saved`);
      setTimeout(() => setErrorMessage(null), 3000);
      
    } catch (error) {
      console.error("Error adding webhook endpoint:", error);
      setErrorMessage(error.message);
    }
  };

  const startEdit = (key) => {
    const config = webhookEndpoints[key];
    setEditingKey(key);
    setFormData({
      key,
      url: typeof config === 'object' ? config.url : config,
      method: typeof config === 'object' ? config.method : 'ANY',
      authMethod: typeof config === 'object' ? config.authMethod || 'none' : 'none',
      apiKeyHeaderName: typeof config === 'object' ? config.apiKeyHeaderName : 'X-API-Key',
      // Mask sensitive fields with placeholders instead of showing actual values
      apiKey: typeof config === 'object' && config.apiKey ? '••••••••••••••••' : '',
      username: typeof config === 'object' ? config.username : '',
      // Mask password field if it exists
      password: typeof config === 'object' && config.password ? '••••••••••••••••' : '',
      // Mask bearer token if it exists
      bearerToken: typeof config === 'object' && config.bearerToken ? '••••••••••••••••' : '',
      // Mask custom header value if it looks like a credential
      customHeaderName: typeof config === 'object' ? config.customHeaderName : '',
      customHeaderValue: typeof config === 'object' ? 
        (config.customHeaderValue && 
         (config.customHeaderName.toLowerCase().includes('token') || 
          config.customHeaderName.toLowerCase().includes('key') || 
          config.customHeaderName.toLowerCase().includes('auth')) ? 
         '••••••••••••••••' : config.customHeaderValue) : '',
      description: typeof config === 'object' ? config.description : '',
    });
    setIsExpanded(true); // Ensure form is visible when editing
  };

  const removeEndpoint = (key) => {
    const updated = { ...webhookEndpoints };
    delete updated[key];
    setWebhookEndpoints(updated);
    localStorage.setItem("webhookEndpoints", JSON.stringify(updated));
  };

  const descriptionTooltip = (
    <div>
      <p className="font-medium">Clear description of what this webhook does and what fields are required in the payload.</p>
      <p className="font-bold mt-2 text-blue-600 dark:text-blue-400">For search endpoints, be VERY specific about required fields!</p>
      <p className="mt-1">Example: <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-1 rounded">Searches Brave Search API. Required payload: {"\"query\": \"search term\""}. Returns list of search results.</span></p>
      <p className="mt-2 text-rose-500 dark:text-rose-400">Do NOT create default payloads with generic values - a specific query is always required.</p>
      <p className="mt-2">The AI will use this description to understand how to use your webhook correctly.</p>
    </div>
  );

  const exportWebhooks = () => {
    setShowEncryptModal(true);
  };
  
  const processExport = (useEncryption = false) => {
    try {
      const webhooksJson = JSON.stringify(webhookEndpoints, null, 2);
      let finalData = webhooksJson;
      let filename = "webhook_endpoints.json";
      
      if (useEncryption && encryptPassword) {
        finalData = CryptoJS.AES.encrypt(webhooksJson, encryptPassword).toString();
        filename = "webhook_endpoints_encrypted.json";
      }
      
      const blob = new Blob([finalData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShowEncryptModal(false);
      setEncryptPassword("");
    } catch (error) {
      console.error("Error exporting webhooks:", error);
      alert("Failed to export webhooks!");
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileToImport(file);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target.result;
        
        try {
          const parsedData = JSON.parse(content);
          importWebhooks(parsedData);
        } catch (error) {
          setShowDecryptModal(true);
        }
      };
      
      reader.readAsText(file);
    }
  };
  
  const processImport = () => {
    if (!fileToImport) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      
      try {
        const decrypted = CryptoJS.AES.decrypt(content, decryptPassword).toString(CryptoJS.enc.Utf8);
        if (!decrypted) {
          throw new Error("Decryption failed - incorrect password");
        }
        
        const parsedData = JSON.parse(decrypted);
        importWebhooks(parsedData);
        
        setShowDecryptModal(false);
        setDecryptPassword("");
        setFileToImport(null);
      } catch (error) {
        console.error("Error decrypting file:", error);
        alert("Failed to decrypt file. Please check your password and try again.");
      }
    };
    
    reader.readAsText(fileToImport);
  };

  const importWebhooks = (data) => {
    try {
      if (typeof data !== "object" || data === null) {
        throw new Error("Invalid webhook data format");
      }

      let isValid = true;
      Object.values(data).forEach((endpoint) => {
        if (!endpoint.url || !endpoint.method) {
          isValid = false;
        }
      });

      if (!isValid) {
        throw new Error("Invalid webhook endpoint data");
      }

      const updatedWebhooks = { ...webhookEndpoints, ...data };
      setWebhookEndpoints(updatedWebhooks);
      localStorage.setItem("webhookEndpoints", JSON.stringify(updatedWebhooks));
      alert("Webhooks imported successfully!");
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFileToImport(null);
    } catch (error) {
      console.error("Error importing webhooks:", error);
      alert("Failed to import webhooks: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      key: "",
      url: "",
      method: "ANY",
      authMethod: "none",
      apiKeyHeaderName: "X-API-Key",
      apiKey: "",
      username: "",
      password: "",
      bearerToken: "",
      customHeaderName: "",
      customHeaderValue: "",
      description: "",
    });
    setFormErrors({});
  };

  return (
    <div className="mb-4 border-t border-secondary-200 dark:border-dark-border pt-4 mt-4">
      <div 
        className="flex items-center justify-between cursor-pointer mb-2 pr-6" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-xl font-semibold text-secondary-800 dark:text-dark-text flex-1">
          Webhook Endpoints Manager
        </h2>
        <button className="text-secondary-500 dark:text-dark-text-secondary hover:bg-secondary-100 dark:hover:bg-dark-surface-alt p-2 rounded-full">
          {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-2">
          <div className="flex justify-center mb-3 gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".json" 
              className="hidden" 
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium shadow-sm"
            >
              Import Webhooks
            </button>
            <button
              onClick={exportWebhooks}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm"
            >
              Export Webhooks
            </button>
          </div>
          
          {errorMessage && (
            <div className={`mb-4 p-3 rounded border ${errorMessage.includes('successfully') ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/30 dark:text-green-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400'}`}>
              {errorMessage}
            </div>
          )}
    
          <form onSubmit={handleSubmit} className="bg-white dark:bg-dark-surface p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-3 text-secondary-800 dark:text-dark-text">
              {editingKey ? `Edit Webhook: ${editingKey}` : "Add New Webhook Endpoint"}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                  Endpoint Key (used in webhook_call tool):
                </label>
                <input
                  type="text"
                  name="key"
                  value={formData.key}
                  onChange={handleInputChange}
                  placeholder="e.g., n8n-brave-search"
                  className={`w-full p-2 border rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt ${formErrors.key ? 'border-red-500 dark:border-red-800' : 'border-gray-300 dark:border-gray-600'}`}
                  disabled={!!editingKey}
                />
                {formErrors.key && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.key}</p>}
              </div>
              
              <div>
                <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                  Webhook URL:
                </label>
                <input
                  type="text"
                  name="url"
                  value={formData.url}
                  onChange={handleInputChange}
                  placeholder="https://example.com/api/webhook"
                  className={`w-full p-2 border rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt ${formErrors.url ? 'border-red-500 dark:border-red-800' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {formErrors.url && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.url}</p>}
              </div>
              
              <div>
                <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                  Required HTTP Method:
                </label>
                <select
                  name="method"
                  value={formData.method}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                >
                  <option value="ANY">Any (Auto-select)</option>
                  <option value="GET">GET only</option>
                  <option value="POST">POST only</option>
                </select>
              </div>
              
              <div>
                <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                  Authentication Method:
                </label>
                <select
                  name="authMethod"
                  value={formData.authMethod}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                >
                  <option value="none">No Authentication</option>
                  <option value="apiKey">API Key</option>
                  <option value="basicAuth">Basic Auth</option>
                  <option value="bearerToken">Bearer Token</option>
                  <option value="customHeader">Custom Header</option>
                </select>
              </div>
              
              {formData.authMethod === "apiKey" && (
                <div>
                  <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                    API Key Header Name:
                  </label>
                  <input
                    type="text"
                    name="apiKeyHeaderName"
                    value={formData.apiKeyHeaderName}
                    onChange={handleInputChange}
                    placeholder="e.g., X-API-Key"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                  />
                </div>
              )}
              
              {formData.authMethod === "apiKey" && (
                <div>
                  <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                    API Key:
                  </label>
                  <input
                    type="text"
                    name="apiKey"
                    value={formData.apiKey}
                    onChange={handleInputChange}
                    placeholder="Your API key"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                  />
                </div>
              )}
              
              {formData.authMethod === "basicAuth" && (
                <div>
                  <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                    Username:
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Your username"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                  />
                </div>
              )}
              
              {formData.authMethod === "basicAuth" && (
                <div>
                  <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                    Password:
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Your password"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                  />
                </div>
              )}
              
              {formData.authMethod === "bearerToken" && (
                <div>
                  <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                    Bearer Token:
                  </label>
                  <input
                    type="text"
                    name="bearerToken"
                    value={formData.bearerToken}
                    onChange={handleInputChange}
                    placeholder="Your Bearer Token"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                  />
                </div>
              )}
              
              {formData.authMethod === "customHeader" && (
                <div>
                  <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                    Custom Header Name:
                  </label>
                  <input
                    type="text"
                    name="customHeaderName"
                    value={formData.customHeaderName}
                    onChange={handleInputChange}
                    placeholder="e.g., Authorization"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                  />
                </div>
              )}
              
              {formData.authMethod === "customHeader" && (
                <div>
                  <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                    Custom Header Value:
                  </label>
                  <input
                    type="text"
                    name="customHeaderValue"
                    value={formData.customHeaderValue}
                    onChange={handleInputChange}
                    placeholder="e.g., Bearer token"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt"
                  />
                </div>
              )}
              
              <div>
                <label className="block mb-1 text-secondary-700 dark:text-dark-text">
                  Description (include payload requirements):
                  <Tooltip text={descriptionTooltip}>
                    <span className="ml-1 inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full h-4 w-4 text-xs">?</span>
                  </Tooltip>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe how to use this webhook, especially any required payload fields"
                  className={`w-full p-2 border rounded h-24 text-secondary-800 dark:text-dark-text bg-white dark:bg-dark-surface-alt ${formErrors.description ? 'border-red-500 dark:border-red-800' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {formErrors.description && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.description}</p>}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-4">
              {editingKey && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingKey(null);
                    setFormData({
                      key: "",
                      url: "",
                      method: "ANY",
                      authMethod: "none",
                      apiKeyHeaderName: "X-API-Key",
                      apiKey: "",
                      username: "",
                      password: "",
                      bearerToken: "",
                      customHeaderName: "",
                      customHeaderValue: "",
                      description: "",
                    });
                    setFormErrors({});
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm"
              >
                {editingKey ? "Update Endpoint" : "Add Endpoint"}
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/30 rounded text-sm">
              <div 
                className="flex items-center justify-between cursor-pointer" 
                onClick={() => setIsTipsExpanded(!isTipsExpanded)}
              >
                <h4 className="font-semibold text-secondary-800 dark:text-dark-text flex items-center">
                  📝 Webhook Configuration Tips
                  <span className="ml-2 text-xs text-secondary-500 dark:text-dark-text-secondary">
                    (click to {isTipsExpanded ? 'collapse' : 'expand'})
                  </span>
                </h4>
                <button className="text-secondary-500 dark:text-dark-text-secondary">
                  {isTipsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
              
              {isTipsExpanded && (
                <ul className="list-disc pl-5 space-y-1 text-secondary-700 dark:text-dark-text-secondary mt-2">
                  <li>Use <strong>hyphens</strong> in endpoint keys (e.g., <code>n8n-brave-search</code>), not underscores.</li>
                  <li>For <strong>search endpoints</strong>, clearly describe that a <code>query</code> field is required.</li>
                  <li>For <strong>POST endpoints</strong>, specify all required payload fields and their formats.</li>
                  <li>Choose the appropriate <strong>authentication method</strong> for your API.</li>
                  <li>For security, endpoint configuration including credentials are only stored in your browser's localStorage.</li>
                  <li>Be precise with endpoint keys - the AI will use them exactly as configured.</li>
                </ul>
              )}
            </div>
          </form>
    
          <div className="space-y-2 max-h-[30rem] overflow-y-auto">
            {Object.entries(webhookEndpoints).map(([key, config]) => {
              const url = typeof config === 'string' ? config : config.url;
              const method = typeof config === 'object' && config.method ? config.method : 'ANY';
              const description = typeof config === 'object' ? config.description : null;
              
              const authMethod = typeof config === 'object' ? config.authMethod || 'none' : 'none';
              const apiKey = typeof config === 'object' ? config.apiKey : null;
              const apiKeyHeaderName = typeof config === 'object' ? config.apiKeyHeaderName || 'X-API-Key' : 'X-API-Key';
              const username = typeof config === 'object' ? config.username : null;
              const bearerToken = typeof config === 'object' ? config.bearerToken : null;
              const customHeaderName = typeof config === 'object' ? config.customHeaderName : null;
              
              return (
                <div key={key} className="flex flex-col text-sm p-3 border rounded dark:border-dark-border">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-secondary-800 dark:text-dark-text break-all">{key}</span>
                    <div className="flex gap-2 ml-2 shrink-0">
                      <button 
                        onClick={() => startEdit(key)}
                        className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => removeEndpoint(key)}
                        className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="text-xs text-secondary-500 dark:text-dark-text-secondary truncate mt-1">
                    <span className="font-semibold">URL:</span> {url}
                  </span>
                  {method !== 'ANY' && (
                    <span className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                      <span className="font-semibold">Method:</span> {method} only
                    </span>
                  )}
                  {authMethod !== 'none' && (
                    <span className="text-xs text-green-500 dark:text-green-400 mt-1">
                      <span className="font-semibold">Authentication:</span> {
                        authMethod === 'apiKey' ? `API Key (${apiKeyHeaderName})` :
                        authMethod === 'basicAuth' ? `Basic Auth (${username})` :
                        authMethod === 'bearerToken' ? 'Bearer Token' :
                        authMethod === 'customHeader' ? `Custom Header (${customHeaderName})` :
                        'Unknown'
                      }
                    </span>
                  )}
                  {description && (
                    <div className="text-xs text-secondary-600 dark:text-dark-text-secondary mt-2 bg-secondary-50 dark:bg-dark-surface-alt p-2 rounded whitespace-pre-wrap">
                      <span className="font-semibold">Description:</span><br />
                      {description}
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(webhookEndpoints).length === 0 && (
              <p className="text-sm text-secondary-500 dark:text-dark-text-secondary p-2">
                No endpoints configured. Add one above to enable webhook tools.
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Add encryption modal */}
      {showEncryptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Export Options</h3>
            <p className="mb-4">Would you like to encrypt your webhook data with a password?</p>
            
            <div className="mb-4">
              <label className="block mb-2">Encryption Password (optional):</label>
              <input
                type="password"
                value={encryptPassword}
                onChange={(e) => setEncryptPassword(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                placeholder="Leave empty for no encryption"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowEncryptModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => processExport(encryptPassword.length > 0)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add decryption modal */}
      {showDecryptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Encrypted File Detected</h3>
            <p className="mb-4">This file appears to be encrypted. Please enter the password to decrypt:</p>
            
            <div className="mb-4">
              <input
                type="password"
                value={decryptPassword}
                onChange={(e) => setDecryptPassword(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                placeholder="Enter decryption password"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setShowDecryptModal(false);
                  setFileToImport(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={processImport}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm"
              >
                Decrypt & Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 