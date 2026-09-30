interface TypeSafeScreenParams {
    title: string;
    abstract: string;
    screeningPrompt: string;
    model: string;
    outputLanguage: string;
}

const INCLUDE_QUESTION = 'Based on `screening_prompt`, should this record be included at the title/abstract screening stage?';

interface NoulQuestion {
    type: 'noul';
    instructions: {
        screening_prompt?: string;
        question: string;
    };
}

export function buildTypeSafeScreeningRequest(params: TypeSafeScreenParams) {
    const questions: Record<string, NoulQuestion> = {
        include: { type: 'noul', instructions: { screening_prompt: params.screeningPrompt, question: INCLUDE_QUESTION } },
    };
    return {
        body: { model: params.model, state: { title: params.title, abstract: params.abstract || '(no abstract)' }, questions },
    };
}

function asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function parseTypeSafeScreeningResponse(
    data: unknown,
    params: TypeSafeScreenParams
) {
    const response = asRecord(data);
    const answers = asRecord(response.answers);
    const probability = asRecord(answers.include).noul;
    if (typeof probability !== 'number' || !Number.isFinite(probability)) {
        throw new Error('TypeSafe: response include.noul is not a finite number');
    }
    const usage = asRecord(response.usage);
    const promptTokenCount = typeof usage.input_tokens === 'number' && Number.isFinite(usage.input_tokens) ? usage.input_tokens : 0;
    const candidatesTokenCount = typeof usage.output_tokens === 'number' && Number.isFinite(usage.output_tokens) ? usage.output_tokens : 0;
    return {
        output: {
            include_probability: Math.min(1, Math.max(0, probability)),
            reasons: [],
            evidence: [],
        },
        usageMetadata: {
            promptTokenCount, candidatesTokenCount, thoughtsTokenCount: 0, totalTokenCount: promptTokenCount + candidatesTokenCount,
            ...(typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0 ? { costUsd: usage.cost } : {}),
        },
        responseMetadata: {
            modelVersion: typeof response.model === 'string' && response.model.trim() ? response.model : params.model,
            ...(typeof response.id === 'string' ? { responseId: response.id } : {}),
        },
    };
}

function sanitizeApiKey(rawKey: string, providerName = 'TypeSafe'): string {
    let out = '';
    for (const ch of rawKey.trim()) {
        const cp = ch.codePointAt(0);
        if (cp === undefined) continue;
        if (cp === 0x200B || cp === 0x200C || cp === 0x200D ||
            cp === 0x2060 || cp === 0xFEFF || cp === 0x00A0) continue;
        if (cp > 255) {
            throw new Error(`${providerName} API key contains characters outside ISO-8859-1. `
                + 'Re-enter the API key; pasted text may contain unsupported or invisible characters.');
        }
        out += ch;
    }
    return out;
}

export async function screenViaTypeSafe(
    params: TypeSafeScreenParams, timeoutMs = 60000
) {
    const rawKey = process.env.TYPE_SAFE_API_KEY;
    const apiKey = rawKey ? sanitizeApiKey(rawKey, 'TypeSafe') : '';
    if (!apiKey) {
        throw new Error('Set TYPE_SAFE_API_KEY in the environment or root .env file.');
    }
    const { body } = buildTypeSafeScreeningRequest(params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = 'https://api.typesafe.ai/v1/systemone';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = (await response.text().catch(() => '')).split(apiKey).join('[REDACTED]');
            const unknownModel = response.status === 400 && text.includes('Unknown model');
            const detail = unknownModel
                ? `Model ${params.model} not found (it may no longer be available). Response=${text.slice(0, 200)}`
                : text.slice(0, 200);
            const error = new Error(`TypeSafe API error ${response.status}: ${detail}`);
            if (response.status === 401 || response.status === 403
                || unknownModel) Object.assign(error, { retryable: false });
            throw error;
        }
        return parseTypeSafeScreeningResponse(await response.json(), params);
    } finally {
        clearTimeout(timer);
    }
}

