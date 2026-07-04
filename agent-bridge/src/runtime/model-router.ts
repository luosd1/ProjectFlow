/**
 * Model router — supports multiple providers (OpenAI-compatible, OpenRouter, DeepSeek, Anthropic, mock).
 * Provider selection from RuntimeConfig. Key resolution in sidecar internal.
 */

export type ProviderType = "openai" | "openai-compatible" | "openrouter" | "deepseek" | "anthropic" | "mock";

export interface ModelConfig {
  provider: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelRouterConfig {
  defaultProvider: ProviderType;
  defaultModel: string;
  providers: Partial<Record<ProviderType, ProviderConfig>>;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  headers?: Record<string, string>;
}

export class ModelRouter {
  private readonly config: ModelRouterConfig;

  constructor(config: ModelRouterConfig) {
    this.config = config;
  }

  /** Resolve the full model configuration for a given provider/model pair. */
  resolve(provider?: string, model?: string): ModelConfig {
    const providerType = (provider ?? this.config.defaultProvider) as ProviderType;
    const modelName = model ?? this.config.defaultModel;

    if (providerType === "mock") {
      return {
        provider: "mock",
        name: modelName,
      };
    }

    const providerConfig = this.config.providers[providerType];
    if (!providerConfig) {
      throw new Error(`未配置的模型提供商: ${providerType}`);
    }

    return {
      provider: providerType,
      name: modelName || providerConfig.defaultModel,
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl,
    };
  }

  /** Get the API endpoint URL for a provider. */
  getEndpoint(provider: ProviderType): string {
    if (provider === "mock") return "http://localhost:mock";

    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      throw new Error(`未配置的模型提供商: ${provider}`);
    }

    return providerConfig.baseUrl;
  }

  /** Get auth headers for a provider. */
  getAuthHeaders(provider: ProviderType): Record<string, string> {
    if (provider === "mock") return {};

    const providerConfig = this.config.providers[provider];
    if (!providerConfig) return {};

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...providerConfig.headers,
    };

    if (providerConfig.apiKey) {
      if (provider === "anthropic") {
        headers["x-api-key"] = providerConfig.apiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers["Authorization"] = `Bearer ${providerConfig.apiKey}`;
      }
    }

    return headers;
  }
}

/** Create a model router from environment variables. */
export function createModelRouterFromEnv(env: Record<string, string | undefined> = process.env): ModelRouter {
  const defaultProvider = (env.DEFAULT_MODEL_PROVIDER ?? "mock") as ProviderType;
  const defaultModel = env.DEFAULT_MODEL_NAME ?? "mock-model";

  const providers: Partial<Record<ProviderType, ProviderConfig>> = {};

  if (env.OPENAI_API_KEY) {
    providers["openai"] = {
      baseUrl: env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      defaultModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  if (env.OPENROUTER_API_KEY) {
    providers["openrouter"] = {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      defaultModel: env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    };
  }

  if (env.DEEPSEEK_API_KEY) {
    providers["deepseek"] = {
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: env.DEEPSEEK_API_KEY,
      defaultModel: env.DEEPSEEK_MODEL ?? "deepseek-chat",
    };
  }

  if (env.ANTHROPIC_API_KEY) {
    providers["anthropic"] = {
      baseUrl: "https://api.anthropic.com/v1",
      apiKey: env.ANTHROPIC_API_KEY,
      defaultModel: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    };
  }

  return new ModelRouter({
    defaultProvider,
    defaultModel,
    providers,
  });
}
