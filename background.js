// Background script for Headline Meter extension
const baseUrl = 'http://localhost:4111';
const workflowId = 'headlineMeterWorkflow';

// Store analysis results by URL
let analysisCache = {};

// Current analysis state
let analysisState = {
  isAnalyzing: false,
  currentUrl: '',
  result: null,
  error: null
};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAnalysisState') {
    // If we're asking about a specific URL and it's in the cache
    if (request.url && analysisCache[request.url]) {
      sendResponse({
        isAnalyzing: false,
        currentUrl: request.url,
        result: analysisCache[request.url].result,
        error: analysisCache[request.url].error
      });
    } else {
      // Otherwise return the current state
      sendResponse(analysisState);
    }
    return true;
  }
  
  if (request.action === 'analyzeUrl') {
    const url = request.url;
    
    // Check if we already have cached results for this URL
    if (analysisCache[url] && analysisCache[url].result) {
      // Return cached results immediately
      sendResponse({
        isAnalyzing: false,
        currentUrl: url,
        result: analysisCache[url].result,
        error: null
      });
      return true;
    }
    
    // Start analysis if not already running for this URL
    if (!analysisState.isAnalyzing || url !== analysisState.currentUrl) {
      analysisState = {
        isAnalyzing: true,
        currentUrl: url,
        result: null,
        error: null
      };
      
      // Start the analysis process
      analyzeUrl(url)
        .then(result => {
          // Update current state
          analysisState.isAnalyzing = false;
          analysisState.result = result;
          
          // Cache the result
          analysisCache[url] = {
            result: result,
            error: null,
            timestamp: Date.now()
          };
        })
        .catch(error => {
          // Update current state
          analysisState.isAnalyzing = false;
          analysisState.error = error.message;
          
          // Cache the error
          analysisCache[url] = {
            result: null,
            error: error.message,
            timestamp: Date.now()
          };
        });
    }
    
    // Return the current state immediately
    sendResponse(analysisState);
    return true;
  }
});

// Function to analyze URL with Mastra workflow
async function analyzeUrl(url) {
  try {
    // Step 1: Create a workflow run
    const createRunResponse = await fetch(`${baseUrl}/api/workflows/${workflowId}/create-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!createRunResponse.ok) {
      const errorText = await createRunResponse.text();
      throw new Error(`Failed to create run: ${createRunResponse.status} - ${errorText}`);
    }

    const runData = await createRunResponse.json();
    const runId = runData.runId || runData.id || (typeof runData === 'string' ? runData : null);

    if (!runId) {
      throw new Error('No runId found in create-run response');
    }

    // Step 2: Start the workflow asynchronously
    const startResponse = await fetch(`${baseUrl}/api/workflows/${workflowId}/start-async?runId=${runId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputData: {
          url: url,
          task: 'Analyze this headline or article URL. Provide an assessment of its tone, potential bias, and emotional impact.'
        }
      })
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Failed to start workflow: ${startResponse.status} - ${errorText}`);
    }

    const response = await startResponse.json();
    
    // Extract the analysis output
    let analysisOutput = null;
    
    if (response && response.payload && response.payload.workflowState && 
        response.payload.workflowState.result && response.payload.workflowState.result.output) {
      analysisOutput = response.payload.workflowState.result.output;
    } else if (response && response.result && response.result.output) {
      analysisOutput = response.result.output;
    } else if (response && response.output) {
      analysisOutput = response.output;
    }
    
    return analysisOutput || JSON.stringify(response);
  } catch (error) {
    throw error;
  }
}
