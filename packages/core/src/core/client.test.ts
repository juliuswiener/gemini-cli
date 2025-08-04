/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  Chat,
  Content,
  EmbedContentResponse,
  GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';
import { findIndexAfterFraction, GeminiClient } from './client.js';
import { AuthType, ContentGenerator } from './contentGenerator.js';
import { GeminiChat } from './geminiChat.js';
import { Config } from '../config/config.js';
import { GeminiEventType, Turn } from './turn.js';
import { getCoreSystemPrompt } from './prompts.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../config/models.js';
import { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import { setSimulate429 } from '../utils/testUtils.js';
import { tokenLimit } from './tokenLimits.js';
import { ideContext } from '../services/ideContext.js';
import { logConcurrentSyntaxDetected } from '../telemetry/loggers.js';

// --- Mocks ---
const mockChatCreateFn = vi.fn();
const mockGenerateContentFn = vi.fn();
const mockEmbedContentFn = vi.fn();
const mockTurnRunFn = vi.fn();
const mockStreamAggregatorMergeStreams = vi.hoisted(() =>
  vi.fn().mockImplementation(async function* () {
    yield* [];
  }),
);
vi.mock('./streamAggregator.js', () => {
  const StreamAggregator = vi.fn();
  StreamAggregator.prototype.mergeStreams = mockStreamAggregatorMergeStreams;
  return { StreamAggregator };
});

vi.mock('@google/genai');
vi.mock('./turn', () => {
  // Define a mock class that has the same shape as the real Turn
  class MockTurn {
    pendingToolCalls = [];
    // The run method is a property that holds our mock function
    run = mockTurnRunFn;

    constructor() {
      // The constructor can be empty or do some mock setup
    }
  }
  // Export the mock class as 'Turn'
  return {
    Turn: MockTurn,
    GeminiEventType: {
      MaxSessionTurns: 'MaxSessionTurns',
      ChatCompressed: 'ChatCompressed',
    },
  };
});

vi.mock('../config/config.js');
vi.mock('./prompts');
vi.mock('../utils/getFolderStructure', () => ({
  getFolderStructure: vi.fn().mockResolvedValue('Mock Folder Structure'),
}));
vi.mock('../utils/errorReporting', () => ({ reportError: vi.fn() }));
vi.mock('../utils/nextSpeakerChecker', () => ({
  checkNextSpeaker: vi.fn().mockResolvedValue(null),
}));
vi.mock('../utils/generateContentResponseUtilities', () => ({
  getResponseText: (result: GenerateContentResponse) =>
    result.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ??
    undefined,
}));
vi.mock('../telemetry/index.js', () => ({
  logApiRequest: vi.fn(),
  logApiResponse: vi.fn(),
  logApiError: vi.fn(),
}));
vi.mock('../services/ideContext.js');
vi.mock('../telemetry/loggers.js', () => ({
  logConcurrentSyntaxDetected: vi.fn(),
  logFlashDecidedToContinue: vi.fn(),
}));

describe('findIndexAfterFraction', () => {
  const history: Content[] = [
    { role: 'user', parts: [{ text: 'This is the first message.' }] }, // JSON length: 66
    { role: 'model', parts: [{ text: 'This is the second message.' }] }, // JSON length: 68
    { role: 'user', parts: [{ text: 'This is the third message.' }] }, // JSON length: 66
    { role: 'model', parts: [{ text: 'This is the fourth message.' }] }, // JSON length: 68
    { role: 'user', parts: [{ text: 'This is the fifth message.' }] }, // JSON length: 65
  ];
  // Total length: 333

  it('should throw an error for non-positive numbers', () => {
    expect(() => findIndexAfterFraction(history, 0)).toThrow(
      'Fraction must be between 0 and 1',
    );
  });

  it('should throw an error for a fraction greater than or equal to 1', () => {
    expect(() => findIndexAfterFraction(history, 1)).toThrow(
      'Fraction must be between 0 and 1',
    );
  });

  it('should handle a fraction in the middle', () => {
    // 333 * 0.5 = 166.5
    // 0: 66
    // 1: 66 + 68 = 134
    // 2: 134 + 66 = 200
    // 200 >= 166.5, so index is 2
    expect(findIndexAfterFraction(history, 0.5)).toBe(2);
  });

  it('should handle a fraction that results in the last index', () => {
    // 333 * 0.9 = 299.7
    // ...
    // 3: 200 + 68 = 268
    // 4: 268 + 65 = 333
    // 333 >= 299.7, so index is 4
    expect(findIndexAfterFraction(history, 0.9)).toBe(4);
  });

  it('should handle an empty history', () => {
    expect(findIndexAfterFraction([], 0.5)).toBe(0);
  });

  it('should handle a history with only one item', () => {
    expect(findIndexAfterFraction(history.slice(0, 1), 0.5)).toBe(0);
  });

  it('should handle history with weird parts', () => {
    const historyWithEmptyParts: Content[] = [
      { role: 'user', parts: [{ text: 'Message 1' }] },
      { role: 'model', parts: [{ fileData: { fileUri: 'derp' } }] },
      { role: 'user', parts: [{ text: 'Message 2' }] },
    ];
    expect(findIndexAfterFraction(historyWithEmptyParts, 0.5)).toBe(1);
  });
});

describe('Gemini Client (client.ts)', () => {
  let client: GeminiClient;
  beforeEach(async () => {
    vi.resetAllMocks();

    // Disable 429 simulation for tests
    setSimulate429(false);

    // Set up the mock for GoogleGenAI constructor and its methods
    const MockedGoogleGenAI = vi.mocked(GoogleGenAI);
    MockedGoogleGenAI.mockImplementation(() => {
      const mock = {
        chats: { create: mockChatCreateFn },
        models: {
          generateContent: mockGenerateContentFn,
          embedContent: mockEmbedContentFn,
        },
      };
      return mock as unknown as GoogleGenAI;
    });

    mockChatCreateFn.mockResolvedValue({} as Chat);
    mockGenerateContentFn.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: '{"key": "value"}' }],
          },
        },
      ],
    } as unknown as GenerateContentResponse);

    // Because the GeminiClient constructor kicks off an async process (startChat)
    // that depends on a fully-formed Config object, we need to mock the
    // entire implementation of Config for these tests.
    const mockToolRegistry = {
      getFunctionDeclarations: vi.fn().mockReturnValue([]),
      getTool: vi.fn().mockReturnValue(null),
    };
    const fileService = new FileDiscoveryService('/test/dir');
    const contentGeneratorConfig = {
      model: 'test-model',
      apiKey: 'test-key',
      vertexai: false,
      authType: AuthType.USE_GEMINI,
    };
    const mockConfigObject = {
      getContentGeneratorConfig: vi
        .fn()
        .mockReturnValue(contentGeneratorConfig),
      getToolRegistry: vi.fn().mockResolvedValue(mockToolRegistry),
      getModel: vi.fn().mockReturnValue('test-model'),
      getEmbeddingModel: vi.fn().mockReturnValue('test-embedding-model'),
      getApiKey: vi.fn().mockReturnValue('test-key'),
      getVertexAI: vi.fn().mockReturnValue(false),
      getUserAgent: vi.fn().mockReturnValue('test-agent'),
      getUserMemory: vi.fn().mockReturnValue(''),
      getFullContext: vi.fn().mockReturnValue(false),
      getSessionId: vi.fn().mockReturnValue('test-session-id'),
      getProxy: vi.fn().mockReturnValue(undefined),
      getWorkingDir: vi.fn().mockReturnValue('/test/dir'),
      getFileService: vi.fn().mockReturnValue(fileService),
      getMaxSessionTurns: vi.fn().mockReturnValue(0),
      getQuotaErrorOccurred: vi.fn().mockReturnValue(false),
      setQuotaErrorOccurred: vi.fn(),
      getNoBrowser: vi.fn().mockReturnValue(false),
      getUsageStatisticsEnabled: vi.fn().mockReturnValue(true),
      getIdeMode: vi.fn().mockReturnValue(false),
      getGeminiClient: vi.fn(),
      getConcurrencyEnabled: vi.fn().mockReturnValue(true),
      getMaxConcurrentCalls: vi.fn().mockReturnValue(3),
      getForcedProcessingMode: vi.fn().mockReturnValue(undefined),
      getDebugMode: vi.fn().mockReturnValue(false),
      getTelemetryEnabled: vi.fn().mockReturnValue(true),
    };
    const MockedConfig = vi.mocked(Config, true);
    MockedConfig.mockImplementation(
      () => mockConfigObject as unknown as Config,
    );

    // We can instantiate the client here since Config is mocked
    // and the constructor will use the mocked GoogleGenAI
    client = new GeminiClient(new Config({} as never));
    mockConfigObject.getGeminiClient.mockReturnValue(client);

    await client.initialize(contentGeneratorConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // NOTE: The following tests for startChat were removed due to persistent issues with
  // the @google/genai mock. Specifically, the mockChatCreateFn (representing instance.chats.create)
  // was not being detected as called by the GeminiClient instance.
  // This likely points to a subtle issue in how the GoogleGenerativeAI class constructor
  // and its instance methods are mocked and then used by the class under test.
  // For future debugging, ensure that the `this.client` in `GeminiClient` (which is an
  // instance of the mocked GoogleGenerativeAI) correctly has its `chats.create` method
  // pointing to `mockChatCreateFn`.
  // it('startChat should call getCoreSystemPrompt with userMemory and pass to chats.create', async () => { ... });
  // it('startChat should call getCoreSystemPrompt with empty string if userMemory is empty', async () => { ... });

  // NOTE: The following tests for generateJson were removed due to persistent issues with
  // the @google/genai mock, similar to the startChat tests. The mockGenerateContentFn
  // (representing instance.models.generateContent) was not being detected as called, or the mock
  // was not preventing an actual API call (leading to API key errors).
  // For future debugging, ensure `this.client.models.generateContent` in `GeminiClient` correctly
  // uses the `mockGenerateContentFn`.
  // it('generateJson should call getCoreSystemPrompt with userMemory and pass to generateContent', async () => { ... });
  // it('generateJson should call getCoreSystemPrompt with empty string if userMemory is empty', async () => { ... });

  describe('generateEmbedding', () => {
    const texts = ['hello world', 'goodbye world'];
    const testEmbeddingModel = 'test-embedding-model';

    it('should call embedContent with correct parameters and return embeddings', async () => {
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];
      const mockResponse: EmbedContentResponse = {
        embeddings: [
          { values: mockEmbeddings[0] },
          { values: mockEmbeddings[1] },
        ],
      };
      mockEmbedContentFn.mockResolvedValue(mockResponse);

      const result = await client.generateEmbedding(texts);

      expect(mockEmbedContentFn).toHaveBeenCalledTimes(1);
      expect(mockEmbedContentFn).toHaveBeenCalledWith({
        model: testEmbeddingModel,
        contents: texts,
      });
      expect(result).toEqual(mockEmbeddings);
    });

    it('should return an empty array if an empty array is passed', async () => {
      const result = await client.generateEmbedding([]);
      expect(result).toEqual([]);
      expect(mockEmbedContentFn).not.toHaveBeenCalled();
    });

    it('should throw an error if API response has no embeddings array', async () => {
      mockEmbedContentFn.mockResolvedValue({} as EmbedContentResponse); // No `embeddings` key

      await expect(client.generateEmbedding(texts)).rejects.toThrow(
        'No embeddings found in API response.',
      );
    });

    it('should throw an error if API response has an empty embeddings array', async () => {
      const mockResponse: EmbedContentResponse = {
        embeddings: [],
      };
      mockEmbedContentFn.mockResolvedValue(mockResponse);
      await expect(client.generateEmbedding(texts)).rejects.toThrow(
        'No embeddings found in API response.',
      );
    });

    it('should throw an error if API returns a mismatched number of embeddings', async () => {
      const mockResponse: EmbedContentResponse = {
        embeddings: [{ values: [1, 2, 3] }], // Only one for two texts
      };
      mockEmbedContentFn.mockResolvedValue(mockResponse);

      await expect(client.generateEmbedding(texts)).rejects.toThrow(
        'API returned a mismatched number of embeddings. Expected 2, got 1.',
      );
    });

    it('should throw an error if any embedding has nullish values', async () => {
      const mockResponse: EmbedContentResponse = {
        embeddings: [{ values: [1, 2, 3] }, { values: undefined }], // Second one is bad
      };
      mockEmbedContentFn.mockResolvedValue(mockResponse);

      await expect(client.generateEmbedding(texts)).rejects.toThrow(
        'API returned an empty embedding for input text at index 1: "goodbye world"',
      );
    });

    it('should throw an error if any embedding has an empty values array', async () => {
      const mockResponse: EmbedContentResponse = {
        embeddings: [{ values: [] }, { values: [1, 2, 3] }], // First one is bad
      };
      mockEmbedContentFn.mockResolvedValue(mockResponse);

      await expect(client.generateEmbedding(texts)).rejects.toThrow(
        'API returned an empty embedding for input text at index 0: "hello world"',
      );
    });

    it('should propagate errors from the API call', async () => {
      const apiError = new Error('API Failure');
      mockEmbedContentFn.mockRejectedValue(apiError);

      await expect(client.generateEmbedding(texts)).rejects.toThrow(
        'API Failure',
      );
    });
  });

  describe('generateContent', () => {
    it('should call generateContent with the correct parameters', async () => {
      const contents = [{ role: 'user', parts: [{ text: 'hello' }] }];
      const generationConfig = { temperature: 0.5 };
      const abortSignal = new AbortController().signal;

      // Mock countTokens
      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 1 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      await client.generateContent(contents, generationConfig, abortSignal);

      expect(mockGenerateContentFn).toHaveBeenCalledWith({
        model: 'test-model',
        config: {
          abortSignal,
          systemInstruction: getCoreSystemPrompt(''),
          temperature: 0.5,
          topP: 1,
        },
        contents,
      });
    });
  });

  describe('generateJson', () => {
    it('should call generateContent with the correct parameters', async () => {
      const contents = [{ role: 'user', parts: [{ text: 'hello' }] }];
      const schema = { type: 'string' };
      const abortSignal = new AbortController().signal;

      // Mock countTokens
      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 1 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      await client.generateJson(contents, schema, abortSignal);

      expect(mockGenerateContentFn).toHaveBeenCalledWith({
        model: 'test-model', // Should use current model from config
        config: {
          abortSignal,
          systemInstruction: getCoreSystemPrompt(''),
          temperature: 0,
          topP: 1,
          responseSchema: schema,
          responseMimeType: 'application/json',
        },
        contents,
      });
    });

    it('should allow overriding model and config', async () => {
      const contents = [{ role: 'user', parts: [{ text: 'hello' }] }];
      const schema = { type: 'string' };
      const abortSignal = new AbortController().signal;
      const customModel = 'custom-json-model';
      const customConfig = { temperature: 0.9, topK: 20 };

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 1 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      await client.generateJson(
        contents,
        schema,
        abortSignal,
        customModel,
        customConfig,
      );

      expect(mockGenerateContentFn).toHaveBeenCalledWith({
        model: customModel,
        config: {
          abortSignal,
          systemInstruction: getCoreSystemPrompt(''),
          temperature: 0.9,
          topP: 1, // from default
          topK: 20,
          responseSchema: schema,
          responseMimeType: 'application/json',
        },
        contents,
      });
    });
  });

  describe('addHistory', () => {
    it('should call chat.addHistory with the provided content', async () => {
      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
      };
      client['chat'] = mockChat as unknown as GeminiChat;

      const newContent = {
        role: 'user',
        parts: [{ text: 'New history item' }],
      };
      await client.addHistory(newContent);

      expect(mockChat.addHistory).toHaveBeenCalledWith(newContent);
    });
  });

  describe('resetChat', () => {
    it('should create a new chat session, clearing the old history', async () => {
      // 1. Get the initial chat instance and add some history.
      const initialChat = client.getChat();
      const initialHistory = await client.getHistory();
      await client.addHistory({
        role: 'user',
        parts: [{ text: 'some old message' }],
      });
      const historyWithOldMessage = await client.getHistory();
      expect(historyWithOldMessage.length).toBeGreaterThan(
        initialHistory.length,
      );

      // 2. Call resetChat.
      await client.resetChat();

      // 3. Get the new chat instance and its history.
      const newChat = client.getChat();
      const newHistory = await client.getHistory();

      // 4. Assert that the chat instance is new and the history is reset.
      expect(newChat).not.toBe(initialChat);
      expect(newHistory.length).toBe(initialHistory.length);
      expect(JSON.stringify(newHistory)).not.toContain('some old message');
    });
  });

  describe('tryCompressChat', () => {
    const mockCountTokens = vi.fn();
    const mockSendMessage = vi.fn();
    const mockGetHistory = vi.fn();

    beforeEach(() => {
      vi.mock('./tokenLimits', () => ({
        tokenLimit: vi.fn(),
      }));

      client['contentGenerator'] = {
        countTokens: mockCountTokens,
      } as unknown as ContentGenerator;

      client['chat'] = {
        getHistory: mockGetHistory,
        addHistory: vi.fn(),
        setHistory: vi.fn(),
        sendMessage: mockSendMessage,
      } as unknown as GeminiChat;
    });

    it('should not trigger summarization if token count is below threshold', async () => {
      const MOCKED_TOKEN_LIMIT = 1000;
      vi.mocked(tokenLimit).mockReturnValue(MOCKED_TOKEN_LIMIT);
      mockGetHistory.mockReturnValue([
        { role: 'user', parts: [{ text: '...history...' }] },
      ]);

      mockCountTokens.mockResolvedValue({
        totalTokens: MOCKED_TOKEN_LIMIT * 0.699, // TOKEN_THRESHOLD_FOR_SUMMARIZATION = 0.7
      });

      const initialChat = client.getChat();
      const result = await client.tryCompressChat('prompt-id-2');
      const newChat = client.getChat();

      expect(tokenLimit).toHaveBeenCalled();
      expect(result).toBeNull();
      expect(newChat).toBe(initialChat);
    });

    it('should trigger summarization if token count is at threshold', async () => {
      const MOCKED_TOKEN_LIMIT = 1000;
      vi.mocked(tokenLimit).mockReturnValue(MOCKED_TOKEN_LIMIT);
      mockGetHistory.mockReturnValue([
        { role: 'user', parts: [{ text: '...history...' }] },
      ]);

      const originalTokenCount = 1000 * 0.7;
      const newTokenCount = 100;

      mockCountTokens
        .mockResolvedValueOnce({ totalTokens: originalTokenCount }) // First call for the check
        .mockResolvedValueOnce({ totalTokens: newTokenCount }); // Second call for the new history

      // Mock the summary response from the chat
      mockSendMessage.mockResolvedValue({
        role: 'model',
        parts: [{ text: 'This is a summary.' }],
      });

      const initialChat = client.getChat();
      const result = await client.tryCompressChat('prompt-id-3');
      const newChat = client.getChat();

      expect(tokenLimit).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalled();

      // Assert that summarization happened and returned the correct stats
      expect(result).toEqual({
        originalTokenCount,
        newTokenCount,
      });

      // Assert that the chat was reset
      expect(newChat).not.toBe(initialChat);
    });

    it('should not compress across a function call response', async () => {
      const MOCKED_TOKEN_LIMIT = 1000;
      vi.mocked(tokenLimit).mockReturnValue(MOCKED_TOKEN_LIMIT);
      mockGetHistory.mockReturnValue([
        { role: 'user', parts: [{ text: '...history 1...' }] },
        { role: 'model', parts: [{ text: '...history 2...' }] },
        { role: 'user', parts: [{ text: '...history 3...' }] },
        { role: 'model', parts: [{ text: '...history 4...' }] },
        { role: 'user', parts: [{ text: '...history 5...' }] },
        { role: 'model', parts: [{ text: '...history 6...' }] },
        { role: 'user', parts: [{ text: '...history 7...' }] },
        { role: 'model', parts: [{ text: '...history 8...' }] },
        {
          role: 'user',
          parts: [{ functionResponse: { name: '...history 8...' } }],
        },
        { role: 'model', parts: [{ text: '...history 10...' }] },
        {
          role: 'user',
          parts: [{ text: '...history 10...' }],
        },
      ]);

      const originalTokenCount = 1000 * 0.7;
      const newTokenCount = 100;

      mockCountTokens
        .mockResolvedValueOnce({ totalTokens: originalTokenCount }) // First call for the check
        .mockResolvedValueOnce({ totalTokens: newTokenCount }); // Second call for the new history

      // Mock the summary response from the chat
      mockSendMessage.mockResolvedValue({
        role: 'model',
        parts: [{ text: 'This is a summary.' }],
      });

      const initialChat = client.getChat();
      const result = await client.tryCompressChat('prompt-id-3');
      const newChat = client.getChat();

      expect(tokenLimit).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalled();

      // Assert that summarization happened and returned the correct stats
      expect(result).toEqual({
        originalTokenCount,
        newTokenCount,
      });
      // Assert that the chat was reset
      expect(newChat).not.toBe(initialChat);

      // 1. standard start context message
      // 2. standard canned user start message
      // 3. compressed summary message
      // 4. standard canned user summary message
      // 5. The last user message (not the last 3 because that would start with a function response)
      expect(newChat.getHistory().length).toEqual(5);
    });

    it('should always trigger summarization when force is true, regardless of token count', async () => {
      mockGetHistory.mockReturnValue([
        { role: 'user', parts: [{ text: '...history...' }] },
      ]);

      const originalTokenCount = 10; // Well below threshold
      const newTokenCount = 5;

      mockCountTokens
        .mockResolvedValueOnce({ totalTokens: originalTokenCount })
        .mockResolvedValueOnce({ totalTokens: newTokenCount });

      // Mock the summary response from the chat
      mockSendMessage.mockResolvedValue({
        role: 'model',
        parts: [{ text: 'This is a summary.' }],
      });

      const initialChat = client.getChat();
      const result = await client.tryCompressChat('prompt-id-1', true); // force = true
      const newChat = client.getChat();

      expect(mockSendMessage).toHaveBeenCalled();

      expect(result).toEqual({
        originalTokenCount,
        newTokenCount,
      });

      // Assert that the chat was reset
      expect(newChat).not.toBe(initialChat);
    });
  });

  describe('sendMessageStream', () => {
    it('should include IDE context when ideMode is enabled', async () => {
      // Arrange
      vi.mocked(ideContext.getOpenFilesContext).mockReturnValue({
        activeFile: '/path/to/active/file.ts',
        selectedText: 'hello',
        cursor: { line: 5, character: 10 },
        recentOpenFiles: [
          { filePath: '/path/to/recent/file1.ts', timestamp: Date.now() },
          { filePath: '/path/to/recent/file2.ts', timestamp: Date.now() },
        ],
      });

      vi.spyOn(client['config'], 'getIdeMode').mockReturnValue(true);

      const mockStream = (async function* () {
        yield { type: 'content', value: 'Hello' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      const initialRequest = [{ text: 'Hi' }];

      // Act
      const stream = client.sendMessageStream(
        initialRequest,
        new AbortController().signal,
        'prompt-id-ide',
      );
      for await (const _ of stream) {
        // consume stream
      }

      // Assert
      expect(ideContext.getOpenFilesContext).toHaveBeenCalled();
      const expectedContext =
        `\nThis is the file that the user was most recently looking at:\n- Path: /path/to/active/file.ts\nThis is the cursor position in the file:\n- Cursor Position: Line 5, Character 10\nThis is the selected text in the active file:\n- hello\nHere are files the user has recently opened, with the most recent at the top:\n- /path/to/recent/file1.ts\n- /path/to/recent/file2.ts\n      `.trim();
      const expectedRequest = [{ text: expectedContext }, ...initialRequest];
      expect(mockTurnRunFn).toHaveBeenCalledWith(
        expectedRequest,
        expect.any(Object),
      );
    });

    it('should return the turn instance after the stream is complete', async () => {
      // Arrange
      const mockStream = (async function* () {
        yield { type: 'content', value: 'Hello' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Act
      const stream = client.sendMessageStream(
        [{ text: 'Hi' }],
        new AbortController().signal,
        'prompt-id-1',
      );

      // Consume the stream manually to get the final return value.
      let finalResult: Turn | undefined;
      while (true) {
        const result = await stream.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
      }

      // Assert
      expect(finalResult).toBeInstanceOf(Turn);
    });

    it('should stop infinite loop after MAX_TURNS when nextSpeaker always returns model', async () => {
      // Get the mocked checkNextSpeaker function and configure it to trigger infinite loop
      const { checkNextSpeaker } = await import(
        '../utils/nextSpeakerChecker.js'
      );
      const mockCheckNextSpeaker = vi.mocked(checkNextSpeaker);
      mockCheckNextSpeaker.mockResolvedValue({
        next_speaker: 'model',
        reasoning: 'Test case - always continue',
      });

      // Mock Turn to have no pending tool calls (which would allow nextSpeaker check)
      const mockStream = (async function* () {
        yield { type: 'content', value: 'Continue...' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Use a signal that never gets aborted
      const abortController = new AbortController();
      const signal = abortController.signal;

      // Act - Start the stream that should loop
      const stream = client.sendMessageStream(
        [{ text: 'Start conversation' }],
        signal,
        'prompt-id-2',
      );

      // Count how many stream events we get
      let eventCount = 0;
      let finalResult: Turn | undefined;

      // Consume the stream and count iterations
      while (true) {
        const result = await stream.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
        eventCount++;

        // Safety check to prevent actual infinite loop in test
        if (eventCount > 200) {
          abortController.abort();
          throw new Error(
            'Test exceeded expected event limit - possible actual infinite loop',
          );
        }
      }

      // Assert
      expect(finalResult).toBeInstanceOf(Turn);

      // Debug: Check how many times checkNextSpeaker was called
      const callCount = mockCheckNextSpeaker.mock.calls.length;

      // If infinite loop protection is working, checkNextSpeaker should be called many times
      // but stop at MAX_TURNS (100). Since each recursive call should trigger checkNextSpeaker,
      // we expect it to be called multiple times before hitting the limit
      expect(mockCheckNextSpeaker).toHaveBeenCalled();

      // The test should demonstrate that the infinite loop protection works:
      // - If checkNextSpeaker is called many times (close to MAX_TURNS), it shows the loop was happening
      // - If it's only called once, the recursive behavior might not be triggered
      if (callCount === 0) {
        throw new Error(
          'checkNextSpeaker was never called - the recursive condition was not met',
        );
      } else if (callCount === 1) {
        // This might be expected behavior if the turn has pending tool calls or other conditions prevent recursion
        console.log(
          'checkNextSpeaker called only once - no infinite loop occurred',
        );
      } else {
        console.log(
          `checkNextSpeaker called ${callCount} times - infinite loop protection worked`,
        );
        // If called multiple times, we expect it to be stopped before MAX_TURNS
        expect(callCount).toBeLessThanOrEqual(100); // Should not exceed MAX_TURNS
      }

      // The stream should produce events and eventually terminate
      expect(eventCount).toBeGreaterThanOrEqual(1);
      expect(eventCount).toBeLessThan(200); // Should not exceed our safety limit
    });

    it('should yield MaxSessionTurns and stop when session turn limit is reached', async () => {
      // Arrange
      const MAX_SESSION_TURNS = 5;
      vi.spyOn(client['config'], 'getMaxSessionTurns').mockReturnValue(
        MAX_SESSION_TURNS,
      );

      const mockStream = (async function* () {
        yield { type: 'content', value: 'Hello' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Act & Assert
      // Run up to the limit
      for (let i = 0; i < MAX_SESSION_TURNS; i++) {
        const stream = client.sendMessageStream(
          [{ text: 'Hi' }],
          new AbortController().signal,
          'prompt-id-4',
        );
        // consume stream
        for await (const _event of stream) {
          // do nothing
        }
      }

      // This call should exceed the limit
      const stream = client.sendMessageStream(
        [{ text: 'Hi' }],
        new AbortController().signal,
        'prompt-id-5',
      );

      const events = [];
      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toEqual([{ type: GeminiEventType.MaxSessionTurns }]);
      expect(mockTurnRunFn).toHaveBeenCalledTimes(MAX_SESSION_TURNS);
    });

    it('should respect MAX_TURNS limit even when turns parameter is set to a large value', async () => {
      // This test verifies that the infinite loop protection works even when
      // someone tries to bypass it by calling with a very large turns value

      // Get the mocked checkNextSpeaker function and configure it to trigger infinite loop
      const { checkNextSpeaker } = await import(
        '../utils/nextSpeakerChecker.js'
      );
      const mockCheckNextSpeaker = vi.mocked(checkNextSpeaker);
      mockCheckNextSpeaker.mockResolvedValue({
        next_speaker: 'model',
        reasoning: 'Test case - always continue',
      });

      // Mock Turn to have no pending tool calls (which would allow nextSpeaker check)
      const mockStream = (async function* () {
        yield { type: 'content', value: 'Continue...' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Use a signal that never gets aborted
      const abortController = new AbortController();
      const signal = abortController.signal;

      // Act - Start the stream with an extremely high turns value
      // This simulates a case where the turns protection is bypassed
      const stream = client.sendMessageStream(
        [{ text: 'Start conversation' }],
        signal,
        'prompt-id-3',
        Number.MAX_SAFE_INTEGER, // Bypass the MAX_TURNS protection
      );

      // Count how many stream events we get
      let eventCount = 0;
      const maxTestIterations = 1000; // Higher limit to show the loop continues

      // Consume the stream and count iterations
      try {
        while (true) {
          const result = await stream.next();
          if (result.done) {
            break;
          }
          eventCount++;

          // This test should hit this limit, demonstrating the infinite loop
          if (eventCount > maxTestIterations) {
            abortController.abort();
            // This is the expected behavior - we hit the infinite loop
            break;
          }
        }
      } catch (error) {
        // If the test framework times out, that also demonstrates the infinite loop
        console.error('Test timed out or errored:', error);
      }

      // Assert that the fix works - the loop should stop at MAX_TURNS
      const callCount = mockCheckNextSpeaker.mock.calls.length;

      // With the fix: even when turns is set to a very high value,
      // the loop should stop at MAX_TURNS (100)
      expect(callCount).toBeLessThanOrEqual(100); // Should not exceed MAX_TURNS
      expect(eventCount).toBeLessThanOrEqual(200); // Should have reasonable number of events

      console.log(
        `Infinite loop protection working: checkNextSpeaker called ${callCount} times, ` +
          `${eventCount} events generated (properly bounded by MAX_TURNS)`,
      );
    });

    it('should log concurrent syntax detected telemetry when concurrent calls are found', async () => {
      // Arrange
      const mockStream = (async function* () {
        yield { type: 'content', value: 'Response to concurrent calls' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      // Mock StreamAggregator.mergeStreams for concurrent execution
      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        yield {
          type: 'content',
          value: 'Concurrent response',
          callId: 'call1',
          callTitle: 'What is TypeScript?',
        };
        yield {
          type: 'content',
          value: 'Concurrent response',
          callId: 'call2',
          callTitle: 'What is JavaScript?',
        };
      });

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Mock telemetry logging function
      const mockLogConcurrentSyntaxDetected = vi.mocked(
        logConcurrentSyntaxDetected,
      );
      mockLogConcurrentSyntaxDetected.mockClear();

      // Act - Call sendMessageStream with concurrent syntax
      const concurrentRequest = [
        { text: 'call1: What is TypeScript?, call2: What is JavaScript?' },
      ];
      const stream = client.sendMessageStream(
        concurrentRequest,
        new AbortController().signal,
        'test-prompt-id',
      );

      // Consume the stream
      for await (const _ of stream) {
        // consume stream
      }

      // Assert - Verify that logConcurrentSyntaxDetected was called
      expect(mockLogConcurrentSyntaxDetected).toHaveBeenCalledTimes(1);
      expect(mockLogConcurrentSyntaxDetected).toHaveBeenCalledWith(
        expect.any(Object), // config
        expect.objectContaining({
          'event.name': 'concurrent_syntax_detected',
          prompt_id: 'test-prompt-id',
          call_count: 2,
          calls: [
            { id: 'call1', prompt: 'What is TypeScript?' },
            { id: 'call2', prompt: 'What is JavaScript?' },
          ],
        }),
      );
    });

    it('should fail to log concurrent telemetry when config disables concurrency', async () => {
      // Arrange - Create a mock config that disables concurrency (like real acceptance test scenario)
      const mockConfigWithDisabledConcurrency = {
        ...client['config'],
        getConcurrencyEnabled: vi.fn().mockReturnValue(false), // This is likely the issue
      };
      client['config'] = mockConfigWithDisabledConcurrency as unknown as Config;

      const mockStream = (async function* () {
        yield {
          type: 'content',
          value: 'Response without concurrent processing',
        };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Mock telemetry logging function
      const mockLogConcurrentSyntaxDetected = vi.mocked(
        logConcurrentSyntaxDetected,
      );
      mockLogConcurrentSyntaxDetected.mockClear();

      // Act - Call sendMessageStream with concurrent syntax
      const concurrentRequest = [
        { text: 'call1: What is TypeScript?, call2: What is JavaScript?' },
      ];
      const stream = client.sendMessageStream(
        concurrentRequest,
        new AbortController().signal,
        'test-prompt-id',
      );

      // Consume the stream
      for await (const _ of stream) {
        // consume stream
      }

      // Assert - Verify that logConcurrentSyntaxDetected was NOT called due to disabled concurrency
      expect(mockLogConcurrentSyntaxDetected).toHaveBeenCalledTimes(0);
    });

    it('should detect concurrent syntax in complex context like acceptance test', async () => {
      // Arrange - Simulate the real acceptance test scenario
      const mockStream = (async function* () {
        yield { type: 'content', value: 'Response to concurrent calls' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      // Mock StreamAggregator.mergeStreams for concurrent execution
      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        yield {
          type: 'content',
          value: 'Concurrent response',
          callId: 'call1',
          callTitle: 'What is TypeScript?',
        };
        yield {
          type: 'content',
          value: 'Concurrent response',
          callId: 'call2',
          callTitle: 'What is JavaScript?',
        };
      });

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Mock telemetry logging function
      const mockLogConcurrentSyntaxDetected = vi.mocked(
        logConcurrentSyntaxDetected,
      );
      mockLogConcurrentSyntaxDetected.mockClear();

      // Act - Test with text that mimics the acceptance test scenario
      const complexRequest = [
        {
          text: "This is the Gemini CLI. We are setting up the context for our chat.\nToday's date is Thursday, July 24, 2025.\nMy operating system is: linux\nI'm currently working in the directory: /home/julius/01_Private/02_Projects/gemini-cli\n\nGot it. Thanks for the context!call1: What is TypeScript?, call2: What is JavaScript?",
        },
      ];

      const stream = client.sendMessageStream(
        complexRequest,
        new AbortController().signal,
        'test-prompt-complex',
      );

      // Consume the stream
      for await (const _ of stream) {
        // consume stream
      }

      // Assert - This should pass if the regex correctly handles complex context
      expect(mockLogConcurrentSyntaxDetected).toHaveBeenCalledTimes(1);
      expect(mockLogConcurrentSyntaxDetected).toHaveBeenCalledWith(
        expect.any(Object), // config
        expect.objectContaining({
          'event.name': 'concurrent_syntax_detected',
          prompt_id: 'test-prompt-complex',
          call_count: 2,
          calls: [
            { id: 'call1', prompt: 'What is TypeScript?' },
            { id: 'call2', prompt: 'What is JavaScript?' },
          ],
        }),
      );
    });
  });

  describe('generateContent', () => {
    it('should use current model from config for content generation', async () => {
      const initialModel = client['config'].getModel();
      const contents = [{ role: 'user', parts: [{ text: 'test' }] }];
      const currentModel = initialModel + '-changed';

      vi.spyOn(client['config'], 'getModel').mockReturnValueOnce(currentModel);

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 1 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      await client.generateContent(contents, {}, new AbortController().signal);

      expect(mockGenerateContentFn).not.toHaveBeenCalledWith({
        model: initialModel,
        config: expect.any(Object),
        contents,
      });
      expect(mockGenerateContentFn).toHaveBeenCalledWith({
        model: currentModel,
        config: expect.any(Object),
        contents,
      });
    });
  });

  describe('tryCompressChat', () => {
    it('should use current model from config for token counting after sendMessage', async () => {
      const initialModel = client['config'].getModel();

      const mockCountTokens = vi
        .fn()
        .mockResolvedValueOnce({ totalTokens: 100000 })
        .mockResolvedValueOnce({ totalTokens: 5000 });

      const mockSendMessage = vi.fn().mockResolvedValue({ text: 'Summary' });

      const mockChatHistory = [
        { role: 'user', parts: [{ text: 'Long conversation' }] },
        { role: 'model', parts: [{ text: 'Long response' }] },
      ];

      const mockChat: Partial<GeminiChat> = {
        getHistory: vi.fn().mockReturnValue(mockChatHistory),
        setHistory: vi.fn(),
        sendMessage: mockSendMessage,
      };

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: mockCountTokens,
      };

      // mock the model has been changed between calls of `countTokens`
      const firstCurrentModel = initialModel + '-changed-1';
      const secondCurrentModel = initialModel + '-changed-2';
      vi.spyOn(client['config'], 'getModel')
        .mockReturnValueOnce(firstCurrentModel)
        .mockReturnValueOnce(secondCurrentModel);

      client['chat'] = mockChat as GeminiChat;
      client['contentGenerator'] = mockGenerator as ContentGenerator;
      client['startChat'] = vi.fn().mockResolvedValue(mockChat);

      const result = await client.tryCompressChat('prompt-id-4', true);

      expect(mockCountTokens).toHaveBeenCalledTimes(2);
      expect(mockCountTokens).toHaveBeenNthCalledWith(1, {
        model: firstCurrentModel,
        contents: mockChatHistory,
      });
      expect(mockCountTokens).toHaveBeenNthCalledWith(2, {
        model: secondCurrentModel,
        contents: expect.any(Array),
      });

      expect(result).toEqual({
        originalTokenCount: 100000,
        newTokenCount: 5000,
      });
    });
  });

  describe('handleFlashFallback', () => {
    it('should use current model from config when checking for fallback', async () => {
      const initialModel = client['config'].getModel();
      const fallbackModel = DEFAULT_GEMINI_FLASH_MODEL;

      // mock config been changed
      const currentModel = initialModel + '-changed';
      vi.spyOn(client['config'], 'getModel').mockReturnValueOnce(currentModel);

      const mockFallbackHandler = vi.fn().mockResolvedValue(true);
      client['config'].flashFallbackHandler = mockFallbackHandler;
      client['config'].setModel = vi.fn();

      const result = await client['handleFlashFallback'](
        AuthType.LOGIN_WITH_GOOGLE,
      );

      expect(result).toBe(fallbackModel);

      expect(mockFallbackHandler).toHaveBeenCalledWith(
        currentModel,
        fallbackModel,
        undefined,
      );
    });
  });

  describe('parseConcurrentSyntax', () => {
    it('should detect concurrent calls with valid syntax', () => {
      const request = [
        { text: 'call1: Analyze security, call2: Check performance' },
      ];
      const result = client['parseConcurrentSyntax'](request);
      expect(result.hasConcurrentCalls).toBe(true);
      expect(result.calls).toHaveLength(2);
      expect(result.calls[0]).toEqual({
        id: 'call1',
        prompt: 'Analyze security',
      });
      expect(result.calls[1]).toEqual({
        id: 'call2',
        prompt: 'Check performance',
      });
    });

    it('should return false when no concurrent calls are detected', () => {
      const request = [{ text: 'Regular prompt without concurrent syntax' }];
      const result = client['parseConcurrentSyntax'](request);
      expect(result.hasConcurrentCalls).toBe(false);
      expect(result.calls).toHaveLength(0);
    });

    it('should handle empty request', () => {
      const request = [{ text: '' }];
      const result = client['parseConcurrentSyntax'](request);
      expect(result.hasConcurrentCalls).toBe(false);
      expect(result.calls).toHaveLength(0);
    });

    it('should handle malformed syntax gracefully', () => {
      const request = [
        { text: 'call1 analyze security, call2 check performance' },
      ]; // Missing colons
      const result = client['parseConcurrentSyntax'](request);
      expect(result.hasConcurrentCalls).toBe(false);
      expect(result.calls).toHaveLength(0);
    });

    it('should handle single concurrent call', () => {
      const request = [{ text: 'call1: Analyze security' }];
      const result = client['parseConcurrentSyntax'](request);
      expect(result.hasConcurrentCalls).toBe(true);
      expect(result.calls).toHaveLength(1);
      expect(result.calls[0]).toEqual({
        id: 'call1',
        prompt: 'Analyze security',
      });
    });

    it('should handle complex prompts with commas', () => {
      const request = [
        {
          text: 'call1: Analyze security, performance, and reliability, call2: Check code quality, style, and best practices',
        },
      ];
      const result = client['parseConcurrentSyntax'](request);
      expect(result.hasConcurrentCalls).toBe(true);
      expect(result.calls).toHaveLength(2);
      expect(result.calls[0]).toEqual({
        id: 'call1',
        prompt: 'Analyze security, performance, and reliability',
      });
      expect(result.calls[1]).toEqual({
        id: 'call2',
        prompt: 'Check code quality, style, and best practices',
      });
    });

    it('should debug the exact acceptance test scenario', () => {
      // Test the exact text that appears in the acceptance test telemetry
      const exactAcceptanceTestText =
        'Got it. Thanks for the context!call1: What is TypeScript?, call2: What is JavaScript?';
      const request = [{ text: exactAcceptanceTestText }];

      console.log(
        'Testing exact acceptance test text:',
        JSON.stringify(exactAcceptanceTestText),
      );

      const result = client['parseConcurrentSyntax'](
        request,
        'debug-prompt-id',
      );

      console.log('parseConcurrentSyntax result:', result);

      // This test should reveal why the regex is failing
      expect(result.hasConcurrentCalls).toBe(true);
      expect(result.calls).toHaveLength(2);
      expect(result.calls[0]).toEqual({
        id: 'call1',
        prompt: 'What is TypeScript?',
      });
      expect(result.calls[1]).toEqual({
        id: 'call2',
        prompt: 'What is JavaScript?',
      });
    });

    it('should debug configuration issues in sendMessageStream flow', async () => {
      // Test the full sendMessageStream flow to debug why telemetry isn't logged in acceptance test

      // Mock telemetry logging function
      const mockLogConcurrentSyntaxDetected = vi.mocked(
        logConcurrentSyntaxDetected,
      );
      mockLogConcurrentSyntaxDetected.mockClear();

      // Debug configuration - check if these might be the issue
      console.log(
        'Config getConcurrencyEnabled:',
        client['config'].getConcurrencyEnabled(),
      );
      console.log(
        'Config getForcedProcessingMode:',
        client['config'].getForcedProcessingMode(),
      );
      console.log(
        'Config getTelemetryEnabled:',
        client['config'].getTelemetryEnabled(),
      );
      console.log('Config getDebugMode:', client['config'].getDebugMode());

      const mockStream = (async function* () {
        yield { type: 'content', value: 'Response to concurrent calls' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      // Mock StreamAggregator.mergeStreams for concurrent execution
      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        yield {
          type: 'content',
          value: 'Concurrent response',
          callId: 'call1',
          callTitle: 'What is TypeScript?',
        };
        yield {
          type: 'content',
          value: 'Concurrent response',
          callId: 'call2',
          callTitle: 'What is JavaScript?',
        };
      });

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Use the exact same prompt from acceptance test
      const concurrentRequest = [
        { text: 'call1: What is TypeScript?, call2: What is JavaScript?' },
      ];

      console.log('Testing sendMessageStream flow with concurrent request');

      const stream = client.sendMessageStream(
        concurrentRequest,
        new AbortController().signal,
        'test-prompt-debug-flow',
      );

      // Consume the stream
      for await (const _ of stream) {
        // consume stream
      }

      // Debug the results
      console.log(
        'logConcurrentSyntaxDetected call count:',
        mockLogConcurrentSyntaxDetected.mock.calls.length,
      );
      if (mockLogConcurrentSyntaxDetected.mock.calls.length > 0) {
        console.log(
          'logConcurrentSyntaxDetected calls:',
          mockLogConcurrentSyntaxDetected.mock.calls,
        );
      }

      // This should help us understand why the telemetry isn't working in the real flow
      expect(mockLogConcurrentSyntaxDetected).toHaveBeenCalledTimes(1);
    });

    it('should route to executeConcurrentStreams when concurrent calls are detected', async () => {
      // Arrange
      const mockConcurrentEvents = [
        {
          type: 'content',
          value: 'TypeScript analysis',
          callId: 'call1',
          callTitle: 'What is TypeScript?',
        },
        {
          type: 'content',
          value: 'JavaScript analysis',
          callId: 'call2',
          callTitle: 'What is JavaScript?',
        },
      ];

      // Mock executeConcurrentStreams to return test events
      const mockExecuteConcurrentStreams = vi.spyOn(
        client,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'executeConcurrentStreams' as any,
      );
      mockExecuteConcurrentStreams.mockImplementation(async function* () {
        for (const event of mockConcurrentEvents) {
          yield event;
        }
      });

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      const concurrentRequest = [
        { text: 'call1: What is TypeScript?, call2: What is JavaScript?' },
      ];

      // Act
      const stream = client.sendMessageStream(
        concurrentRequest,
        new AbortController().signal,
        'test-concurrent-routing',
      );

      const events = [];
      let finalResult: Turn | undefined;

      // Consume the stream and capture events and final result
      while (true) {
        const result = await stream.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
        events.push(result.value);
      }

      // Assert
      expect(mockExecuteConcurrentStreams).toHaveBeenCalledTimes(1);
      expect(mockExecuteConcurrentStreams).toHaveBeenCalledWith(
        [
          { id: 'call1', prompt: 'What is TypeScript?' },
          { id: 'call2', prompt: 'What is JavaScript?' },
        ],
        expect.any(Object), // signal
        'test-concurrent-routing',
      );

      // Should yield events from executeConcurrentStreams
      expect(events).toEqual(mockConcurrentEvents);

      // Should return a Turn instance
      expect(finalResult).toBeInstanceOf(Turn);

      // Should NOT call the regular Turn.run since we took the concurrent path
      expect(mockTurnRunFn).not.toHaveBeenCalled();
    });

    it('should continue with sequential path when no concurrent calls are detected', async () => {
      // Arrange
      const mockStream = (async function* () {
        yield { type: 'content', value: 'Sequential response' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      // Mock executeConcurrentStreams to ensure it's not called
      const mockExecuteConcurrentStreams = vi.spyOn(
        client,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'executeConcurrentStreams' as any,
      );

      const sequentialRequest = [{ text: 'What is TypeScript?' }]; // No concurrent syntax

      // Act
      const stream = client.sendMessageStream(
        sequentialRequest,
        new AbortController().signal,
        'test-sequential-path',
      );

      const events = [];
      let finalResult: Turn | undefined;

      // Consume the stream
      while (true) {
        const result = await stream.next();
        if (result.done) {
          finalResult = result.value;
          break;
        }
        events.push(result.value);
      }

      // Assert
      expect(mockExecuteConcurrentStreams).not.toHaveBeenCalled();
      expect(mockTurnRunFn).toHaveBeenCalledTimes(1);
      expect(mockTurnRunFn).toHaveBeenCalledWith(
        sequentialRequest,
        expect.any(Object),
      );

      expect(events).toEqual([
        { type: 'content', value: 'Sequential response' },
      ]);
      expect(finalResult).toBeInstanceOf(Turn);
    });

    it('should handle errors in concurrent path gracefully', async () => {
      // Arrange
      const mockError = new Error('Concurrent execution failed');

      // Mock executeConcurrentStreams to throw an error
      const mockExecuteConcurrentStreams = vi.spyOn(
        client,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'executeConcurrentStreams' as any,
      );
      mockExecuteConcurrentStreams.mockImplementation(async function* () {
        yield* [];
        throw mockError;
      });

      const mockChat: Partial<GeminiChat> = {
        addHistory: vi.fn(),
        getHistory: vi.fn().mockReturnValue([]),
      };
      client['chat'] = mockChat as GeminiChat;

      const mockGenerator: Partial<ContentGenerator> = {
        countTokens: vi.fn().mockResolvedValue({ totalTokens: 0 }),
        generateContent: mockGenerateContentFn,
      };
      client['contentGenerator'] = mockGenerator as ContentGenerator;

      const concurrentRequest = [
        { text: 'call1: What is TypeScript?, call2: What is JavaScript?' },
      ];

      // Act & Assert
      const stream = client.sendMessageStream(
        concurrentRequest,
        new AbortController().signal,
        'test-concurrent-error',
      );

      // Should propagate the error from executeConcurrentStreams
      await expect(async () => {
        for await (const _ of stream) {
          // consume stream
        }
      }).rejects.toThrow('Concurrent execution failed');

      expect(mockExecuteConcurrentStreams).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent syntax buried in massive context like real acceptance test', () => {
      // Create a test that mimics the real acceptance test scenario with massive context
      const massiveContext = `This is the Gemini CLI. We are setting up the context for our chat.\n  Today's date is Thursday, July 24, 2025.\n  My operating system is: linux\n  I'm currently working in the directory: /home/julius/01_Private/02_Projects/gemini-cli\n  Showing up to 200 items (files + folders). Folders or files indicated with ... contain more items not shown, were ignored, or the display limit (200 items) was reached.\n\n/home/julius/01_Private/02_Projects/gemini-cli/\n├───.editorconfig\n├───.gitattributes\n├───.gitignore\n├───.npmrc\n├───.nvmrc\n├───.prettierrc.json\n├───.roomodes\n├───CONTRIBUTING.md\n├───Dockerfile\n├───esbuild.config.js\n├───eslint.config.js\n├───GEMINI.md\n├───LICENSE\n├───Makefile\n├───package-lock.json\n├───package.json\n├───README.md\n├───ROADMAP.md\n├───tsconfig.json\n${'├───file-' + Array.from({ length: 100 }, (_, i) => i).join('.txt\n├───file-')}.txt\nGot it. Thanks for the context!call1: What is TypeScript?, call2: What is JavaScript?`;

      const request = [{ text: massiveContext }];

      console.log(
        'Testing with massive context, text length:',
        massiveContext.length,
      );
      console.log(
        'Last 200 chars:',
        JSON.stringify(massiveContext.slice(-200)),
      );

      const result = client['parseConcurrentSyntax'](
        request,
        'debug-massive-context',
      );

      console.log('parseConcurrentSyntax result with massive context:', result);

      // This test should reveal if the regex fails with massive context
      expect(result.hasConcurrentCalls).toBe(true);
      expect(result.calls).toHaveLength(2);
      expect(result.calls[0]).toEqual({
        id: 'call1',
        prompt: 'What is TypeScript?',
      });
      expect(result.calls[1]).toEqual({
        id: 'call2',
        prompt: 'What is JavaScript?',
      });
    });

    it('should handle concurrent syntax in multi-part request structure like real CLI', () => {
      // Test the actual multi-part request structure that happens in real CLI
      const environmentContext = `This is the Gemini CLI. We are setting up the context for our chat.\n  Today's date is Thursday, July 24, 2025.\n  My operating system is: linux\n  I'm currently working in the directory: /home/julius/01_Private/02_Projects/gemini-cli\n  [... massive file listing ...]`;

      const userPrompt =
        'call1: What is TypeScript?, call2: What is JavaScript?';

      // This is how the request is structured in real CLI - as separate parts
      const multiPartRequest = [
        { text: environmentContext },
        { text: userPrompt },
      ];

      console.log('Testing multi-part request structure');
      console.log('Part 1 length:', environmentContext.length);
      console.log('Part 2:', JSON.stringify(userPrompt));

      const result = client['parseConcurrentSyntax'](
        multiPartRequest,
        'debug-multipart',
      );

      console.log('Multi-part parseConcurrentSyntax result:', result);

      // This test should reveal if the issue is with multi-part request structure
      expect(result.hasConcurrentCalls).toBe(true);
      expect(result.calls).toHaveLength(2);
      expect(result.calls[0]).toEqual({
        id: 'call1',
        prompt: 'What is TypeScript?',
      });
      expect(result.calls[1]).toEqual({
        id: 'call2',
        prompt: 'What is JavaScript?',
      });
    });
  });

  describe('executeConcurrentStreams', () => {
    beforeEach(() => {
      // Reset the mock for each test
      mockStreamAggregatorMergeStreams.mockClear();
      mockTurnRunFn.mockClear();
    });

    it('should create multiple Turn instances and use StreamAggregator to merge streams', async () => {
      // Arrange
      const calls = [
        { id: 'call1', prompt: 'Analyze security' },
        { id: 'call2', prompt: 'Check performance' },
      ];
      const signal = new AbortController().signal;
      const prompt_id = 'test-concurrent-prompt';

      // Mock stream events that will be returned by StreamAggregator
      const mockAggregatedEvents = [
        {
          type: 'content',
          value: 'Security analysis complete',
          callId: 'call1',
          callTitle: 'Analyze security',
        },
        {
          type: 'content',
          value: 'Performance check complete',
          callId: 'call2',
          callTitle: 'Check performance',
        },
      ];

      // Mock StreamAggregator.mergeStreams to return our test events
      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        for (const event of mockAggregatedEvents) {
          yield event;
        }
      });

      // Mock Turn.run to return individual streams
      const mockStream1 = (async function* () {
        yield { type: 'content', value: 'Security analysis complete' };
      })();
      const mockStream2 = (async function* () {
        yield { type: 'content', value: 'Performance check complete' };
      })();

      mockTurnRunFn
        .mockReturnValueOnce(mockStream1)
        .mockReturnValueOnce(mockStream2);

      // Act
      const generator = client['executeConcurrentStreams'](
        calls,
        signal,
        prompt_id,
      );
      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      // Assert
      expect(mockTurnRunFn).toHaveBeenCalledTimes(2);
      expect(mockTurnRunFn).toHaveBeenNthCalledWith(
        1,
        [{ text: 'Analyze security' }],
        signal,
      );
      expect(mockTurnRunFn).toHaveBeenNthCalledWith(
        2,
        [{ text: 'Check performance' }],
        signal,
      );

      expect(mockStreamAggregatorMergeStreams).toHaveBeenCalledTimes(1);
      expect(mockStreamAggregatorMergeStreams).toHaveBeenCalledWith([
        mockStream1,
        mockStream2,
      ]);

      expect(events).toEqual(mockAggregatedEvents);
    });

    it('should yield enriched events with callId and callTitle from StreamAggregator', async () => {
      // Arrange
      const calls = [{ id: 'call1', prompt: 'Test prompt 1' }];
      const signal = new AbortController().signal;
      const prompt_id = 'test-enriched-events';

      // Mock enriched event from StreamAggregator
      const enrichedEvent = {
        type: 'content',
        value: 'Test response',
        callId: 'call1',
        callTitle: 'Test prompt 1',
      };

      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        yield enrichedEvent;
      });

      const mockStream = (async function* () {
        yield { type: 'content', value: 'Test response' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      // Act
      const generator = client['executeConcurrentStreams'](
        calls,
        signal,
        prompt_id,
      );
      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      // Assert
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(enrichedEvent);
      expect(events[0]).toHaveProperty('callId', 'call1');
      expect(events[0]).toHaveProperty('callTitle', 'Test prompt 1');
    });

    it('should handle multiple concurrent calls with proper Turn instance creation', async () => {
      // Arrange
      const calls = [
        { id: 'call1', prompt: 'First task' },
        { id: 'call2', prompt: 'Second task' },
        { id: 'call3', prompt: 'Third task' },
      ];
      const signal = new AbortController().signal;
      const prompt_id = 'test-multiple-calls';

      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        // Return empty generator for this test
      });

      const mockStream = (async function* () {
        yield { type: 'content', value: 'Task complete' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      // Act
      const generator = client['executeConcurrentStreams'](
        calls,
        signal,
        prompt_id,
      );
      // Consume the generator
      for await (const _ of generator) {
        // Process events
      }

      // Assert
      expect(mockTurnRunFn).toHaveBeenCalledTimes(3);

      // Verify each Turn was created with correct prompt_id format
      expect(mockTurnRunFn).toHaveBeenNthCalledWith(
        1,
        [{ text: 'First task' }],
        signal,
      );
      expect(mockTurnRunFn).toHaveBeenNthCalledWith(
        2,
        [{ text: 'Second task' }],
        signal,
      );
      expect(mockTurnRunFn).toHaveBeenNthCalledWith(
        3,
        [{ text: 'Third task' }],
        signal,
      );
    });

    it('should continue processing other streams when one stream fails (handled by StreamAggregator)', async () => {
      // Arrange
      const calls = [
        { id: 'call1', prompt: 'Failing task' },
        { id: 'call2', prompt: 'Successful task' },
      ];
      const signal = new AbortController().signal;
      const prompt_id = 'test-error-handling';

      // Mock StreamAggregator to handle the error and continue with other streams
      const mockEvents = [
        {
          type: 'error',
          value: { error: { message: 'Error in call call1: Stream error' } },
          callId: 'call1',
          callTitle: 'Failing task',
        },
        {
          type: 'content',
          value: 'Success response',
          callId: 'call2',
          callTitle: 'Successful task',
        },
      ];

      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      });

      const mockStream = (async function* () {
        yield { type: 'content', value: 'Response' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      // Act
      const generator = client['executeConcurrentStreams'](
        calls,
        signal,
        prompt_id,
      );
      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      // Assert - Should not crash and should process both events
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('error');
      expect(events[0].callId).toBe('call1');
      expect(events[1].type).toBe('content');
      expect(events[1].callId).toBe('call2');
    });

    it('should pass signal to all Turn instances for proper cancellation support', async () => {
      // Arrange
      const calls = [{ id: 'call1', prompt: 'Cancellable task' }];
      const abortController = new AbortController();
      const signal = abortController.signal;
      const prompt_id = 'test-cancellation';

      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        // Empty generator
      });

      const mockStream = (async function* () {
        yield { type: 'content', value: 'Response' };
      })();
      mockTurnRunFn.mockReturnValue(mockStream);

      // Act
      const generator = client['executeConcurrentStreams'](
        calls,
        signal,
        prompt_id,
      );
      for await (const _ of generator) {
        // Process events
      }

      // Assert
      expect(mockTurnRunFn).toHaveBeenCalledWith(
        [{ text: 'Cancellable task' }],
        signal,
      );
    });

    it('should handle empty calls array gracefully', async () => {
      // Arrange
      const calls: Array<{ id: string; prompt: string }> = [];
      const signal = new AbortController().signal;
      const prompt_id = 'test-empty-calls';

      mockStreamAggregatorMergeStreams.mockImplementation(async function* () {
        // Empty generator
      });

      // Act
      const generator = client['executeConcurrentStreams'](
        calls,
        signal,
        prompt_id,
      );
      const events = [];
      for await (const event of generator) {
        events.push(event);
      }

      // Assert
      expect(mockTurnRunFn).not.toHaveBeenCalled();
      expect(mockStreamAggregatorMergeStreams).toHaveBeenCalledWith([]);
      expect(events).toHaveLength(0);
    });
  });

  describe('buildRequestFromCall', () => {
    it('should build a PartListUnion from a concurrent call', () => {
      // Arrange
      const call = { id: 'call1', prompt: 'Test prompt for building request' };

      // Act
      const result = client['buildRequestFromCall'](call);

      // Assert
      expect(result).toEqual([{ text: 'Test prompt for building request' }]);
    });

    it('should handle empty prompt', () => {
      // Arrange
      const call = { id: 'call1', prompt: '' };

      // Act
      const result = client['buildRequestFromCall'](call);

      // Assert
      expect(result).toEqual([{ text: '' }]);
    });

    it('should handle complex prompt with special characters', () => {
      // Arrange
      const call = {
        id: 'call1',
        prompt: 'Analyze code: function test() { return "hello, world!"; }',
      };

      // Act
      const result = client['buildRequestFromCall'](call);

      // Assert
      expect(result).toEqual([
        { text: 'Analyze code: function test() { return "hello, world!"; }' },
      ]);
    });
  });
});
