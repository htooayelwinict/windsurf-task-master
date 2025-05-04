import { jest } from '@jest/globals';
import { logger } from '../../mcp-server/src/utils/logger.js';

describe('Logger', () => {
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        // Spy on console methods
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        // Restore console methods
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    test('should log error messages', () => {
        const message = 'Test error message';
        const metadata = { key: 'value' };
        
        logger.error(message, metadata);
        
        expect(consoleErrorSpy).toHaveBeenCalled();
        const loggedArgs = consoleErrorSpy.mock.calls[0];
        expect(loggedArgs[0]).toContain(message);
    });

    test('should log info messages', () => {
        const message = 'Test info message';
        const metadata = { key: 'value' };
        
        logger.info(message, metadata);
        
        expect(consoleLogSpy).toHaveBeenCalled();
        const loggedArgs = consoleLogSpy.mock.calls[0];
        expect(loggedArgs[0]).toContain(message);
    });



    test('should include metadata in log messages', () => {
        const message = 'Test message with metadata';
        const metadata = { userId: 123, action: 'test' };
        
        logger.info(message, metadata);
        
        expect(consoleLogSpy).toHaveBeenCalled();
        const loggedArgs = consoleLogSpy.mock.calls[0];
        const loggedMessage = loggedArgs[0];
        
        // Check that metadata is included in the log
        expect(loggedMessage).toContain('userId');
        expect(loggedMessage).toContain('123');
        expect(loggedMessage).toContain('action');
        expect(loggedMessage).toContain('test');
    });
});
