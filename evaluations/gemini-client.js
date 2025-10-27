// Gemini Client Wrapper with BrainTrust Tracing
// Prompt loaded from docs/gemini-prompt/classification-prompt.md

const { GoogleGenAI } = require('@google/genai');
const { traced, currentSpan } = require('braintrust');
const fs = require('fs');
const path = require('path');

/**
 * Loads the system instruction prompt from the markdown file
 * @returns {string} The system instruction prompt
 */
function loadPromptFromMarkdown() {
  const promptPath = path.join(__dirname, '..', 'docs', 'gemini-prompt', 'classification-prompt.md');

  try {
    const promptContent = fs.readFileSync(promptPath, 'utf-8');
    return promptContent;
  } catch (error) {
    console.error(`Error loading prompt from ${promptPath}:`, error.message);
    throw new Error(`Failed to load classification prompt from markdown file: ${error.message}`);
  }
}

// Load system instruction from markdown file (cached at module load time)
const SYSTEM_INSTRUCTION = loadPromptFromMarkdown();

/**
 * Creates a Gemini client with the specified configuration
 */
function createGeminiClient(apiKey) {
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });

  // Configure with google search tool
  const tools = [{ googleSearch: {} }];

  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
    tools,
    systemInstruction: [{ text: SYSTEM_INSTRUCTION }]
  };

  return { ai, config };
}

/**
 * Classifies a song using Gemini API with BrainTrust tracing
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Classification result
 */
async function classifySongWithGemini(artist, title, apiKey) {
  return traced(
    async (span) => {
      const startTime = Date.now();

      // Log the input to BrainTrust
      span.log({
        input: { artist, title },
        metadata: {
          model: 'gemini-flash-latest',
          type: 'music-classification'
        }
      });

      try {
        const { ai, config } = createGeminiClient(apiKey);
        const model = 'gemini-flash-latest';
        const prompt = `${artist} - ${title}`;

        const contents = [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ];

        // Generate content using full response API to access tool call metadata
        const response = await ai.models.generateContent({
          model,
          config,
          contents,
        });

        const endTime = Date.now();
        const latency = endTime - startTime;

        // Extract the text from the response
        const fullText = response.text || '';

        // Extract grounding metadata and tool call information from response candidates
        const toolCalls = [];
        let groundingMetadata = null;

        if (response.candidates && response.candidates.length > 0) {
          const candidate = response.candidates[0];

          // Capture grounding metadata if present
          if (candidate.groundingMetadata) {
            groundingMetadata = candidate.groundingMetadata;
          }

          // Check if there are function calls (tool invocations)
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.functionCall) {
                toolCalls.push({
                  name: part.functionCall.name,
                  args: part.functionCall.args || {}
                });
              }
            }
          }
        }

        // Extract search queries from grounding metadata (primary source)
        let searchQueries = [];
        if (groundingMetadata?.webSearchQueries) {
          searchQueries = groundingMetadata.webSearchQueries;
        }

        // Also check traditional function calls as fallback
        const functionCallQueries = toolCalls
          .filter(tc => tc.name === 'googleSearch' || tc.name === 'google_search')
          .map(tc => tc.args.query || tc.args.q || '')
          .filter(q => q.length > 0);

        // Combine both sources
        searchQueries = [...searchQueries, ...functionCallQueries];

        // Log the output to BrainTrust with tool call metadata
        span.log({
          output: fullText,
          metadata: {
            latency_ms: latency,
            response_length: fullText.length,
            tool_calls_used: toolCalls.length > 0,
            tool_call_count: toolCalls.length,
            search_queries: searchQueries,
            tool_calls: toolCalls,
            grounding_metadata: groundingMetadata,
            has_grounding: !!groundingMetadata
          }
        });

        return {
          artist,
          title,
          classification: fullText,
          latency_ms: latency,
          model: 'gemini-flash-latest'
        };

      } catch (error) {
        span.log({
          error: error.message,
          metadata: {
            error_type: error.constructor.name
          }
        });

        throw error;
      }
    },
    {
      name: 'classify_song_gemini',
      type: 'llm'
    }
  );
}

module.exports = {
  createGeminiClient,
  classifySongWithGemini,
  SYSTEM_INSTRUCTION
};
