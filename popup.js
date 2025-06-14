document.addEventListener('DOMContentLoaded', function () {
  const urlDisplay = document.getElementById('urlDisplay')
  const loadingContainer = document.getElementById('loadingContainer')
  const analysisResult = document.getElementById('analysisResult')
  const baseUrl = 'http://localhost:4111'
  const workflowId = 'headlineMeterWorkflow'

  // Function to display analysis results
  function displayAnalysisResult(result) {
    if (result) {
      const formattedResult = result.replace(/\n/g, '<br>')
      analysisResult.innerHTML = `<div class="analysis-content">${formattedResult}</div>`
      analysisResult.style.display = 'block'
    }
  }

  function displayError(error) {
    analysisResult.textContent = `Error: ${error}`
    analysisResult.style.display = 'block'
  }

  // Function to analyze URL with Mastra
  async function analyzeUrl(url) {
    loadingContainer.style.display = 'flex'
    analysisResult.textContent = ''

    try {
      // First check if we have cached results
      const cacheKey = `headline-analysis-${url}`
      const cachedData = await new Promise(resolve => {
        chrome.storage.local.get(cacheKey, result => resolve(result[cacheKey]))
      })

      // If we have cached results, use them
      if (cachedData) {
        displayAnalysisResult(cachedData)
        loadingContainer.style.display = 'none'
        return
      }

      // Otherwise perform the analysis
      const createRunResponse = await fetch(`${baseUrl}/api/workflows/${workflowId}/create-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!createRunResponse.ok) {
        const errorText = await createRunResponse.text()
        throw new Error(`Failed to create run: ${createRunResponse.status} - ${errorText}`)
      }

      const runData = await createRunResponse.json()
      const runId = runData.runId || runData.id || (typeof runData === 'string' ? runData : null)

      if (!runId) {
        throw new Error('No runId found in create-run response')
      }

      const startResponse = await fetch(`${baseUrl}/api/workflows/${workflowId}/start-async?runId=${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputData: {
            url: url,
            task: 'Analyze this headline or article URL. Provide an assessment of its tone, potential bias, and emotional impact.'
          }
        })
      })

      if (!startResponse.ok) {
        const errorText = await startResponse.text()
        throw new Error(`Failed to start workflow: ${startResponse.status} - ${errorText}`)
      }

      const response = await startResponse.json()
      let analysisOutput = null

      if (response && response.payload && response.payload.workflowState && 
          response.payload.workflowState.result && response.payload.workflowState.result.output) {
        analysisOutput = response.payload.workflowState.result.output
      } else if (response && response.result && response.result.output) {
        analysisOutput = response.result.output
      } else if (response && response.output) {
        analysisOutput = response.output
      }

      if (analysisOutput) {
        // Cache the result
        chrome.storage.local.set({ [cacheKey]: analysisOutput })
        
        // Display the result
        displayAnalysisResult(analysisOutput)
      } else {
        throw new Error('Could not extract analysis result from the response')
      }
    } catch (error) {
      displayError(error.message)
    } finally {
      loadingContainer.style.display = 'none'
    }
  }

  // Get current tab URL and analyze it
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs.length > 0) {
      const currentUrl = tabs[0].url
      urlDisplay.textContent = currentUrl
      analyzeUrl(currentUrl)
    } else {
      urlDisplay.textContent = 'Could not retrieve URL.'
      loadingContainer.style.display = 'none'
    }
  })
})
