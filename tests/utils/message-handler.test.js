/**
 * Tests for the message handler utilities
 */

import {
    safeParseJson,
    safeStringifyJson,
    createJsonRpcResponse,
    createJsonRpcErrorResponse,
    handleMissingMethod
} from '../../mcp-server/src/utils/message-handler.js';

describe('Message Handler Utilities', () => {
    describe('safeParseJson', () => {
        test('should parse valid JSON', () => {
            const json = '{"key": "value"}';
            const result = safeParseJson(json);
            expect(result).toEqual({ key: 'value' });
        });

        test('should handle JSON with BOM character', () => {
            // Add BOM character (0xFEFF) at the beginning
            const json = '\uFEFF{"key": "value"}';
            const result = safeParseJson(json);
            expect(result).toEqual({ key: 'value' });
        });

        test('should handle JSON with extra whitespace', () => {
            const json = '  \n  {"key": "value"}  \n  ';
            const result = safeParseJson(json);
            expect(result).toEqual({ key: 'value' });
        });

        test('should handle invalid JSON by returning null', () => {
            const json = '{"key": value}'; // Missing quotes around value
            const result = safeParseJson(json);
            expect(result).toBeNull();
        });
    });

    describe('safeStringifyJson', () => {
        test('should stringify valid objects', () => {
            const obj = { key: 'value' };
            const result = safeStringifyJson(obj);
            expect(result).toBe('{"key":"value"}');
        });

        test('should handle circular references', () => {
            const obj = { key: 'value' };
            obj.circular = obj; // Create circular reference
            const result = safeStringifyJson(obj);
            expect(result).toContain('Circular Reference');
        });
    });

    describe('createJsonRpcResponse', () => {
        test('should create a valid JSON-RPC response', () => {
            const id = 123;
            const result = { success: true };
            const response = createJsonRpcResponse(id, result);
            const parsed = JSON.parse(response);
            
            expect(parsed).toEqual({
                jsonrpc: '2.0',
                id: 123,
                result: { success: true }
            });
        });
    });

    describe('createJsonRpcErrorResponse', () => {
        test('should create a valid JSON-RPC error response', () => {
            const id = 123;
            const code = -32600;
            const message = 'Invalid Request';
            const response = createJsonRpcErrorResponse(id, code, message);
            const parsed = JSON.parse(response);
            
            expect(parsed).toEqual({
                jsonrpc: '2.0',
                id: 123,
                error: {
                    code: -32600,
                    message: 'Invalid Request'
                }
            });
        });

        test('should include data if provided', () => {
            const id = 123;
            const code = -32600;
            const message = 'Invalid Request';
            const data = { details: 'Additional error details' };
            const response = createJsonRpcErrorResponse(id, code, message, data);
            const parsed = JSON.parse(response);
            
            expect(parsed).toEqual({
                jsonrpc: '2.0',
                id: 123,
                error: {
                    code: -32600,
                    message: 'Invalid Request',
                    data: { details: 'Additional error details' }
                }
            });
        });
    });
});
