You are building a production-grade AI provider orchestration layer for a GitHub Repo Analyzer platform.

Your task is to redesign the Gemini integration into a resilient multi-model AI service.

GOALS:

* Automatically detect working Gemini models
* Retry across multiple models if one fails
* Validate API connectivity before analysis
* Gracefully fallback to numeric analysis if all AI models fail
* Prevent app crashes
* Log precise failure reasons

IMPLEMENTATION REQUIREMENTS:

1. Create a dedicated AI provider service layer:
   server/services/aiProviderService.js

2. Add support for testing multiple Gemini models in sequence:

   * gemini-1.5-flash
   * gemini-1.5-flash-latest
   * gemini-1.5-pro
   * gemini-pro
   * gemini-2.0-flash-exp

3. Implement:
   async function findWorkingModel()

Behavior:

* Ping each model with a lightweight test prompt:
  "Respond with the word OK"
* Stop at first successful model
* Cache successful model in memory for reuse

4. Handle all Gemini failure types:

   * Invalid API key
   * 400 bad request
   * 429 quota exceeded
   * model not found
   * SDK incompatibility
   * timeout
   * empty response

5. Add structured logging:
   {
   provider,
   model,
   success,
   latency,
   error
   }

6. Build retry strategy:

   * maxRetries = 2
   * exponential backoff

7. If ALL Gemini models fail:

   * Automatically switch to fallback numeric analysis
   * Return:
     {
     source: "fallback",
     reason: "all_models_failed"
     }

8. Add startup validation:
   On server boot:

   * verify GEMINI_API_KEY exists
   * test at least one model
   * print working model

9. Add API route:
   GET /api/health/ai

Response:
{
status,
working_model,
provider,
latency
}

10. Ensure:

* No frontend API key exposure
* No unhandled promise rejections
* No crashes if Gemini unavailable

11. Optimize for:

* token efficiency
* fast failover
* clean architecture

12. Use latest Google Generative AI SDK patterns.

13. Add extensive inline comments explaining:

* failover logic
* retry flow
* model testing
* caching behavior
